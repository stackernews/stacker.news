import { WALLET } from '@/fragments/wallet'
import { useQuery } from '@apollo/client'
import { useDecryption } from './crypto'
import { useCallback } from 'react'

export function useWalletQuery ({ id, name }) {
  // const decrypt = useWalletDecryption()
  const query = useQuery(WALLET, { variables: { id, name } })
  const decryptValue = useDecryption()

  const decryptConfig = useCallback((config) => {
    return Object.fromEntries(
      Object.entries(config)
        .map(([key, value]) => {
          const encrypted = value.__typename === 'VaultEntry'
          if (!encrypted) return [key, value]

          // undo the field aliases we had to use because of https://github.com/graphql/graphql-js/issues/53
          // so we can pretend the GraphQL API returns the fields as they are named in the schema
          let renamed = key.replace(/^encrypted/, '')
          renamed = renamed.charAt(0).toLowerCase() + renamed.slice(1)
          return [
            renamed,
            decryptValue(value)
          ]
        })
    )
  }, [decryptValue])

  if (query.data?.wallet) {
    const { wallet } = query.data
    if (wallet.__typename !== 'UserWallet') return query

    const protocols = wallet.protocols.map(protocol => ({
      ...protocol,
      config: decryptConfig(protocol.config)
    }))

    return {
      ...query,
      data: {
        wallet: {
          ...wallet,
          protocols
        }
      }
    }
  }

  return query
}
