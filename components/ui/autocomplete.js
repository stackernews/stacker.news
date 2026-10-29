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
        <BaseAutocomplete.Popup className={popoverClasses({ className: cn('w-(--anchor-width) max-w-none py-0.75 rounded-md text-base', className) })} {...props}>
          {children}
        </BaseAutocomplete.Popup>
      </BaseAutocomplete.Positioner>
    </BaseAutocomplete.Portal>
  )
}

export function AutocompleteList ({ className, ...props }) {
  return <BaseAutocomplete.List className={cn('list-none ps-0 mb-0', className)} {...props} />
}

export function AutocompleteGroupLabel ({ className, action, ...props }) {
  return (
    <div role='presentation' className='flex items-center gap-2 px-3 pt-1.5 pb-0.5 text-xs text-muted'>
      <BaseAutocomplete.GroupLabel className={cn('font-bold', className)} {...props} />
      {action}
    </div>
  )
}

export function AutocompleteItem ({ className, action, ...props }) {
  return (
    <div role='presentation' className='relative mx-1 mt-0.5'>
      <BaseAutocomplete.Item className={cn(styles.item, 'flex items-baseline gap-2 py-1 px-3 rounded-md', className)} {...props} />
      {action}
    </div>
  )
}

// goes around a group's Collection to lay its items out as cards
export function AutocompleteTiles ({ className, ...props }) {
  return <div role='presentation' className={cn('grid gap-2 px-3 pt-0.5', className)} {...props} />
}

// has no padding, what's inside sets it
export function AutocompleteTile ({ className, action, ...props }) {
  return (
    <div role='presentation' className='relative min-w-0'>
      <BaseAutocomplete.Item className={cn(styles.item, styles.tile, 'flex flex-col min-w-0 h-full rounded-md', className)} {...props} />
      {action}
    </div>
  )
}

// Status and Empty always render for screen readers, so padding them would show an empty box
export const autocompleteStatusClasses = ({ className } = {}) =>
  cn('px-3 py-1 text-xs text-muted', className)
