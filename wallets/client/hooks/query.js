import { UPSERT_WALLET_RECEIVE_LNBITS, UPSERT_WALLET_SEND_LNBITS, WALLET } from '@/fragments/wallet'
import { useMutation, useQuery } from '@apollo/client'
import { useDecryption, useEncryption } from '@/wallets/client/hooks'
import { useCallback, useEffect, useState } from 'react'
import { isEncryptedField, protocolFields } from '@/wallets/client/util'

export function useWalletQuery ({ id, name }) {
  const query = useQuery(WALLET, { variables: { id, name } })
  const [wallet, setWallet] = useState(null)

  const decryptWallet = useWalletDecryption()

  useEffect(() => {
    if (!query.data?.wallet) return
    decryptWallet(query.data?.wallet).then(wallet => setWallet(wallet))
  }, [query.data, decryptWallet])

  return {
    ...query,
    // pretend query is still loading until we've decrypted the wallet
    loading: !!wallet,
    data: wallet ? { wallet } : null
  }
}

export function useWalletProtocolMutation (wallet, protocol) {
  const mutation = getWalletProtocolMutation(protocol)
  const [mutate] = useMutation(mutation)
  const encryptConfig = useEncryptConfig(protocol)

  return useCallback(async (values) => {
    const encrypted = await encryptConfig(values)
    const { data } = await mutate({
      variables: {
        // TODO(wallet-v2): use template id if no wallet id is provided
        walletId: wallet.id,
        ...encrypted
      }
    })
    return data
  }, [mutate, encryptConfig])
}

function getWalletProtocolMutation (protocol) {
  switch (protocol.name) {
    case 'LNBITS':
      return protocol.send ? UPSERT_WALLET_SEND_LNBITS : UPSERT_WALLET_RECEIVE_LNBITS
    default:
      return null
  }
}

function useWalletDecryption () {
  const decryptConfig = useDecryptConfig()

  return useCallback(async wallet => {
    if (wallet.__typename === 'WalletTemplate') return wallet

    const protocols = await Promise.all(
      wallet.protocols.map(
        async protocol => ({
          ...protocol,
          config: await decryptConfig(protocol.config)
        })
      )
    )
    return { ...wallet, protocols }
  }, [decryptConfig])
}

function useDecryptConfig () {
  const decrypt = useDecryption()

  return useCallback(async (config) => {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(config)
          .map(
            async ([key, value]) => {
              const encrypted = value.__typename === 'VaultEntry'
              if (!encrypted) return [key, value]

              // undo the field aliases we had to use because of https://github.com/graphql/graphql-js/issues/53
              // so we can pretend the GraphQL API returns the fields as they are named in the schema
              let renamed = key.replace(/^encrypted/, '')
              renamed = renamed.charAt(0).toLowerCase() + renamed.slice(1)

              return [
                renamed,
                await decrypt(value)
              ]
            }
          )
      )
    )
  }, [decrypt])
}

function useEncryptConfig (protocol) {
  const encrypt = useEncryption()

  return useCallback(async (config) => {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(config)
          .map(
            async ([key, value]) => {
              if (!isEncryptedField(protocol, key)) return [key, value]
              return [
                key,
                await encrypt(value)
              ]
            }
          )
      )
    )
  }, [encrypt])
}
