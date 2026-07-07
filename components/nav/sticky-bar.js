import { useEffect, useRef } from 'react'
import styles from '@/components/header.module.css'
import { Nav, Navbar } from 'react-bootstrap'
import Container from '@/components/ui/container'
import { NavPrice, SearchItem, Back, NavWalletSummary, Brand, SignUpButton, RightCorner } from './common'
import { useMe } from '@/components/me'
import classNames from 'classnames'
import { CommentsNavigator, useCommentsNavigatorContext } from '../use-comments-navigator'

export default function StickyBar ({ prefix, sub, path, topNavKey, dropNavKey, hideMobileNav = false }) {
  const ref = useRef()
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()

  useEffect(() => {
    const stick = () => {
      if (window.scrollY > 100) {
        ref.current?.classList.remove(styles.hide)
      } else {
        ref.current?.classList.add(styles.hide)
      }
    }

    window.addEventListener('scroll', stick)

    return () => {
      window.removeEventListener('scroll', stick)
    }
  }, [ref?.current])

  return (
    <div className={classNames(styles.hide, styles.sticky)} ref={ref}>
      <Container className='px-0 hidden md:block'>
        <Navbar className='py-0'>
          <Nav
            className={styles.navbarNav}
            activeKey={topNavKey}
          >
            <Back />
            <Brand className='me-1' />
            <SearchItem className='me-0 ms-2' />
            <NavPrice />
            <CommentsNavigator navigator={navigator} commentCount={commentCount} className='flex' />
            <RightCorner dropNavKey={dropNavKey} path={path} className='flex' />
          </Nav>
        </Navbar>
      </Container>
      {!hideMobileNav && (
        <Container className='sm:px-0 block md:hidden'>
          <Navbar className='py-0'>
            <Nav
              className={classNames(styles.navbarNav)}
              activeKey={topNavKey}
            >
              <Back />
              <NavPrice className='shrink' />
              <CommentsNavigator navigator={navigator} commentCount={commentCount} className='flex' />
              {me ? <NavWalletSummary className='px-2' /> : <SignUpButton className='ms-auto' width='fit-content' />}
            </Nav>
          </Navbar>
        </Container>
      )}
    </div>
  )
}
