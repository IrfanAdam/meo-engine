/* MEO provider adapter: Anthropic Messages API — vanilla JS, no imports. */
window.MEO = window.MEO || {};
window.MEO.providers = window.MEO.providers || {};

window.MEO.providers.anthropic = async function (key, messages, model) {
  if (!key) throw new Error("MEO: missing API key for provider 'anthropic'");
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("MEO: 'messages' must be a non-empty array");
  }
  var useModel = model || "claude-haiku-4-5";
  var system = messages
    .filter(function (m) { return m.role === "system"; })
    .map(function (m) { return String(m.content); })
    .join("\n");
  var turns = messages
    .filter(function (m) { return m.role !== "system"; })
    .map(function (m) {
      return { role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) };
    });
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 45000);
  var res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(
        Object.assign(
          { model: useModel, max_tokens: 4096, messages: turns },
          system ? { system: system } : {}
        )
      ),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
  clearTimeout(timer);
  if (!res.ok) {
    var detail = "";
    try { detail = await res.text(); } catch (e) { /* ignore */ }
    throw new Error(
      "MEO anthropic: request failed with status " + res.status + (detail ? " — " + detail.slice(0, 300) : "")
    );
  }
  var data = await res.json();
  var text = ((data.content) || [])
    .filter(function (b) { return b.type === "text"; })
    .map(function (b) { return b.text || ""; })
    .join("");
  if (!text) throw new Error("MEO anthropic: empty response text");
  return text;
};
