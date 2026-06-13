export const REWARD_SATS_ROUTE_ID = 'reward-sats'
export const COWBOY_CREDITS_ROUTE_ID = 'cowboy-credits'
export const ADD_WALLET_ROUTE_ID = 'add'
export const WALLET_DETAIL_TABS = ['configure', 'logs', 'activity']

// Wallet route map:
// - /wallets: default wallet hub selection
// - /wallets/reward-sats and /wallets/cowboy-credits: internal wallets
// - /wallets/reward-sats/send: internal reward sats withdrawal
// - /wallets/add: add-wallet panel
// - /wallets/add/:template: configure a new wallet from a template
// - /wallets/:id and /wallets/:id/:tab: external wallets by numeric id

export function walletRouteId (wallet) {
  return String(wallet.id)
}

export function selectedWalletRoute (routeWalletId) {
  return `/wallets/${routeWalletId}`
}

export function addWalletTemplateRoute (template) {
  return `/wallets/${ADD_WALLET_ROUTE_ID}/${template}`
}

export function walletDetailRoute (routeWalletId, tab) {
  return `${selectedWalletRoute(routeWalletId)}/${tab}`
}

export function walletRoute (entry) {
  // external entry.routeId is String(wallet.id), so entry.routeId routes every kind
  return selectedWalletRoute(entry.routeId)
}
