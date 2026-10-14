/* MEO Engine — deterministic page template.
 * The model NEVER writes HTML/CSS. It supplies structured content JSON
 * (see runContentRefined in generate.js); this file renders it into the
 * same polished layout every run. Consistency by construction.
 * Plain <script>-compatible: no import/export. Attaches to window.MEO.
 */
(function () {
  window.MEO = window.MEO || {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stars(rating) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    var full = Math.round(r);
    var out = '';
    for (var i = 0; i < 5; i++) out += i < full ? '★' : '☆';
    return out;
  }

  // Deterministic hero visual when no photos exist: brand gradient +
  // product initial. Always looks intentional, never broken.
  function heroSvg(brand, name) {
    var colors = (brand && brand.colors) || [];
    var c0 = colors[0] || '#1a1a1a';
    var c2 = colors[2] || colors[0] || '#888888';
    var initial = (String(name || 'M').trim()[0] || 'M').toUpperCase();
    return '<svg viewBox="0 0 640 480" role="img" aria-label="' + esc(name) + '">' +
      '<defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + esc(c0) + '"/>' +
      '<stop offset="1" stop-color="' + esc(c2) + '"/></linearGradient></defs>' +
      '<rect width="640" height="480" fill="url(#hg)"/>' +
      '<circle cx="520" cy="90" r="150" fill="#ffffff" opacity="0.12"/>' +
      '<circle cx="110" cy="400" r="110" fill="#ffffff" opacity="0.10"/>' +
      '<text x="320" y="300" text-anchor="middle" font-size="180" ' +
      'font-family="system-ui,sans-serif" font-weight="800" fill="#ffffff" opacity="0.9">' +
      esc(initial) + '</text></svg>';
  }

  // content: {headline, subhead, rating, reviews, price, cta, bullets[], specs[{k,v}], faqs[{q,a}], trust[]}
  window.MEO.buildPage = function (content, research, audit, brand) {
    content = content || {};
    research = research || {};
    audit = audit || {};
    brand = brand || {};
    var name = research.name || research.product || content.headline || 'Product';
    var images = Array.isArray(research.images) ? research.images.filter(function (u) {
      return typeof u === 'string' && /^https?:\/\//i.test(u);
    }) : [];
    var bullets = (content.bullets || []).slice(0, 6);
    var specs = (content.specs || []).slice(0, 8);
    var faqs = (content.faqs || []).slice(0, 6);
    var trust = (content.trust || []).slice(0, 3);
    while (trust.length < 3) trust.push(['Free shipping', 'Easy returns', 'Warranty included'][trust.length]);
    var score = (typeof audit.score === 'number') ? audit.score : null;

    var heroMedia = images.length
      ? '<img src="' + esc(images[0]) + '" alt="' + esc(name) + '">'
      : heroSvg(brand, name);
    var gallery = images.length > 1
      ? '<div class="gallery">' + images.slice(1).map(function (u) {
          return '<img src="' + esc(u) + '" alt="' + esc(name) + '" loading="lazy">';
        }).join('') + '</div>'
      : '';

    var ratingLine = content.rating
      ? '<p class="rating"><span class="stars">' + stars(content.rating) + '</span> ' +
        esc(content.rating) + (content.reviews ? ' · ' + esc(content.reviews) + ' reviews' : '') + '</p>'
      : '';
    var priceRow = (content.price || content.cta)
      ? '<p class="price-row">' +
        (content.price ? '<span class="price">' + esc(content.price) + '</span>' : '') +
        (content.cta ? '<a class="buy-btn" href="#">' + esc(content.cta) + '</a>' : '') + '</p>'
      : '';

    var checkSvg = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var checks = bullets.length
      ? '<ul class="checks">' + bullets.map(function (b) {
          return '<li>' + checkSvg + '<span>' + esc(b) + '</span></li>';
        }).join('') + '</ul>'
      : '';

    var specRows = specs.length
      ? '<section class="specs"><h2>Specifications</h2><table><tbody>' +
        specs.map(function (s) {
          return '<tr><th scope="row">' + esc(s.k) + '</th><td>' + esc(s.v) + '</td></tr>';
        }).join('') + '</tbody></table></section>'
      : '';

    var faqBlock = faqs.length
      ? '<section class="faq"><h2>Frequently asked questions</h2>' +
        faqs.map(function (f) {
          return '<details class="faq-item"><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';
        }).join('') + '</section>'
      : '';

    var ldProduct = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: String(name),
      description: String(content.subhead || ''),
      image: images
    };
    var ldFaq = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(function (f) {
        return {
          '@type': 'Question',
          name: String(f.q),
          acceptedAnswer: { '@type': 'Answer', text: String(f.a) }
        };
      })
    };

    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + esc(content.headline || name) + '</title>\n' +
      '<meta name="description" content="' + esc(content.subhead || '') + '">\n' +
      window.MEO.buildBrandCss(brand) + '\n' +
      '<script type="application/ld+json">' + JSON.stringify(ldProduct) + '<\/script>\n' +
      '<script type="application/ld+json">' + JSON.stringify(ldFaq) + '<\/script>\n' +
      '</head>\n<body>\n<div class="wrap">\n' +
      '<div class="site-head"><span class="mark">' + esc((String(name).trim()[0] || 'M').toUpperCase()) + '</span>' +
      '<span class="brandline">' + esc(name) + '</span>' +
      (score != null ? '<span class="geo-chip">AI-search optimized · ' + score + '/100</span>' : '') + '</div>\n' +
      '<header class="hero">\n<div class="hero-copy">\n' +
      '<h1>' + esc(content.headline || name) + '</h1>\n' +
      ratingLine +
      (content.subhead ? '<p class="sub">' + esc(content.subhead) + '</p>\n' : '') +
      checks + priceRow + '</div>\n' +
      '<div class="hero-media">' + heroMedia + '</div>\n</header>\n' +
      '<section class="proof">' + trust.map(function (t) {
        return '<div>' + esc(t) + '</div>';
      }).join('') + '</section>\n' +
      gallery + '\n' + specRows + '\n' + faqBlock + '\n' +
      '<footer>Generated with MEO Engine · ' + esc(name) + '</footer>\n' +
      '</div>\n</body>\n</html>';
  };
})();
