import { useField, useFormikContext } from 'formik'

// show errors after submission unless the form explicitly opts into immediate validation
export function useFormikField (props, { noForm = false } = {}) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()

  const invalid = (formik?.validateOnMount || formik?.submitCount > 0) && meta.error

  return { field, meta, helpers, formik, invalid }
}
