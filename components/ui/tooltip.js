import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/cn'
import styles from './tooltip.module.css'
import arrowStyles from './arrow.module.css'

// _app.js mounts one provider so moving between adjacent triggers does not
// replay the opening delay. Per-tooltip delays stay on each trigger.
export function TooltipProvider ({ children }) {
  return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>
}

// The trigger must forward its props and ref. Only the popup is portaled.
export default function Tooltip ({ children, content, side = 'bottom', delay, closeDelay, disabled, className }) {
  if (!content) return children
  return (
    <BaseTooltip.Root disabled={disabled}>
      {/* Tooltips open immediately unless a caller asks for a delay. */}
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
