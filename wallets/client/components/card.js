import { Card } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import DragIcon from '@/svgs/draggable.svg'
import { useWalletImage, useWalletSupport, useWalletStatus, WalletStatus } from '@/wallets/client/hooks'
import { isWallet, urlify, walletDisplayName } from '@/wallets/lib/util'
import { Draggable } from '@/wallets/client/components'

export function WalletCard ({ wallet, draggable = false, index, ...props }) {
  const image = useWalletImage(wallet.name)
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)

  const card = (
    <Card
      className={styles.card}
      {...props}
    >
      <div className={styles.indicators}>
        {draggable && <DragIcon className={classNames(styles.indicator, styles.drag, 'me-auto')} />}
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
          {isWallet(wallet)
            ? <>configure<Gear width={14} height={14} /></>
            : <>attach<Plug width={14} height={14} /></>}
        </Card.Footer>
      </WalletLink>
    </Card>
  )

  if (draggable) {
    return (
      <Draggable index={index}>
        {card}
      </Draggable>
    )
  }

  return card
}

function WalletLink ({ wallet, children }) {
  const support = useWalletSupport(wallet)
  const sendRecvParam = support.send ? 'send' : 'receive'
  const href = '/wallets' + (isWallet(wallet) ? `/${wallet.id}` : `/${urlify(wallet.name)}`) + `/${sendRecvParam}`
  return <Link href={href}>{children}</Link>
}

function statusToClass (status) {
  switch (status) {
    case WalletStatus.OK: return styles.success
    case WalletStatus.ERROR: return styles.error
    case WalletStatus.WARNING: return styles.warning
    case WalletStatus.DISABLED:
    case WalletStatus.UNCONFIGURED: return styles.disabled
  }
}
