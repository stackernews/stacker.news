/**
 * This is a custom implementation of NIP-60 cashu wallets
 * It diverges from the NDK wallet service because its goals are:
 * 1. control the flow so that things are available when we need them
 * 2. reduce relay footprint so that we do not conflict with other apps sharing the same wallet
 */
import { Nostr } from '@/lib/nostr'
import { NDKCashuToken, NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet'
import { NDKKind } from '@nostr-dev-kit/ndk'
let cashuNostrConnector = null

/**
 *
 * In this implementation we assume the user client wants to run a single cashu attachment
 * for a long time, so we keep it unless it changes.
 * If we want to support multiple attachments of the same kind,
 * his might need to be changed to an array instances that timeout after a while
 * @param {*} param0
 * @returns
 */
async function getNostrConnector ({ privKey, relays }) {
  console.log(relays)
  if (!cashuNostrConnector || !cashuNostrConnector.checkConfig({ privKey, relays })) {
    if (cashuNostrConnector) cashuNostrConnector.close()
    cashuNostrConnector = new Nostr({ privKey, relays })
  }
  return cashuNostrConnector
}

// Get a cashu wallet from the relays
export async function getWallet ({ privKey, relays, walletId, walletName, mints }) {
  const nostr = getNostrConnector({ privKey, relays })
  if (!walletName) throw new Error('walletName is required')
  const pubKey = await nostr.pubKey

  const foundWallets = []
  await nostr.subscribe({
    kinds: [NDKKind.CashuWallet],
    authors: [pubKey],
    ...(walletId ? { tags: ['d', walletId] } : {})
  }, {
    onEvent: async (sub, event) => {
      const wallet = await NDKCashuWallet.from(event)
      const name = wallet.name ?? 'unknown'
      const mints = wallet.mints ?? []
      const relays = wallet.relays ?? []
      const unit = wallet.unit ?? 'unknown'
      const walletId = wallet.walletId ?? 'unknown'
      const status = wallet.status ?? 'unknown'
      console.log('Found wallet:', { name, mints, relays, unit, walletId, status })
      foundWallets.push(wallet)
    },
    relays,
    closeOnEose: true
  }).wait()

  if (foundWallets.length === 0) throw new Error('wallet not found')
  const foundWallet = foundWallets.find(w => w.name === walletName || w.walletId === walletId)
  console.log('Found wallets:', foundWallets, 'using', foundWallet)

  // merge more mints and relays to the wallet without changing the synched state
  for (const relay of relays) {
    if (!foundWallet.relays.includes(relay)) {
      foundWallet.relays.push(relay)
    }
  }
  for (const mint of mints) {
    if (!foundWallet.mints.includes(mint)) {
      foundWallet.mints.push(mint)
    }
  }

  await refreshBalance(nostr, foundWallet, { relays })

  return foundWallet
}

/**
 * Refresh the balance of a cashu wallet by fetching all the tokens
 * @param {NDKCashuWallet} wallet
 * @param {*} pubKey
 * @param {*} param2
 * @returns
 */
async function refreshBalance (nostr, wallet, { relays }) {
  const pubKey = await nostr.pubKey

  /** @type {Promise<NDKCashuToken>[]} */
  const tokensPromises = []
  await nostr.subscribe({
    kinds: [NDKKind.CashuToken],
    authors: [pubKey]
  }, {
    onEvent: (sub, event) => {
      if (event.kind === NDKKind.CashuToken) {
        tokensPromises.push(NDKCashuToken.from(event))
      }
    },
    relays,
    closeOnEose: true
  }).wait()

  let balance = 0
  // add all the tokens and calculate the balance
  for (const p of await Promise.allSettled(tokensPromises)) {
    if (p.status === 'rejected') {
      console.error('Error fetching token', p.reason)
      continue
    }
    /** @type {NDKCashuToken[]} */
    const token = p.value
    if (token.walletId !== wallet.walletId) {
      console.warn('Token does not belong to the wallet', token.walletId, '!=', wallet.walletId)
      continue
    }

    // HOTFIX: NDKCashuToken is looking for this in the tags???
    // The NIP-60 spec says it should be in the content...
    token.mint = token.mint ?? JSON.parse(token.content).mint

    console.log('Adding token', token, 'from mint', token.mint)
    const sats = token.amount ?? 0
    balance += sats
    wallet.addToken(token)
    console.log('Wallet balance:', balance)
  }

  const mintedBalances = wallet.mintBalances
  console.log('Minted balances:', mintedBalances)
  return balance
}

export async function createWallet ({ privKey, relays, walletName, mints }) {
  const nostr = getNostrConnector({ privKey, relays })

  console.log('Creating wallet', walletName)
  const wallet = new NDKCashuWallet(nostr.ndk)
  wallet.name = walletName
  wallet.mints = mints
  wallet.relays = relays
  wallet.unit = 'sats'
  await wallet.publish() // publish the new wallet
  return wallet
}
