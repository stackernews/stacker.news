import 'bootstrap/dist/css/bootstrap.min.css'
import '../styles/globals.css'
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import { Provider } from 'next-auth/client'

const client = new ApolloClient({
  uri: '/api/graphql',
  cache: new InMemoryCache()
})

function MyApp ({ Component, pageProps }) {
  return (
    <Provider session={pageProps.session}>
      <ApolloProvider client={client}>
        <Component {...pageProps} />
      </ApolloProvider>
    </Provider>
  )
}

export default MyApp
