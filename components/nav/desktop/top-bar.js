import { Nav, Navbar, Container } from 'react-bootstrap'
import styles from '../../header.module.css'
import { AnonCorner, Back, Brand, MeCorner, NavPrice, SearchItem } from '../common'
import { useMe } from '../../me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'
import { useEffect, useRef } from 'react'

export default function TopBar ({ prefix, sub, path, topNavKey, dropNavKey }) {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()
  const ref = useRef()

  useEffect(() => {
    const stick = () => {
      if (window.scrollY > 0) {
        ref.current?.classList.add(styles.scrolled)
      } else {
        ref.current?.classList.remove(styles.scrolled)
      }
    }

    window.addEventListener('scroll', stick)

    return () => {
      window.removeEventListener('scroll', stick)
    }
  }, [ref.current])

  return (
    <>
      <div className={styles.navbarSpacer} />
      <div className={styles.sticky} ref={ref}>
        <Container className='px-0 d-none d-md-block'>
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
