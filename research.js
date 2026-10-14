// MEO Engine — research track (provider-agnostic, plain script, no imports/exports).
window.MEO = window.MEO || {};

window.MEO.buildResearchPrompt = function buildResearchPrompt(input) {
  return (
    "Research the following product for an MEO (GEO + AEO) page audit.\n" +
    "Product input: " + String(input) + "\n\n" +
    "Return:\n" +
    "1. product facts (materials, specs, price, variants, availability)\n" +
    "2. USPs — list at least 3 unique selling points\n" +
    "3. positioning vs competitors (name 2-4 competitors and how this product differs)\n" +
    "4. target keywords (SEO/AEO phrases users would search)\n" +
    "5. image URLs (real, publicly loadable image URLs for THIS exact product — brand/retailer CDN or og:image style URLs you know exist; never invent or guess URLs; use [] if unknown)\n\n" +
    'Reply ONLY with JSON shaped as {"facts":[],"usps":[],"competitors":[],"keywords":[],"images":[]} ' +
    "inside a ```json code fence. No other text."
  );
};

window.MEO.parseResearch = function parseResearch(text) {
  var raw = String(text);
  var jsonText = null;
  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    var inner = fence[1].trim();
    var start = inner.indexOf("{");
    var end = inner.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) jsonText = inner.slice(start, end + 1);
  }
  if (!jsonText) {
    var start = raw.indexOf("{");
    var end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) jsonText = raw.slice(start, end + 1);
  }
  var parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Research parse failed: " + raw.slice(0, 200));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Research parse failed: " + raw.slice(0, 200));
  }
  ["facts", "usps", "competitors", "keywords", "images"].forEach(function (k) {
    if (!Array.isArray(parsed[k])) parsed[k] = [];
  });
  return parsed;
};

window.MEO.runResearch = async function runResearch(chatFn, input) {
  var prompt = window.MEO.buildResearchPrompt(input);
  var text = await chatFn([{ role: "user", content: prompt }]);
  return window.MEO.parseResearch(text);
};

// Multi-pass: draft -> critique -> revise. Keeps the best valid draft.
// passes = number of revise rounds after the draft. onPass(n, total) progress hook.
window.MEO.runResearchRefined = async function runResearchRefined(chatFn, input, passes, onPass) {
  passes = passes == null ? 1 : passes;
  var prompt = window.MEO.buildResearchPrompt(input);
  var draftText = await chatFn([{ role: "user", content: prompt }]);
  var best = window.MEO.parseResearch(draftText);
  if (onPass) onPass(1, passes + 1);
  for (var i = 0; i < passes; i++) {
    var critique = await chatFn([{
      role: "user",
      content: window.MEO.buildCritiquePrompt("research", JSON.stringify(best).slice(0, 4000)),
    }]);
    if (/^\s*PASS\s*$/i.test(String(critique))) { if (onPass) onPass(i + 2, passes + 1); break; }
    var revised = await chatFn([{
      role: "user",
      content: window.MEO.buildRevisePrompt("research", prompt, JSON.stringify(best), critique),
    }]);
    try {
      var cand = window.MEO.parseResearch(revised);
      if (cand.usps.length >= 3) best = cand; // quality gate: never regress below 3 USPs
    } catch (e) { /* keep previous best */ }
    if (onPass) onPass(i + 2, passes + 1);
  }
  return best;
};
