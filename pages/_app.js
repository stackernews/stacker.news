import '../styles/globals.scss'
import { ApolloProvider } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { FundErrorModal, FundErrorProvider } from '../components/fund-error'
import { MeProvider } from '../components/me'
import PlausibleProvider from 'next-plausible'
import { LightningProvider } from '../components/lightning'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { ItemActModal, ItemActProvider } from '../components/item-act'
import getApolloClient from '../lib/apollo'

function MyApp ({ Component, pageProps: { session, ...props } }) {
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
      <Provider session={session}>
        <ApolloProvider client={getApolloClient()}>
          <MeProvider>
            <LightningProvider>
              <FundErrorProvider>
                <FundErrorModal />
                <ItemActProvider>
                  <ItemActModal />
                  <Component {...props} />
                </ItemActProvider>
              </FundErrorProvider>
            </LightningProvider>
          </MeProvider>
        </ApolloProvider>
      </Provider>
    </PlausibleProvider>
  )
}

export default MyApp
