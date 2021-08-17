import '../styles/globals.scss'
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { FundErrorModal, FundErrorProvider } from '../components/fund-error'
import { MeProvider } from '../components/me'
import PlausibleProvider from 'next-plausible'
import { LightningProvider } from '../components/lightning'

const client = new ApolloClient({
  uri: '/api/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          moreItems: {
            keyArgs: ['sort', 'userId'],
            merge (existing, incoming, { readField }) {
              const items = existing ? existing.items : []
              return {
                cursor: incoming.cursor,
                items: [...items, ...incoming.items]
              }
            },

            read (existing) {
              if (existing) {
                return {
                  cursor: existing.cursor,
                  items: existing.items
                }
              }
            }
          },
          moreFlatComments: {
            keyArgs: ['userId'],
            merge (existing, incoming, { readField }) {
              const comments = existing ? existing.comments : []
              return {
                cursor: incoming.cursor,
                comments: [...comments, ...incoming.comments]
              }
            },

            read (existing) {
              if (existing) {
                return {
                  cursor: existing.cursor,
                  comments: existing.comments
                }
              }
            }
          },
          notifications: {
            merge (existing, incoming, { readField }) {
              const notifications = existing ? existing.notifications : []
              return {
                cursor: incoming.cursor,
                notifications: [...notifications, ...incoming.notifications]
              }
            },

            read (existing) {
              if (existing) {
                return {
                  cursor: existing.cursor,
                  notifications: existing.notifications
                }
              }
            }
          }
        }
      }
    }
  })
})

function MyApp ({ Component, pageProps }) {
  return (
    <PlausibleProvider domain='stacker.news' trackOutboundLinks>
      <Provider session={pageProps.session}>
        <ApolloProvider client={client}>
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
