import { Card } from 'react-bootstrap'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import { isConfigured } from '@/wallets/common'
import DraggableIcon from '@/svgs/draggable.svg'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import { useWalletImage } from '@/wallets/image'
import { useWalletStatus, statusToClass, Status } from '@/wallets/status'
import { useWalletSupport } from '@/wallets/support'

// TODO(wallet-v2): will we still need this?
//
// I want to show a table, so I think we won't need cards anymore.
export default function WalletCard ({ wallet, draggable, onDragStart, onDragEnter, onDragEnd, onTouchStart, sourceIndex, targetIndex, index }) {
  const image = useWalletImage(wallet)
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)

  return (
    <Card
      className={styles.card}
      // we attach the drag listeners to the whole card to have a proper drag image
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
    >
      <div className={styles.indicators}>
        {status.any !== Status.Disabled && <DraggableIcon className={styles.drag} width={16} height={16} />}
        {support.recv && <RecvIcon className={`${styles.indicator} ${statusToClass(status.recv)}`} />}
        {support.send && <SendIcon className={`${styles.indicator} ${statusToClass(status.send)}`} />}
      </div>
      <Card.Body
        // we attach touch listener only to card body to not interfere with wallet link
        onTouchStart={onTouchStart}
        className={draggable
          ? (`${sourceIndex === index ? styles.drag : ''} ${draggable && targetIndex === index ? styles.drop : ''}`)
          : ''}
        style={{ cursor: draggable ? 'move' : 'default' }}
      >
        <div className='d-flex text-center align-items-center h-100'>
          {image
            ? <img className={styles.walletLogo} {...image} />
            : <Card.Title className={styles.walletLogo}>{wallet.def.card.title}</Card.Title>}
        </div>
      </Card.Body>
      <Link href={`/wallets/${wallet.def.name}`}>
        <Card.Footer className={styles.attach}>
          {isConfigured(wallet)
            ? <>configure<Gear width={14} height={14} /></>
            : <>attach<Plug width={14} height={14} /></>}
        </Card.Footer>
      </Link>
    </Card>
  )
}
