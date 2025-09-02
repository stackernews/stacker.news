import { Nav, Navbar, Container } from 'react-bootstrap'
import styles from '../../header.module.css'
import { AnonCorner, Back, Brand, MeCorner, NavPrice, SearchItem } from '../common'
import { useMe } from '../../me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'
import classNames from 'classnames'
import { useScrollThreshold } from '@/components/use-scroll-threshold'

export default function TopBar ({ prefix, sub, path, topNavKey, dropNavKey }) {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()
  const { sentinelRef, past } = useScrollThreshold(0)

  return (
    <>
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
      <div className={styles.navbarSpacer} />
      <div className={classNames(styles.sticky, past && styles.scrolled)}>
        <Container className='px-0'>
          <Navbar className='py-0'>
            <Nav
              className={styles.navbarNav}
              activeKey={topNavKey}
            >
              <Back />
              <Brand className='me-1' />
              <SearchItem prefix={prefix} className='me-0 ms-2 d-none d-md-flex' />
              <NavPrice className='ms-auto me-0 mx-md-auto d-none d-md-flex' />
              <CommentsNavigator navigator={navigator} commentCount={commentCount} />
              {me
                ? <MeCorner dropNavKey={dropNavKey} me={me} className='d-none d-md-flex' />
                : <AnonCorner path={path} className='d-none d-md-flex' />}
            </Nav>
          </Navbar>
        </Container>
      </div>
    </>
  )
}
