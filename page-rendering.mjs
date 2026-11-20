const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export function renderCats(cats) {
  const cards = cats.map((cat) => `
        <article class="cat-card">
          <a href="/cats/${cat.id}" aria-label="View ${escapeHtml(cat.name)}">
            <img src="/cats/${cat.id}/images/${encodeURIComponent(cat.activeImage)}"
              alt="${escapeHtml(cat.name)}" width="480" height="360">
            <div class="cat-details">
              <p class="eyebrow">Available</p>
              <h2>${escapeHtml(cat.name)}</h2>
              <p>${escapeHtml(cat.description)}</p>
            </div>
          </a>
        </article>`).join("");
  return renderPage({
    title: "Available cats",
    description: "Meet the cats currently available at Sveta's Cats.",
    backHref: "/",
    backLabel: "Back to home",
    content: `<main class="container listing" id="main">
      <p class="eyebrow">Find your new little companion</p>
      <h1>Available <span>today</span></h1>
      <p class="listing-intro">Meet the cats currently available at Sveta's Cats. Each one has a personality all their own.</p>
      ${cats.length
        ? `<div class="cat-grid">${cards}\n      </div>`
        : '<p class="empty-state">No cats are available right now. Please check back soon.</p>'}
    </main>`,
  });
}

export function renderCat(cat) {
  const images = [cat.activeImage, ...cat.images.filter((image) => image !== cat.activeImage)];
  const gallery = images.map((image, index) => `
        <figure>
          <a href="/cats/${cat.id}/images/${encodeURIComponent(image)}"
            aria-label="View full-size photo ${index + 1} of ${escapeHtml(cat.name)}">
            <img src="/cats/${cat.id}/images/${encodeURIComponent(image)}"
              alt="${escapeHtml(cat.name)} - photo ${index + 1}" width="480" height="360">
          </a>
          <figcaption>Photo ${index + 1}${index === 0 ? " &middot; Main photo" : ""}</figcaption>
        </figure>`).join("");
  const metadata = Object.entries(cat)
    .filter(([key]) => !["name", "description", "images", "activeImage"].includes(key))
    .map(([key, value]) => `
        <div>
          <dt>${escapeHtml(key)}</dt>
          <dd><pre>${escapeHtml(typeof value === "object" ? JSON.stringify(value, null, 2) : String(value))}</pre></dd>
        </div>`).join("");
  return renderPage({
    title: cat.name,
    description: cat.description,
    backHref: "/cats",
    backLabel: "Back to available cats",
    content: `<main class="container cat-profile" id="main">
      <p class="eyebrow">Meet your new little companion</p>
      <h1>${escapeHtml(cat.name)}</h1>
      <p class="profile-description">${escapeHtml(cat.description)}</p>
      <section aria-labelledby="photos-title">
        <h2 id="photos-title">Photos</h2>
        <div class="cat-gallery">${gallery}
        </div>
      </section>
      <section class="profile-metadata" aria-labelledby="metadata-title">
        <h2 id="metadata-title">More about ${escapeHtml(cat.name)}</h2>
        <dl>${metadata}
        </dl>
      </section>
    </main>`,
  });
}

function renderPage({ title, description, backHref, backLabel, content }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#faf7f0">
    <title>${escapeHtml(title)} | Sveta's Cats</title>
    <link rel="stylesheet" href="/site.css">
  </head>
  <body>
    <header class="container">
      <a class="brand" href="/">Sveta's Cats<span>.</span></a>
      <nav aria-label="Main navigation"><a href="${backHref}">${backLabel}</a></nav>
    </header>
    ${content}
    <footer class="container">
      <span>Sveta's Cats</span>
      <span>A sample site, made for the love of cats.</span>
    </footer>
  </body>
</html>`;
}
