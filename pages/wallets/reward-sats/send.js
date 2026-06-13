import { getGetServerSideProps } from '@/api/ssrApollo'
import { useMe } from '@/components/me'
import { formatSats } from '@/lib/format'
import { WalletActionEmpty, WalletActionShell, WalletRouteGate } from '@/wallets/client/components'
import { rewardSatsBalance } from '@/wallets/client/reward-sats'
import { RewardSatsSendForm } from '@/wallets/client/components/send'
import styles from '@/wallets/client/components/send/send.module.css'
import BountyIcon from '@/svgs/bounty-bag.svg'
import { selectedWalletRoute, REWARD_SATS_ROUTE_ID } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function RewardSatsSendPage () {
  return (
    <WalletRouteGate walletsRequired={false}>
      <RewardSatsSend />
    </WalletRouteGate>
  )
}

function RewardSatsSend () {
  const { me } = useMe()
  const availableSats = rewardSatsBalance(me?.privates)
  const identity = (
    <>
      <BountyIcon className={styles.internalIcon} width={18} height={18} />
      <span className={styles.walletName}>reward sats</span>
    </>
  )

  if (availableSats <= 0) {
    return (
      <WalletActionShell title='send' identity={identity}>
        <WalletActionEmpty message='you have no reward sats to withdraw' backHref={selectedWalletRoute(REWARD_SATS_ROUTE_ID)} />
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell
      title='send'
      identity={identity}
      available={{ amount: formatSats(availableSats) }}
    >
      <RewardSatsSendForm rewardSatsAvailable={availableSats} />
    </WalletActionShell>
  )
}
