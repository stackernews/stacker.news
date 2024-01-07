import { Badge, Button, Card } from 'react-bootstrap'
import styles from '../styles/wallet.module.css'
import Plug from '../svgs/plug.svg'
import Gear from '../svgs/settings-5-fill.svg'
import Link from 'next/link'
import CancelButton from './cancel-button'
import { SubmitButton } from './form'

export function WalletCard ({ title, badges, provider, enabled }) {
  return (
    <Card className={styles.card}>
      <div className={`${styles.indicator} ${enabled ? styles.success : styles.disabled}`} />
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
      {provider &&
        <Link href={`/settings/wallets/${provider}`}>
          <Card.Footer className={styles.attach}>
            {enabled
              ? <>configure<Gear width={14} height={14} /></>
              : <>attach<Plug width={14} height={14} /></>}
          </Card.Footer>
        </Link>}
    </Card>
  )
}

export function WalletButtonBar ({
  enabled, disable,
  className, children, onDelete, onCancel, hasCancel = true,
  createText = 'attach', deleteText = 'unattach', editText = 'save'
}) {
  return (
    <div className={`mt-3 ${className}`}>
      <div className='d-flex justify-content-between'>
        {enabled &&
          <Button onClick={onDelete} variant='grey-medium'>{deleteText}</Button>}
        {children}
        <div className='d-flex align-items-center ms-auto'>
          {hasCancel && <CancelButton onClick={onCancel} />}
          <SubmitButton variant='primary' disabled={disable}>{enabled ? editText : createText}</SubmitButton>
        </div>
      </div>
    </div>
  )
}
