import { useEffect, useRef } from 'react'
import styles from '@/components/header.module.css'
import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavPrice, MeCorner, AnonCorner, SearchItem, Back, NavWalletSummary, Brand, SignUpButton } from './common'
import { useMe } from '@/components/me'
import classNames from 'classnames'

export default function StickyBar ({ prefix, sub, path, topNavKey, dropNavKey }) {
  const ref = useRef()
  const sticky = useRef()
  const me = useMe()

  useEffect(() => {
    const observer = new window.IntersectionObserver(([entry]) => {
      sticky?.current?.classList.toggle(styles.hide, entry.isIntersecting)
    })
    ref?.current && observer.observe(ref.current)

    return () => {
      ref?.current && observer.unobserve(ref.current)
    }
  }, [ref?.current, sticky?.current])

  return (
    <>
      <div ref={ref} style={{ position: 'relative', top: '50px' }} />
      <div className={styles.hide} style={{ position: 'sticky', borderBottom: '1px solid var(--theme-toolbarActive)', top: '0', backgroundColor: 'var(--bs-body-bg)', zIndex: 1000 }} ref={sticky}>
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
              {me ? <MeCorner dropNavKey={dropNavKey} me={me} className='d-flex' /> : <AnonCorner path={path} className='d-flex' />}
            </Nav>
          </Navbar>
        </Container>
        <Container className='px-sm-0 d-block d-md-none'>
          <Navbar className='py-0'>
            <Nav
              className={classNames(styles.navbarNav, 'justify-content-between')}
              activeKey={topNavKey}
            >
              <Back />
              <NavPrice className='flex-shrink-1 flex-grow-0' />
              {me ? <NavWalletSummary /> : <SignUpButton />}
            </Nav>
          </Navbar>
        </Container>
      </div>
    </>
  )
}
