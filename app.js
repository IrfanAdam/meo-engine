// MEO Engine prototype — mock audit, no backend yet.
document.getElementById("run").addEventListener("click", () => {
  const text = document.getElementById("input").value.toLowerCase();
  let geo = 62, aeo = 58;
  if (text.includes("faq") || text.includes("?")) aeo += 12;
  if (text.includes("$") || text.includes("price")) geo += 8;
  if (text.includes("schema") || text.includes("review")) { geo += 6; aeo += 6; }
  if (text.length > 120) { geo += 5; aeo += 5; }
  geo = Math.min(98, geo); aeo = Math.min(98, aeo);
  const overall = Math.round((geo + aeo) / 2);

  document.getElementById("geo").textContent = geo;
  document.getElementById("aeo").textContent = aeo;
  document.getElementById("overall").textContent = overall;

  const fixes = [
    "Add Product + FAQ JSON-LD schema (citation-ready facts).",
    "Add a 3-question FAQ block answering price / fit / returns.",
    "Put key specs in the first 100 words for answer engines.",
  ];
  const ul = document.getElementById("fixes");
  ul.innerHTML = "";
  fixes.forEach(f => {
    const li = document.createElement("li");
    li.textContent = f;
    ul.appendChild(li);
  });
  document.getElementById("results").classList.remove("hidden");
});
