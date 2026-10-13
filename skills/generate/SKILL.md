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
- Single HTML document: <!DOCTYPE html> ... </html>.
- Inline <style> only; no <link> stylesheets, no external scripts.
- One <h1>, title + meta description using primary keyword.
- JSON-LD <script type="application/ld+json"> valid JSON.
- No lorem ipsum; every claim traceable to research facts.

## Rules
- Return HTML only, no fences, no commentary.
- Keep total under ~60KB; images as plain <img> with alt text.
