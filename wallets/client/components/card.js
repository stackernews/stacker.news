import { Card } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import DragIcon from '@/svgs/draggable.svg'
import { useWalletImage, useWalletSupport, useWalletStatus, WalletStatus, useWalletDelete } from '@/wallets/client/hooks'
import { isWallet, urlify, walletDisplayName } from '@/wallets/lib/util'
import { Draggable } from '@/wallets/client/components'
import TrashIcon from '@/svgs/delete-bin-line.svg'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'

export function WalletCard ({ wallet, draggable = false, index, ...props }) {
  const image = useWalletImage(wallet.name)
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)
  const showModal = useShowModal()
  const router = useRouter()

  const card = (
    <Card
      className={styles.card}
      {...props}
    >
      <div className={styles.indicators}>
        {draggable && <DragIcon className={classNames(styles.indicator, styles.drag, 'me-auto')} />}
        {support.send && <SendIcon className={`${styles.indicator} ${statusToClass(status.send)}`} />}
        {support.receive && <RecvIcon className={`${styles.indicator} ${statusToClass(status.receive)}`} />}
      </div>
      <Card.Body>
        <div className='d-flex text-center align-items-center h-100'>
          {image
            ? <img className={styles.walletLogo} {...image} />
            : <Card.Title className={styles.walletLogo}>{walletDisplayName(wallet.name)}</Card.Title>}
        </div>
      </Card.Body>
      <Card.Footer className={classNames(styles.attach, 'd-flex justify-content-around px-2 px-sm-3')}>
        {isWallet(wallet)
          ? (
            <>
              <WalletLink wallet={wallet} className='pe-1 pe-sm-2 justify-content-center d-flex align-items-center text-reset'>
                <Gear width={14} height={14} className='me-2' />modify
              </WalletLink>
              <div className='pointer text-center border-start ps-2 ps-sm-3 d-flex align-items-center' onClick={() => showModal(onClose => <WalletDeleteObstacle wallet={wallet} onClose={onClose} onSuccess={() => router.push('/wallets')} />)}><TrashIcon width={18} height={18} /></div>
            </>
            )
          : (
            <WalletLink wallet={wallet} className='justify-content-center d-flex align-items-center text-reset'>
              <Plug width={14} height={14} className='me-2' />attach
            </WalletLink>)}
      </Card.Footer>
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

function WalletLink ({ wallet, children, className }) {
  const href = '/wallets' + (isWallet(wallet) ? `/${wallet.id}` : `/${urlify(wallet.name)}`)
  return <Link href={href} className={className}>{children}</Link>
}

function statusToClass (status) {
  switch (status) {
    case WalletStatus.OK: return styles.success
    case WalletStatus.ERROR: return styles.error
    case WalletStatus.WARNING: return styles.warning
    case WalletStatus.DISABLED: return styles.disabled
  }
}

function WalletDeleteObstacle ({ wallet, onClose, onSuccess }) {
  const deleteWallet = useWalletDelete(wallet)
  const toaster = useToast()

  const handleConfirm = async () => {
    try {
      await deleteWallet()
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('failed to delete wallet:', err)
      toaster.danger('failed to delete wallet')
    }
  }

  return (
    <div className='text-center'>
      <h4 className='mb-3'>Delete wallet</h4>
      <p className='fw-bold'>
        Are you sure you want to delete this wallet?
      </p>
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='delete' />
    </div>
  )
}
