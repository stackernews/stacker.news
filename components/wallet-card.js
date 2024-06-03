import { Badge, Button, Card } from 'react-bootstrap'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import CancelButton from './cancel-button'
import { SubmitButton } from './form'
import { useWallet, Status } from './wallet'

export function WalletCard ({ name, title, badges, status }) {
  const wallet = useWallet(name)

  let indicator = styles.disabled
  switch (wallet.status) {
    case Status.Enabled:
    case true:
      indicator = styles.success
      break
    case Status.Locked:
      indicator = styles.warning
      break
    case Status.Error:
      indicator = styles.error
      break
    case Status.Initialized:
    case false:
      indicator = styles.disabled
      break
  }

  return (
    <Card className={styles.card}>
      <div className={`${styles.indicator} ${indicator}`} />
      <Card.Body>
        <Card.Title>{title}</Card.Title>
        <Card.Subtitle className='mt-2'>
          {badges?.map(
            badge =>
              <Badge className={styles.badge} key={badge} bg={null}>
                {badge}
              </Badge>)}
        </Card.Subtitle>
      </Card.Body>
      <Link href={`/settings/wallets/${name}`}>
        <Card.Footer className={styles.attach}>
          {wallet.isConfigured
            ? <>configure<Gear width={14} height={14} /></>
            : <>attach<Plug width={14} height={14} /></>}
        </Card.Footer>
      </Link>
    </Card>
  )
}

export function WalletButtonBar ({
  wallet, disable,
  className, children, onDelete, onCancel, hasCancel = true,
  createText = 'attach', deleteText = 'detach', editText = 'save'
}) {
  return (
    <div className={`mt-3 ${className}`}>
      <div className='d-flex justify-content-between'>
        {wallet.isConfigured &&
          <Button onClick={onDelete} variant='grey-medium'>{deleteText}</Button>}
        {children}
        <div className='d-flex align-items-center ms-auto'>
          {hasCancel && <CancelButton onClick={onCancel} />}
          <SubmitButton variant='primary' disabled={disable}>{wallet.isConfigured ? editText : createText}</SubmitButton>
        </div>
      </div>
    </div>
  )
}
