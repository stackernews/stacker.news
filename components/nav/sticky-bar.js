import { useEffect, useRef } from 'react'
import styles from '@/components/header.module.css'
import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavPrice, MeCorner, AnonCorner, SearchItem, Back, NavWalletSummary, Brand, SignUpButton } from './common'
import { useMe } from '@/components/me'
import classNames from 'classnames'
import { CommentsNavigator, useCommentsNavigatorContext } from '../use-comments-navigator'

export default function StickyBar ({ prefix, sub, path, topNavKey, dropNavKey }) {
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
      <Container className='px-0 d-none d-md-block'>
        <Navbar className='py-0'>
          <Nav
            className={styles.navbarNav}
            activeKey={topNavKey}
          >
            <Back />
            <Brand className='me-1' />
            <SearchItem className='me-0 ms-2' />
            <NavPrice />
            <CommentsNavigator navigator={navigator} commentCount={commentCount} className='d-flex' />
            {me ? <MeCorner dropNavKey={dropNavKey} me={me} className='d-flex' /> : <AnonCorner path={path} className='d-flex' />}
          </Nav>
        </Navbar>
      </Container>
      <Container className='px-sm-0 d-block d-md-none'>
        <Navbar className='py-0'>
          <Nav
            className={classNames(styles.navbarNav)}
            activeKey={topNavKey}
          >
            <Back />
            <NavPrice className='flex-shrink-1' />
            <CommentsNavigator navigator={navigator} commentCount={commentCount} className='d-flex' />
            {me ? <NavWalletSummary className='px-2' /> : <SignUpButton width='fit-content' />}
          </Nav>
        </Navbar>
      </Container>
    </div>
  )
}
