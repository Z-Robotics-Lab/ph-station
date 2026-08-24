# @deepseek-ai/dsh-client-ui-ph-icons

PH cockpit icon set: a small vendored subset of [tabler-icons](https://github.com/tabler/tabler-icons) (MIT) as typed React atoms. Each glyph is a 24×24 outline with `stroke="currentColor"`, so it inherits the surrounding text color and needs no per-theme styling. Icons take `{ size = 16, className }` and render a decorative (`aria-hidden`) `<svg>`.

The set is deliberately curated, not the full ~5900-icon package: the cockpit uses a fixed handful (tab strip, panel titles, node kinds, status chips, buttons), so the paths are copied in rather than pulled as a runtime dependency. Attribution lives in the repository [`THIRD_PARTY_NOTICES.md`](../../../THIRD_PARTY_NOTICES.md).

This is a shared platform leaf (like `ui-primitives`): it is seeded into the frozen browser module table so the purity-gated plugin bundles (`ui-conversation`, `ui-ph-*`) can value-import its components.

## Usage

```tsx
import { IconBox, Icon } from '@deepseek-ai/dsh-client-ui-ph-icons'

<IconBox size={14} />            // by named export
const Glyph = Icon['sitemap']    // by tabler outline name
```

## Adding an icon

Copy the `<path d=…>` bodies from `@tabler/icons/icons/outline/<name>.svg` into a new component in `src/index.tsx` (the shared `Svg` wrapper supplies the frame and stroke), then add it to the `Icon` index.

## Model Experience

None. This package contributes no tools, prompts, session events, or model-visible text; it is a browser-only presentational asset with no token or KV-cache effect.

## Known Limitations and Deferred Work

The exported set covers only the glyphs the cockpit renders today (the tab strip and a handful of panel affordances). The remaining icons named in `docs/ph-cockpit-v3.md` §4.2 (node kinds, status chips, buttons, empty states) are added on demand as the panels that use them land — deferred, not missing.
