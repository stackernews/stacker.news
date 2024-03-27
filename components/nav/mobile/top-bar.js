import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavSelect, NavWalletSummary, SignUpButton, noNavSelect } from '../common'
import { useMe } from '@/components/me'

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  const me = useMe()
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back className='d-flex d-md-none' />
        {noNavSelect({ path, pathname })
          ? (
            <>
              <NavPrice className='flex-shrink-1' />
              {me ? <NavWalletSummary /> : <SignUpButton />}
            </>)
          : <NavSelect sub={sub} className='w-100' />}
      </Nav>
    </Navbar>
  )
}
