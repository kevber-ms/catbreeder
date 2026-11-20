# Sveta's Cats

A dependency-free sample cat breeder site with a local Node.js server and a
static build for GitHub Pages. Requires Node.js 22 or newer for development
and building; the published static site does not need a server.

## Deploy to GitHub Pages

1. Commit and push these changes to `main`.
2. In the GitHub repository, open **Settings > Pages** and set **Source** to
   **GitHub Actions**. Do not select deployment from the repository root.
3. Open **Actions > Deploy to GitHub Pages** and run the workflow, or push a
   new commit to `main`.
4. After the deployment succeeds, open <https://kevber-ms.github.io/catbreeder/>.

The workflow tests the site, generates `dist`, and deploys **only that folder**.
It obtains the URL base path from GitHub Pages, so `/catbreeder/` project URLs
and root-domain deployments both work. Only active cats and their listed images
are included. Raw `cat.json` files, inactive cats, unlisted images, source code,
and server files are not included in the Pages artifact.

The static site is a snapshot: adding, editing, hiding, or removing cats requires
a rebuild and deployment. Commit repository changes and push to `main` to trigger
this automatically. There is no admin interface or Google Drive integration yet.
Files in a public GitHub source repository remain public independently of Pages.

## Build static content locally

```sh
npm run build
```

This generates a clean `dist` directory for hosting at `/`. For a project site,
set `BASE_PATH` before building. For example, in PowerShell:

```powershell
$env:BASE_PATH = "/catbreeder"
npm run build
Remove-Item Env:BASE_PATH
```

Serve only `dist` using a static web server; when building for `/catbreeder`,
mount it at that URL prefix. Listing and detail pages are written as directory
`index.html` files, so direct links and reloads work without SPA rewrite rules.
Do not upload the repository root or use it as the public static directory.

## Run the dynamic server locally

```sh
npm start
```

Open <http://127.0.0.1:3000>. Set `PORT` to use another port.
Use this server rather than opening the HTML directly or serving the project
with a generic static file server: the cat list is rendered on the server,
and the repository must not be a public static directory.

## Code structure

- `server.mjs`: HTTP routing, response headers, error handling, and startup.
- `cat-repository.mjs`: dynamic repository discovery, metadata validation,
  active-cat filtering, and protected image-file access.
- `page-rendering.mjs`: listing and detail-page HTML, shared layout, and escaping.
- `build.mjs`: static page generation and copying only published images to `dist`.
- `.github/workflows/pages.yml`: tests, static build, and GitHub Pages deployment.

## Cat repository

See [Muse AI instructions](museai.md) for AI-powered record creation, updates, deletion, photo management, and publication rules.

Each cat has its own folder under `repository`, for example:

```text
repository/
  261119-milo/
    cat.json
    portrait.svg
    playtime.svg
```

Each folder name is the cat's internal ID in `YYMMDD-name` format, using the
record's creation date and a lowercase cat-name slug (letters, digits, and
separating hyphens). For example, Luna's record created on November 19, 2026
has the ID `261119-luna`. Store the same ID in the metadata; it must exactly
match the folder name. Keep the ID unchanged when editing an existing record.
The metadata format is:

```json
{
  "id": "261119-milo",
  "name": "Milo",
  "description": "A curious ginger boy.",
  "isActive": true,
  "images": ["portrait.svg", "playtime.svg"],
  "activeImage": "portrait.svg"
}
```

`name` and `description` must be nonempty strings. `isActive` must be a boolean.
`images` lists local filenames (no subdirectories), and `activeImage` must be
one of them. Supported formats: SVG, PNG, JPEG, WebP, AVIF, and GIF.
Metadata fields of active cats other than `images` and `activeImage` are displayed
publicly on their detail pages, including extra fields such as `internalNotes`.
The `images` entries are rendered as a photo gallery, not a filename list;
`activeImage` selects the main photo but is not shown as metadata. Do not put confidential
information in a record intended for publication. The internal ID is used in
detail-page and image URLs to identify the cat.
Keep real private records out of public source control; the included records
and illustrations are dummy examples.

With the local Node.js server, listings, details, and image requests read the repository on each request;
there is no hardcoded cat catalog or startup cache. Add or remove a cat folder
at runtime and the next request reflects the change without restarting.
Prepare a complete new folder outside the repository, then move it in to avoid
requests seeing partially written records.
The `/cats` page shows only cats with `isActive: true`, using each cat's selected
`activeImage`. Change the flag to remove a cat from the list. There is no
separate date-based availability rule.
Milo, Luna, and Poppy are active examples; Oliver is an inactive example.

Click a cat card to open its own `/cats/<id>` address, such as
`/cats/261119-milo`. Direct links and page reloads work at the same address.
The detail page shows its name, description, every image listed in `images`
(the active image first), and all remaining metadata except `activeImage`. Arrays and objects are
shown as formatted JSON, and metadata is escaped as text rather than HTML.

The server exposes only the home page, stylesheet, active cat listing,
active cat detail pages, and the listed images of active cats. Raw repository
files, inactive cat detail pages and images, unlisted images, and other project
files return 404. Image links are intentionally public while listed for an
active cat; they are not authenticated downloads.
Repository errors are logged on the server and return an error response,
rather than silently showing an incomplete list.

## Tests

```sh
npm test
```
