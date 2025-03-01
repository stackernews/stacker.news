import { Nav, Navbar } from 'react-bootstrap'
import { NavPrice, NavWalletSummary, Sorts, hasNavSelect, MultiNavSelect } from '../common'
import styles from '../../header.module.css'
import { useMe } from '@/components/me'

export default function SecondBar (props) {
  const { me } = useMe()
  const { topNavKey, sub } = props
  const isMultiSub = sub && Array.isArray(sub) ? sub.length > 1 : false
  if (!hasNavSelect(props)) return null
  return (
    <Navbar className='d-flex flex-column align-items-start'>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Sorts {...props} />
        {me ? <NavWalletSummary className='ms-auto px-2' /> : <NavPrice className='justify-content-end' />}
      </Nav>
      {isMultiSub && hasNavSelect(props) && <MultiNavSelect subs={sub} size='large' className='me-1' />}
    </Navbar>
  )
}
