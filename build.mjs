import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { activeCats, readCatImage } from "./cat-repository.mjs";
import { renderCat, renderCats } from "./page-rendering.mjs";

const siteRoot = dirname(fileURLToPath(import.meta.url));

function normalizeBasePath(basePath) {
  if (
    typeof basePath !== "string" ||
    (basePath !== "" && !basePath.startsWith("/")) ||
    basePath.includes("//") ||
    basePath.split("/").some((part) =>
      part !== "" && (part === "." || part === ".." || !/^[a-zA-Z0-9._-]+$/.test(part)))
  ) {
    throw new Error("BASE_PATH must be empty or a URL path such as /catbreeder.");
  }
  return basePath.replace(/\/$/, "");
}

export async function buildSite({
  repositoryPath = join(siteRoot, "repository"),
  outputDirectory = join(siteRoot, "dist"),
  basePath = "",
} = {}) {
  basePath = normalizeBasePath(basePath);
  const output = resolve(outputDirectory);
  if (basename(output) !== "dist" || output === resolve(repositoryPath) || output === siteRoot) {
    throw new Error("Build output must be a dedicated dist directory.");
  }
  const cats = await activeCats(repositoryPath);
  await rm(output, { recursive: true, force: true });
  await mkdir(join(output, "cats"), { recursive: true });
  await writeFile(join(output, ".nojekyll"), "");
  await copyFile(join(siteRoot, "index.html"), join(output, "index.html"));
  await copyFile(join(siteRoot, "site.css"), join(output, "site.css"));
  await writeFile(join(output, "cats", "index.html"), renderCats(cats, basePath));
  for (const cat of cats) {
    const folder = join(output, "cats", cat.id);
    await mkdir(join(folder, "images"), { recursive: true });
    await writeFile(join(folder, "index.html"), renderCat(cat, basePath));
    for (const imageName of cat.images) {
      const image = await readCatImage(repositoryPath, cat, imageName);
      await writeFile(join(folder, "images", imageName), image.content);
    }
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = await buildSite({ basePath: process.env.BASE_PATH ?? "" });
  console.log(`Static site built in ${output}`);
}
