import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  WalletConfigureForm,
  WalletDetailRoutePage
} from '@/wallets/client/components'
import { useRouteWallet } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletConfigurePage () {
  const { wallet, ready, routeId } = useRouteWallet()

  return (
    <WalletDetailRoutePage ready={ready} resource={wallet} title='configure'>
      {wallet => <WalletConfigureForm key={routeId} wallet={wallet} />}
    </WalletDetailRoutePage>
  )
}
