/* MEO provider adapter: OpenAI — vanilla JS, no imports. */
window.MEO = window.MEO || {};
window.MEO.providers = window.MEO.providers || {};

window.MEO.providers.openai = async function (key, messages) {
  if (!key) throw new Error("MEO: missing API key for provider 'openai'");
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("MEO: 'messages' must be a non-empty array");
  }
  var res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: messages.map(function (m) {
        return { role: m.role === "system" ? "system" : "user", content: String(m.content) };
      }),
    }),
  });
  if (!res.ok) {
    var detail = "";
    try { detail = await res.text(); } catch (e) { /* ignore */ }
    throw new Error(
      "MEO openai: request failed with status " + res.status + (detail ? " — " + detail.slice(0, 300) : "")
    );
  }
  var data = await res.json();
  var text =
    data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("MEO openai: empty response text");
  return text;
};
