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
    throw new Error("Image fetch needs a full http(s) product URL — or paste image URLs manually below.");
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
    throw new Error("No usable images found on that page. Paste image URLs manually below.");
  }
  return found;
};
