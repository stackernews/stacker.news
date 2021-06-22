import Header from './header'
import Head from 'next/head'
import Container from 'react-bootstrap/Container'
import { LightningProvider } from './lightning'
import { useRouter } from 'next/router'
import Footer from './footer'
import { NextSeo } from 'next-seo'

export default function Layout ({ noContain, noFooter, children }) {
  const router = useRouter()
  const defaultTitle = router.asPath.split('?')[0].slice(1)
  const fullTitle = `${defaultTitle && `${defaultTitle} \\ `}stacker news`
  const desc = 'Discuss Bitcoin. Stack sats. News for plebs.'
  return (
    <>
      <NextSeo
        title={fullTitle}
        description={desc}
        openGraph={{
          title: fullTitle,
          description: desc,
          images: [
            {
              url: 'https://stacker.news/favicon.png'
            }
          ],
          site_name: 'Stacker News'
        }}
        twitter={{
          site: '@stacker_news',
          cardType: 'summary_large_image'
        }}
      />
      <LightningProvider>
        <Head>
          <meta name='viewport' content='initial-scale=1.0, width=device-width' />
        </Head>
        <Header />
        {noContain
          ? children
          : (
            <Container className='mt-1 px-sm-0'>
              {children}
            </Container>
            )}
        {!noFooter && <Footer />}
      </LightningProvider>
    </>
  )
}
