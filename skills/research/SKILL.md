Use when researching a business, topic, or competitor set before generating a page.
# Research Skill v0.1.0

## Purpose
Produce grounded facts, USPs, competitors, keywords, and image ideas.

## Prompt template
```
Research "{topic}" in {locale}. Return ONLY JSON matching the output schema.
Prefer official sites. Mark uncertain facts with "(unverified)".
Collect: key facts, 3-5 USPs, 3-5 competitors, SEO keywords, 3-5 image ideas.
```

## Input schema (JSON)
```json
{ "topic": "string", "locale": "string (e.g. en-IN)" }
```

## Output schema (JSON)
```json
{
  "facts": ["string"],
  "usps": ["string (3-5)"],
  "competitors": [{ "name": "string", "url": "string", "note": "string" }],
  "keywords": { "primary": ["string"], "secondary": ["string"] },
  "images": [{ "idea": "string", "alt": "string", "query": "string" }]
}
```

## Rules
- Output valid JSON only, no markdown fences.
- At least 3 facts, 3 USPs, 3 competitors, 5 keywords, 3 image ideas.
- Empty field -> use [] or "" never null.
