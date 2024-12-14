import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export const galoyBlinkUrl = 'https://api.blink.sv/graphql'
export const galoyBlinkDashboardUrl = 'https://dashboard.blink.sv/'

export const SCOPE_READ = 'READ'
export const SCOPE_WRITE = 'WRITE'
export const SCOPE_RECEIVE = 'RECEIVE'

export async function getWallet ({ apiKey, currency }) {
  const out = await request({
    apiKey,
    query: `
      query me {
        me {
          defaultAccount {
            wallets {
              id
              walletCurrency
            }
          }
        }
      }`
  })

  const wallets = out.data.me.defaultAccount.wallets
  for (const wallet of wallets) {
    if (wallet.walletCurrency === currency) {
      return wallet
    }
  }

  throw new Error(`wallet ${currency} not found`)
}

export async function request ({ apiKey, query, variables = {} }) {
  const res = await fetch(galoyBlinkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ query, variables })
  })

  assertResponseOk(res)
  assertContentTypeJson(res)

  return res.json()
}

export async function getScopes ({ apiKey }) {
  const out = await request({
    apiKey,
    query: `
      query scopes {
        authorization {
          scopes
        }
      }`
  })
  const scopes = out?.data?.authorization?.scopes
  return scopes || []
}
