import { Nav, Navbar } from 'react-bootstrap'
import { NavSelect, PostItem, Sorts, noNavSelect } from '../common'
import styles from '../../header.module.css'

export default function SecondBar (props) {
  const { prefix, topNavKey, sub } = props
  if (noNavSelect(props)) return null
  return (
    <Navbar className='pt-0 pb-3'>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <NavSelect sub={sub} size='medium' className='me-1' />
        <Sorts {...props} />
        <PostItem className='ms-auto me-0 d-none d-md-flex' prefix={prefix} />
      </Nav>
    </Navbar>
  )
}
