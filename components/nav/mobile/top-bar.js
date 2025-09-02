import { Nav, Navbar, Container } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'
import classNames from 'classnames'
import { useScrollThreshold } from '@/components/use-scroll-threshold'

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()
  const showNavSelect = hasNavSelect({ path, pathname })
  // TODO: arbitrary value?
  const threshold = showNavSelect ? 10 : 0
  const { sentinelRef, past } = useScrollThreshold(threshold)

  return (
    <>
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
      {!showNavSelect && <div className={styles.navbarSpacer} />}
      <div className={classNames(styles.sticky, past && styles.scrolled, showNavSelect && !past && styles.hide)}>
        <Container className='px-sm-0 d-block d-md-none'>
          <Navbar className='py-0'>
            <Nav
              className={styles.navbarNav}
              activeKey={topNavKey}
            >
              <Back className='d-flex d-md-none' />
              <NavPrice className='flex-shrink-1' />
              <CommentsNavigator navigator={navigator} commentCount={commentCount} className='px-2' />
              {me ? <NavWalletSummary /> : <SignUpButton width='fit-content' />}
            </Nav>
          </Navbar>
        </Container>
      </div>
    </>
  )
}
