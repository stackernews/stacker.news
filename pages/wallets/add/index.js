import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletRouteGate } from '@/wallets/client/components'
import { WalletHome } from '@/wallets/client/components/home'
import { ADD_WALLET_ROUTE_ID } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function AddWalletPage () {
  return (
    <WalletRouteGate>
      <WalletHome routeWalletId={ADD_WALLET_ROUTE_ID} />
    </WalletRouteGate>
  )
}
