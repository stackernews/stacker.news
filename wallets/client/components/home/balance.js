import { useMe } from '@/components/me'
import { useExternalWalletBalance } from '@/wallets/client/balance'
import { balanceDisplay } from '@/wallets/client/balance/format'
import { rewardSatsBalance } from '@/wallets/client/reward-sats'

const UNAVAILABLE_BALANCE = { status: 'unavailable', amount: null, display: null, source: null, error: null }

// Maps a home entry (internal pseudo-wallet or connected wallet) to the
// normalized balance state that BalanceRow/BalanceHero render. External
// balances already arrive normalized from the data layer.
export function useWalletBalanceState (entry) {
  const externalBalance = useExternalWalletBalance(entry?.kind === 'external' ? entry.wallet : null)
  const { me } = useMe()

  if (entry?.kind === 'external') return externalBalance
  if (entry?.kind === 'internal') return internalWalletBalanceState(entry, me?.privates)
  return UNAVAILABLE_BALANCE
}

function internalWalletBalanceState (entry, privates) {
  const amount = entry.balance === 'rewardSats'
    ? rewardSatsBalance(privates)
    : privates?.credits ?? 0

  return {
    status: 'ready',
    amount,
    display: balanceDisplay({ units: entry.units, compactUnits: entry.compactUnits }),
    source: null,
    error: null
  }
}
