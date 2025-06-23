import { useCallback } from 'react'
import { Card } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import DragIcon from '@/svgs/draggable.svg'
import { useWalletImage, useWalletIsConfigured, useWalletSupport, useWalletStatus, WalletStatus } from '@/wallets/client/hooks'
import { isWallet, urlify, walletDisplayName } from '@/wallets/lib/util'
import { useDndState, useDndDispatch, DRAG_START, DRAG_ENTER, DRAG_DROP, DRAG_END } from '@/wallets/client/context'

export function WalletCard ({ wallet, className = '', draggable = false, onDragStart, onDragOver, onDragEnter, onDrop, onDragEnd }) {
  const image = useWalletImage(wallet.name)
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)
  const isConfigured = useWalletIsConfigured(wallet)

  return (
    <Card
      className={classNames(styles.card, className, { [styles.draggable]: draggable })}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
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
          {isConfigured
            ? <>configure<Gear width={14} height={14} /></>
            : <>attach<Plug width={14} height={14} /></>}
        </Card.Footer>
      </WalletLink>
    </Card>
  )
}

export function DraggableWalletCard ({ wallet, index, items }) {
  const { isDragging, dragOverIndex } = useDndState()
  const dispatch = useDndDispatch()

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
    e.dataTransfer.setData('text/plain', index.toString())
    dispatch({ type: DRAG_START, index })
  }, [index, dispatch])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    dispatch({ type: DRAG_ENTER, index })
  }, [index, dispatch])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'))
    if (draggedIndex !== index) {
      dispatch({ type: DRAG_DROP, fromIndex: draggedIndex, toIndex: index, items })
    }
  }, [index, dispatch, items])

  const handleDragEnd = useCallback(() => {
    dispatch({ type: DRAG_END })
  }, [dispatch])

  const isBeingDragged = isDragging && dragOverIndex === index
  const isDragOver = isDragging && dragOverIndex !== index && dragOverIndex === index

  return (
    <WalletCard
      wallet={wallet}
      className={classNames({ [styles.dragging]: isBeingDragged, [styles.dragOver]: isDragOver })}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    />
  )
}

function WalletLink ({ wallet, children }) {
  const support = useWalletSupport(wallet)
  const sendRecvParam = support.send ? 'send' : 'receive'
  const href = '/wallets' + (isWallet(wallet) ? `/${wallet.id}` : `/${urlify(wallet.name)}`) + `/${sendRecvParam}`
  return <Link href={href}>{children}</Link>
}

function statusToClass (status) {
  switch (status) {
    case WalletStatus.Enabled: return styles.success
    case WalletStatus.Disabled: return styles.disabled
    case WalletStatus.Error: return styles.error
    case WalletStatus.Warning: return styles.warning
  }
}
