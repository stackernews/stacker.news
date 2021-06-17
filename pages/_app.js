import '../styles/globals.scss'
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { FundErrorModal, FundErrorProvider } from '../components/fund-error'
import { MeProvider } from '../components/me'

const client = new ApolloClient({
  uri: '/api/graphql',
  cache: new InMemoryCache()
})

function MyApp ({ Component, pageProps }) {
  return (
    <>
      <Provider session={pageProps.session}>
        <ApolloProvider client={client}>
          <MeProvider>
            <FundErrorProvider>
              <FundErrorModal />
              <Component {...pageProps} />
            </FundErrorProvider>
          </MeProvider>
        </ApolloProvider>
      </Provider>
    </>
  )
}

export default MyApp
