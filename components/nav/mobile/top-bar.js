import { Nav, Navbar, Container } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'
import { useEffect, useRef } from 'react'
import classNames from 'classnames'

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()
  const ref = useRef()
  const showNavSelect = hasNavSelect({ path, pathname })

  useEffect(() => {
    const threshold = showNavSelect ? 100 : 0
    const stick = () => {
      if (window.scrollY > threshold) {
        ref.current?.classList.add(styles.scrolled)
        if (showNavSelect) ref.current?.classList.remove(styles.hide)
      } else {
        ref.current?.classList.remove(styles.scrolled)
        if (showNavSelect) ref.current?.classList.add(styles.hide)
      }
    }

    stick()
    window.addEventListener('scroll', stick, { passive: true })

    return () => {
      window.removeEventListener('scroll', stick)
    }
  }, [showNavSelect])

  return (
    <>
      {!showNavSelect && <div className={styles.navbarSpacer} />}
      <div className={classNames(showNavSelect && styles.hide, styles.sticky)} ref={ref}>
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
