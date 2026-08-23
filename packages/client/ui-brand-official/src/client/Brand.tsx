import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the physical-harness `PH` monogram at the size and class its host surface requests.
 * @param props - Host-supplied mark presentation.
 * @returns the `PH` text mark.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: `${typeof size === 'number' ? size : 24}px`,
        lineHeight: 1,
        letterSpacing: '-0.03em',
      }}
    >
      PH
    </span>
  )
}

/**
 * Render the physical-harness wordmark without its independently slotted mark.
 * @returns the `physical-harness` text wordmark.
 */
export function OfficialBrandName() {
  return (
    <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '0.06em' }}>physical-harness</span>
  )
}
