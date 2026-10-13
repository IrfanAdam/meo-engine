/* MEO provider adapter: dispatcher — vanilla JS, no imports. */
window.MEO = window.MEO || {};
window.MEO.providers = window.MEO.providers || {};

window.MEO.chat = async function ({ provider, key, messages }) {
  if (!provider) throw new Error("MEO: missing provider (expected 'gemini'|'openai'|'anthropic'|'local')");
  if (!key && provider !== "local") {
    throw new Error("MEO: missing API key for provider '" + provider + "'");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("MEO: 'messages' must be a non-empty array of {role, content}");
  }
  if (provider === "gemini" || provider === "openai") {
    var fn = window.MEO.providers[provider];
    if (typeof fn !== "function") {
      throw new Error("MEO: provider script for '" + provider + "' is not loaded");
    }
    return fn(key, messages);
  }
  if (provider === "anthropic" || provider === "local") {
    throw new Error("MEO: provider '" + provider + "' not configured yet");
  }
  throw new Error(
    "MEO: unknown provider '" + provider + "' (expected 'gemini'|'openai'|'anthropic'|'local')"
  );
};
