import { Nav, Navbar } from 'react-bootstrap'
import { Back, NavPrice, NavWalletSummary, Sorts, hasNavSelect } from '../common'
import styles from '../../header.module.css'
import { useMe } from '@/components/me'
import { useDomain } from '@/components/territory-domains'

export default function SecondBar (props) {
  const { me } = useMe()
  const { domain } = useDomain()
  const { topNavKey } = props
  if (!hasNavSelect(props)) return null
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        {domain && <Back className='d-flex d-md-none' />}
        <Sorts {...props} />
        {me ? <NavWalletSummary className='ms-auto px-2' /> : <NavPrice className='justify-content-end' />}
      </Nav>
    </Navbar>
  )
}
