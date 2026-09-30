import { Formik, Form as FormikForm } from 'formik'
import { createContext, useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/toast'
import { useMe } from '@/components/me'
import { clearFieldDrafts } from '@/lib/form-draft'

class SessionRequiredError extends Error {
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

    clearFieldDrafts(storageKeyPrefix, values)
  }, [me, onSubmit, storageKeyPrefix])

  return (
    <Formik
      initialValues={initial}
      enableReinitialize={enableReinitialize}
      validateOnChange={validateOnChange}
      validateOnMount={!!validateImmediately}
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
