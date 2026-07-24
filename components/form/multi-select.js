import { useEffect, useMemo } from 'react'
import { useFormikContext, useField } from 'formik'
import { Combobox } from '@base-ui/react/combobox'
import ArrowDownSFill from '@/svgs/arrow-down-s-fill.svg'
import CloseIcon from '@/svgs/close-line.svg'
import CheckIcon from '@/svgs/check-line.svg'
import Info from '@/components/info'
import { popoverClasses } from '@/components/ui/popover'
import popoverStyles from '@/components/ui/popover.module.css'
import { itemClasses } from '@/components/ui/menu'
import styles from './multi-select.module.css'
import { cn } from '@/lib/cn'
import { FormGroup, hintClasses, errorClasses, inputClasses } from './field'

export function MultiSelect ({ label, items, size = 'lg', info, groupClassName, onChange, noForm, overrideValue, hint, placeholder, onValueClick, ...props }) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()
  const invalid = meta.touched && meta.error

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
    }
  }, [overrideValue])

  // useSubs' mixed array (strings plus the muted { label, items } group) is
  // normalized to all groups: Base UI's isGroupedItems needs every entry to carry .items
  const options = useMemo(() => {
    const flat = []; const groups = []
    for (const item of items) {
      if (item && typeof item === 'object' && item.items) groups.push(item)
      else flat.push(item)
    }
    return [{ items: flat }, ...groups]
  }, [items])

  const currentValue = field.value || props.value || []

  return (
    <FormGroup label={label} className={groupClassName}>
      <span className='flex items-center'>
        <Combobox.Root
          multiple name={field.name} items={options} value={currentValue}
          onValueChange={vals => { helpers?.setValue?.(vals); onChange?.(formik, vals) }}
        >
          {/* react-select's control anatomy: the outer row never wraps, Chips is the
              wrapping value container (flex-1), the indicators are a fixed right column */}
          <Combobox.InputGroup className={cn(inputClasses(), 'flex items-center gap-1.5 cursor-text w-auto', styles.control, invalid && styles.isInvalid)}>
            <Combobox.Chips className='flex flex-wrap items-center gap-1.5 flex-1 min-w-0'>
              <Combobox.Value>
                {vals => (
                  <>
                    {vals.map(v => (
                      <Combobox.Chip key={v} className={styles.chip}>
                        <span
                          className={cn('font-bold text-xs py-0.5', onValueClick && 'cursor-pointer')}
                          onMouseDown={e => { if (onValueClick) { e.preventDefault(); e.stopPropagation(); onValueClick(v) } }}
                        >
                          {v}
                        </span>
                        <Combobox.ChipRemove aria-label={`Remove ${v}`} className='px-1 cursor-pointer border-0 bg-transparent'>
                          <CloseIcon width={14} height={14} className='fill-grey' />
                        </Combobox.ChipRemove>
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input placeholder={vals.length ? '' : placeholder} className='flex-1 min-w-15 border-0 bg-transparent outline-none p-0' />
                  </>
                )}
              </Combobox.Value>
            </Combobox.Chips>
            {/* Clear auto-unmounts at zero chips and bakes tabIndex -1 and a
                focus-preserving mousedown; both buttons are click-only, like
                the old react-select indicators */}
            <Combobox.Clear
              aria-label='Clear selection'
              className='flex items-center px-1 border-0 bg-transparent cursor-pointer max-md:min-w-11 max-md:min-h-11 max-md:justify-center'
            >
              <CloseIcon width={16} height={16} className='fill-grey' />
            </Combobox.Clear>
            <Combobox.Trigger
              aria-label='Open popup'
              className='flex items-center px-2 border-0 bg-transparent cursor-pointer max-md:min-w-11 max-md:min-h-11 max-md:justify-center'
            >
              <ArrowDownSFill width={20} height={20} className='fill-grey' />
            </Combobox.Trigger>
          </Combobox.InputGroup>
          <Combobox.Portal>
            <Combobox.Positioner sideOffset={2} className={popoverStyles.positioner}>
              <Combobox.Popup className={popoverClasses({ className: 'max-w-none w-(--anchor-width) mt-1' })}>
                <Combobox.Empty className='not-empty:py-2 not-empty:px-6 text-muted text-base'>no territories found</Combobox.Empty>
                <Combobox.List className='list-none ps-0 mb-0 not-empty:py-2 max-h-108 overflow-auto text-base'>
                  {group => (
                    <Combobox.Group key={group.label ?? 'all'} items={group.items}>
                      {group.label && <Combobox.GroupLabel className={styles.groupLabel}>{group.label}</Combobox.GroupLabel>}
                      <Combobox.Collection>
                        {sub => (
                          <Combobox.Item key={sub} value={sub} className={itemClasses({ className: cn('flex items-center gap-2', styles.item) })}>
                            <Combobox.ItemIndicator render={<CheckIcon width={16} height={16} className='fill-current shrink-0' />} /> {sub}
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        {info && <Info>{info}</Info>}
      </span>
      {meta.touched && meta.error &&
        <div className={errorClasses()}>
          {meta.touched && meta.error}
        </div>}
      {hint &&
        <small className={hintClasses()}>
          {hint}
        </small>}
    </FormGroup>
  )
}
