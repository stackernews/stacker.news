import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavSelect, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  const { me } = useMe()
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back className='d-flex d-md-none' />
        {hasNavSelect({ path, pathname })
          ? <NavSelect sub={sub} className='w-100' />
          : (
            <>
              <NavPrice className='flex-shrink-1' />
              {me ? <NavWalletSummary /> : <SignUpButton width='fit-content' />}
            </>)}
      </Nav>
    </Navbar>
  )
}
