# Muse AI instructions

## Instructions to manage cat records

### Record identity and location

- Each cat record has a unique, permanent `id` in `YYMMDD-name` format.
  The date is the record's creation date, not the cat's birth date.
  For example, Luna's record created on November 19, 2026 is `261119-luna`.
- Use a lowercase name slug containing letters, digits, and separating hyphens.
  Check existing IDs before creating a record. If the ID already belongs to a
  different cat, append a numeric suffix, such as `261119-luna-2`. Never overwrite
  an existing record just because its name matches.
- Store each record under `repository/<id>/`. Its `cat.json` file must contain
  an `id` exactly matching the folder name.
- Keep the ID and folder name unchanged when updating a record, including when
  changing the cat's display name. This preserves existing links.
- The cat's details URI contains its ID: `/cats/<id>/`. On the current GitHub
  Pages site, an example is
  `https://kevber-ms.github.io/catbreeder/cats/261119-luna/`.

### Metadata and photos

A record consists of `cat.json` and locally stored image files in the same folder:

```text
repository/
  261119-luna/
    cat.json
    portrait.jpg
    playing.jpg
```

Example `cat.json`:

```json
{
  "id": "261119-luna",
  "name": "Luna",
  "description": "A gentle cat who enjoys quiet company.",
  "isActive": true,
  "images": ["portrait.jpg", "playing.jpg"],
  "activeImage": "portrait.jpg"
}
```

- `name` and `description` are required, nonempty strings.
- `isActive` is a required boolean (`true` or `false`, not a quoted string).
  It controls whether the cat is published. Only active cats appear in the list;
  inactive cats' details and images are also unavailable on the site.
  - `isSold` is an optional boolean (`true` or `false`, not a quoted string)
- `images` is a required, nonempty array of local filenames. Every listed file
  must exist in the cat's folder. Do not use URLs, absolute paths, subdirectories,
  or `..` path segments.
- Image filenames must start with an ASCII letter or digit and contain only
  letters, digits, dots, underscores, and hyphens. Supported extensions are
  `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, and `.gif`.
  Preserve the filename's exact capitalization.
- `activeImage` is the required filename of the single main/default photo and
  must be present in `images`, even for an inactive record.
  It is distinct from the cat's `isActive` flag.
- The list displays the `activeImage`. The details page renders every image
  listed in `images`, with the main photo first. Unlisted image files are not
  published. The filename array and `activeImage` are not shown as metadata.
- Additional metadata fields are allowed. Preserve existing fields unless the
  requested update changes or removes them. They are displayed publicly on
  active cats' details pages, including fields named `internalNotes`.
  Do not store confidential information in these records.

### Create

1. Gather the cat's name, description, photos, main-photo selection, and intended
   publication status. Do not invent missing information.
2. Choose a unique creation-date-based ID and verify that no existing record
   uses it.
3. Prepare the complete folder outside `repository`, including all photos and
   valid metadata. Move it into `repository/<id>/` only when complete so the
   site does not read a partially created record.
4. If the record is not ready to publish, set `isActive` to `false`. Inactive
   records must still satisfy the metadata requirements above. Set it to `true`
   only when the cat is ready and all listed photos exist.

### Read

- Discover records by enumerating the folders in `repository` and reading their
  `cat.json` files. Do not hardcode cat names, IDs, counts, or image lists.
- Use the exact ID to identify a record for updates or deletion; names alone
  are not unique. Inspect inactive records as well when managing the catalog.

### Update

- Read the existing metadata first and change only the requested fields.
  Preserve the record's ID, folder name, and unrelated photos and metadata.
- To add photos, save the files before adding their filenames to `images`.
- To change the main photo, set `activeImage` to an existing entry in `images`.
- To remove a photo, remove its entry from `images` and delete only that
  record's corresponding file. If it was the main photo, select another
  remaining image in the same update. Do not leave `images` empty.
- To hide or republish a record, change `isActive` to `false` or `true`.

### Delete

- For a request to hide, deactivate, or mark a cat unavailable, set `isActive`
  to `false`; retain its record and photos.
- For an explicit request to permanently delete a record, verify its ID and
  delete only `repository/<id>/` and its contents. Do not delete the repository
  folder, use broad deletion patterns, or modify other cats.

### Validate and publish

- Run `npm run build` after CRUD operations to validate the repository and
  generate the static site. Fix any invalid metadata or missing listed images;
  do not silently skip broken records. Invalid inactive metadata can also fail
  validation.
- Do not manually edit generated `dist` files or hardcode catalog entries in
  application code or tests. The build discovers the current records.
- Commit and push intended source changes to `main` when authorized to publish.
  GitHub Actions rebuilds and deploys the site. Local edits alone do not update
  GitHub Pages; confirm the deployment succeeds before reporting changes live.
- Deactivating or deleting a record removes its published pages and images
  after a successful deployment, not immediately. Previously downloaded files
  and Git history are not erased by this operation.
- The local Node.js server reads current records on each request; GitHub Pages
  serves a built snapshot. There is no Google Drive integration or web admin
  interface at present.
- Raw metadata and inactive records are excluded from the generated site, but
  files committed to a public GitHub repository are still publicly accessible
  in source control.
