import { Formik, Form as FormikForm } from 'formik'
import { createContext, useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/toast'
import { useMe } from '@/components/me'

export class SessionRequiredError extends Error {
  constructor () {
    super('session required')
    this.name = 'SessionRequiredError'
  }
}

export const StorageKeyPrefixContext = createContext()

export function Form ({
  initial, validate, schema, onSubmit, children, initialError, validateImmediately,
  storageKeyPrefix, validateOnChange = true, requireSession, innerRef, enableReinitialize,
  ...props
}) {
  const toaster = useToast()
  const initialErrorToasted = useRef(false)
  const { me } = useMe()

  useEffect(() => {
    if (initialError && !initialErrorToasted.current) {
      toaster.danger('form error: ' + initialError.message || initialError.toString?.())
      initialErrorToasted.current = true
    }
  }, [])

  const clearLocalStorage = useCallback((values) => {
    Object.keys(values).forEach(v => {
      window.localStorage.removeItem(storageKeyPrefix + '-' + v)
      if (Array.isArray(values[v])) {
        values[v].forEach(
          (iv, i) => {
            Object.keys(iv).forEach(k => {
              window.localStorage.removeItem(`${storageKeyPrefix}-${v}[${i}].${k}`)
            })
            window.localStorage.removeItem(`${storageKeyPrefix}-${v}[${i}]`)
          })
      }
    })
  }, [storageKeyPrefix])

  const onSubmitInner = useCallback(async (values, ...args) => {
    if (requireSession && !me) {
      throw new SessionRequiredError()
    }

    try {
      if (onSubmit) {
        await onSubmit(values, ...args)
      }
    } catch (err) {
      console.log(err.message, err)
      toaster.danger(err.message ?? err.toString?.())
      return
    }

    if (!storageKeyPrefix) return
    clearLocalStorage(values)
  }, [me, onSubmit, clearLocalStorage, storageKeyPrefix])

  return (
    <Formik
      initialValues={initial}
      enableReinitialize={enableReinitialize}
      validateOnChange={validateOnChange}
      validate={validate}
      validationSchema={schema}
      initialTouched={validateImmediately && initial}
      validateOnBlur={false}
      onSubmit={onSubmitInner}
      innerRef={innerRef}
    >
      <FormikForm {...props} noValidate>
        <StorageKeyPrefixContext.Provider value={storageKeyPrefix}>
          {children}
        </StorageKeyPrefixContext.Provider>
      </FormikForm>
    </Formik>
  )
}
