import { useEffect, useRef } from 'react'
import { useField, useFormikContext } from 'formik'
import { OTPField } from '@base-ui/react/otp-field'
import { FormGroup, inputClasses, errorClasses } from './field'

// purpose-built MultiInput replacement (§19.0-3): Base UI OTP Field owns focus
// management, per-slot caret, paste fan-out, Backspace-retreat and arrow keys
export function OtpInput ({ name, length = 6, label, groupClassName, disabled, autoFocus, onChange, ...props }) {
  const formik = useFormikContext()
  const [field, meta, helpers] = useField({ name })
  // submit-gated — MultiInput's hideError block, verbatim gate (§18.0-3 family)
  const invalid = formik.submitCount > 0 && meta.touched && meta.error

  const firstSlotRef = useRef(null)
  // §19.8-5 fallback: React's autoFocus attr doesn't survive SSR hydration —
  // a mount effect focuses slot 0 (the old MultiInput shape)
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
        normalizeValue={v => v.toLowerCase()} // idempotent — normalizes typed, pasted, controlled and autofilled values (§19.0-3)
        validationType='alphanumeric' // the numeric default would reject bech32 letters
        autoComplete='one-time-code' // the Base UI default, kept visible
        required
        disabled={disabled}
        name={name} // the hidden validation input carries it (§19.2)
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
