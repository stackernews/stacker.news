import { useCallback } from 'react'
import { isEncryptedField, isWallet, protocolRelationName } from '@/wallets/lib/util'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { ME } from '@/fragments/users'
import { SAVE_WALLET_PROTOCOLS, WALLETS } from '@/wallets/client/fragments'
import { useEncryption } from '@/wallets/client/hooks/crypto'
import { requestPersistentStorage } from '@/components/use-indexeddb'
import { clearWalletBalanceCache } from '@/wallets/client/balance'
import { useTestStore, useWallet } from './context'
import { protocolStatuses, summarize } from './status'
import { WalletStaleConfigError } from '@/wallets/client/errors'

// Re-runs the status builder + summarize gate on the submitted snapshot (not the
// live render values, to dodge stale closures), then upserts summarize()'s
// `saveable` and removes its `removeIds`.
export function useSaveWallet () {
  const wallet = useWallet()
  const tests = useTestStore()
  const client = useApolloClient()
  const { encrypt } = useEncryption()
  const [mutate] = useMutation(SAVE_WALLET_PROTOCOLS)

  return useCallback(async (formValues, protocols) => {
    const { canSave, saveable, removeIds } = summarize(protocolStatuses(wallet, formValues, tests, protocols))
    if (!canSave) {
      throw new WalletStaleConfigError()
    }

    // Encrypt protected fields client-side once, then hand the whole batch to
    // the server inside a single transaction. Each config is wrapped in a
    // @oneOf branch keyed by the protocol's relation name so the server knows
    // which protocol it is without us having to send name/send separately.
    const upserts = await Promise.all(saveable.map(async ({ protocol, enabled, config }) => ({
      enabled: enabled ?? false,
      config: await buildProtocolConfigBranch(encrypt, protocol, config)
    })))

    const variables = {
      upserts,
      removeIds
    }
    if (isWallet(wallet)) {
      variables.walletId = wallet.id
    } else {
      variables.templateName = wallet.name
    }

    const { data } = await mutate({ variables })
    const savedWallet = data?.saveWalletProtocols

    requestPersistentStorage()
    // Saved configs may have changed credentials or removed protocols entirely;
    // either way previously cached balances are now suspect.
    clearWalletBalanceCache()

    await client.refetchQueries({ include: [ME, WALLETS] })

    return savedWallet?.id
  }, [wallet, tests, encrypt, mutate, client])
}

// `config` is the capability's draft — already normalized to exactly the
// protocol's fields, so no filtering is needed.
async function buildProtocolConfigBranch (encrypt, protocol, config) {
  const branch = protocolRelationName(protocol)
  // WebLN has no config fields; the schema accepts a boolean sentinel.
  if (Object.keys(config).length === 0) {
    return { [branch]: true }
  }
  const entries = await Promise.all(
    Object.entries(config).map(async ([key, value]) => {
      if (!isEncryptedField(protocol, key)) return [key, value]
      return [key, await encrypt(value)]
    })
  )
  return { [branch]: Object.fromEntries(entries) }
}
