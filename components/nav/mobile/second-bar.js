import { Nav, Navbar } from 'react-bootstrap'
import { NavWalletSummary, Sorts, hasNavSelect, SignUpButton } from '../common'
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
        {me ? <NavWalletSummary className='ms-auto px-2' /> : <SignUpButton className='ms-auto' width='fit-content' />}
      </Nav>
    </Navbar>
  )
}
