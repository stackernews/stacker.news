import { useEffect, useRef } from 'react'
import { useField, useFormikContext } from 'formik'
import { OTPField } from '@base-ui/react/otp-field'
import { FormGroup, inputClasses, errorClasses } from './field'

// Base UI OTP Field owns focus management, the per-slot caret, paste fan-out,
// Backspace retreat and arrow keys
export function OtpInput ({ name, length = 6, label, groupClassName, disabled, autoFocus, onChange, ...props }) {
  const formik = useFormikContext()
  const [field, meta, helpers] = useField({ name })
  // invalid paints only after a submit attempt
  const invalid = formik.submitCount > 0 && meta.touched && meta.error

  const firstSlotRef = useRef(null)
  // React's autoFocus attribute doesn't survive SSR hydration, so a mount
  // effect focuses the first slot instead
  useEffect(() => {
    autoFocus && firstSlotRef.current?.focus()
  }, [autoFocus])
  return (
    <FormGroup label={label} className={groupClassName}>
      <OTPField.Root
        length={length}
        value={field.value ?? ''}
        onValueChange={v => { helpers.setValue(v); onChange?.(v) }}
        onBlur={() => helpers.setTouched(true)}
        normalizeValue={v => v.toLowerCase()} // idempotent; normalizes typed, pasted, controlled and autofilled values
        validationType='alphanumeric' // the numeric default would reject bech32 letters
        autoComplete='one-time-code' // the Base UI default, kept visible
        required
        disabled={disabled}
        name={name} // the hidden validation input carries it
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
