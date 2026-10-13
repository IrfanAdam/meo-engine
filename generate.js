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
    var colors = asList(brand.colors).join(', ') || '(unspecified)';
    var fonts = asList(brand.fonts).join(' | ') || '(unspecified)';
    var tone = asList(brand.tone).join(', ') || '(unspecified)';
    var spacing = brand.spacing || '(unspecified)';

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
      'BRAND VISUAL LANGUAGE (apply throughout the inline CSS):',
      '- colors: ' + colors,
      '- fonts: ' + fonts,
      '- tone: ' + tone,
      '- spacing/layout: ' + spacing,
      '',
      'IMAGES (embed with <img src="..." alt="...">, meaningful alt text):'
    );
    lines.push(images.length
      ? images.map(function (u) { return '- ' + u; }).join('\n')
      : '- (none provided; use zero external images)');
    lines.push(
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
    return html;
  }

  window.MEO.buildPagePrompt = buildPagePrompt;
  window.MEO.runGenerate = runGenerate;
})();
