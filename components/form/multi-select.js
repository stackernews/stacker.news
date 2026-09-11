import { useEffect, useMemo, useState } from 'react'
import { Combobox, ComboboxPopup, ComboboxList, ComboboxItem } from '@/components/ui/combobox'
import ArrowDownSFill from '@/svgs/arrow-down-s-fill.svg'
import CloseIcon from '@/svgs/close-line.svg'
import CheckIcon from '@/svgs/check-line.svg'
import Info from '@/components/info'
import styles from './multi-select.module.css'
import { cn } from '@/lib/cn'
import { FormGroup, hintClasses, errorClasses, inputClasses } from './field'
import { useFormikField } from './use-formik-field'

const ICONS = { sm: { trigger: 16, clear: 14 }, md: { trigger: 20, clear: 16 } }

export function MultiSelect ({ label, items, size = 'md', info, groupClassName, className, onChange, noForm, overrideValue, hint, placeholder, emptyText = 'no matches', onValueClick, ...props }) {
  const { field, meta, helpers, formik, invalid } = useFormikField(props, { noForm })
  // base ui keeps a multiple popup open across picks, react-select closed it
  const [open, setOpen] = useState(false)

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
  const icons = ICONS[size]

  return (
    <FormGroup label={label} htmlFor={id} className={groupClassName}>
      <span className='flex items-center'>
        <Combobox.Root
          multiple name={field.name} items={options} value={currentValue}
          open={open} onOpenChange={setOpen}
          onValueChange={vals => { setOpen(false); helpers.setValue?.(vals); onChange?.(formik, vals) }}
        >
          <Combobox.InputGroup className={cn(inputClasses({ size, className }), 'flex items-center gap-1.5 cursor-text w-auto min-w-50', styles.control)} data-invalid={invalid ? '' : undefined}>
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
                              className='font-bold text-[85%] px-1.5 py-0.5'
                              onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
                              onClick={e => { e.stopPropagation(); onValueClick(v) }}
                            >
                              {v}
                            </button>
                            )
                          : <span className='font-bold text-[85%] px-1.5 py-0.5'>{v}</span>}
                        <Combobox.ChipRemove aria-label={`remove ${v}`} className='flex items-center px-1'>
                          <CloseIcon width={14} height={14} className='fill-muted' />
                        </Combobox.ChipRemove>
                      </Combobox.Chip>
                    ))}
                    {/* size=1 so the input grows with the row instead of its default 20ch */}
                    <Combobox.Input id={id} size={1} placeholder={vals.length ? '' : placeholder} className='flex-1 min-w-16 outline-none' />
                  </>
                )}
              </Combobox.Value>
            </Combobox.Chips>
            <Combobox.Clear
              aria-label='clear selection'
              className='flex items-center px-1 max-md:min-w-11 max-md:min-h-11 max-md:justify-center'
            >
              <CloseIcon width={icons.clear} height={icons.clear} className='fill-muted' />
            </Combobox.Clear>
            <Combobox.Trigger
              aria-label='open popup'
              className='flex items-center px-2 max-md:min-w-11 max-md:min-h-11 max-md:justify-center'
            >
              <ArrowDownSFill width={icons.trigger} height={icons.trigger} className='fill-muted' />
            </Combobox.Trigger>
          </Combobox.InputGroup>
          <ComboboxPopup className={cn('max-w-none w-(--anchor-width) mt-1', size === 'sm' && 'text-sm')}>
            <Combobox.Empty className='not-empty:py-2 not-empty:px-3 text-muted'>{emptyText}</Combobox.Empty>
            <ComboboxList className={cn('not-empty:py-2 overflow-auto', styles.list)}>
              {group => (
                <Combobox.Group key={group.label ?? 'all'} items={group.items}>
                  {group.label && <Combobox.GroupLabel className={cn('px-3 py-1 text-xs uppercase', styles.groupLabel)}>{group.label}</Combobox.GroupLabel>}
                  <Combobox.Collection>
                    {sub => (
                      <ComboboxItem key={sub} value={sub} variant='option' className='flex items-center gap-2'>
                        <Combobox.ItemIndicator render={<CheckIcon width={16} height={16} className='shrink-0' />} /> {sub}
                      </ComboboxItem>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox.Root>
        {info && <Info>{info}</Info>}
      </span>
      {invalid &&
        <div className={errorClasses()}>
          {meta.error}
        </div>}
      {hint &&
        <small className={hintClasses()}>
          {hint}
        </small>}
    </FormGroup>
  )
}
