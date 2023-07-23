import Header from './header'
import Container from 'react-bootstrap/Container'
import { LightningProvider } from './lightning'
import Footer from './footer'
import Seo from './seo'
import Search from './search'

export default function Layout ({
  sub, noContain, noFooter, noFooterLinks,
  containClassName, noSeo, children, search
}) {
  return (
    <>
      {!noSeo && <Seo sub={sub} />}
      <LightningProvider>
        <Header sub={sub} />
        {noContain
          ? children
          : (
            <Container className={`px-sm-0 ${containClassName || ''}`}>
              {children}
            </Container>
            )}
        {!noFooter && <Footer noLinks={noFooterLinks} />}
        {!noContain && search && <Search sub={sub} />}
      </LightningProvider>
    </>
  )
}
