import FormikBridgePlugin from './formikbridge'

// called when the editor state changes
// throw here everything that should happen when the editor state changes
export function OnChangePlugin () {
  return (
    <FormikBridgePlugin /> // WIP: barebone formik bridge plugin for Lexical
  )
}

export default OnChangePlugin
