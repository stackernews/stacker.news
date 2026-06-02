import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletRouteGate } from '@/wallets/client/components'
import { WalletHome } from '@/wallets/client/components/home'
import { COWBOY_CREDITS_ROUTE_ID } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

// cowboy credits is an internal pseudo-wallet — no connected wallet, so no key gate
export default function CowboyCreditsWalletPage () {
  return (
    <WalletRouteGate walletsRequired={false}>
      <WalletHome routeWalletId={COWBOY_CREDITS_ROUTE_ID} />
    </WalletRouteGate>
  )
}
