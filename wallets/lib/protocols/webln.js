import { useEffect } from 'react'

// WebLN
// https://webln.guide/

export default {
  name: 'WEBLN',
  displayName: 'WebLN',
  send: true,
  fields: [],
  relationName: 'walletSendWebLN',
  isAvailable: () => window?.weblnEnabled
}

// this hook is used to check if the lightning browser extension is still enabled
// in which case we will also not attempt to use WebLN
// for payments using the `isAvailable` function above
export function useWeblnEvents () {
  useEffect(() => {
    const onEnable = () => {
      window.weblnEnabled = true
    }

    const onDisable = () => {
      window.weblnEnabled = false
    }

    if (!window.webln) onDisable()
    else onEnable()

    window.addEventListener('webln:enabled', onEnable)
    // event is not fired by Alby browser extension but added here for sake of completeness
    window.addEventListener('webln:disabled', onDisable)
    return () => {
      window.removeEventListener('webln:enabled', onEnable)
      window.removeEventListener('webln:disabled', onDisable)
    }
  }, [])
}
