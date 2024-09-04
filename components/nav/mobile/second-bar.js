import { Nav, Navbar } from 'react-bootstrap'
import { NavPrice, NavWalletSummary, Sorts, hasNavSelect } from '../common'
import styles from '../../header.module.css'
import { useMe } from '@/components/me'

export default function SecondBar (props) {
  const { me } = useMe()
  const { topNavKey } = props
  if (!hasNavSelect(props)) return null
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Sorts {...props} />
        {me ? <NavWalletSummary className='ms-auto px-2' /> : <NavPrice className='justify-content-end' />}
      </Nav>
    </Navbar>
  )
}
