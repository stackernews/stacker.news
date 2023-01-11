import '../styles/globals.scss'
import { ApolloProvider, gql, useQuery } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { MeProvider } from '../components/me'
import PlausibleProvider from 'next-plausible'
import { LightningProvider } from '../components/lightning'
import getApolloClient from '../lib/apollo'
import NextNProgress from 'nextjs-progressbar'
import { PriceProvider } from '../components/price'
import Head from 'next/head'
import { useRouter } from 'next/dist/client/router'
import { useEffect } from 'react'
import Moon from '../svgs/moon-fill.svg'
import Layout from '../components/layout'
import { ShowModalProvider } from '../components/modal'

function CSRWrapper ({ Component, apollo, ...props }) {
  const { data, error } = useQuery(gql`${apollo.query}`, { variables: apollo.variables, fetchPolicy: 'cache-first' })
  if (error) {
    return (
      <div className='d-flex font-weight-bold justify-content-center mt-3 mb-1'>
        {error.toString()}
      </div>
    )
  }

  if (!data) {
    return (
      <Layout>
        <div className='d-flex justify-content-center mt-3 mb-1'>
          <Moon className='spin fill-grey' />
        </div>
      </Layout>
    )
  }

  return <Component {...props} data={data} />
}

function MyApp ({ Component, pageProps: { session, ...props } }) {
  const client = getApolloClient()
  const router = useRouter()

  useEffect(() => {
    // HACK: 'cause there's no way to tell Next to skip SSR
    // So every page load, we modify the route in browser history
    // to point to the same page but without SSR, ie ?nodata=true
    // this nodata var will get passed to the server on back/foward and
    // 1. prevent data from reloading and 2. perserve scroll
    // (2) is not possible while intercepting nav with beforePopState
    if (router.isReady) {
      router.replace({
        pathname: router.pathname,
        query: { ...router.query, nodata: true }
      }, router.asPath, { ...router.options, scroll: false })
    }
  }, [router.asPath])

  /*
    If we are on the client, we populate the apollo cache with the
    ssr data
  */
  const { apollo, data, me, price } = props
  if (apollo && data) {
    client.writeQuery({
      query: gql`${apollo.query}`,
      data: data,
      variables: apollo.variables
    })
  }

  return (
    <>
      <NextNProgress
        color='var(--primary)'
        startPosition={0.3}
        stopDelayMs={200}
        height={2}
        showOnShallow
        options={{ showSpinner: false }}
      />
      <Head>
        <meta name='viewport' content='initial-scale=1.0, width=device-width' />
      </Head>
      <PlausibleProvider domain='stacker.news' trackOutboundLinks>
        <Provider session={session}>
          <ApolloProvider client={client}>
            <MeProvider me={me}>
              <PriceProvider price={price}>
                <LightningProvider>
                  <ShowModalProvider>
                    {data || !apollo?.query
                      ? <Component {...props} />
                      : <CSRWrapper Component={Component} {...props} />}
                  </ShowModalProvider>
                </LightningProvider>
              </PriceProvider>
            </MeProvider>
          </ApolloProvider>
        </Provider>
      </PlausibleProvider>
    </>
  )
}

export default MyApp
