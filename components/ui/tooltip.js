import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/cn'
import styles from './tooltip.module.css'
import arrowStyles from './arrow.module.css'

// _app.js mounts this once for grouping only (adjacent triggers swap
// instantly, 400ms native timeout). Deliberately NO delay props: a Provider
// delay makes the group's open value 0 permanently, and TooltipTrigger's
// groupOpenValue === 0 short-circuit then flattens every per-site delay to 0
// — the 0-default lives on the Trigger below instead
export function TooltipProvider ({ children }) {
  return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>
}

/**
 * SN Tooltip — children must be a single element that spreads props and
 * forwards ref (DOM tags qualify); it stays in place, only the popup portals
 */
export default function Tooltip ({ children, content, side = 'bottom', delay, closeDelay, disabled, className }) {
  if (!content) return children
  return (
    <BaseTooltip.Root disabled={disabled}>
      {/* delay ?? 0 = rb parity (Trigger's own default is 600ms; closeDelay's is already 0) */}
      <BaseTooltip.Trigger render={children} delay={delay ?? 0} closeDelay={closeDelay} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className={styles.positioner}>
          <BaseTooltip.Popup className={cn(styles.popup, 'px-2 py-1 text-sm leading-none text-center wrap-break-word max-w-48 rounded-md', className)}>
            <BaseTooltip.Arrow className={arrowStyles.arrow} />
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
