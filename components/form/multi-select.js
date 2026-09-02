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

export function MultiSelect ({ label, items, size = 'lg', info, groupClassName, className, onChange, noForm, overrideValue, hint, placeholder, onValueClick, ...props }) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()
  const invalid = meta.touched && meta.error

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
    }
  }, [overrideValue])

  // base ui wants all options or all groups, so plain options go in an unlabeled group
  const options = useMemo(() => {
    const flat = []; const groups = []
    for (const item of items) {
      if (item && typeof item === 'object' && item.items) groups.push(item)
      else flat.push(item)
    }
    return [{ items: flat }, ...groups]
  }, [items])

  const currentValue = field.value || props.value || []
  const id = props.id || props.name
  const controlSize = size === 'sm' ? 'sm' : 'md'
  const triggerIconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20
  const clearIconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16

  return (
    <FormGroup label={label} htmlFor={id} className={groupClassName}>
      <span className='flex items-center'>
        <Combobox.Root
          multiple name={field.name} items={options} value={currentValue}
          onValueChange={vals => { helpers?.setValue?.(vals); onChange?.(formik, vals) }}
        >
          <Combobox.InputGroup className={cn(inputClasses({ size: controlSize, className }), 'flex items-center gap-1.5 cursor-text w-auto', styles.control, invalid && styles.isInvalid)}>
            <Combobox.Chips className='flex flex-wrap items-center gap-1.5 flex-1 min-w-0'>
              <Combobox.Value>
                {vals => (
                  <>
                    {vals.map(v => (
                      <Combobox.Chip key={v} className={styles.chip}>
                        {onValueClick
                          ? (
                            <button
                              type='button'
                              className='font-bold text-xs py-0.5 cursor-pointer border-0 bg-transparent'
                              onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
                              onClick={e => { e.stopPropagation(); onValueClick(v) }}
                            >
                              {v}
                            </button>
                            )
                          : <span className='font-bold text-xs py-0.5'>{v}</span>}
                        <Combobox.ChipRemove aria-label={`remove ${v}`} className='px-1 cursor-pointer border-0 bg-transparent'>
                          <CloseIcon width={clearIconSize} height={clearIconSize} className='fill-muted' />
                        </Combobox.ChipRemove>
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input id={id} placeholder={vals.length ? '' : placeholder} className='flex-1 min-w-15 border-0 bg-transparent outline-none p-0' />
                  </>
                )}
              </Combobox.Value>
            </Combobox.Chips>
            <Combobox.Clear
              aria-label='clear selection'
              className='flex items-center px-1 border-0 bg-transparent cursor-pointer max-md:min-w-11 max-md:min-h-11 max-md:justify-center'
            >
              <CloseIcon width={clearIconSize} height={clearIconSize} className='fill-muted' />
            </Combobox.Clear>
            <Combobox.Trigger
              aria-label='open popup'
              className='flex items-center px-2 border-0 bg-transparent cursor-pointer max-md:min-w-11 max-md:min-h-11 max-md:justify-center'
            >
              <ArrowDownSFill width={triggerIconSize} height={triggerIconSize} className='fill-muted' />
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
