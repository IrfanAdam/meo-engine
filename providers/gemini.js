/* MEO provider adapter: Gemini — vanilla JS, no imports. */
window.MEO = window.MEO || {};
window.MEO.providers = window.MEO.providers || {};

window.MEO.providers.gemini = async function (key, messages) {
  if (!key) throw new Error("MEO: missing API key for provider 'gemini'");
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("MEO: 'messages' must be a non-empty array");
  }
  var contents = messages.map(function (m) {
    return { role: "user", parts: [{ text: String(m.content) }] };
  });
  var MEO_GEMINI_MODEL = "gemini-3.8-flash";
  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" + MEO_GEMINI_MODEL + ":generateContent?key=" +
    encodeURIComponent(key);
  var lastErr = null;
  for (var attempt = 1; attempt <= 3; attempt++) {
    var res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: contents }),
      });
    } catch (netErr) {
      throw netErr; // network blocked — app.js explains (file:// vs serve)
    }
    if (res.ok) {
      var data = await res.json();
      var parts =
        (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      var text = parts.map(function (p) { return p.text || ""; }).join("");
      if (!text) throw new Error("MEO gemini: empty response text");
      return text;
    }
    var detail = "";
    try { detail = await res.text(); } catch (e) { /* ignore */ }
    lastErr = "MEO gemini: request failed with status " + res.status + (detail ? " — " + detail.slice(0, 300) : "");
    if ((res.status === 503 || res.status === 429) && attempt < 3) {
      await new Promise(function (r) { setTimeout(r, attempt * 3000); });
      continue;
    }
    if (res.status === 503) {
      throw new Error("MEO gemini: model is overloaded right now (high demand). Wait a minute and click Run again.");
    }
    throw new Error(lastErr);
  }
  throw new Error(lastErr || "MEO gemini: request failed");
};
