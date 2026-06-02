import { useCallback, useState } from 'react'
import { protocolKey } from '@/wallets/lib/util'
import { useFormikContext } from 'formik'
import { isMeaningfulDraft } from './draft'

// One owner for "which protocol is active" on each side. Sends and receives that
// offer the same connection (sharedNames) stay linked; an NWC url can force the
// receive side to LN_ADDR. Active resolves as: explicit choice → a configured one
// → the shared default → the first.

export function resolveActive (protocols, choice, defaultName, isConfigured) {
  return protocols.find(p => p.name === choice) ??
    protocols.find(isConfigured) ??
    protocols.find(p => p.name === defaultName) ??
    protocols[0]
}

// A connection offered for both sides keeps the two cards on the same one; a
// side-only pick moves only that side.
export function applyChoice (choices, side, name, sharedNames) {
  const next = { ...choices, [side]: name }
  if (sharedNames.includes(name)) next[side === 'send' ? 'receive' : 'send'] = name
  return next
}

export function useProtocolSelection ({ sendProtocols, receiveProtocols, sharedNames }) {
  const { values } = useFormikContext()
  const [choices, setChoices] = useState({ send: undefined, receive: undefined })

  const isConfigured = useCallback(
    p => isMeaningfulDraft(p, values[protocolKey(p)] ?? {}),
    [values])

  const chooseSend = useCallback(name => setChoices(c => applyChoice(c, 'send', name, sharedNames)), [sharedNames])
  const chooseReceive = useCallback(name => setChoices(c => applyChoice(c, 'receive', name, sharedNames)), [sharedNames])
  const forceReceiveLnAddr = useCallback(() => setChoices(c => ({ ...c, receive: 'LN_ADDR' })), [])

  const defaultName = sharedNames[0]
  return {
    send: { protocol: resolveActive(sendProtocols, choices.send, defaultName, isConfigured), choose: chooseSend },
    receive: { protocol: resolveActive(receiveProtocols, choices.receive, defaultName, isConfigured), choose: chooseReceive },
    forceReceiveLnAddr
  }
}
