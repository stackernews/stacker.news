import { Image } from 'react-bootstrap'
import LayoutCenter from '../components/layout-center'
import styles from '../styles/404.module.css'

export default function fourZeroFour () {
  return (
    <LayoutCenter>
      <Image width='500' height='375' src='/falling.gif' fluid />
      <h1 className={styles.fourZeroFour}><span>500</span><span className={styles.notFound}>server error</span></h1>
    </LayoutCenter>
  )
}
