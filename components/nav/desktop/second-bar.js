import { Nav, Navbar } from 'react-bootstrap'
import { NavSelect, PostItem, Sorts, hasNavSelect } from '../common'
import styles from '../../header.module.css'
import { useBranding } from '../../territory-branding'

export default function SecondBar (props) {
  const { prefix, topNavKey, sub } = props
  const branding = useBranding()
  if (!hasNavSelect(props)) return null
  return (
    <Navbar className='pt-0 pb-2'>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        {!branding && <NavSelect sub={sub} size='medium' className='me-1' />}
        <div className={`${!branding ? 'ms-2 d-flex' : 'd-flex'}`}>
          <Sorts {...props} className={!branding ? 'ms-1' : undefined} />
        </div>
        <PostItem className='ms-auto me-0 d-none d-md-flex' prefix={prefix} />
      </Nav>
    </Navbar>
  )
}
