/* MEO Engine — shared critique/revise prompt builders for multi-pass tracks.
 * Plain <script>-compatible: no import/export. Pure prompt builders (no chat).
 * kind: 'research' | 'audit' | 'brand' | 'generate'
 */
window.MEO = window.MEO || {};

window.MEO.buildCritiquePrompt = function (kind, outputText) {
  var checklists = {
    research: [
      'at least 3 specific USPs (not generic praise)',
      'facts with concrete specs/price/variants (no placeholders)',
      '2-4 named competitors with differentiators',
      'keywords a real shopper would type',
      'image hints only if they describe real, producible shots',
    ],
    audit: [
      'score is justified by the checks (not inflated)',
      'checks cover all 5 ids exactly once: schema, faq, structure, citations, meta',
      'every fix is one concrete action, not vague advice',
      'at least 5 keywords, each with term + intent + valid place',
    ],
    brand: [
      'at least 2 valid hex colors, primary first',
      'at least 1 real CSS font stack (not a single invented name)',
      'at least 3 concrete tone adjectives',
      'spacing is actionable layout guidance, not filler',
    ],
    generate: [
      'exactly one <h1> with product name + top keyword',
      'key specs appear in the first 100 words of body copy',
      'every color/font is a brand token var(--bN)/var(--f0) — no stray hex/rgb/names',
      'layout skeleton present: .wrap > header.hero (.hero-copy + .hero-media) + .proof + .specs + .faq + footer',
      'images rule respected: only allow-listed URLs or inline <svg>, zero hotlinks',
      'visible FAQ mirrors the FAQPage JSON-LD (same questions)',
    ],
  };
  var list = (checklists[kind] || ['output is complete and correct'])
    .map(function (c) { return '- ' + c; }).join('\n');
  return (
    'You are a ruthless QA reviewer. Critique the draft below against this checklist:\n' +
    list + '\n\nDRAFT:\n' + String(outputText).slice(0, 6000) +
    '\n\nReply with a bullet list of concrete weaknesses only (each: WHAT is wrong + HOW to fix). ' +
    'If it fully passes, reply with exactly: PASS'
  );
};

window.MEO.buildRevisePrompt = function (kind, originalPrompt, draftText, critique) {
  return (
    'ORIGINAL TASK:\n' + String(originalPrompt).slice(0, 4000) +
    '\n\nYOUR DRAFT:\n' + String(draftText).slice(0, 8000) +
    '\n\nQA CRITIQUE (fix every item):\n' + String(critique).slice(0, 3000) +
    '\n\nProduce the FULL corrected output now, same format as the original task required. ' +
    'No commentary, no explanation of changes.'
  );
};
