import { isTemplate, isWallet, protocolClientSchema, protocolFields, protocolFormId, walletLud16Domain } from '@/wallets/lib/util'
import { createContext, useContext, useMemo, useCallback, useState } from 'react'
import { useWalletProtocolUpsert } from '@/wallets/client/hooks'
import { parseNwcUrl } from '@/wallets/lib/validate'
import { useApolloClient } from '@apollo/client/react'
import { ME } from '@/fragments/users'
import { REMOVE_WALLET_PROTOCOL, WALLETS } from '@/wallets/client/fragments'

const WalletSettingsFormContext = createContext()

export function WalletSettingsFormContextProvider ({ wallet, initial, children }) {
  const [formState, setFormState] = useState(initial ?? {})

  const updateFormState = useCallback((id, state) => {
    setFormState(formState => {
      return id ? { ...formState, [id]: state } : state
    })
  }, [])

  const clearFormState = useCallback((id) => {
    setFormState(({ [id]: _removed, ...formState }) => formState)
  }, [])

  const value = useMemo(
    () => ({ wallet, formState, updateFormState, clearFormState }),
    [wallet, formState, updateFormState, clearFormState])

  return (
    <WalletSettingsFormContext.Provider value={value}>
      {children}
    </WalletSettingsFormContext.Provider>
  )
}

export function useWallet () {
  const { wallet } = useContext(WalletSettingsFormContext)
  return wallet
}

export function useWalletFormState () {
  const { formState, updateFormState } = useContext(WalletSettingsFormContext)
  return [formState, updateFormState]
}

export function useClearWalletProtocolForm () {
  const { clearFormState } = useContext(WalletSettingsFormContext)
  return clearFormState
}

export function useWalletProtocols (send) {
  const wallet = useWallet()

  const protocolFilter = useCallback(p => p.send === send, [send])

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

function useProtocolFormState (protocol) {
  const formId = protocolFormId(protocol)
  const [formState, updateFormState] = useWalletFormState()
  const setProtocolFormState = useCallback(
    ({ enabled, ...config }) => {
      updateFormState(formId, { ...protocol, enabled, config })
    },
    [updateFormState, formId, protocol])
  return useMemo(() => [formState[formId], setProtocolFormState], [formState, formId, setProtocolFormState])
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
    let value = formState === undefined ? protocol.config?.[field.name] : formState.config?.[field.name]

    if (!value && field.share) {
      value = complementaryFormState?.config?.[field.name]
    }

    if (formState === undefined && protocol.name === 'LN_ADDR' && field.name === 'address' && lud16Domain) {
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

// check if a protocol has meaningful configuration
export function hasProtocolConfig (protocol) {
  if (!protocol) return false
  const fields = protocolFields(protocol)
  if (fields.length === 0) return protocol.enabled !== false

  const config = protocol.config || {}
  // for protocols with fields, check if any have values
  return Object.values(config).some(v => v !== '' && v !== false && v !== undefined && v !== null)
}

export function useSaveWallet () {
  const wallet = useWallet()
  const [formState] = useWalletFormState()
  const upsert = useWalletProtocolUpsert()
  const client = useApolloClient()

  const save = useCallback(async () => {
    let walletId = isWallet(wallet) ? wallet.id : undefined
    // filter out empty protocols before saving
    const protocolsToSave = Object.values(formState).filter(hasProtocolConfig)
    const protocolsToRemove = isWallet(wallet)
      ? wallet.protocols.filter(protocol => !hasProtocolConfig(formState[protocolFormId(protocol)]))
      : []

    for (const protocol of protocolsToSave) {
      const { id } = await upsert(
        {
          ...wallet,
          id: walletId,
          __typename: walletId ? 'Wallet' : 'WalletTemplate'
        },
        protocol, { ...protocol.config, enabled: protocol.enabled ?? false }
      )
      walletId ??= id
    }

    for (const protocol of protocolsToRemove) {
      await client.mutate({ mutation: REMOVE_WALLET_PROTOCOL, variables: { id: protocol.id } })
    }

    await client.refetchQueries({ include: [ME, WALLETS] })
  }, [wallet, formState, upsert, client])

  return save
}
