import { Image } from 'react-bootstrap'
import LayoutCenter from '../components/layout-center'
import styles from '../styles/404.module.css'

export default function fourZeroFour () {
  return (
    <LayoutCenter>
      <Image width='500' height='376' src='/maze.gif' fluid />
      <h1 className={styles.fourZeroFour}><span>404</span><span className={styles.notFound}>page not found</span></h1>
    </LayoutCenter>
  )
}
