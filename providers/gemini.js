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
  var res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: contents }),
  });
  if (!res.ok) {
    var detail = "";
    try { detail = await res.text(); } catch (e) { /* ignore */ }
    throw new Error(
      "MEO gemini: request failed with status " + res.status + (detail ? " — " + detail.slice(0, 300) : "")
    );
  }
  var data = await res.json();
  var parts =
    (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  var text = parts.map(function (p) { return p.text || ""; }).join("");
  if (!text) throw new Error("MEO gemini: empty response text");
  return text;
};
