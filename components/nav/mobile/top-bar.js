import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavSelect, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'
import { useDomain } from '@/components/territory-domains'

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  const { me } = useMe()
  const { domain } = useDomain()
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back className='d-flex d-md-none' />
        {hasNavSelect({ path, pathname })
          ? !domain ? <NavSelect sub={sub} className='w-100' /> : null
          : (
            <>
              <NavPrice className='flex-shrink-1' />
              {me ? <NavWalletSummary /> : <SignUpButton width='fit-content' />}
            </>)}
      </Nav>
    </Navbar>
  )
}
