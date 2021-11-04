import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Button, Container, NavDropdown, SplitButton, Dropdown } from 'react-bootstrap'
import Price from './price'
import { useMe } from './me'
import Head from 'next/head'
import { signOut, signIn, useSession } from 'next-auth/client'
import { useLightning } from './lightning'
import { useEffect, useState } from 'react'
import { randInRange } from '../lib/rand'
import styled from 'styled-components'
import Sun from '../svgs/sun-fill.svg'
import Moon from '../svgs/moon-fill.svg'
import { gql, useMutation } from '@apollo/client'

const Brand = styled(Navbar.Brand)`
  color: ${({ theme }) => theme.brandColor}
`

export const StyledNavbar = styled(Navbar).attrs(({ theme }) => ({
  variant: theme.navbarVariant,
  className: styles.navbar
}))`
  & .dropdown-menu {
    background-color: ${({ theme }) => theme.body};
    border: 1px solid ${({ theme }) => theme.borderColor};
  }

  & .dropdown-item {
    color: ${({ theme }) => theme.dropdownItemColor};
  }

  & .dropdown-item:hover {
    color: ${({ theme }) => theme.dropdownItemColorHover};
  }

  & .dropdown-item.active {
    color: ${({ theme }) => theme.brandColor};
    text-shadow: 0 0 10px var(--primary);
  }

  & .dropdown-divider {
    border-top: 1px solid ${({ theme }) => theme.borderColor};
  }

  & .theme {
    margin-right: 1rem;
    cursor: pointer;
    fill: ${({ theme }) => theme.dropdownItemColor};
  }

  & .theme:hover {
    fill: ${({ theme }) => theme.dropdownItemColorHover};
  }
`

function WalletSummary ({ me }) {
  return `${me?.sats} \\ ${me?.stacked}`
}

export default function Header () {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const me = useMe()
  const [session, loading] = useSession()
  const [sort, setSort] = useState('recent')
  const [within, setWithin] = useState()
  const [setTheme] = useMutation(
    gql`
      mutation setTheme($theme: String!) {
        setTheme(theme: $theme)
      }`
  )

  useEffect(() => {
    setSort(localStorage.getItem('sort') || 'recent')
    setWithin(localStorage.getItem('topWithin'))
  }, [])

  const otherSort = sort === 'recent' ? 'top' : 'recent'
  const sortLink = `/${sort}${sort === 'top' && within ? `/${within}` : ''}`
  const otherSortLink = `/${otherSort}${otherSort === 'top' && within ? `/${within}` : ''}`

  const Corner = () => {
    if (me) {
      return (
        <div className='d-flex align-items-center'>
          <Head>
            <link rel='shortcut icon' href={me?.hasNewNotes ? '/favicon-notify.png' : '/favicon.png'} />
          </Head>
          <div className='position-relative mr-1'>
            <NavDropdown className='px-0' title={`@${me?.name}`} alignRight>
              <Link href={'/' + me?.name} passHref>
                <NavDropdown.Item>
                  profile
                  {me && !me.bio &&
                    <div className='p-1 d-inline-block bg-secondary ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <Link href='/notifications' passHref>
                <NavDropdown.Item>
                  notifications
                  {me?.hasNewNotes &&
                    <div className='p-1 d-inline-block bg-danger ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <Link href='/wallet' passHref>
                <NavDropdown.Item>wallet</NavDropdown.Item>
              </Link>
              <NavDropdown.Divider />
              <Link href='/invites' passHref>
                <NavDropdown.Item>invites
                  {me && !me.hasInvites &&
                    <div className='p-1 d-inline-block bg-success ml-1'>
                      <span className='invisible'>{' '}</span>
                    </div>}
                </NavDropdown.Item>
              </Link>
              <div>
                <NavDropdown.Divider />
                <Link href='/recent' passHref>
                  <NavDropdown.Item>recent</NavDropdown.Item>
                </Link>
                <Link href={`/top${within ? `/${within}` : ''}`} passHref>
                  <NavDropdown.Item>top</NavDropdown.Item>
                </Link>
                {me
                  ? (
                    <Link href='/post' passHref>
                      <NavDropdown.Item>post</NavDropdown.Item>
                    </Link>
                    )
                  : <NavDropdown.Item onClick={signIn}>post</NavDropdown.Item>}
                <NavDropdown.Item href='https://bitcoinerjobs.co' target='_blank'>jobs</NavDropdown.Item>
              </div>
              <NavDropdown.Divider />
              <div className='d-flex align-items-center'>
                <Link href='/settings' passHref>
                  <NavDropdown.Item>settings</NavDropdown.Item>
                </Link>
                {me?.theme === 'light'
                  ? <Moon onClick={() => setTheme({ variables: { theme: 'dark' } })} className='theme' />
                  : <Sun onClick={() => setTheme({ variables: { theme: 'light' } })} className='theme' />}
              </div>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={signOut}>logout</NavDropdown.Item>
            </NavDropdown>
            {me?.hasNewNotes &&
              <span className='position-absolute p-1 bg-danger' style={{ top: '5px', right: '0px' }}>
                <span className='invisible'>{' '}</span>
              </span>}
            {me && !me.bio &&
              <span className='position-absolute p-1 bg-secondary' style={{ bottom: '5px', right: '0px' }}>
                <span className='invisible'>{' '}</span>
              </span>}
          </div>
          {me &&
            <Nav.Item>
              <Link href='/wallet' passHref>
                <Nav.Link className='text-success px-0 text-nowrap'><WalletSummary me={me} /></Nav.Link>
              </Link>
            </Nav.Item>}
        </div>
      )
    } else {
      if (loading || session) {
        return null
      }
      const strike = useLightning()
      useEffect(() => {
        setTimeout(strike, randInRange(3000, 10000))
      }, [router.asPath])
      return path !== '/login' && !path.startsWith('/invites') && <Button id='login' onClick={signIn}>login</Button>
    }
  }

  return (
    <>
      <Container className='px-sm-0'>
        <StyledNavbar>
          <Nav
            className={styles.navbarNav}
            activeKey={path}
          >
            <Link href='/' passHref>
              <Brand className={`${styles.brand} d-none d-sm-block`}>STACKER NEWS</Brand>
            </Link>
            <Link href='/' passHref>
              <Brand className={`${styles.brand} d-block d-sm-none`}>SN</Brand>
            </Link>
            <Nav.Item className='d-md-flex d-none nav-dropdown-toggle'>
              <SplitButton
                title={
                  <Link href={sortLink} passHref>
                    <Nav.Link className={styles.navLink}>{sort}</Nav.Link>
                  </Link>
              }
                key={`/${sort}`}
                id='recent-top-button'
                variant='link'
                className='p-0'
              >
                <Link href={otherSortLink} passHref>
                  <Dropdown.Item onClick={() => localStorage.setItem('sort', otherSort)}>{otherSort}</Dropdown.Item>
                </Link>
              </SplitButton>
            </Nav.Item>
            <Nav.Item className='d-md-flex d-none'>
              {me
                ? (
                  <Link href='/post' passHref>
                    <Nav.Link className={styles.navLink}>post</Nav.Link>
                  </Link>
                  )
                : <Nav.Link className={styles.navLink} onClick={signIn}>post</Nav.Link>}
            </Nav.Item>
            <Nav.Item className='d-md-flex d-none'>
              <Nav.Link href='https://bitcoinerjobs.co' target='_blank' className={styles.navLink}>jobs</Nav.Link>
            </Nav.Item>
            <Nav.Item className='text-monospace' style={{ opacity: '.5' }}>
              <Price />
            </Nav.Item>
            <Corner />
          </Nav>
        </StyledNavbar>
      </Container>
    </>
  )
}

export function HeaderPreview () {
  return (
    <>
      <Container className='px-sm-0'>
        <Navbar className={styles.navbar}>
          <Nav className='w-100 justify-content-between flex-wrap align-items-center'>
            <Link href='/' passHref>
              <Navbar.Brand className={`${styles.brand} d-none d-sm-block`}>STACKER NEWS</Navbar.Brand>
            </Link>
            <Nav.Item className='text-monospace' style={{ opacity: '.5' }}>
              <Price />
            </Nav.Item>
          </Nav>
        </Navbar>
      </Container>
    </>
  )
}
