import FormikBridgePlugin from './formikbridge'

// called when the editor state changes
// throw here everything that should happen when the editor state changes
export default function OnChangePlugin ({ ...props }) {
  return (
    <FormikBridgePlugin {...props} /> // WIP: barebone formik bridge plugin for Lexical
  )
}
