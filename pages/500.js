import Image from 'react-bootstrap/Image'
import { StaticLayout } from '../components/layout'
import styles from '../styles/404.module.css'

export default function fiveHundo () {
  return (
    <StaticLayout>
      <Image width='500' height='375' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/falling.gif`} fluid />
      <h1 className={styles.fourZeroFour}><span>500</span><span className={styles.notFound}>server error</span></h1>
    </StaticLayout>
  )
}
