import '../styles/globals.scss'
import { ApolloProvider } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { FundErrorModal, FundErrorProvider } from '../components/fund-error'
import { MeProvider } from '../components/me'
import PlausibleProvider from 'next-plausible'
import { LightningProvider } from '../components/lightning'
import apolloClient from '../lib/apollo'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

function MyApp ({ Component, pageProps }) {
  const router = useRouter()
  useEffect(() => {
    router.beforePopState(({ url, as, options }) => {
      // we need to tell the next page to use a cache-first fetch policy ...
      // so that scroll position can be maintained
      const fullurl = new URL(url, 'https://stacker.news')
      fullurl.searchParams.set('cache', true)
      router.push(`${fullurl.pathname}${fullurl.search}`, as, options)
      return false
    })
  }, [])

  return (
    <PlausibleProvider domain='stacker.news' trackOutboundLinks>
      <Provider session={pageProps.session}>
        <ApolloProvider client={apolloClient}>
          <MeProvider>
            <LightningProvider>
              <FundErrorProvider>
                <FundErrorModal />
                <Component {...pageProps} />
              </FundErrorProvider>
            </LightningProvider>
          </MeProvider>
        </ApolloProvider>
      </Provider>
    </PlausibleProvider>
  )
}

export default MyApp
