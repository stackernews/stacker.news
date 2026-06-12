import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletRouteGate } from '@/wallets/client/components'
import { WalletHome } from '@/wallets/client/components/home'
import { REWARD_SATS_ROUTE_ID } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

// reward sats is an internal pseudo-wallet — no connected wallet, so no key gate
export default function RewardSatsWalletPage () {
  return (
    <WalletRouteGate walletsRequired={false}>
      <WalletHome routeWalletId={REWARD_SATS_ROUTE_ID} />
    </WalletRouteGate>
  )
}
