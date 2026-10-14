Use when rendering the final page from validated content into fixed HTML.
# Template Skill v0.1.0

## Purpose
Deterministic page renderer. Layout, CSS classes, JSON-LD, and fallbacks are
engine-owned; the model supplies only content JSON. Output quality cannot
drift between runs, providers, or inputs.

## Layout (always, in order)
site-head (brand mark + AI-score chip) > hero 56/44 (copy + media) >
proof (3 trust) > gallery (2+ images only) > specs table > FAQ details >
footer. Product + FAQPage JSON-LD in head.

## Rules
- Escape every content string; never inject model HTML.
- Hero media: first verified image, else brand-gradient SVG with initial.
- Gallery renders only when 2+ images exist; never render broken <img>.
- CSS comes from buildBrandCss only — no per-page custom styles.
