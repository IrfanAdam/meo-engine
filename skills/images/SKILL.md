Use when resolving product photos that actually depict the product before page generation.
# Images Skill v0.1.0

## Purpose
Auto-resolve fitting, loadable product photos: page extraction first, photo-search fallback with recursive relevance correction.

## Pipeline
```
page URL? -> fetchPageImages (og:image + <img>, chrome filtered)
  : resolveProductImages (search -> LLM judge 0-2 -> corrected re-search, max 3 rounds)
merge (page > searched > research URLs) -> verifyImages (browser load test) -> research.images
```

## Output contract
- Only URLs that fit the product (judge score >= 1) and load in-browser.
- Fail-open: unjudgeable sets keep noun-matching candidates; total failure -> brand SVG visuals.

## Rules
- Never invent URLs; every candidate comes from a fetched page or library API.
- Judge from titles, not pixels; blocklist risky subjects before judging.
- Runs before audit/generate so the page step only sees verified photos.
