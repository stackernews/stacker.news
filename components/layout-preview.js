import { HeaderPreview } from './header'
import Head from 'next/head'
import Container from 'react-bootstrap/Container'

export default function LayoutPreview ({ children }) {
  return (
    <>
      <Head>
        <meta name='viewport' content='initial-scale=1.0, width=device-width' />
      </Head>
      <HeaderPreview />

      <Container className='mt-1 px-sm-0'>
        {children}
      </Container>
    </>
  )
}
