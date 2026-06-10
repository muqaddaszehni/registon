# Registon — Interactive Monument Valley-style Registan Square

**Date:** 2026-06-10
**Status:** Approved design, pre-implementation

## What this is

A full-screen, web-based interactive 3D rendering of Registan Square, Samarkand, in the visual style of Monument Valley: low-poly flat-shaded geometry, orthographic isometric camera, toy-like charm — but in Registan's real colors. The user lands directly in the scene (no landing page), guides a small character around the plaza by tapping/clicking, and discovers 8 story hotspots that open short bilingual story cards.

**Priorities (user-stated, in order):** game-like feel → educational layer → public showcase.

## Experience

- **Camera:** fixed orthographic isometric, initially viewing from south-east. Rotatable in 90° snaps (corner button on desktop, two-finger twist on touch) between four fixed views — the Monument Valley "turn the toy" feel. No free orbit.
- **World:** the plaza + the three facades, true to the real layout — Ulugh Beg Madrasah (west), Sher-Dor (east, facing it), Tilya-Kori (north). Character enters from the south. Facades only; no interior courtyards (deliberate scope cut).
- **Movement:** tap/click any walkable tile → character pathfinds (A*) and strolls there. No jumping, no puzzles, no fail states.
- **Hotspots (8):** glowing tiles. Stepping on one slides in a story card (DOM overlay, not 3D): 2–3 sentences + small detail illustration + EN / Тоҷикӣ toggle.
  1. Ulugh Beg portal — the astronomer-king's madrasah
  2. Ulugh Beg minaret — the leaning minaret straightened in 1932
  3. Sher-Dor portal — the tiger-lions and rising sun; rule-breaking figurative art
  4. Sher-Dor dome — the ribbed turquoise twin domes
  5. Tilya-Kori portal — "the gilded one"; madrasah + Friday mosque
  6. Tilya-Kori dome — gold-leaf mihrab beneath turquoise
  7. Plaza centre — "Registan" = sandy place; six centuries of public life
  8. The doves — ambient vignette, tiny card
- **Ambience:** wandering doves that scatter when walked into; 2–3 stylized low-poly trees with drifting leaf particles; heat shimmer. Soft background music behind a corner toggle, **muted by default** (track wired up later — toggle and audio module built now).

## Visual direction — "Majolica & Sand" (chosen over MV-pastel and day-cycle options)

- Monument Valley geometry and flatness, Registan's real palette: warm sandstone walls, cobalt/lapis portals, turquoise domes, cream sky accents.
- **Fixed sunset, permanently golden hour** (user-confirmed; day-cycle explicitly rejected): low warm directional sun, long soft shadows, peach→lavender sky gradient, emissive glints on turquoise domes. Lighting is a first-class feature — Registan is famous for its sunset.
- **Ornament is required, not optional.** Silhouettes alone are insufficient (user-stated). Geometric tilework must read clearly: girih star lattices, majolica bands, Kufic-style border strips — drawn as **procedurally generated canvas textures** in palette colors (no photos, no image assets). Sher-Dor's tiger-and-sun mosaic appears as a stylized flat decal on its portal.

## Technical design

**Stack:** Vite + TypeScript + vanilla Three.js. No React, no game engine, no model files, no downloaded assets — all geometry procedural, all textures canvas-generated at runtime. (Chosen over React Three Fiber and Godot/Unity WebGL exports for bundle size, hackability, and fit-to-scope.)

**Modules** (each small, single-purpose, independently testable):

| Module | Responsibility |
|---|---|
| `scene` | Renderer, orthographic camera, 90° rotation tweening, sunset lighting rig, sky gradient |
| `buildings` | One file per madrasah; procedural primitives (boxes, lathed domes, extruded arches) |
| `patterns` | Canvas-texture generators, one per motif (girih, bands, Kufic strips, tiger decal) |
| `world` | Ground plane + walkable grid (2D array: walkable/blocked/hotspot) |
| `character` | A* pathfinding on grid, walk animation, raycast tap-to-move input |
| `hotspots` | Glowing tiles, proximity triggers, fire card-open events |
| `ambience` | Doves (wander/scatter), leaf particles, heat shimmer; respects reduced-motion |
| `audio` | Music toggle UI + playback plumbing; muted by default; track added later |
| `ui` | DOM-overlay story cards, EN/Тоҷикӣ toggle, rotate button, music toggle |
| `content` | `content.json`: `{ id, title_en, title_tj, body_en, body_tj }` per hotspot |

UI is DOM, not 3D — cards, toggles, and buttons are HTML/CSS layered over the full-viewport canvas.

**Performance:** hard floor of 60fps on a mid-range phone. Poly count may rise to serve ornament and detail (user-approved) as long as the floor holds. Flat shading, merged geometry, no per-frame allocations.

## Content & localization

- Languages: **English + Tajik (Cyrillic)**.
- All copy lives in `content.json`; editing stories never touches code.
- English drafted from historical sources. Tajik drafted alongside but **flagged as requiring native-speaker review before launch** — machine-drafted Tajik is not publishable as-is.

## Edge cases

- **No WebGL:** full-screen fallback card with a static image and a short message.
- **Portrait phones:** camera pulls back to frame the whole plaza; story cards become bottom-sheets.
- **`prefers-reduced-motion`:** doves walk instead of flutter; no shimmer; camera rotation still snaps but without easing flourish.
- **Loading:** near-zero (no asset files); brief palette-colored fade-in.

## Testing & verification

- **Unit (Vitest):** pathfinding, grid logic, content-loading/i18n lookup.
- **Real verification (required before any "done" claim):** run in actual desktop browsers and a real/throttled mobile profile; confirm 60fps via devtools performance capture; manually walk every hotspot in both languages.

## Explicitly out of scope (v1)

- Interior courtyards, puzzle mechanics, character customization, day/night cycle, audio narration, languages beyond EN/TJ, CMS — none of these. Future versions can revisit.

## Deployment & domain

- **Hosting:** Cloudflare Pages — the build output is a static bundle; deploys via `wrangler pages deploy` (CLI, no Cloudflare MCP needed).
- **Domain:** registered at GoDaddy (account has an MCP for domain/DNS management). Recommended setup: keep registration at GoDaddy, point nameservers to Cloudflare so DNS, CDN, and TLS live in one place alongside Pages.
- **Verification:** after DNS cutover, confirm the site loads over HTTPS on the real domain from a phone off-wifi.

## Open items

- Which GoDaddy domain (or a new registration) to use — to be picked once the GoDaddy MCP is registered in Claude Code and we can list the account's domains.
- Music track selection (toggle ships, track later — user-stated).
- Native-speaker review of Tajik copy.
