import { useId } from 'react'
import { useField } from 'formik'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { cn } from '@/lib/cn'
import { FormGroup, labelClasses, errorClasses } from './field'
import styles from './checkbox.module.css' // shares the check and radio skin

// The group owns the Formik field and provides native radio keyboard behavior.
export function RadioGroup ({ label, groupClassName, children, onChange, ...props }) {
  const [field, meta, helpers] = useField(props)
  const labelId = useId()
  return (
    <FormGroup className={groupClassName}>
      {label && <label id={labelId} className={labelClasses()}>{label}</label>}
      <BaseRadioGroup
        value={field.value}
        name={props.name}
        aria-labelledby={label ? labelId : undefined}
        onValueChange={(v) => { helpers.setValue(v); onChange?.(v) }}
        onBlur={() => helpers.setTouched(true)}
      >
        {children}
      </BaseRadioGroup>
      <div className={errorClasses()}>
        {meta.touched && meta.error}
      </div>
    </FormGroup>
  )
}

export function Radio ({ label, value, id, disabled, groupClassName, extra }) {
  return (
    <FormGroup className={groupClassName}>
      {/* The wrapping label targets the hidden native input. */}
      <label className={cn(styles.check, 'mb-0.5')}>
        <BaseRadio.Root
          id={id}
          value={value}
          disabled={disabled}
          className={cn(styles.checkInput, styles.radio)}
        />
        <span className={'inline-flex flex-nowrap items-center grow' + (disabled ? ' text-muted' : '')}>
          <span className='grow'>{label}</span>
          {extra && <span>{extra}</span>}
        </span>
      </label>
    </FormGroup>
  )
}
