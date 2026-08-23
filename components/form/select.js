import { useEffect } from 'react'
import Info from '@/components/info'
import { cn } from '@/lib/cn'
import { useFormikField } from './use-formik-field'
import { FormGroup, hintClasses, errorClasses } from './field'
import styles from './select.module.css'

export function Select ({ label, items, info, groupClassName, onChange, noForm, overrideValue, hint, className, ...props }) {
  const { field, meta, helpers, formik } = useFormikField(props, { noForm })
  const invalid = meta.touched && meta.error // not submit-gated: selects paint invalid immediately, inputs wait for a submit attempt

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
    }
  }, [overrideValue])

  return (
    <FormGroup label={label} htmlFor={props.id || props.name} className={groupClassName}>
      <span className='flex items-center'>
        <select
          {...field} {...props}
          id={props.id || props.name}
          aria-invalid={!!invalid}
          className={cn(styles.select, 'max-md:text-touch', invalid && styles.invalid, className)}
          onChange={(e) => {
            if (field?.onChange) {
              field.onChange(e)
            }

            if (onChange) {
              onChange(formik, e)
            }
          }}
        >
          {items.map(item => {
            if (item && typeof item === 'object') {
              return (
                <optgroup key={item.label} label={item.label}>
                  {item.items.map(item => <option key={item}>{item}</option>)}
                </optgroup>
              )
            } else {
              return <option key={item}>{item}</option>
            }
          })}
        </select>
        {info && <Info>{info}</Info>}
      </span>
      {invalid &&
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
