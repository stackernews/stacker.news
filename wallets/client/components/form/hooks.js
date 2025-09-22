import { isTemplate, isWallet, protocolClientSchema, protocolFields, protocolFormId, walletLud16Domain } from '@/wallets/lib/util'
import { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react'
import { useWalletProtocolUpsert } from '@/wallets/client/hooks'
import { MultiStepForm, useFormState, useStep } from '@/components/multi-step-form'
import { parseNwcUrl } from '@/wallets/lib/validate'

export const Step = {
  SEND: 'send',
  RECEIVE: 'receive',
  SETTINGS: 'settings'
}

const WalletMultiStepFormContext = createContext()

export function WalletMultiStepFormContextProvider ({ wallet, initial, steps, children }) {
  // save selected protocol, but useProtocol will always return the first protocol if no protocol is selected
  const [protocol, setProtocol] = useState(null)
  const value = useMemo(() => ({ wallet, protocol, setProtocol }), [wallet, protocol, setProtocol])
  return (
    <WalletMultiStepFormContext.Provider value={value}>
      <MultiStepForm initial={initial} steps={steps}>
        {children}
      </MultiStepForm>
    </WalletMultiStepFormContext.Provider>
  )
}

export function useWallet () {
  const { wallet } = useContext(WalletMultiStepFormContext)
  return wallet
}

export function useWalletProtocols () {
  const step = useStep()
  const wallet = useWallet()

  const protocolFilter = useCallback(p => step === Step.SEND ? p.send : !p.send, [step])

  return useMemo(() => {
    // all protocols are templates if wallet is a template
    if (isTemplate(wallet)) {
      return wallet.protocols.filter(protocolFilter)
    }
    // return template for every protocol that isn't configured
    const configured = wallet.protocols.filter(protocolFilter)
    const templates = wallet.template.protocols.filter(protocolFilter)
    return templates.map(p => configured.find(c => c.name === p.name) ?? p)
  }, [wallet, protocolFilter])
}

export function useProtocol () {
  const { protocol, setProtocol } = useContext(WalletMultiStepFormContext)
  const protocols = useWalletProtocols()
  const [lnAddrForm] = useProtocolForm({ name: 'LN_ADDR', send: false })

  useEffect(() => {
    // this makes sure that we've always selected a protocol (that exists) when moving between send and receive
    if (!protocol || !protocols.find(p => p.id === protocol.id)) {
      // we switch to the LN_ADDR protocol form if it exists and there's an initial value
      // else we just select the first protocol.
      const lnAddrProto = protocols.find(p => p.name === 'LN_ADDR')
      if (lnAddrForm?.initial.address && lnAddrProto) {
        setProtocol(lnAddrProto)
      } else {
        setProtocol(protocols[0])
      }
    }
  }, [protocol, protocols, setProtocol, lnAddrForm])

  // make sure we always have a protocol, even on first render before useEffect runs
  return useMemo(() => [protocol ?? protocols[0], setProtocol], [protocol, protocols, setProtocol])
}

function useProtocolFormState (protocol) {
  const formId = protocolFormId(protocol)
  const [formState, setFormState] = useFormState(formId)
  const setProtocolFormState = useCallback(
    ({ enabled, ...config }) => {
      setFormState({ ...protocol, enabled, config })
    },
    [setFormState, protocol])
  return useMemo(() => [formState, setProtocolFormState], [formState, setProtocolFormState])
}

export function useProtocolForm (protocol) {
  const [formState, setFormState] = useProtocolFormState(protocol)
  const [complementaryFormState] = useProtocolFormState({ name: protocol.name, send: !protocol.send })
  const [nwcSendFormState] = useProtocolFormState({ name: 'NWC', send: true })
  const wallet = useWallet()
  const lud16Domain = walletLud16Domain(wallet.name)
  const fields = protocolFields(protocol)
  const initial = fields.reduce((acc, field) => {
    // we only fallback to the existing protocol config because formState was not initialized yet on first render
    // after init, we use formState as the source of truth everywhere
    let value = formState?.config?.[field.name] ?? protocol.config?.[field.name]

    if (!value && field.share) {
      value = complementaryFormState?.config?.[field.name]
    }

    if (protocol.name === 'LN_ADDR' && field.name === 'address' && lud16Domain) {
      // automatically set lightning addresses from NWC urls if lud16 parameter is present
      if (nwcSendFormState?.config?.url) {
        const { lud16 } = parseNwcUrl(nwcSendFormState.config.url)
        if (lud16?.split('@')[1] === lud16Domain) value = lud16
      }
      // remove domain part since we will append it automatically if lud16Domain is set
      if (lud16Domain && value) {
        value = value.split('@')[0]
      }
    }

    return {
      ...acc,
      [field.name]: value || ''
    }
  }, { enabled: formState?.enabled ?? protocol.enabled })

  let schema = protocolClientSchema(protocol)
  if (lud16Domain) {
    schema = schema.transform(({ address, ...rest }) => {
      return {
        address: address ? `${address}@${lud16Domain}` : '',
        ...rest
      }
    })
  }

  return useMemo(() => [{ fields, initial, schema }, setFormState], [fields, initial, schema, setFormState])
}

export function useSaveWallet () {
  const wallet = useWallet()
  const [formState] = useFormState()
  const upsert = useWalletProtocolUpsert()

  const save = useCallback(async () => {
    let walletId = isWallet(wallet) ? wallet.id : undefined
    for (const protocol of Object.values(formState)) {
      const { id } = await upsert(
        {
          ...wallet,
          id: walletId,
          __typename: walletId ? 'Wallet' : 'WalletTemplate'
        },
        protocol, { ...protocol.config, enabled: protocol.enabled }
      )
      walletId ??= id
    }
  }, [wallet, formState, upsert])

  return save
}
