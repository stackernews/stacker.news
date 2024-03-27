import { Nav, Navbar } from 'react-bootstrap'
import { NavPrice, Sorts, hasNavSelect } from '../common'
import styles from '../../header.module.css'

export default function SecondBar (props) {
  const { topNavKey } = props
  if (!hasNavSelect(props)) return null
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Sorts {...props} />
        <NavPrice className='justify-content-end' />
      </Nav>
    </Navbar>
  )
}
