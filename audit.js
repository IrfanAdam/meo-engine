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

  function parseAudit(text) {
    var str = String(text == null ? "" : text);
    var block = extractFirstJsonBlock(str);
    if (!block) {
      throw new Error("Audit parse failed: no JSON object found. Snippet: " + str.slice(0, 200));
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
  }

  function auditQuality(obj) {
    // higher = better; gates the refine loop against regressions
    var ids = {};
    obj.checks.forEach(function (c) { ids[c.id] = true; });
    var coverage = CHECK_IDS.filter(function (id) { return ids[id]; }).length;
    return coverage * 100 + obj.keywords.length * 10 + obj.score;
  }

  function runAudit(chatFn, input, research) {
    var messages = [{ role: "user", content: buildAuditPrompt(input, research) }];
    return Promise.resolve()
      .then(function () { return chatFn(messages); })
      .then(function (raw) { return parseAudit(raw); });
  }

  // Multi-pass: draft -> critique -> revise. Keeps the best valid audit.
  async function runAuditRefined(chatFn, input, research, passes, onPass) {
    passes = passes == null ? 1 : passes;
    var prompt = buildAuditPrompt(input, research);
    var draftText = await chatFn([{ role: "user", content: prompt }]);
    var best = parseAudit(draftText);
    var bestQ = auditQuality(best);
    if (onPass) onPass(1, passes + 1);
    for (var i = 0; i < passes; i++) {
      var critique = await chatFn([{
        role: "user",
        content: window.MEO.buildCritiquePrompt("audit", JSON.stringify(best).slice(0, 4000)),
      }]);
      if (/^\s*PASS\s*$/i.test(String(critique))) { if (onPass) onPass(i + 2, passes + 1); break; }
      var revised = await chatFn([{
        role: "user",
        content: window.MEO.buildRevisePrompt("audit", prompt, JSON.stringify(best), critique),
      }]);
      try {
        var cand = parseAudit(revised);
        if (auditQuality(cand) >= bestQ) { best = cand; bestQ = auditQuality(cand); }
      } catch (e) { /* keep previous best */ }
      if (onPass) onPass(i + 2, passes + 1);
    }
    return best;
  }

  window.MEO = window.MEO || {};
  window.MEO.buildAuditPrompt = buildAuditPrompt;
  window.MEO.runAudit = runAudit;
  window.MEO.parseAudit = parseAudit;
  window.MEO.runAuditRefined = runAuditRefined;
  window.MEO.AUDIT_CHECK_IDS = CHECK_IDS;
  window.MEO.AUDIT_CHECK_LABELS = CHECK_LABELS;
  window.MEO.AUDIT_PLACES = PLACES;
})();
