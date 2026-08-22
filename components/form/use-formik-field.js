import { useField, useFormikContext } from 'formik'

// invalid paints only after a submit attempt,
// and noForm short-circuits the whole formik binding
export function useFormikField (props, { noForm = false } = {}) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()

  const invalid = (!formik || formik.submitCount > 0) && meta.touched && meta.error

  return { field, meta, helpers, formik, invalid }
}
