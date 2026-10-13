/* MEO Engine — Audit track (Tasks 6-7). Plain <script>-compatible, no imports. */
(function () {
  var CHECK_IDS = ["schema", "faq", "structure", "citations", "meta"];
  var CHECK_LABELS = {
    schema: "Schema.org coverage",
    faq: "FAQ coverage",
    structure: "Page structure",
    citations: "Citation-readiness",
    meta: "Meta / semantic density"
  };
  var PLACES = ["h1", "faq", "schema", "body"];

  function buildAuditPrompt(input, research) {
    var r = research == null ? "" : String(research);
    return [
      "You are an SEO + GEO (generative) + AEO (answer-engine) auditor for product pages.",
      "Input product/page: " + String(input),
      "Research context: " + (r ? r.slice(0, 2000) : "(none)"),
      "",
      "Return ONLY a single JSON object (no markdown fences, no commentary) with this exact shape:",
      '{"score": 0-100, "checks": [{"id": "schema|faq|structure|citations|meta", "label": "...", "score": 0-100, "fix": "..."}], "keywords": [{"term": "...", "intent": "...", "place": "h1|faq|schema|body"}]}',
      "",
      "Rules:",
      "- score must be numeric 0-100.",
      "- checks must cover ALL 5 ids exactly once: schema, faq, structure, citations, meta.",
      "- Each check: id (one of the 5), label (short string), score (numeric 0-100), fix (one concrete fix string).",
      "- keywords must contain at least 5 entries; each with term (non-empty string), intent (short string), place (one of h1, faq, schema, body)."
    ].join("\n");
  }

  function extractFirstJsonBlock(text) {
    var start = String(text).indexOf("{");
    if (start === -1) return null;
    var depth = 0, inStr = false, esc = false, i, ch;
    for (i = start; i < text.length; i++) {
      ch = text[i];
      if (inStr) {
        if (esc) { esc = false; }
        else if (ch === "\\") { esc = true; }
        else if (ch === '"') { inStr = false; }
      } else {
        if (ch === '"') { inStr = true; }
        else if (ch === "{") { depth++; }
        else if (ch === "}") {
          depth--;
          if (depth === 0) return text.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  function validateAudit(obj) {
    if (!obj || typeof obj !== "object") return "parsed value is not an object";
    if (typeof obj.score !== "number" || !(obj.score >= 0 && obj.score <= 100)) return "score must be a number 0-100";
    if (!Array.isArray(obj.checks) || obj.checks.length === 0) return "checks must be a non-empty array";
    if (!Array.isArray(obj.keywords) || obj.keywords.length === 0) return "keywords must be a non-empty array";
    return null;
  }

  function runAudit(chatFn, input, research) {
    var messages = [{ role: "user", content: buildAuditPrompt(input, research) }];
    return Promise.resolve()
      .then(function () { return chatFn(messages); })
      .then(function (raw) {
        var text = String(raw == null ? "" : raw);
        var block = extractFirstJsonBlock(text);
        if (!block) {
          throw new Error("Audit parse failed: no JSON object found. Snippet: " + text.slice(0, 200));
        }
        var obj;
        try {
          obj = JSON.parse(block);
        } catch (e) {
          throw new Error("Audit parse failed: invalid JSON (" + e.message + "). Snippet: " + block.slice(0, 200));
        }
        var err = validateAudit(obj);
        if (err) {
          throw new Error("Audit validation failed: " + err + ". Snippet: " + block.slice(0, 200));
        }
        return obj;
      });
  }

  window.MEO = window.MEO || {};
  window.MEO.buildAuditPrompt = buildAuditPrompt;
  window.MEO.runAudit = runAudit;
  window.MEO.AUDIT_CHECK_IDS = CHECK_IDS;
  window.MEO.AUDIT_CHECK_LABELS = CHECK_LABELS;
  window.MEO.AUDIT_PLACES = PLACES;
})();
