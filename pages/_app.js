import '../styles/globals.scss'
import { ApolloProvider, gql } from '@apollo/client'
import { MeProvider } from '../components/me'
import PlausibleProvider from 'next-plausible'
import getApolloClient from '../lib/apollo'
import NextNProgress from 'nextjs-progressbar'
import { PriceProvider } from '../components/price'
import Head from 'next/head'
import { useRouter } from 'next/dist/client/router'
import { useEffect } from 'react'
import { ShowModalProvider } from '../components/modal'
import ErrorBoundary from '../components/error-boundary'
import { LightningProvider } from '../components/lightning'
import { ServiceWorkerProvider } from '../components/serviceworker'

const SSR = typeof window === 'undefined'

function writeQuery (client, apollo, data) {
  if (apollo && data) {
    client.writeQuery({
      query: gql`${apollo.query}`,
      data,
      variables: apollo.variables,
      broadcast: !SSR,
      overwrite: SSR
    })
  }
}

function MyApp ({ Component, pageProps: { ...props } }) {
  const client = getApolloClient()
  const router = useRouter()

  useEffect(() => {
    // HACK: 'cause there's no way to tell Next to skip SSR
    // So every page load, we modify the route in browser history
    // to point to the same page but without SSR, ie ?nodata=true
    // this nodata var will get passed to the server on back/foward and
    // 1. prevent data from reloading and 2. perserve scroll
    // (2) is not possible while intercepting nav with beforePopState
    if (router.query.nodata || !router.isReady) return

    router.replace({
      pathname: router.pathname,
      query: { ...router.query, nodata: true }
    }, router.asPath, { ...router.options, shallow: true }).catch((e) => {
      // workaround for https://github.com/vercel/next.js/issues/37362
      if (!e.cancelled) {
        throw e
      }
    })
  }, [router.pathname, router.query])

  /*
    If we are on the client, we populate the apollo cache with the
    ssr data
  */
  const { apollo, ssrData, me, price, ...otherProps } = props
  // if we are on the server, useEffect won't run
  if (SSR && client) {
    writeQuery(client, apollo, ssrData)
  }
  useEffect(() => {
    writeQuery(client, apollo, ssrData)
  }, [client, apollo, ssrData])

  return (
    <>
      <NextNProgress
        color='var(--bs-primary)'
        startPosition={0.3}
        stopDelayMs={200}
        height={2}
        showOnShallow={false}
        options={{ showSpinner: false }}
      />
      <Head>
        <meta name='viewport' content='initial-scale=1.0, width=device-width' />
      </Head>
      <ErrorBoundary>
        <PlausibleProvider domain='stacker.news' trackOutboundLinks>
          <ApolloProvider client={client}>
            <MeProvider me={me}>
              <ServiceWorkerProvider>
                <PriceProvider price={price}>
                  <LightningProvider>
                    <ShowModalProvider>
                      <Component ssrData={ssrData} {...otherProps} />
                    </ShowModalProvider>
                  </LightningProvider>
                </PriceProvider>
              </ServiceWorkerProvider>
            </MeProvider>
          </ApolloProvider>
        </PlausibleProvider>
      </ErrorBoundary>
    </>
  )
}

export default MyApp
