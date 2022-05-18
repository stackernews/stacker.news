import { Image } from 'react-bootstrap'
import LayoutError from '../components/layout-error'
import styles from '../styles/404.module.css'

export default function fourZeroFour () {
  return (
    <LayoutError>
      <Image width='500' height='376' src='/maze.gif' fluid />
      <h1 className={styles.fourZeroFour}><span>404</span><span className={styles.notFound}>page not found</span></h1>
    </LayoutError>
  )
}
