/* MEO Engine — Track 3b: standalone product-page generator.
 * Plain <script>-compatible: no import/export. Attaches to window.MEO.
 * chatFn: async (prompt: string) => string (raw model text). Never imports providers.
 */
(function () {
  window.MEO = window.MEO || {};

  function asList(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim()) return [val];
    return [];
  }

  function fmtKeywords(audit) {
    var kws = (audit && audit.keywords) || [];
    if (!Array.isArray(kws)) return ['(no keyword map provided)'];
    return kws.map(function (k) {
      if (typeof k === 'string') return '- ' + k;
      if (k && typeof k === 'object') {
        var term = k.term || k.keyword || JSON.stringify(k);
        var place = k.place || k.placement || k.intent || '';
        return '- ' + term + (place ? ' (place: ' + place + ')' : '');
      }
      return '- ' + String(k);
    });
  }

  // Build the single prompt that merges research + audit + brand into a page spec.
  function buildPagePrompt(research, audit, brand) {
    research = research || {};
    audit = audit || {};
    brand = brand || {};
    var name = research.name || research.product || 'the product';
    var usps = asList(research.usps);
    var facts = asList(research.facts);
    var images = asList(research.images);
    var keywords = fmtKeywords(audit);
    var colors = asList(brand.colors);
    var fonts = asList(brand.fonts);
    var tone = asList(brand.tone).join(', ') || '(unspecified)';
    var spacing = brand.spacing || '(unspecified)';
    // Deterministic token contract: the page CSS is injected by the engine
    // (see buildBrandCss), so the model MUST style via these variables.
    var tokenDefs = colors.map(function (c, i) { return '--b' + i + ': ' + c; });
    if (fonts.length) tokenDefs.push('--f0: ' + fonts.join(', '));
    var tokenBlock = tokenDefs.length
      ? ':root { ' + tokenDefs.join('; ') + '; }'
      : ':root { --b0: #1a1a1a; --b1: #ffffff; }';
    var colorRule = colors.length
      ? colors.map(function (c, i) { return 'var(--b' + i + ') = ' + c; }).join(', ')
      : '(none provided — use only var(--b0)/var(--b1))';

    var lines = [
      'You are an expert GEO/AEO/SEO product-page copywriter and front-end developer.',
      'Write a high-converting, search- and answer-engine-optimized product page for: ' + name,
      '',
      'UNIQUE SELLING POINTS (feature each prominently):'
    ];
    lines.push(usps.length
      ? usps.map(function (u) { return '- ' + u; }).join('\n')
      : '- (no USPs provided; infer sensible ones, clearly plausible)');
    lines.push('', 'SUPPORTING FACTS:');
    lines.push(facts.length
      ? facts.map(function (f) { return '- ' + f; }).join('\n')
      : '- (none provided)');
    lines.push('', 'KEYWORD PLACEMENTS (use each term in its placement; all must appear verbatim):');
    lines.push(keywords.join('\n'));
    lines.push(
      '',
      'BRAND TOKENS (MANDATORY — ignoring these = failed output):',
      '- Use these CSS variables for EVERY color and font on the page. No other hex, rgb(), or named colors anywhere:',
      '- ' + tokenBlock,
      '- Token map: ' + colorRule + (fonts.length ? ' | font: var(--f0) = ' + fonts.join(', ') : ''),
      '- Example: body { font-family: var(--f0); background: var(--b1); color: var(--b0); }',
      '- tone of voice: ' + tone,
      '- spacing/layout: ' + spacing,
      '- A <style> block defining exactly this :root is injected automatically — reference the vars, do not redefine them.',
      '',
      'IMAGES (STRICT — broken links = failed output):'
    );
    lines.push(images.length
      ? images.map(function (u) { return '- USE ONLY this exact URL in <img src>: ' + u; }).join('\n')
      : '- Use ZERO <img> tags. For product visuals use inline <svg> blocks (gradients/shapes) filled with the brand tokens above.');
    lines.push(
      '- NEVER invent, guess, or hotlink image URLs (no unsplash/picsum/placeholder CDNs).',
      '- Image priority: FIRST image URL = hero <img> inside .hero-media; remaining URLs in a <div class="gallery"> grid after the proof section.',
      '',
      'LAYOUT (exact skeleton — every generated page follows this structure):',
      '<div class="wrap">',
      '  <header class="hero">',
      '    <div class="hero-copy"> h1, star-rating line, price line, key specs (first 100 words), buy button </div>',
      '    <div class="hero-media"> ONE visual: allow-listed <img> or inline <svg> only </div>',
      '  </header>',
      '  <section class="proof"> 3 trust bullets (shipping / returns / warranty) </section>',
      '  <div class="gallery"> remaining images as <img> grid (omit div if only one image) </div>',
      '  <section class="specs"> <h2>Specifications</h2> + <table> of spec rows </section>',
      '  <section class="faq"> <h2>FAQ</h2> + 3 or more question/answer pairs (mirror the FAQ JSON-LD) </section>',
      '  <footer> brand line </footer>',
      '</div>',
      'Base CSS for .wrap/.hero/.proof/.specs/.faq is injected automatically — use exactly these class names.',
      '',
      '',
      'OUTPUT RULES:',
      '1. Output ONE self-contained HTML document only (optionally inside a single ```html fenced block), no commentary.',
      '2. Inline <style> in <head>; no external stylesheets or scripts except JSON-LD.',
      '3. Include BOTH a Product and an FAQPage JSON-LD block (<script type="application/ld+json">).',
      '4. Exactly one <h1> with the product name + top keyword.',
      '5. Put key specs in the first 100 words of the body copy.',
      '6. Include a visible FAQ section answering at least 3 questions (mirroring the FAQ JSON-LD).',
      '7. Semantic structure: header/main/section/footer, meta description, descriptive <title>.'
    );
    return lines.join('\n');
  }

  // Extract the first HTML document: prefer a ```html fenced block,
  // else the first <!doctype html ...>...</html> span (case-insensitive),
  // else the first <html ...>...</html> span.
  function extractHtml(text) {
    var fenced = /```html\s*([\s\S]*?)```/i.exec(text);
    if (fenced) return fenced[1].trim();
    var m = /<!doctype html[\s\S]*?<\/html\s*>/i.exec(text) ||
            /<html[\s\S]*?<\/html\s*>/i.exec(text);
    if (!m) {
      throw new Error('runGenerate: no HTML document found in model output');
    }
    return m[0].trim();
  }

  // Deterministic brand + layout CSS injected into every generated page, so
  // the brand and structure carry even if the model under-uses the tokens.
  function buildBrandCss(brand) {
    brand = brand || {};
    var colors = asList(brand.colors);
    var fonts = asList(brand.fonts);
    var vars = colors.map(function (c, i) { return '--b' + i + ': ' + c + ';'; }).join(' ');
    if (!colors.length) vars = '--b0: #1a1a1a; --b1: #ffffff;';
    var bg = colors[1] || colors[0] || '#ffffff';
    var ink = colors[0] || '#1a1a1a';
    var accent = colors[2] || colors[0] || '#1a1a1a';
    var muted = colors[3] || '#6b7280';
    var stack = fonts.length ? fonts.join(', ') : 'system-ui, sans-serif';
    // This CSS loads AFTER the model's own <style>, so it wins on conflicts.
    return '<style>/* MEO brand tokens + layout */\n:root { ' + vars + ' --f0: ' + stack + '; }\n' +
      'body { font-family: var(--f0); background: ' + bg + '; color: ' + ink + '; margin: 0; line-height: 1.6; }\n' +
      '.wrap { max-width: 1100px; margin: 0 auto; padding: 40px 24px 72px; }\n' +
      '.hero { display: grid; grid-template-columns: 56fr 44fr; gap: 40px; align-items: center; margin-bottom: 48px; }\n' +
      '.hero h1 { font-size: clamp(28px, 4vw, 44px); line-height: 1.15; margin: 0 0 12px; }\n' +
      '.hero .rating { color: ' + accent + '; font-weight: 700; letter-spacing: 1px; }\n' +
      '.hero .price { font-size: 28px; font-weight: 800; margin: 12px 0; }\n' +
      '.hero .buy-btn, .hero .cta, a.buy-btn, button.buy-btn { display: inline-block; background: ' + accent + '; color: #fff; padding: 14px 32px; border-radius: 10px; font-weight: 700; text-decoration: none; border: 0; margin-top: 16px; }\n' +
      '.hero-media svg, .hero-media img { width: 100%; height: auto; border-radius: 14px; display: block; }\n' +
      '.proof { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 48px; }\n' +
      '.proof-item, .proof > div { background: #ffffff; border: 1px solid ' + ink + '18; border-radius: 12px; padding: 20px; text-align: center; font-weight: 600; }\n' +
      '.specs { margin-bottom: 48px; }\n' +
      '.specs h2, .faq h2, .gallery h2 { font-size: 24px; margin-bottom: 16px; }\n' +
      '.specs table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 12px; overflow: hidden; }\n' +
      '.specs th, .specs td { text-align: left; padding: 12px 16px; border-bottom: 1px solid ' + ink + '14; }\n' +
      '.specs tr:nth-child(even) td { background: ' + ink + '08; }\n' +
      '.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 48px; }\n' +
      '.gallery img { width: 100%; height: 200px; object-fit: cover; border-radius: 12px; }\n' +
      '.faq-item, .faq > div { margin-bottom: 16px; }\n' +
      '.faq h3 { margin: 0 0 6px; font-size: 17px; }\n' +
      'footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid ' + ink + '22; color: ' + muted + '; font-size: 14px; }\n' +
      '.site-head { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }\n' +
      '.site-head .mark { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: ' + accent + '; color: #fff; font-weight: 800; font-size: 18px; }\n' +
      '.site-head .brandline { font-weight: 700; font-size: 15px; }\n' +
      '.site-head .geo-chip { margin-left: auto; font-size: 12.5px; font-weight: 600; color: ' + muted + '; border: 1px solid ' + ink + '26; border-radius: 999px; padding: 5px 14px; }\n' +
      '.hero .sub { font-size: 17px; color: ' + ink + 'cc; margin: 0 0 20px; max-width: 46ch; }\n' +
      '.hero .stars { color: ' + accent + '; letter-spacing: 2px; font-size: 18px; }\n' +
      '.hero .rating { font-weight: 600; font-size: 15px; margin: 0 0 12px; }\n' +
      '.checks { list-style: none; margin: 0 0 8px; padding: 0; }\n' +
      '.checks li { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; font-weight: 500; }\n' +
      '.checks svg { width: 18px; height: 18px; flex: none; margin-top: 3px; color: ' + accent + '; }\n' +
      '.price-row { display: flex; align-items: center; gap: 20px; margin: 20px 0 0; }\n' +
      '.proof > div { font-size: 15px; }\n' +
      '.specs th { width: 34%; color: ' + ink + 'aa; font-weight: 600; }\n' +
      '.faq-item { background: #ffffff; border: 1px solid ' + ink + '18; border-radius: 12px; padding: 14px 18px; }\n' +
      '.faq-item summary { font-weight: 700; cursor: pointer; font-size: 16px; }\n' +
      '.faq-item p { margin: 8px 0 4px; color: ' + ink + 'cc; }\n' +
      '@media (max-width: 800px) { .hero { grid-template-columns: 1fr; } .proof { grid-template-columns: 1fr; } }\n</style>';
  }

  // Guarantee a visible hero visual: if the page has no <svg> and no
  // allow-listed <img>, insert a brand-gradient hero SVG into .hero-media
  // (fallback: right after the </h1>).
  function ensureHeroVisual(html, images, brand) {
    var allowed = asList(images).map(function (u) { return String(u).trim(); });
    var hasSvg = /<svg[\s>]/i.test(html);
    var hasImg = false;
    String(html).replace(/<img\b[^>]*>/gi, function (tag) {
      var m = /src\s*=\s*["']([^"']+)["']/i.exec(tag);
      if (m && allowed.indexOf(m[1].trim()) !== -1) hasImg = true;
      return tag;
    });
    if (hasSvg || hasImg) return html;
    var colors = asList((brand || {}).colors);
    var c0 = colors[0] || '#1a1a1a';
    var c1 = colors[1] || '#e5e5e5';
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' role='img' aria-label='Product visual'>" +
      "<defs><linearGradient id='meohero' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='" + c0 + "'/><stop offset='1' stop-color='" + c1 + "'/>" +
      "</linearGradient></defs><rect width='800' height='600' fill='url(#meohero)'/>" +
      "<circle cx='600' cy='180' r='120' fill='#ffffff' opacity='0.25'/>" +
      "<circle cx='180' cy='450' r='80' fill='#ffffff' opacity='0.18'/></svg>";
    if (/<div[^>]*class=["'][^"']*hero-media[^"']*["'][^>]*>/i.test(html)) {
      return html.replace(/(<div[^>]*class=["'][^"']*hero-media[^"']*["'][^>]*>)/i, '$1' + svg);
    }
    return html.replace(/(<\/h1\s*>)/i, '$1' + svg);
  }

  // Replace hallucinated/hotlinked <img> (anything not in the research URL
  // allow-list) with an inline SVG placeholder in brand colors — never a
  // broken-image icon.
  function sanitizeImages(html, images, brand) {
    var allowed = asList(images).map(function (u) { return String(u).trim(); });
    var colors = asList((brand || {}).colors);
    var c0 = colors[0] || '#1a1a1a';
    var c1 = colors[1] || '#e5e5e5';
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' role='img' aria-label='Product visual'>" +
      "<defs><linearGradient id='meo' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='" + c0 + "'/><stop offset='1' stop-color='" + c1 + "'/>" +
      "</linearGradient></defs><rect width='800' height='600' fill='url(#meo)'/></svg>";
    return String(html).replace(/<img\b[^>]*>/gi, function (tag) {
      var m = /src\s*=\s*["']([^"']+)["']/i.exec(tag);
      if (m && allowed.indexOf(m[1].trim()) !== -1) return tag;
      return svg;
    });
  }

  // Calls the model and returns the validated standalone HTML string.
  async function runGenerate(chatFn, research, audit, brand) {
    if (typeof chatFn !== 'function') {
      throw new Error('runGenerate: chatFn must be a function');
    }
    var raw = await chatFn(buildPagePrompt(research, audit, brand));
    if (raw && typeof raw === 'object') {
      if (typeof raw.text === 'string') raw = raw.text;
      else if (typeof raw.content === 'string') raw = raw.content;
    }
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new Error('runGenerate: chatFn returned empty output');
    }
    var html = extractHtml(raw);
    var lower = html.toLowerCase();
    if (lower.indexOf('<html') === -1) {
      throw new Error('runGenerate: output is missing <html>');
    }
    if (lower.indexOf('application/ld+json') === -1) {
      throw new Error('runGenerate: output is missing application/ld+json schema');
    }
    var tokenUses = (html.match(/var\(--b\d+\)|var\(--f0\)/g) || []).length;
    var hexHits = asList((brand || {}).colors).filter(function (c) {
      return lower.indexOf(String(c).toLowerCase()) !== -1;
    }).length;
    if (tokenUses === 0 && hexHits === 0) {
      throw new Error('runGenerate: output ignored the brand tokens (no var(--bN)/hex found) — click Run again');
    }
    if (!/class=["'][^"']*\bhero\b/i.test(html)) {
      throw new Error('runGenerate: output ignored the layout skeleton (no .hero section) — click Run again');
    }
    html = sanitizeImages(html, asList((research || {}).images), brand);
    html = ensureHeroVisual(html, asList((research || {}).images), brand);
    var css = buildBrandCss(brand);
    if (/<\/head\s*>/i.test(html)) html = html.replace(/<\/head\s*>/i, css + '\n</head>');
    else if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, '$&' + css);
    return html;
  }

  function pageQuality(html) {
    // higher = better; gates the refine loop against regressions
    var score = 0;
    var classes = ['wrap', 'hero', 'hero-copy', 'hero-media', 'proof', 'specs', 'faq'];
    classes.forEach(function (c) {
      if (new RegExp('class=["\'][^"\']*\\b' + c + '\\b', 'i').test(html)) score += 10;
    });
    score += (html.match(/var\(--b\d+\)|var\(--f0\)/g) || []).length;
    score += (html.match(/<svg[\s>]/gi) || []).length * 5;
    return score;
  }

  // Multi-pass: draft -> critique -> revise. Keeps the best valid page.
  async function runGenerateRefined(chatFn, research, audit, brand, passes, onPass) {
    passes = passes == null ? 1 : passes;
    if (typeof chatFn !== 'function') throw new Error('runGenerate: chatFn must be a function');
    var spec = buildPagePrompt(research, audit, brand);
    var draftRaw = await chatFn(spec);
    var draftHtml = postProcess(draftRaw, research, brand);
    var best = draftHtml, bestQ = pageQuality(draftHtml);
    if (onPass) onPass(1, passes + 1);
    for (var i = 0; i < passes; i++) {
      var critique = await chatFn(window.MEO.buildCritiquePrompt('generate', best.slice(0, 6000)));
      if (/^\s*PASS\s*$/i.test(String(critique))) { if (onPass) onPass(i + 2, passes + 1); break; }
      var revised = await chatFn(window.MEO.buildRevisePrompt('generate', spec, best.slice(0, 8000), critique));
      try {
        var cand = postProcess(revised, research, brand);
        if (pageQuality(cand) >= bestQ) { best = cand; bestQ = pageQuality(cand); }
      } catch (e) { /* keep previous best */ }
      if (onPass) onPass(i + 2, passes + 1);
    }
    return best;
  }

  // Shared validate + sanitize + inject pipeline used by both runners.
  function postProcess(raw, research, brand) {
    if (raw && typeof raw === 'object') {
      if (typeof raw.text === 'string') raw = raw.text;
      else if (typeof raw.content === 'string') raw = raw.content;
    }
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new Error('runGenerate: chatFn returned empty output');
    }
    var html = extractHtml(raw);
    var lower = html.toLowerCase();
    if (lower.indexOf('<html') === -1) throw new Error('runGenerate: output is missing <html>');
    if (lower.indexOf('application/ld+json') === -1) {
      throw new Error('runGenerate: output is missing application/ld+json schema');
    }
    html = sanitizeImages(html, asList((research || {}).images), brand);
    html = ensureHeroVisual(html, asList((research || {}).images), brand);
    var css = buildBrandCss(brand);
    if (/<\/head\s*>/i.test(html)) html = html.replace(/<\/head\s*>/i, css + '\n</head>');
    else if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, '$&' + css);
    return html;
  }

  // ---- Structured content path (preferred): the model returns ONLY JSON
  // content; MEO.buildPage renders it deterministically. Small, validatable,
  // and immune to layout/CSS drift.
  function buildContentPrompt(research, audit, brand) {
    research = research || {};
    audit = audit || {};
    brand = brand || {};
    var name = research.name || research.product || 'the product';
    var usps = asList(research.usps);
    var facts = asList(research.facts);
    var keywords = fmtKeywords(audit);
    var tone = asList(brand.tone).join(', ') || 'clear, confident, friendly';
    return [
      'You are an expert GEO/AEO/SEO product copywriter. Write page content for: ' + name,
      '',
      'UNIQUE SELLING POINTS:',
      usps.length ? usps.map(function (u) { return '- ' + u; }).join('\n') : '- (infer plausible ones)',
      '',
      'SUPPORTING FACTS:',
      facts.length ? facts.map(function (f) { return '- ' + f; }).join('\n') : '- (none)',
      '',
      'KEYWORDS (work each term naturally into headline/subhead/bullets/faqs):',
      keywords.join('\n'),
      '',
      'VOICE: ' + tone,
      '',
      'Reply ONLY with JSON inside a ```json fence, no other text. Exact shape:',
      '{"headline":"product name + top keyword, <= 70 chars",',
      ' "subhead":"1-2 sentence benefit summary, key specs in first 100 chars",',
      ' "rating":4.8, "reviews":"2,314", "price":"$89", "cta":"Buy now",',
      ' "bullets":["4-6 punchy benefit bullets"],',
      ' "specs":[{"k":"Capacity","v":"25L"}, ... 4-8 rows],',
      ' "faqs":[{"q":"...","a":"..."}, ... 3-5 pairs, answers 1-3 sentences],',
      ' "trust":["Free shipping","30-day returns","2-year warranty"]}',
      'Numbers must be plausible for this product; never invent certifications.'
    ].join('\n');
  }

  function parseContent(raw) {
    if (raw && typeof raw === 'object') {
      if (typeof raw.text === 'string') raw = raw.text;
      else if (typeof raw.content === 'string') raw = raw.content;
    }
    var text = String(raw || '');
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('runContent: no JSON object found');
    var obj;
    try {
      obj = JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      throw new Error('runContent: invalid JSON — ' + e.message);
    }
    var missing = [];
    if (!obj.headline) missing.push('headline');
    if (!Array.isArray(obj.bullets) || obj.bullets.length < 3) missing.push('bullets>=3');
    if (!Array.isArray(obj.specs) || obj.specs.length < 3) missing.push('specs>=3');
    if (!Array.isArray(obj.faqs) || obj.faqs.length < 3) missing.push('faqs>=3');
    if (missing.length) throw new Error('runContent: incomplete content, missing: ' + missing.join(', '));
    obj.specs = obj.specs.filter(function (s) { return s && s.k && s.v; });
    obj.faqs = obj.faqs.filter(function (f) { return f && f.q && f.a; });
    return obj;
  }

  function contentQuality(c) {
    return (c.bullets || []).length * 2 + (c.specs || []).length * 2 +
      (c.faqs || []).length * 3 + (c.headline ? 5 : 0) +
      (c.subhead ? 5 : 0) + (c.price ? 2 : 0) + (c.rating ? 2 : 0);
  }

  // Draft -> validate -> targeted revise (max `passes` revises). Keeps best.
  async function runContentRefined(chatFn, research, audit, brand, passes, onPass) {
    passes = passes == null ? 1 : passes;
    if (typeof chatFn !== 'function') throw new Error('runContent: chatFn must be a function');
    var spec = buildContentPrompt(research, audit, brand);
    var total = passes + 1;
    var best = null, bestQ = -1;
    var feedback = '';
    for (var i = 0; i < total; i++) {
      if (onPass) onPass(i + 1, total);
      var prompt = feedback ? spec + '\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Fix exactly this and nothing else:\n' + feedback : spec;
      var cand;
      try {
        cand = parseContent(await chatFn(prompt));
      } catch (e) {
        feedback = String(e.message);
        continue;
      }
      var q = contentQuality(cand);
      if (q > bestQ) { best = cand; bestQ = q; }
      feedback = '';
      if ((cand.bullets || []).length >= 4 && (cand.specs || []).length >= 4 && (cand.faqs || []).length >= 3) break;
    }
    if (!best) throw new Error('runContent: model never returned valid content (' + feedback + ') — click Run again');
    return best;
  }

  window.MEO.buildPagePrompt = buildPagePrompt;
  window.MEO.buildBrandCss = buildBrandCss;
  window.MEO.ensureHeroVisual = ensureHeroVisual;
  window.MEO.runGenerate = runGenerate;
  window.MEO.runGenerateRefined = runGenerateRefined;
  window.MEO.buildContentPrompt = buildContentPrompt;
  window.MEO.parseContent = parseContent;
  window.MEO.runContentRefined = runContentRefined;
})();
