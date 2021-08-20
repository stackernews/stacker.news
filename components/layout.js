import Header from './header'
import Head from 'next/head'
import Container from 'react-bootstrap/Container'
import { LightningProvider } from './lightning'
import Footer from './footer'
import Seo from './seo'

export default function Layout ({ noContain, noFooter, noSeo, children }) {
  return (
    <>
      {!noSeo && <Seo />}
      <LightningProvider>
        <Head>
          <meta name='viewport' content='initial-scale=1.0, width=device-width' />
        </Head>
        <Header />
        {noContain
          ? children
          : (
            <Container className='px-sm-0'>
              {children}
            </Container>
            )}
        {!noFooter && <Footer />}
      </LightningProvider>
    </>
  )
}
