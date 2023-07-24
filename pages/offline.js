import Image from 'react-bootstrap/Image'
import { StaticLayout } from '../components/layout'
import styles from '../styles/404.module.css'

export default function offline () {
  return (
    <StaticLayout>
      <Image width='500' height='376' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/falling.gif`} fluid />
      <h1 className={styles.fourZeroFour}><span>Offline</span></h1>
    </StaticLayout>
  )
}
