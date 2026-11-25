import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createSiteServer } from "./server.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "svetas-cats-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repository = join(root, "repository");
  await cp(fileURLToPath(new URL("./repository", import.meta.url)), repository, { recursive: true });
  const server = createSiteServer(repository);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return {
    repository,
    get: (path) => fetch(`http://127.0.0.1:${server.address().port}${path}`),
    async update(id, changes) {
      const path = join(repository, id, "cat.json");
      const metadata = JSON.parse(await readFile(path, "utf8"));
      await writeFile(path, JSON.stringify({ ...metadata, ...changes }));
    },
  };
}

test("private files, inactive cats, and unlisted images are not public", async (t) => {
  const { get, repository } = await fixture(t);
  await writeFile(join(repository, "261119-milo", "unlisted.svg"), "<svg/>");
  for (const path of [
    "/repository",
    "/repository/261119-milo/cat.json",
    "/repository/261119-milo/portrait.svg",
    "/repository/261119-milo/portrait.jpg",
    "/repository/261119-oliver/portrait.svg",
    "/cats/261119-oliver",
    "/cats/261119-oliver/",
    "/cats/261119-unknown",
    "/cats/milo",
    "/cats/261119-oliver/images/portrait.svg",
    "/cats/261119-milo/images/unlisted.svg",
    "/cats/261119-milo/images/portrait.svg",
    "/cats/261119-milo/images/cat.json",
    "/cats/261119-milo/images/%2e%2e%2fcat.json",
    "/cats/261119-milo/images/..%5ccat.json",
    "/.git/config",
    "/server.mjs",
    "/cat-repository.mjs",
    "/page-rendering.mjs",
    "/package.json",
    "/README.md",
  ]) {
    const response = await get(path);
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), "Not found.");
  }
});

test("repository edits change the selected image and availability without restarting", async (t) => {
  const { get, update } = await fixture(t);
  await update("261119-milo", { activeImage: "playtime.jpg" });
  assert.match(await (await get("/cats")).text(), /\/cats\/261119-milo\/images\/playtime\.jpg/);
  const selected = await get("/cats/261119-milo/images/playtime.jpg");
  assert.equal(selected.status, 200);
  await selected.text();
  const otherImage = await get("/cats/261119-milo/images/portrait.jpg");
  assert.equal(otherImage.status, 200);
  await otherImage.text();
  const detail = await get("/cats/261119-milo");
  assert.equal(detail.status, 200);
  const detailImages = [...(await detail.text()).matchAll(/<img src="([^"]+)"/g)];
  assert.equal(detailImages[0][1], "/cats/261119-milo/images/playtime.jpg");

  await update("261119-milo", { isActive: false });
  assert.ok(!(await (await get("/cats")).text()).includes("<h2>Milo</h2>"));
  assert.equal((await get("/cats/261119-milo/images/playtime.jpg")).status, 404);
  assert.equal((await get("/cats/261119-milo/images/portrait.jpg")).status, 404);
  assert.equal((await get("/cats/261119-milo")).status, 404);
});

test("sold cats are marked sold in listings and details", async (t) => {
  const { get, update } = await fixture(t);
  await update("261119-milo", { isSold: true });
  const listing = await get("/cats");
  assert.equal(listing.status, 200);
  const listingHtml = await listing.text();
  assert.ok(listingHtml.includes('<span class="availability sold">Sold</span>'));
  assert.ok(listingHtml.includes('<span class="availability">Looking for a home</span>'));
  const detail = await get("/cats/261119-milo");
  assert.equal(detail.status, 200);
  const detailHtml = await detail.text();
  assert.ok(detailHtml.includes("<dt>Availability</dt><dd>Sold</dd>"));
  assert.ok(!detailHtml.includes("<dt>isSold</dt>"));
});

test("cats added and removed at runtime update listings, details, and images without restarting", async (t) => {
  const { get, repository } = await fixture(t);
  await rm(repository, { recursive: true });
  await mkdir(repository);
  const id = `261119-new-${randomUUID()}`;
  const detailPath = `/cats/${id}`;
  const imagePath = `${detailPath}/images/new-photo.svg`;
  assert.match(await (await get("/cats")).text(), /No cats are available right now/);
  assert.equal((await get(detailPath)).status, 404);
  assert.equal((await get(imagePath)).status, 404);

  const folder = join(repository, id);
  await mkdir(folder);
  const image = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
  await writeFile(join(folder, "new-photo.svg"), image);
  await writeFile(join(folder, "cat.json"), JSON.stringify({
    id,
    name: "New arrival",
    description: "Added after the server started.",
    isActive: true,
    images: ["new-photo.svg"],
    activeImage: "new-photo.svg",
    favoriteToy: "Feathers",
  }));
  const listing = await get("/cats");
  assert.equal(listing.status, 200);
  const html = await listing.text();
  assert.equal((html.match(/<article /g) ?? []).length, 1);
  assert.ok(html.includes(`href="${detailPath}"`));
  const detail = await get(detailPath);
  assert.equal(detail.status, 200);
  const detailHtml = await detail.text();
  assert.ok(detailHtml.includes("<h1>New arrival</h1>"));
  assert.ok(detailHtml.includes("Added after the server started."));
  assert.ok(detailHtml.includes("<dt>favoriteToy</dt>"));
  assert.ok(detailHtml.includes("<pre>Feathers</pre>"));
  assert.ok(detailHtml.includes(`src="${imagePath}"`));
  const photo = await get(imagePath);
  assert.equal(photo.status, 200);
  assert.equal(await photo.text(), image);

  await rm(folder, { recursive: true });
  const afterRemoval = await get("/cats");
  assert.equal(afterRemoval.status, 200);
  assert.match(await afterRemoval.text(), /No cats are available right now/);
  assert.equal((await get(detailPath)).status, 404);
  assert.equal((await get(imagePath)).status, 404);
});

test("detail pages render images as a gallery and omit image metadata fields", async (t) => {
  const { get, update } = await fixture(t);
  await update("261119-milo", {
    ageMonths: 0,
    vaccinated: false,
    traits: ["gentle", "curious"],
    health: { checked: true },
    adoptionFee: null,
  });
  for (const path of ["/cats/261119-milo", "/cats/261119-milo/"]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes("<h1>Milo</h1>"));
    assert.ok(html.includes("A curious ginger boy who loves chasing ribbons"));
    assert.ok(html.includes('href="/cats">Back to available cats</a>'));
    for (const key of ["id", "isActive", "internalNotes",
      "ageMonths", "vaccinated", "traits", "health", "adoptionFee"]) {
      assert.ok(html.includes(`<dt>${key}</dt>`), key);
    }
    assert.ok(!html.includes("<dt>images</dt>"));
    assert.ok(!html.includes("<dt>activeImage</dt>"));
    assert.ok(!html.includes("<pre>portrait.jpg</pre>"));
    for (const value of ["261119-milo", "Dummy record. Replace with real details before publishing.",
      "<pre>0</pre>", "<pre>false</pre>", "<pre>null</pre>", "&quot;gentle&quot;", "&quot;checked&quot;: true"]) {
      assert.ok(html.includes(value), value);
    }
    const imageUrls = [...html.matchAll(/<img src="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(imageUrls, [
      "/cats/261119-milo/images/portrait.jpg",
      "/cats/261119-milo/images/playtime.jpg",
    ]);
    for (const url of imageUrls) {
      const image = await get(url);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get("Content-Type"), "image/jpeg");
      assert.equal(new DataView(await image.arrayBuffer()).getUint16(0), 0xffd8);
    }
  }
});

test("an empty repository shows an explicit empty state", async (t) => {
  const { repository, get } = await fixture(t);
  await rm(repository, { recursive: true });
  await mkdir(repository);
  const response = await get("/cats");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /No cats are available right now/);
  assert.ok(!html.includes("<article"));
});

test("a single-photo profile keeps its main photo without an empty additional gallery", async (t) => {
  const { get, update } = await fixture(t);
  await update("261119-milo", { images: ["portrait.jpg"], activeImage: "portrait.jpg" });
  const response = await get("/cats/261119-milo");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal((html.match(/<img /g) ?? []).length, 1);
  assert.ok(html.includes('class="profile-photo" href="/cats/261119-milo/images/portrait.jpg"'));
  assert.ok(!html.includes('class="cat-gallery"'));
  assert.ok(html.includes('id="metadata-title"'));
});

test("local typography is served under the existing same-origin content policy", async (t) => {
  const { get } = await fixture(t);
  const response = await get("/site.css");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Security-Policy"), /font-src 'self'/);
  const stylesheet = await response.text();
  for (const [, value] of stylesheet.matchAll(/url\("([^"]+)"\)/g)) {
    const font = await get(`/${value}`);
    assert.equal(font.status, 200, value);
    assert.equal(font.headers.get("Content-Type"), "font/ttf");
    assert.equal(new DataView(await font.arrayBuffer()).getUint32(0), 0x00010000);
  }
  assert.equal((await get("/fonts/unlisted.ttf")).status, 404);
});

test("the photographic home theme serves its hero image locally", async (t) => {
  const { get } = await fixture(t);
  const response = await get("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  const [, imagePath] = html.match(/<img src="([^"]+)"/);
  const image = await get(`/${imagePath}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("Content-Type"), "image/jpeg");
  assert.equal(new DataView(await image.arrayBuffer()).getUint16(0), 0xffd8);
  assert.equal((await get("/assets/unlisted.jpg")).status, 404);
});

test("cat names and descriptions are escaped rather than interpreted as markup", async (t) => {
  const { get, update } = await fixture(t);
  await update("261119-milo", {
    name: 'Milo <script>alert("cat")</script>',
    description: '<img src=x onerror="alert(1)"> & cuddles',
    '<script>key</script>': { note: '<script>value</script>' },
  });
  for (const path of ["/cats", "/cats/261119-milo"]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes("Milo &lt;script&gt;alert(&quot;cat&quot;)&lt;/script&gt;"));
    assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; cuddles"));
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img src=x"));
    if (path !== "/cats") {
      assert.ok(html.includes("<dt>&lt;script&gt;key&lt;/script&gt;</dt>"));
      assert.ok(html.includes("&lt;script&gt;value&lt;/script&gt;"));
    }
  }
});

test("invalid metadata fails explicitly instead of exposing files or dropping cats", async (t) => {
  const { get, update } = await fixture(t);
  const errors = t.mock.method(console, "error", () => {});
  for (const changes of [
    { isActive: "false" },
    { isSold: "yes" },
    { isActive: true, activeImage: "../cat.json", images: ["../cat.json"] },
    { activeImage: "missing.svg", images: ["portrait.jpg"] },
  ]) {
    await update("261119-milo", changes);
    const response = await get("/cats");
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "We couldn't load this page. Please try again later.");
  }
  assert.equal(errors.mock.callCount(), 4);
});

test("unreadable repository data and missing images return logged errors", async (t) => {
  const { get, repository } = await fixture(t);
  const errors = t.mock.method(console, "error", () => {});
  await rm(join(repository, "261119-milo", "portrait.jpg"));
  assert.equal((await get("/cats/261119-milo/images/portrait.jpg")).status, 500);
  await writeFile(join(repository, "261119-milo", "cat.json"), "{ broken json");
  assert.equal((await get("/cats")).status, 500);
  await rm(repository, { recursive: true });
  assert.equal((await get("/cats")).status, 500);
  assert.equal(errors.mock.callCount(), 3);
});

test("metadata IDs must be present and match their folder names", async (t) => {
  const { get, update } = await fixture(t);
  const errors = t.mock.method(console, "error", () => {});
  for (const id of [undefined, "261118-milo", 261119]) {
    await update("261119-milo", { id });
    const response = await get("/cats");
    assert.equal(response.status, 500);
    await response.text();
  }
  assert.equal(errors.mock.callCount(), 3);
});

test("folder IDs require a six-digit creation-date prefix", async (t) => {
  const { get, repository, update } = await fixture(t);
  const errors = t.mock.method(console, "error", () => {});
  for (const id of ["milo", "20261119-milo", "261119-Milo"]) {
    await update("261119-milo", { id });
    await rename(join(repository, "261119-milo"), join(repository, id));
    const response = await get("/cats");
    assert.equal(response.status, 500);
    await response.text();
    await rename(join(repository, id), join(repository, "261119-milo"));
  }
  assert.equal(errors.mock.callCount(), 3);
});

test("same-name cats created on different dates have distinct image routes", async (t) => {
  const { get, repository, update } = await fixture(t);
  await cp(join(repository, "261119-luna"), join(repository, "261118-luna"), { recursive: true });
  await update("261118-luna", { id: "261118-luna" });
  const response = await get("/cats");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal((html.match(/<h2>Luna<\/h2>/g) ?? []).length, 2);
  for (const id of ["261118-luna", "261119-luna"]) {
    const imagePath = `/cats/${id}/images/portrait.jpg`;
    assert.ok(html.includes(`src="${imagePath}"`));
    const image = await get(imagePath);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("Content-Type"), "image/jpeg");
    assert.equal(new DataView(await image.arrayBuffer()).getUint16(0), 0xffd8);
  }
});
