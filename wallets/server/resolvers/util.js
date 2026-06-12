import { protocolRelationName } from '@/wallets/lib/util'
import { GqlInputError } from '@/lib/error'

export function parseWalletId (walletId) {
  const id = Number(walletId)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new GqlInputError('invalid wallet id')
  }
  return id
}

export function mapWalletResolveTypes (wallet) {
  // GraphQL union member types (e.g. WalletSendNWC) are the protocol's
  // relationName (walletSendNWC) with a capitalized first letter.
  return {
    ...wallet,
    protocols: wallet.protocols.map(({ config, ...p }) => {
      const relationName = protocolRelationName(p)
      return {
        ...p,
        config: {
          ...config,
          __resolveType: relationName ? relationName[0].toUpperCase() + relationName.slice(1) : null
        }
      }
    }),
    __resolveType: 'Wallet'
  }
}
