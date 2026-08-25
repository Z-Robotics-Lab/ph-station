/**
 * Dev-only scratch serve for the ph panel packages: mounts each view over the
 * committed board fixtures (fixtures.json) on :5180, so design audits and
 * headless playwright drive a real runtime render without a board bridge or a
 * workspace build. Never shipped; not part of any tsconfig aggregate or gate.
 *
 *   pnpm exec vite --config scratch/vite.config.ts     (or preview_start "ph-scratch")
 *
 * Regenerate fixtures: python3 scratch/capture-fixtures.py <physical-harness>
 */
// No `import from 'vite'`: vite reaches the repo only as vitest's transitive
// dependency (the .bin shim), so the package id is unresolvable from here —
// a plain config object needs nothing from it.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))
// react is not a root dependency; pin every specifier (incl. esbuild's
// automatic JSX runtime) to the one copy the client packages depend on.
const req = createRequire(here('../packages/client/ui-ph-vault/package.json'))

export default ({
  root: here('.'),
  server: { port: 5180, strictPort: true },
  resolve: {
    alias: [
      { find: /^react$/, replacement: req.resolve('react') },
      { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') },
      { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') },
      { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') },
      { find: /^react-dom$/, replacement: req.resolve('react-dom') },
      // The two bare workspace ids in the panel component graph, mapped to
      // source so a fresh clone serves without `pnpm run build`.
      { find: /^@deepseek-ai\/dsh-client-ui-ph-icons$/, replacement: here('../packages/client/ui-ph-icons/src/index.tsx') },
      { find: /^@deepseek-ai\/dsh-client-ui-primitives$/, replacement: here('../packages/client/ui-primitives/src/index.ts') },
    ],
  },
})
