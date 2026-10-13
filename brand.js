/* MEO Engine — Track 3a: brand visual-language extractor.
 * Plain <script>-compatible: no import/export. Attaches to window.MEO.
 * chatFn: async (prompt: string) => string (raw model text). Never imports providers.
 */
(function () {
  window.MEO = window.MEO || {};

  function buildBrandPrompt(input) {
    return (
      'You are a brand-language analyst. Given the product name or product/brand page below, ' +
      'infer its visual brand language.\n\n' +
      'Input: ' + String(input) + '\n\n' +
      'Reply with ONLY a single JSON object (optionally inside one ```json fenced block), ' +
      'no other text, with exactly these keys:\n' +
      '{\n' +
      '  "colors": ["#rrggbb", ...] (hex strings, at least 2: primary first, then accents),\n' +
      '  "fonts": ["<css font stack>", ...] (at least 1, e.g. "Inter, system-ui, sans-serif"),\n' +
      '  "tone": ["<adjective>", ...] (at least 3, e.g. "bold", "minimal", "playful"),\n' +
      '  "spacing": "<short spacing/layout guidance string>"\n' +
      '}'
    );
  }

  // Extract the first JSON object from text: prefer a ```json fenced block,
  // else the first {...} span.
  function extractJson(text) {
    var fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    var candidate = fenced ? fenced[1] : text;
    var start = candidate.indexOf('{');
    var end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('extractBrand: no JSON object found in model output');
    }
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (e) {
      throw new Error('extractBrand: model output is not valid JSON: ' + e.message);
    }
  }

  function validateBrand(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('extractBrand: expected a JSON object');
    }
    var hexRe = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
    if (!Array.isArray(obj.colors) || obj.colors.length < 2 ||
        !obj.colors.every(function (c) { return typeof c === 'string' && hexRe.test(c.trim()); })) {
      throw new Error('extractBrand: "colors" must be an array of >= 2 hex strings');
    }
    if (!Array.isArray(obj.fonts) || obj.fonts.length < 1 ||
        !obj.fonts.every(function (f) { return typeof f === 'string' && f.trim().length > 0; })) {
      throw new Error('extractBrand: "fonts" must be an array of >= 1 non-empty stack strings');
    }
    if (!Array.isArray(obj.tone) || obj.tone.length < 3 ||
        !obj.tone.every(function (t) { return typeof t === 'string' && t.trim().length > 0; })) {
      throw new Error('extractBrand: "tone" must be an array of >= 3 adjectives');
    }
    if (typeof obj.spacing !== 'string' || obj.spacing.trim().length === 0) {
      throw new Error('extractBrand: "spacing" must be a non-empty string');
    }
    return {
      colors: obj.colors.map(function (c) { return c.trim(); }),
      fonts: obj.fonts.map(function (f) { return f.trim(); }),
      tone: obj.tone.map(function (t) { return t.trim(); }),
      spacing: obj.spacing.trim()
    };
  }

  // Prompts the model for brand visual language and returns validated tokens.
  async function extractBrand(chatFn, input) {
    if (typeof chatFn !== 'function') {
      throw new Error('extractBrand: chatFn must be a function');
    }
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new Error('extractBrand: input must be a non-empty string');
    }
    var raw = await chatFn(buildBrandPrompt(input));
    if (raw && typeof raw === 'object') {
      if (typeof raw.text === 'string') raw = raw.text;
      else if (typeof raw.content === 'string') raw = raw.content;
    }
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new Error('extractBrand: chatFn returned empty output');
    }
    return validateBrand(extractJson(raw));
  }

  window.MEO.buildBrandPrompt = buildBrandPrompt;
  window.MEO.extractBrand = extractBrand;
})();
