import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete'
import { cn } from '@/lib/cn'
import { popoverClasses } from './popover'
import popoverStyles from './popover.module.css'
import styles from './autocomplete.module.css'

export const Autocomplete = BaseAutocomplete

export function AutocompletePopup ({ side = 'bottom', align = 'start', sideOffset = 6, anchor, positionMethod, className, children, ...props }) {
  return (
    <BaseAutocomplete.Portal>
      <BaseAutocomplete.Positioner side={side} align={align} sideOffset={sideOffset} anchor={anchor} positionMethod={positionMethod} className={popoverStyles.positioner}>
        <BaseAutocomplete.Popup className={popoverClasses({ className: cn('w-(--anchor-width) max-w-none rounded-md', className) })} {...props}>
          {children}
        </BaseAutocomplete.Popup>
      </BaseAutocomplete.Positioner>
    </BaseAutocomplete.Portal>
  )
}

export function AutocompleteList ({ className, ...props }) {
  return <BaseAutocomplete.List className={cn('list-none ps-0 mb-0', className)} {...props} />
}

export function AutocompleteGroupLabel ({ action, ...props }) {
  return (
    <div role='presentation' className='flex items-center gap-2 px-4 text-xs text-muted'>
      <BaseAutocomplete.GroupLabel {...props} />
      {action}
    </div>
  )
}

// mx-1 and px-3 add up to the px-4 of labels, tiles and status lines, so their edges line up
export function AutocompleteItem ({ className, action, ...props }) {
  return (
    <div role='presentation' className='relative mx-1 mt-1'>
      <BaseAutocomplete.Item className={cn(styles.item, 'flex items-baseline gap-2 py-2 px-3 rounded-md text-sm', className)} {...props} />
      {action}
    </div>
  )
}

// goes around a group's Collection to lay its items out as cards
export function AutocompleteTiles ({ className, ...props }) {
  return <div role='presentation' className={cn('grid gap-2 px-4 pt-1', className)} {...props} />
}

// has no padding, what's inside sets it
export function AutocompleteTile ({ className, action, ...props }) {
  return (
    <div role='presentation' className='relative min-w-0'>
      <BaseAutocomplete.Item className={cn(styles.item, styles.tile, 'flex flex-col min-w-0 h-full rounded-md text-sm', className)} {...props} />
      {action}
    </div>
  )
}

// Status and Empty always render for screen readers, so padding them would show an empty box
export const autocompleteStatusClasses = ({ className } = {}) =>
  cn('px-4 pt-3 pb-1 text-xs text-muted', className)
