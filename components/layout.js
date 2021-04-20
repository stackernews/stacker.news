import Header from './header'
import Container from 'react-bootstrap/Container'
import { Lightning } from './lightning'

export default function Layout ({ noContain, children }) {
  return (
    <>
      <Header />
      <Lightning />
      {noContain
        ? children
        : (
          <Container className='my-2 py-2 px-sm-0'>
            {children}
          </Container>
          )}
    </>
  )
}
