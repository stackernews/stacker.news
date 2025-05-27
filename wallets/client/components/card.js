import { Card } from 'react-bootstrap'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import { useWalletImage, useWalletIsConfigured, useWalletSupport, useWalletStatus, WalletStatus } from '@/wallets/client/hooks'
import { urlify, walletDisplayName } from '@/wallets/client/util'

export default function WalletCard ({ wallet }) {
  const image = useWalletImage(wallet.name)
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)
  const isConfigured = useWalletIsConfigured(wallet)

  return (
    <Card className={styles.card}>
      <div className={styles.indicators}>
        {support.receive && <RecvIcon className={`${styles.indicator} ${statusToClass(status.receive)}`} />}
        {support.send && <SendIcon className={`${styles.indicator} ${statusToClass(status.send)}`} />}
      </div>
      <Card.Body>
        <div className='d-flex text-center align-items-center h-100'>
          {image
            ? <img className={styles.walletLogo} {...image} />
            : <Card.Title className={styles.walletLogo}>{walletDisplayName(wallet.name)}</Card.Title>}
        </div>
      </Card.Body>
      <WalletLink wallet={wallet}>
        <Card.Footer className={styles.attach}>
          {isConfigured
            ? <>configure<Gear width={14} height={14} /></>
            : <>attach<Plug width={14} height={14} /></>}
        </Card.Footer>
      </WalletLink>
    </Card>
  )
}

function WalletLink ({ wallet, children }) {
  if (wallet.__typename === 'UserWallet') {
    return <Link href={`/wallets/${wallet.id}`}>{children}</Link>
  }
  return <Link href={`/wallets/${urlify(wallet.name)}`}>{children}</Link>
}

function statusToClass (status) {
  switch (status) {
    case WalletStatus.Enabled: return styles.success
    case WalletStatus.Disabled: return styles.disabled
    case WalletStatus.Error: return styles.error
    case WalletStatus.Warning: return styles.warning
  }
}
