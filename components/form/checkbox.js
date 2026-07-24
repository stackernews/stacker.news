import { createContext, useContext, useId } from 'react'
import { useField } from 'formik'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui/react/checkbox-group'
import { cn } from '@/lib/cn'
import { FormGroup, labelClasses, errorClasses } from './field'
import styles from './checkbox.module.css'

// the explicit dual-mode flag: inside a CheckboxGroup the group owns the
// formik array, so children skip their own write
const CheckboxGroupContext = createContext(false)

export function Checkbox ({
  children, label, groupClassName, type = 'checkbox',
  hiddenLabel, extra, handleChange, inline, disabled, ...props
}) {
  const inGroup = useContext(CheckboxGroupContext)
  // formik treats checkbox inputs specially: with `type` passed, useField
  // returns the right bag of props (field.checked derives from array
  // membership when a value prop is present)
  const [field, meta, helpers] = useField({ ...props, type })
  const invalid = meta.touched && meta.error // not submit-gated: checkboxes paint invalid immediately, inputs wait for a submit attempt
  const id = props.id || props.name

  return (
    <FormGroup className={groupClassName}>
      {hiddenLabel && <label className={cn(labelClasses(), 'invisible block')}>{label}</label>}
      {/* the label wraps the control: Base UI's span isn't labelable, but the
          hidden real input inside it is, and wrapping associates natively */}
      <label className={cn(styles.check, 'mb-0.5', inline && 'inline-flex me-4')}>
        <BaseCheckbox.Root
          id={id}
          {...props}
          disabled={disabled}
          checked={!!field.checked}
          className={cn(styles.checkInput, styles.checkbox, invalid && styles.invalid)}
          onCheckedChange={(checked) => {
            // group mode: containment already drives checked (CheckboxRoot.mjs:126)
            // and the group writes the array, so there is one write path
            if (!inGroup) helpers.setValue(checked)
            handleChange && handleChange(checked, helpers.setValue)
          }}
          onBlur={() => helpers.setTouched(true)}
        />
        <span className={'inline-flex flex-nowrap items-center grow' + (disabled ? ' text-muted' : '')}>
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
