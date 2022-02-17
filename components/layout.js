import Header from './header'
import Head from 'next/head'
import Container from 'react-bootstrap/Container'
import { LightningProvider } from './lightning'
import Footer from './footer'
import Seo from './seo'
import Search from './search'

export default function Layout ({
  sub, noContain, noFooter, noFooterLinks,
  containClassName, noSeo, children
}) {
  return (
    <>
      {!noSeo && <Seo sub={sub} />}
      <LightningProvider>
        <Head>
          <meta name='viewport' content='initial-scale=1.0, width=device-width' />
        </Head>
        <Header sub={sub} />
        {noContain
          ? children
          : (
            <Container className={`px-sm-0 ${containClassName || ''}`}>
              {children}
            </Container>
            )}
        {!noFooter && <Footer noLinks={noFooterLinks} />}
        {!noContain && <Search sub={sub} />}
      </LightningProvider>
    </>
  )
}
