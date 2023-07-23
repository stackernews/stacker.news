import { Image } from 'react-bootstrap'
import LayoutStatic from '../components/layout-static'
import styles from '../styles/404.module.css'

export default function offline () {
  return (
    <LayoutStatic>
      <Image width='500' height='376' src='/falling.gif' fluid />
      <h1 className={styles.fourZeroFour}><span>Offline</span></h1>
    </LayoutStatic>
  )
}
