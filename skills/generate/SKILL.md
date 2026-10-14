Use when generating the final standalone HTML page from research facts.
# Generate Skill v0.1.0

## Purpose
Turn research JSON into one self-contained HTML document with JSON-LD.

## Prompt template
```
Generate a page for "{topic}" from the given research JSON.
Return the full HTML document only. Inline <style> in <head>, no external
CSS/JS. Include sections: hero, facts, USPs, competitors, FAQ.
Embed valid JSON-LD (LocalBusiness/Organization + FAQPage).
```

## Input
Research JSON: {facts, usps, competitors, keywords, images}.

## Output contract
- The model returns ONLY content JSON (headline, subhead, rating, reviews,
  price, cta, bullets, specs, faqs, trust) — validated by parseContent.
- NEVER model-written HTML/CSS. MEO.buildPage (template skill) renders the
  fixed layout deterministically, so every run looks identical in structure.
- Exactly one <h1>, title + meta description from headline/subhead.
- JSON-LD <script type="application/ld+json"> valid JSON.
- No lorem ipsum; every claim traceable to research facts.
- Layout skeleton: .wrap > header.hero (.hero-copy + .hero-media, 56/44 grid) + .proof + .specs + .faq + footer.
- Brand: style ONLY via var(--bN)/var(--f0) tokens; engine injects :root + base CSS.
- Images: allow-listed URLs only, else inline <svg>; never hotlink/invent URLs.
- Multi-pass: draft -> critique (checklist above) -> revise; keep best valid page.

## Rules
- Return HTML only, no fences, no commentary.
- Keep total under ~60KB; images as plain <img> with alt text.
