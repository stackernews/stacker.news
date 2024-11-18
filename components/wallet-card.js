import { Card } from 'react-bootstrap'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import { Status, isConfigured } from '@/wallets/common'
import DraggableIcon from '@/svgs/draggable.svg'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import useDarkMode from './dark-mode'
import { useEffect, useState } from 'react'

const statusToClass = status => {
  switch (status) {
    case Status.Enabled: return styles.success
    case Status.Disabled: return styles.disabled
    case Status.Error: return styles.error
    case Status.Warning: return styles.warning
  }
}

export default function WalletCard ({ wallet, draggable, onDragStart, onDragEnter, onDragEnd, onTouchStart, sourceIndex, targetIndex, index }) {
  const [dark] = useDarkMode()
  const { card: { title, image } } = wallet.def
  const [imgSrc, setImgSrc] = useState(image?.src)

  useEffect(() => {
    if (!imgSrc) return
    // wallet.png <-> wallet-dark.png
    setImgSrc(dark ? image?.src.replace(/\.([a-z]{3})$/, '-dark.$1') : image?.src)
  }, [dark])

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
          {wallet.status.any !== Status.Disabled && <DraggableIcon className={styles.drag} width={16} height={16} />}
          {wallet.support.recv && <RecvIcon className={`${styles.indicator} ${statusToClass(wallet.status.recv)}`} />}
          {wallet.support.send && <SendIcon className={`${styles.indicator} ${statusToClass(wallet.status.send)}`} />}
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
        <div className='d-flex text-center align-items-center h-100'>
          {image
            ? <img alt={title} width='100%' {...image} src={imgSrc} />
            : <Card.Title className='w-100 justify-content-center align-items-center'>{title}</Card.Title>}
        </div>
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
