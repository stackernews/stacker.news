import { useRef } from 'react'
import styles from '@/components/header.module.css'
import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavPrice, MeCorner, AnonCorner, SearchItem, Back, NavWalletSummary, Brand, SignUpButton } from './common'
import { useMe } from '@/components/me'
import classNames from 'classnames'

export default function StickyBar ({ prefix, sub, path, topNavKey, dropNavKey }) {
  const ref = useRef()
  const { me } = useMe()

  return (
    <div className={styles.sticky} ref={ref}>
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
            {me ? <NavWalletSummary className='px-2' /> : <SignUpButton width='fit-content' />}
          </Nav>
        </Navbar>
      </Container>
    </div>
  )
}
