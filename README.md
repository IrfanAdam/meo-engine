# MEO Engine — Multi-Engine Optimization

Paste a product name or URL → get a **GEO + AEO + SEO-optimized product page** as standalone HTML. Bring your own LLM API key; everything runs in the browser. Static site, no backend, no build step.

## How it works

Five live pipeline steps, all visible with real-time status:

1. **Research** — product facts, USPs, competitors, keywords (draft → critique → revise)
2. **Brand** — colors, fonts, tone extracted as design tokens
3. **Images** — photo hunter: scrapes the pasted page, or hunts stock libraries across multiple rounds with LLM relevance judging (only exact-fit photos pass)
4. **Audit** — GEO/AEO scores, checks, and keyword placements
5. **Generate** — the model writes validated content JSON; the engine renders it into a fixed, polished template (hero, proof, gallery, specs, FAQ, Product + FAQPage JSON-LD)

Open the result in a new tab or export it as a `.html` file.

## Providers (BYO key, stored locally)

- Gemini (default: `gemini-3.5-flash-lite`)
- OpenAI (`gpt-4o-mini`) — needs a CORS proxy from browsers
- Anthropic (`claude-haiku-4-5`)
- No key? A mock audit runs so the UI is still explorable.

New provider = one file in `providers/` behind the single `MEO.chat()` interface. Portable skills live in `skills/` (`registry.json`).

## Run locally

Open `index.html` directly, or:

```bash
npx serve .
```

## Deploy (Vercel)

Import this repo in Vercel — static site, no build step needed.
