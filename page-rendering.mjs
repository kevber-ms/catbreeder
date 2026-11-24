const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export function renderCats(cats, basePath = "") {
  const cards = cats.map((cat) => `
        <article class="cat-card">
          <a class="cat-card-link" href="${basePath}/cats/${cat.id}" aria-label="View ${escapeHtml(cat.name)}">
            <div class="cat-image">
              <img src="${basePath}/cats/${cat.id}/images/${encodeURIComponent(cat.activeImage)}"
                alt="${escapeHtml(cat.name)}" width="480" height="360" loading="lazy">
              <span class="availability">Looking for a home</span>
            </div>
            <div class="cat-info">
              <div class="cat-title"><h2>${escapeHtml(cat.name)}</h2></div>
              <p>${escapeHtml(cat.description)}</p>
            </div>
            <span class="view-profile">Meet ${escapeHtml(cat.name)} <span aria-hidden="true">&rarr;</span></span>
          </a>
        </article>`).join("");
  return renderPage({
    basePath,
    title: "Available cats",
    description: "Meet the cats currently available at Sveta's Cats.",
    content: `<main class="container listing" id="main">
      <div class="collection-heading">
        <a class="back-link" href="${basePath}/">Back to our home</a>
        <p class="eyebrow">Meet your new best friend</p>
        <h1>Small paws.<br><em>Big personalities.</em></h1>
        <p>Get to know the lovely little characters looking for their forever homes.</p>
      </div>
      <div class="collection-bar"><h2>Available cats <span>${String(cats.length).padStart(2, "0")}</span></h2><span>A little love. A lifelong friend.</span></div>
      ${cats.length
        ? `<div class="cat-grid">${cards}\n      </div>`
        : '<p class="empty-state">No cats are available right now. Please check back soon.</p>'}
      <p class="listing-note">Sample profiles use illustrative photographs, not confirmed availability listings.</p>
    </main>`,
  });
}

export function renderCat(cat, basePath = "") {
  const images = cat.images.filter((image) => image !== cat.activeImage);
  const gallery = images.map((image, index) => `
        <figure>
          <a href="${basePath}/cats/${cat.id}/images/${encodeURIComponent(image)}"
            aria-label="View full-size photo ${index + 2} of ${escapeHtml(cat.name)}">
            <img src="${basePath}/cats/${cat.id}/images/${encodeURIComponent(image)}"
              alt="${escapeHtml(cat.name)} - photo ${index + 2}" width="480" height="360" loading="lazy">
          </a>
          <figcaption>Photo ${index + 2}</figcaption>
        </figure>`).join("");
  const metadata = Object.entries(cat)
    .filter(([key]) => !["name", "description", "images", "activeImage"].includes(key))
    .map(([key, value]) => `
        <div>
          <dt>${escapeHtml(key)}</dt>
          <dd><pre>${escapeHtml(typeof value === "object" ? JSON.stringify(value, null, 2) : String(value))}</pre></dd>
        </div>`).join("");
  return renderPage({
    basePath,
    title: cat.name,
    description: cat.description,
    content: `<main class="container cat-profile" id="main">
      <a class="back-link" href="${basePath}/cats">Back to available cats</a>
      <div class="cat-detail">
        <a class="profile-photo" href="${basePath}/cats/${cat.id}/images/${encodeURIComponent(cat.activeImage)}"
          aria-label="View full-size main photo of ${escapeHtml(cat.name)}">
          <img src="${basePath}/cats/${cat.id}/images/${encodeURIComponent(cat.activeImage)}"
            alt="${escapeHtml(cat.name)} - main photo" width="480" height="550">
        </a>
        <div class="detail-copy">
          <p class="eyebrow">A little love. A lifelong friend.</p>
          <h1>${escapeHtml(cat.name)}</h1>
          <dl class="detail-facts">
            <div><dt>Availability</dt><dd>Looking for a home</dd></div>
            <div><dt>Photos</dt><dd>${cat.images.length}</dd></div>
          </dl>
          <h2>A little about me</h2>
          <p class="profile-description">${escapeHtml(cat.description)}</p>
          <a class="text-link" href="#metadata-title">More about ${escapeHtml(cat.name)} <span aria-hidden="true">&rarr;</span></a>
        </div>
      </div>
      ${images.length ? `<section class="profile-photos" aria-labelledby="photos-title">
        <h2 id="photos-title">Photos</h2>
        <div class="cat-gallery">${gallery}
        </div>
      </section>` : ""}
      <section class="profile-metadata" aria-labelledby="metadata-title">
        <h2 id="metadata-title">More about ${escapeHtml(cat.name)}</h2>
        <dl>${metadata}
        </dl>
      </section>
    </main>`,
  });
}

function renderPage({ basePath, title, description, content }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#23463b">
    <title>${escapeHtml(title)} | Sveta's Cats</title>
    <link rel="stylesheet" href="${basePath}/site.css">
  </head>
  <body>
    <header class="container">
      <a class="brand" href="${basePath}/" aria-label="Sveta's Cats home">
        <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 17 7 5l11 8h4l11-8-2 12c3 4 4 8 2 12-2 5-8 7-13 7S9 34 7 29c-2-4-1-8 2-12Z"/><path d="M13 23h1m12 0h1m-9 4h4l-2 3-2-3Zm-14-3 7 2m-7 3 7-1m18-2 7-2m-7 4 7 1"/></svg>
        <span>Sveta's Cats<small>A LITTLE LOVE. A LIFELONG FRIEND.</small></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="${basePath}/">Our home</a>
        <a href="${basePath}/cats" aria-current="page">Available cats <span aria-hidden="true">&#8599;</span></a>
      </nav>
    </header>
    ${content}
    <footer class="container">
      <a href="${basePath}/">Sveta's Cats</a>
      <p>Thoughtfully raised. Wholeheartedly loved.</p>
      <span>A sample site, made for the love of cats.</span>
    </footer>
  </body>
</html>`;
}
