import { assertContentTypeJson } from '@/lib/url'

export const galoyBlinkUrl = 'https://api.blink.sv/graphql'
export const galoyBlinkDashboardUrl = 'https://dashboard.blink.sv/'

export const SCOPE_READ = 'READ'
export const SCOPE_WRITE = 'WRITE'
export const SCOPE_RECEIVE = 'RECEIVE'

export async function getWallet (authToken, currency) {
  const out = await request(authToken, `
      query me {
          me {
              defaultAccount {
                  wallets {
                      id
                      walletCurrency
                  }
              }
          }
      }
    `, {})
  const wallets = out.data.me.defaultAccount.wallets
  for (const wallet of wallets) {
    if (wallet.walletCurrency === currency) {
      return wallet
    }
  }
  throw new Error(`wallet ${currency} not found`)
}

export async function request (authToken, query, variables = {}) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': authToken
    },
    body: JSON.stringify({ query, variables })
  }
  const res = await fetch(galoyBlinkUrl, options)

  if (!res.ok) {
    // consume response body to avoid memory leaks
    // see https://github.com/nodejs/node/issues/51162
    res.text().catch(() => {})
    throw new Error(`POST ${res.url}: ${res.status} ${res.statusText}`)
  }
  assertContentTypeJson(res)

  return res.json()
}

export async function getScopes (authToken) {
  const out = await request(authToken, `
    query scopes {
        authorization {
            scopes
        }
    }
  `, {})
  const scopes = out?.data?.authorization?.scopes
  return scopes || []
}
