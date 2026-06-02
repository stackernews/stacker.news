import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletRouteGate } from '@/wallets/client/components'
import { WalletHome } from '@/wallets/client/components/home'
import { useWallets, useWalletSendReady } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  // a keyless newcomer with no connected wallets should still reach the home
  // and the add flow, so only gate once their wallets have loaded and exist
  const wallets = useWallets()
  const walletSendReady = useWalletSendReady()
  const noWalletsYet = walletSendReady && wallets.length === 0

  return (
    <WalletRouteGate walletsRequired={!noWalletsYet}>
      <WalletHome />
    </WalletRouteGate>
  )
}
