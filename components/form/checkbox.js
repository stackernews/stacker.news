import { createContext, useContext, useId } from 'react'
import { useField } from 'formik'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group'
import { cn } from '@/lib/cn'
import { FormGroup, labelClasses, errorClasses } from './field'
import { useFormikField } from './use-formik-field'
import styles from './checkbox.module.css'

// inside a CheckboxGroup the group writes the formik array, not the checkbox
const CheckboxGroupContext = createContext(false)

export function Checkbox ({
  children, label, groupClassName, type = 'checkbox',
  hiddenLabel, extra, handleChange, inline, disabled, checked, noForm, ...props
}) {
  const inGroup = useContext(CheckboxGroupContext)
  // type lets formik derive checked from the array when the checkbox has a value
  const { field, meta, helpers } = useFormikField({ ...props, type }, { noForm })
  const invalid = meta.touched && meta.error
  const id = props.id || props.name

  return (
    <FormGroup className={groupClassName}>
      {hiddenLabel && <label className={cn(labelClasses(), 'invisible block')}>{label}</label>}
      <label className={cn(styles.check, 'mb-0.5', inline && 'inline-flex me-4')}>
        <BaseCheckbox.Root
          id={id}
          {...props}
          disabled={disabled}
          checked={checked ?? !!field.checked}
          className={cn(styles.checkInput, styles.checkbox, invalid && styles.invalid)}
          onCheckedChange={(checked) => {
            if (!inGroup) helpers.setValue?.(checked)
            handleChange && handleChange(checked, helpers.setValue)
          }}
          onBlur={() => helpers.setTouched?.(true)}
        />
        <span className={cn('inline-flex flex-nowrap items-center grow', disabled && 'text-muted')}>
          <span className='grow'>{label}</span>
          {extra && <span>{extra}</span>}
        </span>
      </label>
    </FormGroup>
  )
}

export function CheckboxGroup ({ label, groupClassName, children, ...props }) {
  const [, meta, helpers] = useField(props)
  const labelId = useId()
  return (
    <FormGroup className={groupClassName}>
      {label && <label id={labelId} className={labelClasses()}>{label}</label>}
      <CheckboxGroupContext.Provider value>
        <BaseCheckboxGroup
          value={meta.value}
          aria-labelledby={label ? labelId : undefined}
          onValueChange={(v) => helpers.setValue(v)}
        >
          {children}
        </BaseCheckboxGroup>
      </CheckboxGroupContext.Provider>
      <div className={errorClasses()}>
        {meta.touched && meta.error}
      </div>
    </FormGroup>
  )
}
