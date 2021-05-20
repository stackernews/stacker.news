import '../styles/globals.scss'
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { FundErrorModal, FundErrorProvider } from '../components/fund-error'

const client = new ApolloClient({
  uri: '/api/graphql',
  cache: new InMemoryCache()
})

function MyApp ({ Component, pageProps }) {
  return (
    <Provider session={pageProps.session}>
      <FundErrorProvider>
        <FundErrorModal />
        <ApolloProvider client={client}>
          <Component {...pageProps} />
        </ApolloProvider>
      </FundErrorProvider>
    </Provider>
  )
}

export default MyApp
