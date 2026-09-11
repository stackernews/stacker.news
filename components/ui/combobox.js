import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { cn } from '@/lib/cn'
import { popoverClasses } from './popover'
import { itemClasses } from './menu'
import popoverStyles from './popover.module.css'
import styles from './combobox.module.css'

export const Combobox = BaseCombobox

export function ComboboxPopup ({ side, align, sideOffset = 2, className, children, ...props }) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner side={side} align={align} sideOffset={sideOffset} className={popoverStyles.positioner}>
        <BaseCombobox.Popup className={popoverClasses({ className: cn('text-base', className) })} {...props}>
          {children}
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}

export function ComboboxList ({ className, ...props }) {
  return <BaseCombobox.List className={cn('list-none ps-0 mb-0', className)} {...props} />
}

// select-style rows (react-select's option), as opposed to dropdown items
export const optionClasses = ({ className } = {}) =>
  cn(styles.option, 'block w-full py-2 px-3 whitespace-nowrap max-md:min-h-11', className)

export function ComboboxItem ({ variant = 'menu', active, className, ...props }) {
  const classes = variant === 'option' ? optionClasses({ className }) : itemClasses({ active, className })
  return <BaseCombobox.Item className={classes} {...props} />
}
