import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { buildSite } from "./build.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "svetas-static-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repositoryPath = join(root, "repository");
  await mkdir(repositoryPath);
  const outputDirectory = join(root, "dist");
  async function addCat(isActive = true) {
    const id = `261120-cat-${randomUUID()}`;
    const folder = join(repositoryPath, id);
    await mkdir(folder);
    const metadata = {
      id,
      name: "New cat",
      description: "A dynamically discovered cat.",
      isActive,
      images: ["portrait.svg", "playing.svg"],
      activeImage: "portrait.svg",
    };
    await writeFile(join(folder, "cat.json"), JSON.stringify(metadata));
    for (const image of [...metadata.images, "unlisted.svg"]) {
      await writeFile(join(folder, image), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    }
    return metadata;
  }
  return {
    repositoryPath, outputDirectory, addCat,
    build: (basePath = "") => buildSite({ repositoryPath, outputDirectory, basePath }),
  };
}

async function outputFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join("/")).sort();
}

for (const basePath of ["", "/catbreeder/"]) {
  test(`static build publishes only active cat pages and listed images at ${basePath || "/"}`, async (t) => {
    const { build, addCat, outputDirectory } = await fixture(t);
    const cat = await addCat();
    await addCat(false);
    await build(basePath);
    const files = await outputFiles(outputDirectory);
    assert.deepEqual(files, [
      ".nojekyll",
      "assets/hero-cat.jpg",
      `cats/${cat.id}/images/playing.svg`,
      `cats/${cat.id}/images/portrait.svg`,
      `cats/${cat.id}/index.html`,
      "cats/index.html",
      "fonts/dm-sans.ttf",
      "fonts/dm-sans-OFL.txt",
      "fonts/playfair-display.ttf",
      "fonts/playfair-display-italic.ttf",
      "fonts/playfair-display-OFL.txt",
      "index.html",
      "site.css",
    ].sort());

    const prefix = basePath.replace(/\/$/, "");
    const stylesheet = await readFile(join(outputDirectory, "site.css"), "utf8");
    const stylesheetUrl = new URL(`${prefix}/site.css`, "https://example.test");
    const fontUrls = [...stylesheet.matchAll(/url\("([^"]+)"\)/g)];
    assert.equal(fontUrls.length, 3);
    for (const [, value] of fontUrls) {
      const url = new URL(value, stylesheetUrl);
      assert.equal(url.origin, stylesheetUrl.origin);
      assert.ok(url.pathname.startsWith(`${prefix}/fonts/`));
      const font = await readFile(join(outputDirectory, ...url.pathname.slice(prefix.length).split("/")));
      assert.equal(font.readUInt32BE(0), 0x00010000);
    }
    for (const file of files.filter((name) => name.endsWith(".html"))) {
      const html = await readFile(join(outputDirectory, ...file.split("/")), "utf8");
      const pageUrl = new URL(`${prefix}/${file}`, "https://example.test");
      for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const url = new URL(value, pageUrl);
        assert.equal(url.origin, pageUrl.origin);
        assert.ok(url.pathname.startsWith(`${prefix}/`), value);
        const target = join(outputDirectory, ...url.pathname.slice(prefix.length).split("/"));
        const info = await stat(target);
        if (info.isDirectory()) assert.ok((await stat(join(target, "index.html"))).isFile());
        else assert.ok(info.isFile());
      }
    }
    const detail = await readFile(join(outputDirectory, "cats", cat.id, "index.html"), "utf8");
    assert.match(detail, /<h1>New cat<\/h1>/);
    assert.equal((detail.match(/<img /g) ?? []).length, 2);
    assert.ok(!detail.includes("<dt>images</dt>"));
    assert.ok(!detail.includes("<dt>activeImage</dt>"));
  });
}

test("rebuilding discovers new records and removes stale pages and images", async (t) => {
  const { build, addCat, repositoryPath, outputDirectory } = await fixture(t);
  const removed = await addCat();
  await build();
  const added = await addCat();
  await rm(join(repositoryPath, removed.id), { recursive: true });
  await build();
  let files = await outputFiles(outputDirectory);
  assert.ok(files.includes(`cats/${added.id}/index.html`));
  assert.ok(!files.some((file) => file.includes(removed.id)));
  const listing = await readFile(join(outputDirectory, "cats", "index.html"), "utf8");
  assert.ok(listing.includes(`/cats/${added.id}`));
  assert.ok(!listing.includes(removed.id));

  await writeFile(join(repositoryPath, added.id, "cat.json"), JSON.stringify({ ...added, isActive: false }));
  await build();
  files = await outputFiles(outputDirectory);
  assert.ok(!files.some((file) => file.includes(added.id)));
  assert.match(await readFile(join(outputDirectory, "cats", "index.html"), "utf8"), /No cats are available right now/);
});

test("missing published images fail the build instead of silently publishing broken galleries", async (t) => {
  const { build, addCat, repositoryPath } = await fixture(t);
  const cat = await addCat();
  await rm(join(repositoryPath, cat.id, "playing.svg"));
  await assert.rejects(build(), { code: "ENOENT" });
});

test("invalid base paths fail before deleting the previous build", async (t) => {
  const { build, outputDirectory } = await fixture(t);
  await build();
  for (const path of ["https://example.test", "/../repository", '/cat"bad', "/cat//breeder"]) {
    await assert.rejects(build(path), /BASE_PATH/);
  }
  assert.ok((await stat(join(outputDirectory, "index.html"))).isFile());
});
