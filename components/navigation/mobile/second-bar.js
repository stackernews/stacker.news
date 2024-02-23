import { Nav, Navbar } from 'react-bootstrap'
import { NavPrice, Sorts, noNavSelect } from '../common'
import styles from '../../header.module.css'

export default function SecondBar (props) {
  const { topNavKey } = props
  if (noNavSelect(props)) return null
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
