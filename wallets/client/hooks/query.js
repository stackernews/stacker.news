import { WALLET } from '@/fragments/wallet'
import { useQuery } from '@apollo/client'
import { useDecryption } from '@/wallets/client/hooks'
import { useCallback, useEffect, useState } from 'react'

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

export function useWalletMutation () {
  // TODO(wallet-v2): implement this. this should encrypt the wallet before sending it to the server
}

function useWalletDecryption () {
  const decryptConfig = useDecryptConfig()

  return useCallback(async wallet => {
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
