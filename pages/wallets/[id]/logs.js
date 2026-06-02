import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletDetailRoutePage, WalletLogs } from '@/wallets/client/components'
import { useRouteWallet } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletLogsPage () {
  const { wallet, ready } = useRouteWallet()

  return (
    <WalletDetailRoutePage ready={ready} resource={wallet} title='logs'>
      {wallet => <WalletLogs wallet={wallet} />}
    </WalletDetailRoutePage>
  )
}
