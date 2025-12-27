import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavSelect, hasNavSelect } from '../common'
import SecondBar from './second-bar'

export default function NavSelectBar ({ sub, topNavKey, path, pathname }) {
  if (!hasNavSelect({ path, pathname })) return null
  return (
    <>
      <Navbar>
        <Nav
          className={styles.navbarNav}
          activeKey={topNavKey}
        >
          <Back className='d-flex d-md-none' />
          <NavSelect sub={sub} className='w-100' />
        </Nav>
      </Navbar>
      <SecondBar topNavKey={topNavKey} />
    </>
  )
}
