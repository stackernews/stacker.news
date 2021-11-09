import '../styles/globals.scss'
import { ApolloProvider, gql } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { FundErrorModal, FundErrorProvider } from '../components/fund-error'
import { MeProvider } from '../components/me'
import PlausibleProvider from 'next-plausible'
import { LightningProvider } from '../components/lightning'
import { ItemActModal, ItemActProvider } from '../components/item-act'
import getApolloClient from '../lib/apollo'

function MyApp ({ Component, pageProps: { session, ...props } }) {
  const client = getApolloClient()

  /*
    If we are on the client, we populate the apollo cache with the
    ssr data
  */
  if (typeof window !== 'undefined') {
    const { apollo, data } = props
    if (apollo) {
      client.writeQuery({
        query: gql`${apollo.query}`,
        data: data,
        variables: apollo.variables
      })
    }
  }

  return (
    <PlausibleProvider domain='stacker.news' trackOutboundLinks>
      <Provider session={session}>
        <ApolloProvider client={client}>
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
