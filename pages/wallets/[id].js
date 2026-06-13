import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletRoutePage } from '@/wallets/client/components'
import { WalletHome } from '@/wallets/client/components/home'
import { useRouteWallet } from '@/wallets/client/hooks'
import { walletRouteId } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSelectedPage () {
  const { wallet, ready } = useRouteWallet()

  return (
    <WalletRoutePage ready={ready} resource={wallet} notFoundMessage='this wallet route could not be found'>
      {wallet => <WalletHome routeWalletId={walletRouteId(wallet)} />}
    </WalletRoutePage>
  )
}
