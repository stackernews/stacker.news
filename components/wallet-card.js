import { Badge, Card } from 'react-bootstrap'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import { Status, isConfigured, supportsReceive, supportsSend, canReceive, canSend } from '@/wallets/common'
import DraggableIcon from '@/svgs/draggable.svg'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'

export default function WalletCard ({ wallet, draggable, onDragStart, onDragEnter, onDragEnd, onTouchStart, sourceIndex, targetIndex, index }) {
  const { card: { title, badges } } = wallet.def

  const support = {
    recv: supportsReceive(wallet),
    send: supportsSend(wallet)
  }
  // TODO: implement warning and error status for send and recv
  const status = {
    recv: canReceive(wallet) ? styles.success : styles.disabled,
    send: canSend(wallet) ? styles.success : styles.disabled
  }

  return (
    <Card
      className={styles.card}
      // we attach the drag listeners to the whole card to have a proper drag image
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
    >
      <div className={styles.cardMeta}>
        <div className={styles.indicators}>
          {wallet.status === Status.Enabled && <DraggableIcon className={styles.drag} width={16} height={16} />}
          {support.recv && <RecvIcon className={`${styles.indicator} ${status.recv}`} />}
          {support.send && <SendIcon className={`${styles.indicator} ${status.send}`} />}
        </div>
      </div>
      <Card.Body
        // we attach touch listener only to card body to not interfere with wallet link
        onTouchStart={onTouchStart}
        className={draggable
          ? (`${sourceIndex === index ? styles.drag : ''} ${draggable && targetIndex === index ? styles.drop : ''}`)
          : ''}
        style={{ cursor: draggable ? 'move' : 'default' }}
      >
        <Card.Title>{title}</Card.Title>
        <Card.Subtitle className='mt-2'>
          {badges?.map(
            badge => {
              let style = ''
              switch (badge) {
                case 'receive': style = styles.receive; break
                case 'send': style = styles.send; break
              }
              return (
                <Badge className={`${styles.badge} ${style}`} key={badge} bg={null}>
                  {badge}
                </Badge>
              )
            })}
        </Card.Subtitle>
      </Card.Body>
      <Link href={`/settings/wallets/${wallet.def.name}`}>
        <Card.Footer className={styles.attach}>
          {isConfigured(wallet)
            ? <>configure<Gear width={14} height={14} /></>
            : <>attach<Plug width={14} height={14} /></>}
        </Card.Footer>
      </Link>
    </Card>
  )
}
