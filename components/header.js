import { signOut, signIn, useSession } from 'next-auth/client'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'
import { Container } from 'react-bootstrap'

export default function Header () {
  const [session, loading] = useSession()
  const router = useRouter()

  const Corner = () => {
    if (loading) {
      return null
    }

    if (session) {
      return (
        <>
          <Nav.Item>
            <Link href={'/' + session.user.name} passHref>
              <Nav.Link className='text-reset'>@{session.user.name}</Nav.Link>
            </Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link onClick={signOut}>logout</Nav.Link>
          </Nav.Item>
        </>
      )
    } else {
      return <Nav.Link href='/login' onClick={signIn}>login</Nav.Link>
    }
  }

  return (
    <>
      <Navbar bg='primary' className={styles.navbar}>
        <Container>
          <Link href='/' passHref>
            <Navbar.Brand className={styles.brand}>STACKER NEWS</Navbar.Brand>
          </Link>
          <Nav className='mr-auto align-items-center' activeKey={router.asPath.split('?')[0]}>
            <Nav.Item>
              <Link href='/recent' passHref>
                <Nav.Link>recent</Nav.Link>
              </Link>
            </Nav.Item>
            <Nav.Item>
              <Link href='/post' passHref>
                <Nav.Link>post</Nav.Link>
              </Link>
            </Nav.Item>
          </Nav>
          <Nav className='ml-auto align-items-center' activeKey={router.asPath.split('?')[0]}>
            <Corner />
          </Nav>
        </Container>
      </Navbar>
    </>
  )
}
