import { signOut, signIn, useSession } from 'next-auth/client'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Link from 'next/link'
import styles from './header.module.css'
import { useRouter } from 'next/router'

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
          <Nav.Item>{session.user.name}</Nav.Item>
          <Nav.Item>
            <Nav.Link onClick={signOut}>logout</Nav.Link>
          </Nav.Item>
        </>
      )
    } else {
      return <Nav.Link onClick={signIn}>login</Nav.Link>
    }
  }

  return (
    <>
      <Navbar bg='brand' className={styles.navbar}>
        <Link href='/' passHref>
          <Navbar.Brand className={styles.brand}>STACKER NEWS</Navbar.Brand>
        </Link>
        <Nav className='mr-auto align-items-center' activeKey={router.pathname}>
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
        <Nav className='ml-auto align-items-center'>
          <Corner />
        </Nav>
      </Navbar>
    </>
  )
}
