import Header from './header'
import Container from 'react-bootstrap/Container'
import { LightningProvider } from './lightning'

export default function Layout ({ noContain, children }) {
  return (
    <>
      <LightningProvider>
        <Header />
        {noContain
          ? children
          : (
            <Container className='my-1 px-sm-0'>
              {children}
            </Container>
            )}
      </LightningProvider>
    </>
  )
}
