import { createContext, useContext, useMemo, useReducer } from 'react'
import { useFormikContext } from 'formik'
import { isTemplate, protocolKey } from '@/wallets/lib/util'
import { configureReducer, initialConfigureState } from './tests'
import { protocolStatus, protocolStatuses, summarize } from './status'

// Wallet identity is stable for the provider's lifetime; the test store changes
// per action while dispatch is stable, so they're separate contexts. Form
// values live in Formik. Capabilities are derived (not stored) from those three
// by the hooks below.
const WalletContext = createContext()
const TestStoreContext = createContext()
const TestDispatchContext = createContext()

export function WalletConfigureFormProvider ({ wallet, children }) {
  const [state, dispatch] = useReducer(configureReducer, undefined, initialConfigureState)

  return (
    <WalletContext.Provider value={wallet}>
      <TestDispatchContext.Provider value={dispatch}>
        <TestStoreContext.Provider value={state.tests}>
          {children}
        </TestStoreContext.Provider>
      </TestDispatchContext.Provider>
    </WalletContext.Provider>
  )
}

export function useWallet () {
  return useContext(WalletContext)
}

export function useTestStore () {
  return useContext(TestStoreContext)
}

export function useTestDispatch () {
  return useContext(TestDispatchContext)
}

// One protocol's status via the single join (see protocolStatus in status.js).
export function useProtocolStatus (protocol) {
  const wallet = useWallet()
  const tests = useTestStore()
  const { values } = useFormikContext()
  return protocolStatus(wallet, values[protocolKey(protocol)], protocol, tests)
}

// The save bar's folded state over all visible protocols.
export function useSaveSummary (protocols) {
  const wallet = useWallet()
  const tests = useTestStore()
  const { values } = useFormikContext()
  return useMemo(
    () => summarize(protocolStatuses(wallet, values, tests, protocols)),
    [wallet, values, tests, protocols])
}

// All protocol views the configure screen needs, derived from the wallet in one
// pass: both sides resolved (configured overlaid on templates), then partitioned
// for the capability cards and the protocol picker.
export function useConfigureProtocols () {
  const wallet = useWallet()
  return useMemo(() => {
    const sendProtocols = resolveProtocols(wallet, true)
    const receiveProtocols = resolveProtocols(wallet, false)

    // WEBLN is the browser send fallback; it gets its own optional card.
    const primarySendProtocols = sendProtocols.filter(p => p.name !== 'WEBLN')
    const fallbackSendProtocols = sendProtocols.filter(p => p.name === 'WEBLN')

    // Protocols offered for both sides let the picker keep the two capability
    // cards on the same connection.
    const receiveNames = new Set(receiveProtocols.map(p => p.name))
    const sharedProtocolNames = primarySendProtocols
      .map(p => p.name)
      .filter(name => receiveNames.has(name))

    return {
      sendProtocols,
      receiveProtocols,
      primarySendProtocols,
      fallbackSendProtocols,
      sharedProtocolNames,
      allProtocols: [...sendProtocols, ...receiveProtocols]
    }
  }, [wallet])
}

// One side's protocols: just templates for a template wallet, else every
// protocol's template with the configured one overlaid where it exists.
function resolveProtocols (wallet, send) {
  const filter = p => p.send === send
  if (isTemplate(wallet)) return wallet.protocols.filter(filter)
  const configured = wallet.protocols.filter(filter)
  const templates = wallet.template.protocols.filter(filter)
  return templates.map(p => configured.find(c => c.name === p.name) ?? p)
}
