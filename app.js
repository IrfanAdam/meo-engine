// MEO Engine — pipeline wiring (mock fallback + live provider tracks).
window.MEO = window.MEO || {};
let lastAudit = null;
let lastGeneratedHtml = null;

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// --- provider + model + key storage (per provider, localStorage only) ---
const MODELS = {
  gemini: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-haiku-4-5", "claude-3-5-haiku-20241022"],
};
function getProvider() { return $("provider").value || "gemini"; }
function getModel() { return $("model").value || MODELS[getProvider()][0]; }
function getKey() { return $("apiKey").value.trim(); }
function fillModels(saved) {
  const list = MODELS[getProvider()] || [];
  const sel = $("model");
  sel.innerHTML = "";
  list.forEach((m) => {
    const o = document.createElement("option");
    o.value = m; o.textContent = m;
    sel.appendChild(o);
  });
  sel.value = list.includes(saved) ? saved : list[0];
}
function savePrefs() {
  try {
    localStorage.setItem("meo.provider", getProvider());
    localStorage.setItem("meo.model." + getProvider(), getModel());
    localStorage.setItem("meo.key." + getProvider(), getKey());
  } catch (e) { /* private mode */ }
}
function loadPrefs() {
  try {
    const p = localStorage.getItem("meo.provider");
    if (p && MODELS[p]) $("provider").value = p;
    fillModels(localStorage.getItem("meo.model." + getProvider()));
    $("apiKey").value = localStorage.getItem("meo.key." + getProvider()) || "";
  } catch (e) { fillModels(); }
  refreshHint();
}
function refreshHint() {
  $("status").textContent = getKey()
    ? `Live mode — ${getProvider()} key set. Runs research + audit + page generation.`
    : "No API key — runs mock audit. Add a key for live research + audit + page generation.";
}

// chatFn adapters (lanes disagree: research/audit take messages[], brand/generate take a string)
function chatMessages(messages) {
  return window.MEO.chat({ provider: getProvider(), key: getKey(), messages, model: getModel() });
}
function chatPrompt(prompt) {
  return window.MEO.chat({ provider: getProvider(), key: getKey(), messages: [{ role: "user", content: prompt }], model: getModel() });
}

// --- mock fallback (no key): same behavior as before ---
function mockAudit(raw) {
  const text = raw.toLowerCase();
  let geo = 62, aeo = 58;
  if (text.includes("faq") || text.includes("?")) aeo += 12;
  if (text.includes("$") || text.includes("price")) geo += 8;
  if (text.includes("schema") || text.includes("review")) { geo += 6; aeo += 6; }
  if (text.length > 120) { geo += 5; aeo += 5; }
  geo = Math.min(98, geo); aeo = Math.min(98, aeo);
  return {
    input: raw, geo, aeo, overall: Math.round((geo + aeo) / 2),
    fixes: [
      "Add Product + FAQ JSON-LD schema (citation-ready facts).",
      "Add a 3-question FAQ block answering price / fit / returns.",
      "Put key specs in the first 100 words for answer engines.",
    ],
  };
}

function buildStandaloneHTML(audit) {
  const fixes = audit.fixes.map((f) => `      <li>${esc(f)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MEO Optimized Page — GEO ${audit.geo} / AEO ${audit.aeo}</title>
  <meta name="description" content="MEO-optimized product page draft. Scores: GEO ${audit.geo}, AEO ${audit.aeo}." />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": ${JSON.stringify(audit.input.slice(0, 120))},
    "description": "MEO-optimized draft generated from audit.",
    "brand": { "@type": "Brand", "name": "MEO Engine" },
    "offers": { "@type": "Offer", "priceCurrency": "USD", "availability": "https://schema.org/InStock" }
  }
  </script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    .scores { display: flex; gap: 1rem; margin: 1rem 0; }
    .score { border: 1px solid #ddd; border-radius: 8px; padding: .75rem 1rem; text-align: center; }
  </style>
</head>
<body>
  <h1>MEO Optimized Draft</h1>
  <p><strong>Source input:</strong> ${esc(audit.input)}</p>
  <div class="scores">
    <div class="score"><strong>GEO ${audit.geo}</strong><br />Generative score</div>
    <div class="score"><strong>AEO ${audit.aeo}</strong><br />Answer-engine score</div>
    <div class="score"><strong>MEO ${audit.overall}</strong><br />Combined</div>
  </div>
  <h2>Fixes applied in this draft</h2>
  <ul>
${fixes}
  </ul>
  <h2>FAQ (citation-ready)</h2>
  <h3>What is this product?</h3>
  <p>${esc(audit.input)}</p>
  <h3>What should the final page include?</h3>
  <p>Price, specs in the first 100 words, reviews, and Product + FAQ JSON-LD schema.</p>
  <footer><p>Generated by MEO Engine prototype.</p></footer>
</body>
</html>`;
}

function renderAudit(audit) {
  $("geo").textContent = audit.geo;
  $("aeo").textContent = audit.aeo;
  $("overall").textContent = audit.overall;
  const ul = $("fixes");
  ul.innerHTML = "";
  audit.fixes.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = typeof f === "string" ? f : (f.fix || f.label || JSON.stringify(f));
    ul.appendChild(li);
  });
  $("results").classList.remove("hidden");
}

function renderLive(research, audit, brand) {
  const usps = $("usps");
  usps.innerHTML = "";
  (research.usps || []).forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;
    usps.appendChild(li);
  });
  const kws = $("keywords");
  kws.innerHTML = "";
  (audit.keywords || []).forEach((k) => {
    const li = document.createElement("li");
    li.textContent = typeof k === "string" ? k : `${k.term} — ${k.intent || ""} [${k.place || ""}]`;
    kws.appendChild(li);
  });
  $("brand").textContent = `Colors ${(brand.colors || []).join(", ")} · Fonts ${(brand.fonts || []).join(" | ")} · Tone ${(brand.tone || []).join(", ")} · ${brand.spacing || ""}`;
}

function setStatus(t) { $("status").textContent = t; }

function setStep(name, state, sub) {
  const li = document.querySelector(`#steps li[data-step="${name}"]`);
  if (!li) return;
  li.dataset.state = state;
  const s = li.querySelector(".step-sub");
  if (s && sub != null) s.textContent = sub;
}

function resetSteps() {
  ["research", "brand", "audit", "generate"].forEach((n) => { setStep(n, "", "idle"); });
  document.querySelectorAll("#steps li").forEach((li) => { delete li.dataset.pass; });
}

// Live elapsed ticker for the running step: "calling gemini… 12s"
function tickStep(name, base) {
  const t0 = Date.now();
  const id = setInterval(() => {
    const li = document.querySelector(`#steps li[data-step="${name}"]`);
    if (!li || li.dataset.state !== "active") { clearInterval(id); return; }
    const s = li.querySelector(".step-sub");
    const pass = li.dataset.pass ? " " + li.dataset.pass : "";
    if (s) s.textContent = `${base} ${Math.round((Date.now() - t0) / 1000)}s…${pass}`;
  }, 1000);
  return () => clearInterval(id);
}

function friendlyError(e) {
  const msg = (e && e.message ? e.message : String(e)) || "unknown error";
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(msg)) {
    if (getProvider() === "openai") {
      return "OpenAI blocks direct calls from browser pages (no CORS support) — your key is fine, but this static build can't reach api.openai.com. Use Gemini or Anthropic here, or put OpenAI behind a tiny proxy. Raw: " + msg.slice(0, 200);
    }
    return "Network request blocked. Check your connection, then try serving over http (`npx serve .` in the repo folder) instead of file:// — browsers/AdBlock often block API calls from file pages. Raw: " + msg.slice(0, 200);
  }
  return msg.slice(0, 300);
}

async function runPipeline(raw) {
  // Each track iterates: draft -> critique -> revise (MEO_PASSES refine rounds).
  // Research + brand run in parallel, then audit (needs research), then generate.
  const PASSES = 1;
  const TOTAL = PASSES + 2; // draft + critique + revise(s) visible as passes
  resetSteps();
  const passNote = (name) => (n, total) => {
    const li = document.querySelector(`#steps li[data-step="${name}"]`);
    if (li && li.dataset.state === "active") {
      li.dataset.pass = `pass ${n}/${total}`;
      const s = li.querySelector(".step-sub");
      if (s) s.textContent = `calling ${getModel()}… pass ${n}/${total}`;
    }
  };
  setStep("research", "active", `calling ${getModel()}… pass 1/${TOTAL}`);
  setStep("brand", "active", `calling ${getModel()}… pass 1/${TOTAL}`);
  const stopR = tickStep("research", `calling ${getModel()}…`);
  const stopB = tickStep("brand", `calling ${getModel()}…`);
  setStatus("Research + brand tracks running in parallel (draft → critique → revise)…");
  const pR = window.MEO.runResearchRefined(chatMessages, raw, PASSES, passNote("research")).then(
    (r) => { stopR(); setStep("research", "done", `${(r.usps || []).length} USPs · ${(r.keywords || []).length} keywords`); return r; },
    (e) => { stopR(); setStep("research", "error", friendlyError(e)); throw e; }
  );
  const pB = window.MEO.extractBrandRefined(chatPrompt, raw, PASSES, passNote("brand")).then(
    (b) => { stopB(); setStep("brand", "done", (b.colors || []).slice(0, 3).join(" ") || "tokens parsed"); return b; },
    (e) => { stopB(); setStep("brand", "error", friendlyError(e)); throw e; }
  );
  // Auto image track: page photos when input has a URL, else research supplies URLs.
  const pageUrl = detectUrl(raw);
  $("imgStatus").textContent = pageUrl ? "Auto-fetching page images…" : "Research will supply product image URLs…";
  const pI = (async () => {
    if (!pageUrl) return [];
    try {
      return (await window.MEO.fetchPageImages(pageUrl)).map((im) => im.src);
    } catch (e) {
      $("imgStatus").textContent = "Page images blocked — falling back to research image URLs.";
      return [];
    }
  })();
  const [research, brand, pageImgs] = await Promise.all([pR, pB, pI]);
  // Merge: page photos first, then manual URLs, then research URLs — then
  // load-verify so only images that actually render reach the page.
  const merged = [];
  const seen = {};
  pageImgs.concat(manualImages(), research.images || []).forEach((u) => {
    const url = typeof u === "string" ? u : u.src;
    if (url && !seen[url]) { seen[url] = true; merged.push(url); }
  });
  $("imgStatus").textContent = `Verifying ${merged.length} image URLs…`;
  research.images = await window.MEO.verifyImages(merged);
  $("imgStatus").textContent = research.images.length
    ? `${research.images.length} verified image${research.images.length > 1 ? "s" : ""} will be used.`
    : "No loadable images found — page will use brand visuals.";
  setStep("audit", "active", `scoring vs GEO/AEO checks… pass 1/${TOTAL}`);
  const stopA = tickStep("audit", "scoring vs GEO/AEO checks…");
  setStatus("Audit track running (draft → critique → revise)…");
  let auditRaw;
  try {
    auditRaw = await window.MEO.runAuditRefined(chatMessages, raw, JSON.stringify(research).slice(0, 2000), PASSES, passNote("audit"));
    stopA();
    setStep("audit", "done", `score ${auditRaw.score} · ${auditRaw.checks.length} checks · ${auditRaw.keywords.length} keywords`);
  } catch (e) {
    stopA();
    setStep("audit", "error", friendlyError(e));
    throw e;
  }
  const audit = {
    input: raw,
    geo: auditRaw.score,
    aeo: Math.round(auditRaw.checks.reduce((s, c) => s + c.score, 0) / Math.max(1, auditRaw.checks.length)),
    overall: auditRaw.score,
    fixes: auditRaw.checks.map((c) => c.fix),
    keywords: auditRaw.keywords,
  };
  renderAudit(audit);
  renderLive(research, auditRaw, brand);
  lastAudit = audit;
  setStep("generate", "active", "writing standalone HTML…");
  const stopG = tickStep("generate", "writing standalone HTML…");
  setStatus("Generating optimized page (draft → critique → revise)…");
  try {
    lastGeneratedHtml = await window.MEO.runGenerateRefined(chatPrompt, research, auditRaw, brand, PASSES, passNote("generate"));
    stopG();
    setStep("generate", "done", `${(lastGeneratedHtml.length / 1024).toFixed(1)} KB page ready`);
  } catch (e) {
    stopG();
    setStep("generate", "error", friendlyError(e));
    throw e;
  }
  setStatus(`Done — live ${getProvider()} run. Open in new tab or Export the generated page.`);
}

function manualImages() {
  const seen = {};
  return $("manualImages").value.split("\n").map((s) => s.trim()).filter((u) => {
    if (!/^https?:\/\//i.test(u) || seen[u]) return false;
    seen[u] = true;
    return true;
  });
}

function detectUrl(text) {
  return (String(text).match(/https?:\/\/[^\s]+/i) || [])[0] || "";
}
$("provider").addEventListener("change", () => {
  try {
    fillModels(localStorage.getItem("meo.model." + getProvider()));
    $("apiKey").value = localStorage.getItem("meo.key." + getProvider()) || "";
  } catch (e) { fillModels(); $("apiKey").value = ""; }
  refreshHint();
});
$("model").addEventListener("change", () => { savePrefs(); refreshHint(); });
$("apiKey").addEventListener("input", () => { savePrefs(); refreshHint(); });

$("run").addEventListener("click", async () => {
  const raw = $("input").value;
  savePrefs();
  lastGeneratedHtml = null;
  if (!getKey()) {
    resetSteps();
    ["research", "brand", "audit", "generate"].forEach((n) => setStep(n, "done", "mock — no key"));
    lastAudit = mockAudit(raw);
    renderAudit(lastAudit);
    setStatus("Mock audit shown (no key). Open in new tab or Export it, or add a key for the live engine.");
    return;
  }
  try {
    await runPipeline(raw);
  } catch (e) {
    setStatus("Live run failed: " + friendlyError(e));
  }
});

function currentHtml() {
  if (lastGeneratedHtml) return lastGeneratedHtml;
  if (lastAudit) return buildStandaloneHTML(lastAudit);
  return null;
}

$("openTab").addEventListener("click", () => {
  const html = currentHtml();
  if (!html) return;
  window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank", "noopener");
});

$("exportHtml").addEventListener("click", () => {
  const html = currentHtml();
  if (!html) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = "meo-optimized-page.html";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});

loadPrefs();
