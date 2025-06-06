import { Nav, Navbar } from 'react-bootstrap'
import { NavSelect, PostItem, Sorts, hasNavSelect } from '../common'
import styles from '../../header.module.css'
import { useDomain } from '@/components/territory-domains'

export default function SecondBar (props) {
  const { domain } = useDomain()
  const { prefix, topNavKey, sub } = props
  if (!hasNavSelect(props)) return null
  return (
    <Navbar className='pt-0 pb-2'>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        {!domain
          ? (
            <>
              <NavSelect sub={sub} size='medium' className='me-1' />
              <div className='ms-2 d-flex'><Sorts {...props} className='ms-1' /></div>
            </>
            )
            // wip-domains-uxui: as NavSelect is not used in domain, we can use Sorts directly without measurements
          : <Sorts {...props} />}
        <PostItem className='ms-auto me-0 d-none d-md-flex' prefix={prefix} />
      </Nav>
    </Navbar>
  )
}
