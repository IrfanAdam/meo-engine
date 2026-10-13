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
    "5. image / og:image hints (what hero, gallery, and social images the page needs)\n\n" +
    'Reply ONLY with JSON shaped as {"facts":[],"usps":[],"competitors":[],"keywords":[],"images":[]} ' +
    "inside a ```json code fence. No other text."
  );
};

window.MEO.runResearch = async function runResearch(chatFn, input) {
  var prompt = window.MEO.buildResearchPrompt(input);
  var text = await chatFn([{ role: "user", content: prompt }]);
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
