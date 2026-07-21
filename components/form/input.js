import { useCallback, useEffect } from 'react'
import { useField } from 'formik'
import { Field } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import CloseIcon from '@/svgs/close-line.svg'
import { debounce } from '@/components/use-debounce-callback'
import { useIsClient } from '@/components/use-client'
import { numWithUnits } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useFormikField } from './use-formik-field'
import { useFieldDraft } from './use-field-draft'
import { FormGroup, inputClasses, hintClasses, errorClasses } from './field'
import styles from './field.module.css'

export function InputInner ({
  prepend, append, hint, warn, showValid, onChange, onBlur, overrideValue, appendValue,
  innerRef, noForm, clear, onKeyDown, inputGroupClassName, debounce: debounceTime, maxLength, hideError,
  AppendColumn, size, ...props
}) {
  const { field, meta, helpers, formik, invalid } = useFormikField(props, { noForm })
  const { storageKey } = useFieldDraft(props.name)
  const isClient = useIsClient()

  const onKeyDownInner = useCallback((e) => {
    const metaOrCtrl = e.metaKey || e.ctrlKey
    if (metaOrCtrl) {
      if (e.key === 'Enter') formik?.submitForm()
    }

    if (onKeyDown) onKeyDown(e)
  }, [formik?.submitForm, onKeyDown])

  const onChangeInner = useCallback((e) => {
    field?.onChange(e)

    if (storageKey) {
      window.localStorage.setItem(storageKey, e.target.value)
    }

    if (onChange) {
      onChange(formik, e)
    }
  }, [field?.onChange, storageKey, onChange])

  const onBlurInner = useCallback((e) => {
    field?.onBlur?.(e)
    onBlur && onBlur(e)
  }, [field?.onBlur, onBlur])

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
      if (storageKey) {
        window.localStorage.setItem(storageKey, overrideValue)
      }
      onChange && onChange(formik, { target: { value: overrideValue } })
    } else if (storageKey) {
      const draft = window.localStorage.getItem(storageKey)
      if (draft) {
        // for some reason we have to turn off validation to get formik to
        // not assume this is invalid
        const isNumeric = /^[0-9]+$/.test(draft)
        const numericExpected = typeof field.value === 'number'
        helpers.setValue(isNumeric && numericExpected ? parseInt(draft) : draft)
        onChange && onChange(formik, { target: { value: draft } })
      }
    }
  }, [overrideValue])

  useEffect(() => {
    if (appendValue) {
      const updatedValue = meta.value ? `${meta.value}\n${appendValue}` : appendValue
      helpers.setValue(updatedValue)
      if (storageKey) {
        window.localStorage.setItem(storageKey, updatedValue)
      }
      innerRef?.current?.focus()
    }
  }, [appendValue])

  useEffect(debounce(() => {
    if (!noForm && !isNaN(debounceTime) && debounceTime > 0) {
      formik.validateForm()
    }
  }, debounceTime), [noForm, formik, field.value])

  const remaining = maxLength && maxLength - (field.value || '').length
  const isValid = showValid && meta.initialValue !== meta.value && meta.touched && !meta.error

  const { as, ...inputProps } = props

  return (
    <>
      <div className='flex gap-4'>
        <div className='grow basis-0 min-w-0'>
          {/* Field.Root is a plain wrapper so the error sits outside the flex
              row, since the .inputGroup corner rules key on the first and last
              children */}
          <Field.Root invalid={!!(!hideError && invalid)}>
            <div className={cn(styles.inputGroup, 'flex items-stretch', inputGroupClassName)}>
              {prepend}
              <BaseInput
                ref={innerRef}
                {...field}
                {...inputProps}
                render={as === 'textarea' ? <textarea /> : undefined}
                onKeyDown={onKeyDownInner}
                onChange={onChangeInner}
                onBlur={onBlurInner}
                className={inputClasses({
                  valid: isValid,
                  size,
                  // pe-10 insets the text off the validation icon; it must be a
                  // utility because a module padding-right loses to px-4
                  className: cn('flex-1 w-auto min-w-0', ((!hideError && invalid) || isValid) && 'pe-10')
                })}
              />
              {(isClient && clear && field.value && !props.readOnly) && (
                <button
                  type='button'
                  onClick={(e) => {
                    helpers.setValue('')
                    if (storageKey) {
                      window.localStorage.removeItem(storageKey)
                    }
                    if (onChange) {
                      onChange(formik, { target: { value: '' } })
                    }
                  }}
                  className={cn(styles.clearButton, styles.appendButton, invalid && styles.isInvalid)}
                >
                  <CloseIcon className='fill-grey' height={20} width={20} />
                </button>
              )}
              {append}
            </div>
            {!hideError && invalid &&
              <Field.Error match className={errorClasses()}>
                {meta.touched && meta.error}
              </Field.Error>}
          </Field.Root>
        </div>
        {AppendColumn && <AppendColumn className={meta.touched && meta.error ? 'invisible' : ''} />}
      </div>
      {hint && (
        <small className={hintClasses()}>
          {hint}
        </small>
      )}
      {warn && (
        <small className={hintClasses({ className: 'text-warning' })}>
          {warn}
        </small>
      )}
      {!warn && maxLength && !(meta.touched && meta.error && invalid) && (
        <small className={hintClasses({ className: remaining < 0 ? 'text-danger' : 'text-muted' })}>
          {`${numWithUnits(remaining, { abbreviate: false, unitSingular: 'character', unitPlural: 'characters' })} remaining`}
        </small>
      )}
    </>
  )
}

export function Input ({ label, groupClassName, under, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <InputInner {...props} />
      {under}
    </FormGroup>
  )
}

export function Client (Component) {
  return ({ initialValue, ...props }) => {
    // This component can be used for Formik fields
    // where the initial value is not available on first render.
    // Example: value is stored in localStorage which is fetched
    // after first render using an useEffect hook.
    const [,, helpers] = props.noForm ? [{}, {}, {}] : useField(props)

    useEffect(() => {
      initialValue && helpers.setValue(initialValue)
    }, [initialValue])

    return <Component {...props} />
  }
}

export const ClientInput = Client(Input)
