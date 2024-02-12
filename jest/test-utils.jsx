import React, { useCallback } from 'react'
import { render } from '@testing-library/react'
import { MockedProvider as MockedApolloProvider } from '@apollo/client/testing'
import { PriceProvider } from '../components/price'
import { MeProvider } from '../components/me'
import { LoggerProvider } from '../components/logger'
import { ChainFeeProvider } from '../components/chain-fee.js'
// import { WebLNProvider } from '../components/webln'
import { BlockHeightProvider } from '../components/block-height'
import { ServiceWorkerProvider } from '../components/serviceworker'
import { LightningProvider } from '../components/lightning'
// import ErrorBoundary from '../components/error-boundary'
import { ToastProvider } from '../components/toast'
import { ShowModalProvider } from '../components/modal'
import { ErrorBoundary } from 'react-error-boundary'
import * as lib from '@testing-library/react'

import mocks from '../__mocks__/apollo-mocks'

/** @param {{children: React.ReactNode}} */
const AllTheProviders = ({ children }) => {
  const handleError = useCallback((error, info) => {
    console.warn('Component Error Caught', error, info)
  }, [])
  const handleProviderError = useCallback((error, info) => {
    console.warn('Provider Error Caught', error, info)
  }, [])
  // const ssrData = {}
  const me = {}
  const price = {}
  const blockHeight = {}
  const chainFee = {}
  return (

    <ErrorBoundary
      onError={(error, info) =>
        handleProviderError(error, info)}
      fallback={<div>Something went wrong in a Provider</div>}
    >
      <MockedApolloProvider mocks={mocks} addTypename={false}>
        <MeProvider me={me}>
          <LoggerProvider>
            <ServiceWorkerProvider>
              <PriceProvider price={price}>
                <LightningProvider>
                  <ToastProvider>
                    {/* <WebLNProvider> */}
                    <ShowModalProvider>
                      <BlockHeightProvider blockHeight={blockHeight}>
                        <ChainFeeProvider chainFee={chainFee}>
                          <ErrorBoundary
                            onError={(error, info) =>
                              handleError(error, info)}
                            fallback={<div>Something went wrong in the component</div>}
                          >
                            {/* <Component ssrData={ssrData} {...otherProps} /> */}

                            {children}
                            {/* <PWAPrompt copyBody='This website has app functionality. Add it to your home screen to use it in fullscreen and receive notifications. In Safari:' promptOnVisit={2} /> */}
                          </ErrorBoundary>
                        </ChainFeeProvider>
                      </BlockHeightProvider>
                    </ShowModalProvider>
                    {/* </WebLNProvider> */}
                  </ToastProvider>
                </LightningProvider>
              </PriceProvider>
            </ServiceWorkerProvider>
          </LoggerProvider>
        </MeProvider>
      </MockedApolloProvider>
    </ErrorBoundary>
  )
}

/** @returns {import('@testing-library/react').render} */
const customRender = (ui, options) => render(ui, { wrapper: AllTheProviders, ...options })

module.exports = {
  ...lib,
  render: customRender
}
