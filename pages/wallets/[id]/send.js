import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletActionEmpty, WalletActionShell, WalletRoutePage } from '@/wallets/client/components'
import { formatBalanceText, useExternalWalletBalance } from '@/wallets/client/balance'
import { ExternalSendForm } from '@/wallets/client/components/send'
import { useRouteWallet, useWalletCapabilities } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

// external wallet sends are not live yet; flip to false to re-enable
const SEND_COMING_SOON = true

export default function WalletSendPage () {
  const { wallet, ready } = useRouteWallet()

  return (
    <WalletRoutePage ready={ready} resource={wallet}>
      {wallet => SEND_COMING_SOON
        ? (
          <WalletActionShell wallet={wallet} title='send'>
            <WalletActionEmpty message='coming soon' backHref={`/wallets/${wallet.id}`} />
          </WalletActionShell>
          )
        : <WalletSend wallet={wallet} />}
    </WalletRoutePage>
  )
}

function WalletSend ({ wallet }) {
  const { canSend, sendProtocol } = useWalletCapabilities(wallet)
  const balanceState = useExternalWalletBalance(wallet)
  const available = balanceState.status === 'ready'
    ? { amount: formatBalanceText(balanceState) }
    : undefined
  if (!canSend) {
    return (
      <WalletActionShell wallet={wallet} title='send' available={available}>
        <WalletActionEmpty
          message="This wallet cannot send right now. Check this wallet's configure page and logs."
          backHref={`/wallets/${wallet.id}`}
        />
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell wallet={wallet} title='send' available={available}>
      <ExternalSendForm wallet={wallet} protocol={sendProtocol} />
    </WalletActionShell>
  )
}
