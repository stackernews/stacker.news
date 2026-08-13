import { SAT_UNITS } from '@/wallets/client/balance/format'
import { ADD_WALLET_ROUTE_ID, COWBOY_CREDITS_ROUTE_ID, REWARD_SATS_ROUTE_ID, WALLET_DETAIL_TABS, walletDetailRoute, walletRouteId } from '@/wallets/lib/routes'
import { walletDisplayName } from '@/wallets/lib/util'

// The two stacker-news pseudo wallets. walletHomeEntries spreads these straight
// into the entry list, so balance.js and actions.js read action/balance/units
// off the entry directly.
const INTERNAL_WALLET_ENTRIES = [
  {
    kind: 'internal',
    routeId: REWARD_SATS_ROUTE_ID,
    name: 'reward sats',
    action: 'send',
    balance: 'rewardSats',
    units: SAT_UNITS
  },
  {
    kind: 'internal',
    routeId: COWBOY_CREDITS_ROUTE_ID,
    name: 'cowboy credits',
    action: 'buy',
    balance: 'cowboyCredits',
    units: { unitSingular: 'cowboy credit', unitPlural: 'cowboy credits' },
    compactUnits: { unitSingular: 'CC', unitPlural: 'CCs' }
  }
]

// Per-kind UI spec: consumers read a field here instead of re-deriving from
// entry.kind. The 'add' tile is a CTA, not a row, so it's absent here; callers
// special-case it via `entry.kind === 'add'`.
const KIND_SPECS = {
  internal: {
    sectionLabel: 'stacker news',
    showName: true,
    statusPills: false,
    detailTabs: false,
    detailItems: () => [{ key: 'settings', href: '/settings/wallets', label: 'settings' }]
  },
  external: {
    sectionLabel: 'connected',
    showName: false,
    statusPills: true,
    detailTabs: true,
    detailItems: entry => WALLET_DETAIL_TABS.map(tab => ({
      key: tab,
      href: walletDetailRoute(entry.wallet.id, tab),
      label: tab
    }))
  }
}

export function walletHomeEntries (wallets) {
  return [
    ...INTERNAL_WALLET_ENTRIES,
    ...wallets.map(wallet => ({
      kind: 'external',
      routeId: walletRouteId(wallet),
      name: walletDisplayName(wallet.name),
      wallet
    })),
    { kind: 'add', routeId: ADD_WALLET_ROUTE_ID, name: 'add wallet' }
  ]
}

export function defaultWalletHomeRouteId (wallets) {
  return wallets[0] ? walletRouteId(wallets[0]) : REWARD_SATS_ROUTE_ID
}

export function selectedWalletHomeEntry (entries, routeWalletId, defaultRouteId) {
  if (routeWalletId) {
    return entries.find(entry => entry.routeId === routeWalletId) ?? null
  }

  return entries.find(entry => entry.routeId === defaultRouteId)
}

// Per-kind UI spec; undefined for the add tile and a missing entry.
export function kindSpec (entry) {
  return KIND_SPECS[entry?.kind]
}
