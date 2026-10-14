/* MEO Engine — image extractor workflow. Plain <script>-compatible, no imports.
 * URL inputs: fetch page HTML through a CORS-friendly reader proxy, pull
 * og:image + <img> candidates, resolve + filter, user picks. Description
 * inputs: paste image URLs manually. Picks feed research.images.
 */
window.MEO = window.MEO || {};

window.MEO.resolveUrl = function (src, base) {
  try {
    return new URL(String(src).trim(), base).href;
  } catch (e) {
    return null;
  }
};

window.MEO.extractImageUrls = function (htmlText, baseUrl) {
  var html = String(htmlText || "");
  var seen = {};
  var out = [];
  function push(src, alt) {
    var abs = window.MEO.resolveUrl(src, baseUrl);
    if (!abs || seen[abs]) return;
    // skip inline data URIs (huge) and obvious chrome/tracking pixels
    if (/^data:/i.test(abs)) return;
    if (/(icon|logo|sprite|pixel|tracking|1x1|blank|spacer|favicon)/i.test(abs)) return;
    seen[abs] = true;
    out.push({ src: abs, alt: String(alt || "").slice(0, 120) });
  }
  var m, re;
  // og:image / twitter:image first (usually the hero product shot)
  re = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["'][^>]*>/gi;
  while ((m = re.exec(html))) {
    var content = /content\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (content) push(content[1], "product");
  }
  re = /<link[^>]+rel=["']image_src["'][^>]*>/gi;
  while ((m = re.exec(html))) {
    var href = /href\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (href) push(href[1], "product");
  }
  // <img> tags with real URLs (skip .svg chrome)
  re = /<img\b[^>]*>/gi;
  while ((m = re.exec(html)) && out.length < 24) {
    var src = /src\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (!src || /\.svg(\?|$)/i.test(src[1])) continue;
    var alt = /alt\s*=\s*["']([^"']*)["']/i.exec(m[0]);
    push(src[1], alt && alt[1]);
  }
  return out.slice(0, 12);
};

window.MEO.fetchPageImages = async function (pageUrl) {
  var target = String(pageUrl || "").trim();
  if (!/^https?:\/\//i.test(target)) {
    throw new Error("Image fetch needs a full http(s) product URL.");
  }
  var proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(target);
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 30000);
  var res;
  try {
    res = await fetch(proxy, { signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    throw new Error("Image fetch blocked (network). Paste image URLs manually below.");
  }
  clearTimeout(timer);
  if (!res.ok) {
    throw new Error("Image fetch failed (status " + res.status + "). Paste image URLs manually below.");
  }
  var html = await res.text();
  var found = window.MEO.extractImageUrls(html, target);
  if (!found.length) {
    throw new Error("No usable images found on that page.");
  }
  return found;
};

// Wikimedia Commons fallback: real, hotlink-friendly photos by keyword.
// No key, CORS-open (origin=*), reliable for demo-grade visuals.
window.MEO.searchCommonsImages = async function (query, limit) {
  var q = String(query || "").trim();
  if (!q) return [];
  var n = limit || 4;
  var api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrsearch=" + encodeURIComponent(q) +
    "&gsrnamespace=6&gsrlimit=" + n +
    "&prop=imageinfo&iiprop=url|size&iiurlwidth=800";
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 25000);
  var res;
  try {
    res = await fetch(api, { signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    return [];
  }
  clearTimeout(timer);
  if (!res.ok) return [];
  var data;
  try { data = await res.json(); } catch (e) { return []; }
  var pages = (data.query && data.query.pages) || {};
  var cands = [];
  Object.keys(pages).forEach(function (k) {
    var info = (pages[k].imageinfo || [])[0];
    var url = (info && info.thumburl && info.width >= 400) ? info.thumburl : (info && info.url);
    if (!url) return;
    // skip multi-page documents and scans, not product photos
    if (/\/page\d+[-_]|\.(pdf|tiff?|djvu)(\?|$)/i.test(url)) return;
    var title = String(pages[k].title || "").replace(/^File:/i, "").replace(/\.\w+$/, "").replace(/_/g, " ");
    // drop risky/irrelevant subjects — demo safety first
    if (/(nude|naked|sex|dead|corpse|war|protest|accident|crime|funeral)/i.test(title)) return;
    cands.push({ url: url, title: title });
  });
  // prefer shots whose title names the actual product noun (last query word)
  var noun = String(q).split(/\s+/).pop().toLowerCase();
  cands.sort(function (a, b) {
    return (b.title.toLowerCase().indexOf(noun) !== -1) - (a.title.toLowerCase().indexOf(noun) !== -1);
  });
  return cands.slice(0, n);
};

// URL-only wrapper (kept for compatibility).
window.MEO.searchCommonsImages = async function (query, limit) {
  var cands = await window.MEO.searchCommonsWithTitles(query, limit);
  return cands.map(function (c) { return c.url; });
};

// Product name head: text before any dash/colon (brand + line + noun).
window.MEO.productName = function (rawInput) {
  var head = String(rawInput || "").split(/[—–\-—|:;\n]/)[0];
  return head.replace(/https?:\/\/\S+/gi, "").trim().slice(0, 80) || "product";
};

// LLM judge: score each candidate title 0-2 for product-photo fit.
// Returns { scores: [{i, score}], betterQuery }. Fail-open: empty on parse error.
window.MEO.judgeImages = async function (chatFn, product, cands) {
  var lines = cands.map(function (c, i) { return i + ". " + c.title; }).join("\n");
  var prompt =
    'Product: "' + product + '"\n\nCandidate stock photo titles (index + library title):\n' + lines +
    '\n\nScore each 0-2: 2 = clear product photo OF this product, 1 = related and usable, ' +
    '0 = wrong subject (scenery, people-focused, documents, other products). ' +
    'Reply ONLY with JSON: {"scores":[{"i":0,"score":2}],"betterQuery":"<improved 1-2 word photo search for this product>"} ' +
    'inside a ```json fence. No other text.';
  var raw = await chatFn(prompt);
  var text = (raw && typeof raw === "object" && (raw.text || raw.content)) || String(raw);
  var start = text.indexOf("{");
  var end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return { scores: [], betterQuery: "" };
  try {
    var obj = JSON.parse(text.slice(start, end + 1));
    if (!obj || !Array.isArray(obj.scores)) return { scores: [], betterQuery: "" };
    return { scores: obj.scores, betterQuery: String(obj.betterQuery || "") };
  } catch (e) {
    return { scores: [], betterQuery: "" };
  }
};

// Openverse (WordPress photo library): second source, no key, CORS-open.
// Anonymous rate limits are tight — failure returns [] and Commons carries on.
window.MEO.searchOpenverseWithTitles = async function (query, limit) {
  var q = String(query || "").trim();
  if (!q) return [];
  var api = "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) +
    "&page_size=" + (limit || 8) + "&filter_dead=true&license_type=all";
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 25000);
  var res;
  try {
    res = await fetch(api, { signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    return [];
  }
  clearTimeout(timer);
  if (!res.ok) return [];
  var data;
  try { data = await res.json(); } catch (e) { return []; }
  var out = [];
  ((data && data.results) || []).forEach(function (r) {
    if (!r.url || !/^https?:\/\//i.test(r.url)) return;
    var title = String(r.title || "").replace(/_/g, " ");
    if (/(nude|naked|sex|dead|corpse|war|protest|accident|crime|funeral)/i.test(title)) return;
    out.push({ url: r.url, title: title || "untitled photo" });
  });
  return out;
};

// Hunter subagent: exhaustive multi-source photo hunt. Strategies in order —
// Commons, Commons variations, Openverse, judge-suggested re-queries — up to
// 5 rounds. Keeps ONLY exact-fit photos (judge score 2); settles for related
// (score 1) only if no exact fit exists after all rounds. Never returns
// wrong-subject photos.
window.MEO.huntImages = async function (rawInput, research, chatFn, onPhase) {
  var MEO = window.MEO;
  var product = MEO.productName(rawInput);
  var pair = MEO.commonsQueries(research, rawInput);
  var queue = [pair[0], pair[0] + " product", pair[1]];
  var tried = {};
  var twos = [];
  var ones = [];
  var seen = {};
  var rounds = 4;
  for (var r = 0; r < rounds && twos.length < 3; r++) {
    var q = null;
    while (queue.length) {
      var cand = queue.shift().trim();
      if (cand && !tried[cand.toLowerCase()]) { q = cand; break; }
    }
    if (!q) break;
    tried[q.toLowerCase()] = true;
    if (onPhase) onPhase("hunting photos (" + q + ")… round " + (r + 1) + "/" + rounds);
    var found = await MEO.searchCommonsWithTitles(q, 6);
    if (found.length < 3) {
      try {
        var ov = await MEO.searchOpenverseWithTitles(q, 6);
        ov.forEach(function (c) { found.push(c); });
      } catch (e) { /* Commons results stand */ }
    }
    var fresh = found.filter(function (c) { return !seen[c.url]; });
    if (!fresh.length) continue;
    fresh.forEach(function (c) { seen[c.url] = true; });
    if (onPhase) onPhase("checking " + fresh.length + " photos vs product… round " + (r + 1) + "/" + rounds);
    var judged = await MEO.judgeImages(chatFn, product, fresh);
    var byScore = {};
    (judged.scores || []).forEach(function (s) { byScore[s.i] = s.score; });
    if (!judged.scores.length) continue; // judge failed — next strategy, keep nothing
    fresh.forEach(function (c, i) {
      if (byScore[i] === 2 && twos.length < 4) twos.push(c.url);
      else if (byScore[i] === 1 && ones.length < 4) ones.push(c.url);
    });
    var next = (judged.betterQuery || "").trim();
    if (next && !tried[next.toLowerCase()]) queue.unshift(next);
    if (onPhase) onPhase(twos.length + " exact-fit" + (ones.length ? ", " + ones.length + " related" : "") + " so far…");
  }
  var kept = twos.slice(0, 4);
  var fallbackNote = "";
  if (kept.length < 2 && ones.length) {
    // honest fallback: related beats empty, flagged as such
    while (kept.length < 4 && ones.length) kept.push(ones.shift());
    fallbackNote = " (related, not exact)";
  }
  if (onPhase) onPhase(kept.length ? kept.length + " photos kept" + fallbackNote : "no fitting photos");
  return kept;
};

// Query pair from the raw input's product-name head (text before any
// dash/colon), USP prose as fallback. Returns [primary, fallback].
window.MEO.commonsQueries = function (research, rawInput) {
  var units = /^(liters?|litre?s?|ml|kg|g|oz|inch(es)?|cm|mm|gb|tb|watt?s?|pack|set|pcs?)$/i;
  function wordsOf(s) {
    return String(s || "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/[$€£₹]\s*[\d.,]+/g, "")
      .split(/[^A-Za-z]+/)
      .filter(function (w) { return w.length > 2 && !/\d/.test(w) && !units.test(w); });
  }
  var head = String(rawInput || "").split(/[—–\-—|:;\n]/)[0];
  var words = wordsOf(head);
  if (words.length < 2) words = wordsOf(research && research.usps && research.usps[0]);
  var primary = words.slice(-2).join(" ");
  var fallback = words.slice(-1).join(" ");
  return [primary, fallback];
};

// Short Commons-friendly query from research + raw input: last two
// content words (usually modifier + product noun, e.g. "hiking backpack").
window.MEO.commonsQuery = function (research, rawInput) {
  return window.MEO.commonsQueries(research, rawInput)[0];
};

// Keep only URLs that actually load in the browser (kills hallucinated URLs).
// Returns a Promise of the loadable subset, capped at 6, order preserved.
window.MEO.verifyImages = function (urls, timeoutMs) {
  var list = (urls || []).filter(function (u) { return /^https?:\/\//i.test(u); });
  if (typeof Image === "undefined") return Promise.resolve(list.slice(0, 6));
  var wait = timeoutMs || 8000;
  function loads(src) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(false); } }, wait);
      var img = new Image();
      img.onload = function () { if (!done) { done = true; clearTimeout(timer); resolve(true); } };
      img.onerror = function () { if (!done) { done = true; clearTimeout(timer); resolve(false); } };
      img.src = src;
    });
  }
  return Promise.all(list.map(loads)).then(function (ok) {
    return list.filter(function (_, i) { return ok[i]; }).slice(0, 6);
  });
};
