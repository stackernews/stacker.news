import { Badge, Card } from 'react-bootstrap'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import { Status } from 'wallets'

export default function WalletCard ({ wallet }) {
  const { card: { title, badges } } = wallet

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
      <Link href={`/settings/wallets/${wallet.name}`}>
        <Card.Footer className={styles.attach}>
          {wallet.isConfigured
            ? <>configure<Gear width={14} height={14} /></>
            : <>attach<Plug width={14} height={14} /></>}
        </Card.Footer>
      </Link>
    </Card>
  )
}
