import { useEffect, useId, useRef } from 'react'
import { useFormikField } from './use-formik-field'
import { OTPField } from '@base-ui/react/otp-field'
import { FormGroup, inputClasses, errorClasses } from './field'

export function OtpInput ({ name, length = 6, label, groupClassName, disabled, autoFocus, onChange, ...props }) {
  const { field, meta, helpers, invalid } = useFormikField({ name })
  const labelId = useId()

  const firstSlotRef = useRef(null)
  useEffect(() => {
    autoFocus && firstSlotRef.current?.focus()
  }, [autoFocus])
  return (
    <FormGroup label={label} labelId={labelId} className={groupClassName}>
      <OTPField.Root
        length={length}
        value={field.value ?? ''}
        onValueChange={v => { helpers.setValue(v); onChange?.(v) }}
        onBlur={() => helpers.setTouched(true)}
        normalizeValue={v => v.toLowerCase()}
        validationType='alphanumeric'
        autoComplete='one-time-code'
        required
        disabled={disabled}
        name={name}
        aria-labelledby={label ? labelId : undefined}
        className='flex flex-row justify-center gap-2'
        {...props}
      >
        {Array.from({ length }).map((_, i) => (
          <OTPField.Input
            key={i}
            ref={i === 0 ? firstSlotRef : undefined}
            className={inputClasses({ className: 'w-11 px-0 text-center' })}
          />
        ))}
      </OTPField.Root>
      {invalid && <div className={errorClasses({ className: 'block' })}>{meta.error}</div>}
    </FormGroup>
  )
}
