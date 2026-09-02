import { Popover as BasePopover } from '@base-ui/react/popover'
import { cn } from '@/lib/cn'
import styles from './popover.module.css'
import arrowStyles from './arrow.module.css'

// also used by the preview card, the table of contents and the link editor
export const popoverClasses = ({ className } = {}) =>
  cn(styles.popup, 'text-sm max-w-80 rounded-lg shadow-lg', className)

export function Popover (props) {
  return <BasePopover.Root {...props} />
}

export function PopoverContent ({ side = 'bottom', align = 'center', sideOffset = 8, anchor, initialFocus, finalFocus, className, children, ...props }) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} anchor={anchor} className={styles.positioner}>
        <BasePopover.Popup {...props} initialFocus={initialFocus} finalFocus={finalFocus} className={popoverClasses({ className })}>
          <BasePopover.Arrow className={arrowStyles.arrow} />
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

export function PopoverHeader ({ className, children }) {
  return <BasePopover.Title render={<h4 />} className={cn(styles.header, 'flex justify-between items-center py-1.5 px-4 mb-0 text-base font-medium', className)}>{children}</BasePopover.Title>
}

export function PopoverBody ({ className, children }) {
  return <div className={cn('py-2 px-4', className)}>{children}</div>
}

export function PopoverClose (props) {
  return <BasePopover.Close className={styles.close} aria-label='Close' {...props}>X</BasePopover.Close>
}

export const PopoverTrigger = BasePopover.Trigger
