import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { AnonCorner, Back, Brand, MeCorner, NavPrice, SearchItem } from '../common'
import { useMe } from '../../me'

export default function TopBar ({ prefix, sub, path, topNavKey, dropNavKey }) {
  const { me } = useMe()
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back />
        <Brand className='me-1' />
        <SearchItem prefix={prefix} className='me-0 ms-2 d-none d-md-flex' />
        <NavPrice className='ms-auto me-0 mx-md-auto d-none d-md-flex' />
        {me
          ? <MeCorner dropNavKey={dropNavKey} me={me} className='d-none d-md-flex' />
          : <AnonCorner path={path} className='d-none d-md-flex' />}
      </Nav>
    </Navbar>
  )
}
