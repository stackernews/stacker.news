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
                      balance
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
  if (res.status >= 400 && res.status <= 599) {
    // consume res
    res.text().catch(() => {})
    if (res.status === 401) {
      throw new Error('unauthorized')
    } else {
      throw new Error('API responded with HTTP ' + res.status)
    }
  }
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
