Use when auditing a generated page for quality, SEO, and correctness before shipping.
# Audit Skill v0.1.0

## Purpose
Score page quality and return pass/fail checks plus keyword coverage.

## Prompt template
```
Audit this HTML for "{topic}". Return ONLY JSON matching the output schema.
Checks: title+meta present, single h1, JSON-LD valid, inline style only,
no placeholder text, keywords covered, mobile viewport tag.
Score = 0-100 weighted by failed checks (-15 critical, -5 minor).
```

## Input schema (JSON)
```json
{ "topic": "string", "html": "string", "keywords": ["string"] }
```

## Output schema (JSON)
```json
{
  "score": "number 0-100",
  "checks": [{ "id": "string", "pass": "boolean", "severity": "critical|minor", "detail": "string" }],
  "keywords": { "covered": ["string"], "missing": ["string"] }
}
```

## Rules
- Output valid JSON only, no markdown fences.
- Ship threshold: score >= 80 and zero failed critical checks.
- Each check needs a one-line actionable detail on failure.
