import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { activeCats, readCatImage } from "./cat-repository.mjs";
import { renderCat, renderCats } from "./page-rendering.mjs";

const siteRoot = dirname(fileURLToPath(import.meta.url));

export function createSiteServer(repositoryPath = join(siteRoot, "repository")) {
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    response.setHeader("Cache-Control", "no-store");
    const send = (status, type, content) => {
      response.writeHead(status, { "Content-Type": type });
      response.end(request.method === "HEAD" ? undefined : content);
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      send(405, "text/plain; charset=utf-8", "Method not allowed.");
      return;
    }
    try {
      const { pathname } = new URL(request.url, "http://localhost");
      // Only these explicit routes are public; never serve the project directory.
      if (pathname === "/" || pathname === "/index.html") {
        send(200, "text/html; charset=utf-8", await readFile(join(siteRoot, "index.html")));
      } else if (pathname === "/site.css") {
        send(200, "text/css; charset=utf-8", await readFile(join(siteRoot, "site.css")));
      } else if (pathname === "/cats" || pathname === "/cats/") {
        send(200, "text/html; charset=utf-8", renderCats(await activeCats(repositoryPath)));
      } else {
        const detailRoute = /^\/cats\/([a-z0-9-]+)\/?$/.exec(pathname);
        const imageRoute = /^\/cats\/([a-z0-9-]+)\/images\/([a-zA-Z0-9._-]+)$/.exec(pathname);
        const route = detailRoute || imageRoute;
        const cat = route && (await activeCats(repositoryPath))
          .find((item) => item.id === route[1]);
        if (!cat || (imageRoute && !cat.images.includes(imageRoute[2]))) {
          send(404, "text/plain; charset=utf-8", "Not found.");
          return;
        }
        if (detailRoute) {
          send(200, "text/html; charset=utf-8", renderCat(cat));
        } else {
          const imageName = imageRoute[2];
          const image = await readCatImage(repositoryPath, cat, imageName);
          send(200, image.contentType, image.content);
        }
      }
    } catch (error) {
      console.error("Unable to serve cat site:", error);
      send(500, "text/plain; charset=utf-8", "We couldn't load this page. Please try again later.");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  createSiteServer().listen(port, "127.0.0.1", () => {
    console.log(`Sveta's Cats is available at http://127.0.0.1:${port}`);
  });
}
