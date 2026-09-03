import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { cn } from '@/lib/cn'
import { popoverClasses } from './popover'
import { itemClasses } from './menu'
import popoverStyles from './popover.module.css'

export const Combobox = BaseCombobox

export function ComboboxPopup ({ side, align, sideOffset = 2, className, children, ...props }) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner side={side} align={align} sideOffset={sideOffset} className={popoverStyles.positioner}>
        <BaseCombobox.Popup className={popoverClasses({ className })} {...props}>
          {children}
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}

export function ComboboxList ({ className, ...props }) {
  return <BaseCombobox.List className={cn('list-none ps-0 mb-0 text-base', className)} {...props} />
}

export function ComboboxItem ({ active, className, ...props }) {
  return <BaseCombobox.Item className={itemClasses({ active, className })} {...props} />
}
