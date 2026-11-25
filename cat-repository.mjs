import { readFile, readdir, realpath } from "node:fs/promises";
import { extname, isAbsolute, join, relative, sep } from "node:path";

const imageTypes = new Map([
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
]);
const catIdPattern = /^\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const imageNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

async function privateFile(root, ...parts) {
  const resolvedRoot = await realpath(root);
  const resolvedFile = await realpath(join(root, ...parts));
  const location = relative(resolvedRoot, resolvedFile);
  if (location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) {
    throw new Error("Repository file resolves outside its cat folder.");
  }
  return readFile(resolvedFile);
}

export async function activeCats(repositoryPath) {
  const entries = await readdir(repositoryPath, { withFileTypes: true });
  const cats = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (!catIdPattern.test(entry.name)) {
      throw new Error(`Invalid cat folder name: ${entry.name}`);
    }
    const folder = join(repositoryPath, entry.name);
    const metadata = JSON.parse(await privateFile(folder, "cat.json"));
    if (
      !metadata || typeof metadata !== "object" ||
      metadata.id !== entry.name ||
      typeof metadata.name !== "string" || !metadata.name.trim() ||
      typeof metadata.description !== "string" || !metadata.description.trim() ||
      typeof metadata.isActive !== "boolean" ||
      (metadata.isSold !== undefined && typeof metadata.isSold !== "boolean") ||
      !Array.isArray(metadata.images) || metadata.images.length === 0 ||
      !metadata.images.every((image) =>
        typeof image === "string" && imageNamePattern.test(image) &&
        imageTypes.has(extname(image).toLowerCase())) ||
      !metadata.images.includes(metadata.activeImage)
    ) {
      throw new Error(`Invalid cat metadata in ${entry.name}/cat.json`);
    }
    if (metadata.isActive) {
      cats.push(metadata);
    }
  }
  return cats;
}

export async function readCatImage(repositoryPath, cat, imageName) {
  return {
    content: await privateFile(join(repositoryPath, cat.id), imageName),
    contentType: imageTypes.get(extname(imageName).toLowerCase()),
  };
}
