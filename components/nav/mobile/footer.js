import { Nav, Navbar } from 'react-bootstrap'
import { Brand, NavNotifications, PostItem, SearchItem } from '../common'
import { useMe } from '../../me'
import styles from './footer.module.css'
import classNames from 'classnames'
import Offcanvas from './offcanvas'
import { useRouter } from 'next/router'

export default function BottomBar ({ sub }) {
  const router = useRouter()
  const path = router.asPath.split('?')[0]

  const props = {
    prefix: sub ? `/~${sub}` : '',
    path,
    topNavKey: path.split('/')[sub ? 2 : 1] ?? '',
    dropNavKey: path.split('/').slice(sub ? 2 : 1).join('/'),
    sub
  }
  const me = useMe()
  return (
    <div className={classNames('d-block d-md-none', styles.footer)}>
      <Navbar className='container px-0'>
        <Nav className={styles.footerNav}>
          <Offcanvas me={me} {...props} />
          <SearchItem {...props} />
          <Brand />
          <PostItem {...props} className='btn-sm' />
          <NavNotifications />
        </Nav>
      </Navbar>
    </div>
  )
}
