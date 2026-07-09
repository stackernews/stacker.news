import { Popover as BasePopover } from '@base-ui/react/popover'
import { cn } from '@/lib/cn'
import styles from './popover.module.css'
import arrowStyles from './arrow.module.css'

// popup metrics/typography (keystone 6: colors/border/motion live in the module);
// exported for the Preview Card popup (preview-card.js) and later C5 ToC / C8c link editor
export const popoverClasses = ({ className } = {}) =>
  cn(styles.popup, 'text-sm max-w-80 rounded-lg shadow-lg', className)

function Root (props) {
  return <BasePopover.Root {...props} /> // modal already defaults false
}

function Content ({ side = 'bottom', align = 'center', sideOffset = 8, anchor, initialFocus, finalFocus, className, children }) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} anchor={anchor} className={styles.positioner}>
        <BasePopover.Popup initialFocus={initialFocus} finalFocus={finalFocus} className={popoverClasses({ className })}>
          <BasePopover.Arrow className={arrowStyles.arrow} />
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

// h4 = today's DOM at the only header consumer (upvote passed as='h4')
function Header ({ className, children }) {
  return <h4 className={cn(styles.header, 'flex justify-between items-center py-1.5 px-4 mb-0 text-base font-medium', className)}>{children}</h4>
}

function Body ({ className, children }) {
  return <div className={cn('py-2 px-4', className)}>{children}</div>
}

// lightning X on the alert.module.css .close pattern, at popover-header metrics
function Close (props) {
  return <BasePopover.Close className={styles.close} aria-label='Close' {...props}>X</BasePopover.Close>
}

export default Object.assign(Root, { Trigger: BasePopover.Trigger, Content, Header, Body, Close })
