import { useField } from 'formik'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { cn } from '@/lib/cn'
import { FormGroup, labelClasses, errorClasses } from './field'
import styles from './checkbox.module.css'

export function Checkbox ({
  children, label, groupClassName, type = 'checkbox',
  hiddenLabel, extra, handleChange, inline, disabled, ...props
}) {
  // React treats radios and checkbox inputs differently other input types, select, and textarea.
  // Formik does this too! When you specify `type` to useField(), it will
  // return the correct bag of props for you
  const [field, meta, helpers] = useField({ ...props, type })
  const invalid = meta.touched && meta.error // NOT submit-gated — verbatim asymmetry (§18.0-3)
  const id = props.id || props.name

  return (
    <FormGroup className={groupClassName}>
      {hiddenLabel && <label className={cn(labelClasses(), 'invisible block')}>{label}</label>}
      {/* the label WRAPS the control: Base UI's span isn't labelable, but the
          hidden real input inside it is — wrapping associates natively */}
      <label className={cn(styles.check, 'mb-0.5', inline && 'inline-flex me-4')}>
        {type === 'radio'
          ? <input
              id={id}
              {...field}
              {...props}
              disabled={disabled}
              type={type}
              className={cn(styles.checkInput, styles.radio, invalid && styles.invalid)}
              onChange={(e) => {
                field.onChange(e)
                handleChange && handleChange(e.target.checked, helpers.setValue)
              }}
            />
          : <BaseCheckbox.Root
              id={id}
              {...props}
              disabled={disabled}
              checked={!!field.checked}
              className={cn(styles.checkInput, styles.checkbox, invalid && styles.invalid)}
              onCheckedChange={(checked) => {
                // replicate formik's native checkbox semantics: array fields
                // toggle membership of props.value, booleans just flip.
                // NOTE: the array lives in meta.value — formik's field.value for
                // a checkbox is the value PROP (v4 receipt caught this)
                if (Array.isArray(meta.value)) {
                  helpers.setValue(checked
                    ? [...meta.value, props.value]
                    : meta.value.filter(v => v !== props.value))
                } else {
                  helpers.setValue(checked)
                }
                handleChange && handleChange(checked, helpers.setValue)
              }}
              onBlur={() => helpers.setTouched(true)}
            />}
        <span className={'inline-flex flex-nowrap items-center grow' + (disabled ? ' text-muted' : '')}>
          <span className='grow'>{label}</span>
          {extra && <span>{extra}</span>}
        </span>
      </label>
    </FormGroup>
  )
}

export function CheckboxGroup ({ label, groupClassName, children, ...props }) {
  const [, meta] = useField(props)
  return (
    <FormGroup label={label} className={groupClassName}>
      {children}
      <div className={errorClasses()}>
        {meta.touched && meta.error}
      </div>
    </FormGroup>
  )
}
