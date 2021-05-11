import Link from 'next/link'
import { useRouter } from 'next/router'
import Nav from 'react-bootstrap/Nav'

export default function UserHeader ({ user }) {
  const router = useRouter()
  return (
    <>
      <h1>@{user.name} <small className='text-success'>[{user.stacked} stacked, {user.sats} sats]</small></h1>
      <Nav
        activeKey={router.asPath}
      >
        <Nav.Item>
          <Link href={'/' + user.name} passHref>
            <Nav.Link>{user.nitems} posts</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href={'/' + user.name + '/comments'} passHref>
            <Nav.Link>{user.ncomments} comments</Nav.Link>
          </Link>
        </Nav.Item>
        {/* <Nav.Item>
          <Link href={'/' + user.name + '/sativity'} passHref>
            <Nav.Link>sativity</Nav.Link>
          </Link>
        </Nav.Item> */}
      </Nav>
    </>
  )
}
