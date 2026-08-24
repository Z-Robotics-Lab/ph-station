/**
 * PH cockpit icon set — a vendored subset of tabler-icons.
 *
 * The glyph path data is copied verbatim from tabler-icons v3.31.0 (outline),
 * MIT © Paweł Kuna, https://github.com/tabler/tabler-icons. Each icon is a
 * 24×24 `stroke="currentColor"` atom, so it inherits the surrounding text
 * color and adapts to light/dark themes with no per-icon styling. Attribution
 * is recorded in the repository `THIRD_PARTY_NOTICES.md`.
 *
 * Adding an icon: paste the two-or-more `<path d=…>` bodies from
 * `@tabler/icons/icons/outline/<name>.svg` into a new component below — the
 * shared `Svg` wrapper supplies the frame, stroke, and accessibility state.
 * @module @deepseek-ai/dsh-client-ui-ph-icons
 */

import type { PropsWithChildren, ReactElement } from 'react'

/** Sizing and class inputs common to every icon; `size` is the pixel edge. */
export interface IconProps {
  size?: number
  className?: string
}

/** An icon atom: props in, one decorative `<svg>` out. */
export type IconComponent = (props: IconProps) => ReactElement

/** The tabler outline frame: fixed 24-unit viewBox, currentColor stroke, decorative. */
const Svg = ({ size = 16, className, children }: PropsWithChildren<IconProps>): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

/** tabler `layout-dashboard`. */
export const IconLayoutDashboard: IconComponent = props => (
  <Svg {...props}>
    <path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" />
    <path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" />
    <path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" />
    <path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" />
  </Svg>
)

/** tabler `message`. */
export const IconMessage: IconComponent = props => (
  <Svg {...props}>
    <path d="M8 9h8" />
    <path d="M8 13h6" />
    <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z" />
  </Svg>
)

/** tabler `route`. */
export const IconRoute: IconComponent = props => (
  <Svg {...props}>
    <path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4z" />
    <path d="M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5" />
  </Svg>
)

/** tabler `sitemap`. */
export const IconSitemap: IconComponent = props => (
  <Svg {...props}>
    <path d="M3 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
    <path d="M15 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
    <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
    <path d="M6 15v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1" />
    <path d="M12 9l0 3" />
  </Svg>
)

/** tabler `report`. */
export const IconReport: IconComponent = props => (
  <Svg {...props}>
    <path d="M8 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h5.697" />
    <path d="M18 14v4h4" />
    <path d="M18 11v-4a2 2 0 0 0 -2 -2h-2" />
    <path d="M8 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
    <path d="M18 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
    <path d="M8 11h4" />
    <path d="M8 15h3" />
  </Svg>
)

/** tabler `trending-up`. */
export const IconTrendingUp: IconComponent = props => (
  <Svg {...props}>
    <path d="M3 17l6 -6l4 4l8 -8" />
    <path d="M14 7l7 0l0 7" />
  </Svg>
)

/** tabler `box`. */
export const IconBox: IconComponent = props => (
  <Svg {...props}>
    <path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" />
    <path d="M12 12l8 -4.5" />
    <path d="M12 12l0 9" />
    <path d="M12 12l-8 -4.5" />
  </Svg>
)

/** tabler `book`. */
export const IconBook: IconComponent = props => (
  <Svg {...props}>
    <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
    <path d="M3 6l0 13" />
    <path d="M12 6l0 13" />
    <path d="M21 6l0 13" />
  </Svg>
)

/** tabler `books`. */
export const IconBooks: IconComponent = props => (
  <Svg {...props}>
    <path d="M5 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
    <path d="M9 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
    <path d="M5 8h4" />
    <path d="M9 16h4" />
    <path d="M13.803 4.56l2.184 -.53c.562 -.135 1.133 .19 1.282 .732l3.695 13.418a1.02 1.02 0 0 1 -.634 1.219l-.133 .041l-2.184 .53c-.562 .135 -1.133 -.19 -1.282 -.732l-3.695 -13.418a1.02 1.02 0 0 1 .634 -1.219l.133 -.041z" />
    <path d="M14 9l4 -1" />
    <path d="M16 16l3.923 -.98" />
  </Svg>
)

/** Every icon keyed by its tabler outline name, for lookup by string. */
export const Icon: Readonly<Record<string, IconComponent>> = {
  'layout-dashboard': IconLayoutDashboard,
  'message': IconMessage,
  'route': IconRoute,
  'sitemap': IconSitemap,
  'report': IconReport,
  'trending-up': IconTrendingUp,
  'box': IconBox,
  'book': IconBook,
  'books': IconBooks,
}
