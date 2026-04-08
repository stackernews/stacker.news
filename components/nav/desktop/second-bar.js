import { Nav, Navbar } from 'react-bootstrap'
import { NavSelect, PostItem, Sorts, hasNavSelect } from '../common'
import styles from '../../header.module.css'
import { useDomain } from '../../territory-domains'

export default function SecondBar (props) {
  const { prefix, topNavKey, sub } = props
  const { domain } = useDomain()
  if (!hasNavSelect(props)) return null
  return (
    <Navbar className='pt-0 pb-2'>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        {!domain && <NavSelect sub={sub} size='medium' className='me-1' />}
        <div className={`${!domain ? 'ms-2 d-flex' : 'd-flex'}`}>
          <Sorts {...props} className={!domain ? 'ms-1' : undefined} />
        </div>
        <PostItem className='ms-auto me-0 d-none d-md-flex' prefix={prefix} />
      </Nav>
    </Navbar>
  )
}
