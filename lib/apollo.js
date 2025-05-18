import { ApolloClient, InMemoryCache, HttpLink, makeVar, split, from } from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { decodeCursor, LIMIT } from './cursor'
import { COMMENTS_LIMIT, SSR } from './constants'
import { RetryLink } from '@apollo/client/link/retry'
import { isMutationOperation, isQueryOperation } from '@apollo/client/utilities'
function isFirstPage (cursor, existingThings, limit = LIMIT) {
  if (cursor) {
    const decursor = decodeCursor(cursor)
    return decursor.offset === limit
  } else {
    // we don't have anything cached, or our existing items are less than
    // or equal to a full page
    return existingThings?.length < limit
  }
}

const defaultFetchPolicy = SSR ? 'cache-only' : 'cache-first'
const defaultNextFetchPolicy = SSR ? 'cache-only' : 'cache-first'

export default function getApolloClient () {
  if (SSR) {
    return getClient(`${process.env.SELF_URL}/api/graphql`)
  } else {
    window.apolloClient ||= getClient('/api/graphql')
    return window.apolloClient
  }
}

export const meAnonSats = {}

const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 30000,
    jitter: true
  },
  attempts: {
    max: Infinity,
    retryIf: (error, _operation) => {
      // retry only if the error is not a mutation and the operation is a query
      return !!error && !isMutationOperation(_operation.query) && isQueryOperation(_operation.query)
    }
  }
})

function getClient (uri) {
  const link = from([
    retryLink,
    split(
      // batch zaps if wallet is enabled so they can be executed serially in a single request
      operation => operation.operationName === 'act' && operation.variables.act === 'TIP' && operation.getContext().batch,
      new BatchHttpLink({ uri, batchInterval: 1000, batchDebounce: true, batchMax: 0, batchKey: op => op.variables.id }),
      new HttpLink({ uri })
    )
  ])

  return new ApolloClient({
    link,
    ssrMode: SSR,
    connectToDevTools: process.env.NODE_ENV !== 'production',
    cache: new InMemoryCache({
      freezeResults: true,
      // https://github.com/apollographql/apollo-client/issues/7648
      possibleTypes: {
        PaidAction: [
          'ItemPaidAction',
          'ItemActPaidAction',
          'PollVotePaidAction',
          'SubPaidAction',
          'DonatePaidAction',
          'ReceivePaidAction'
        ],
        Notification: [
          'Reply',
          'Votification',
          'Mention',
          'Invitification',
          'Earn',
          'JobChange',
          'InvoicePaid',
          'WithdrawlPaid',
          'Referral',
          'CowboyHat',
          'NewHorse',
          'LostHorse',
          'NewGun',
          'LostGun',
          'FollowActivity',
          'ForwardedVotification',
          'Revenue',
          'SubStatus',
          'TerritoryPost',
          'TerritoryTransfer',
          'Reminder',
          'ItemMention',
          'Invoicification'
        ],
        WalletOrTemplate: [
          'UserWallet',
          'WalletTemplate'
        ]
      },
      typePolicies: {
        Sub: {
          keyFields: ['name'],
          fields: {
            optional: {
              merge: true
            }
          }
        },
        User: {
          // https://www.apollographql.com/docs/react/caching/cache-field-behavior/#merging-non-normalized-objects
          fields: {
            privates: {
              merge: true
            },
            optional: {
              merge: true
            },
            bio: {
              merge: true
            }
          }
        },
        Fact: {
          keyFields: ['id', 'type']
        },
        Wallet: {
          fields: {
            vaultEntries: {
              replace: true
            }
          }
        },
        Query: {
          fields: {
            sub: {
              keyArgs: ['name'],
              merge (existing, incoming) {
                return incoming
              }
            },
            topSubs: {
              keyArgs: ['when', 'by', 'from', 'to', 'limit'],
              merge (existing, incoming, { args }) {
                if (isFirstPage(incoming.cursor, existing?.subs, args.limit)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  subs: [...(existing?.subs || []), ...incoming.subs]
                }
              }
            },
            topUsers: {
              keyArgs: ['when', 'by', 'from', 'to', 'limit'],
              merge (existing, incoming, { args }) {
                if (isFirstPage(incoming.cursor, existing?.users, args.limit)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  users: [...(existing?.users || []), ...incoming.users]
                }
              }
            },
            mySubscribedUsers: {
              keyArgs: false,
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.users)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  users: [...(existing?.users || []), ...incoming.users]
                }
              }
            },
            myMutedUsers: {
              keyArgs: false,
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.users)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  users: [...(existing?.users || []), ...incoming.users]
                }
              }
            },
            userSuggestions: {
              keyArgs: ['q', 'limit'],
              merge (existing, incoming) {
                return incoming
              }
            },
            topCowboys: {
              keyArgs: [],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.users)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  users: [...(existing?.users || []), ...incoming.users]
                }
              }
            },
            items: {
              keyArgs: ['sub', 'sort', 'type', 'name', 'when', 'by', 'from', 'to', 'limit'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items],
                  pins: [...(existing?.pins || []), ...(incoming.pins || [])],
                  ad: incoming?.ad || existing?.ad
                }
              }
            },
            related: {
              keyArgs: ['id', 'title', 'minMatch', 'limit'],
              merge (existing, incoming, { args }) {
                if (isFirstPage(incoming.cursor, existing?.items, args.limit)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items]
                }
              }
            },
            search: {
              keyArgs: ['q', 'sub', 'sort', 'what', 'when', 'from', 'to', 'limit'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.items)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  items: [...(existing?.items || []), ...incoming.items]
                }
              }
            },
            searchUsers: {
              keyArgs: ['q', 'limit', 'similarity'],
              merge (existing, incoming) {
                return [...(existing?.searchUsers || []), ...incoming]
              }
            },
            notifications: {
              keyArgs: ['inc'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.notifications)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  earn: existing?.earn || incoming.earn,
                  notifications: [...(existing?.notifications || []), ...incoming.notifications],
                  lastChecked: existing?.lastChecked || incoming.lastChecked
                }
              }
            },
            numBolt11s: {
              keyArgs: [],
              merge (existing, incoming) {
                return incoming
              }
            },
            walletHistory: {
              keyArgs: ['inc'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.facts)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  facts: [...(existing?.facts || []), ...incoming.facts]
                }
              }
            },
            failedInvoices: {
              keyArgs: [],
              merge (existing, incoming) {
                return incoming
              }
            }
          }
        },
        Item: {
          fields: {
            comments: {
              keyArgs: ['sort'],
              merge (existing, incoming) {
                if (isFirstPage(incoming.cursor, existing?.comments, COMMENTS_LIMIT)) {
                  return incoming
                }

                return {
                  cursor: incoming.cursor,
                  comments: [...(existing?.comments || []), ...incoming.comments]
                }
              }
            },
            meAnonSats: {
              read (existingAmount, { readField }) {
                if (SSR) return null

                const itemId = readField('id')

                // we need to use reactive variables such that updates
                // to local state propagate correctly
                // see https://www.apollographql.com/docs/react/local-state/reactive-variables
                let reactiveVar = meAnonSats[itemId]
                if (!reactiveVar) {
                  const storageKey = `TIP-item:${itemId}`
                  const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
                  reactiveVar = makeVar(existingAmount || 0)
                  meAnonSats[itemId] = reactiveVar
                }

                return reactiveVar()
              }
            }
          }
        }
      }
    }),
    assumeImmutableResults: true,
    queryDeduplication: true,
    defaultOptions: {
      watchQuery: {
        initialFetchPolicy: defaultFetchPolicy,
        fetchPolicy: defaultFetchPolicy,
        nextFetchPolicy: defaultNextFetchPolicy,
        ssr: SSR
      },
      query: {
        initialFetchPolicy: defaultFetchPolicy,
        fetchPolicy: defaultFetchPolicy,
        nextFetchPolicy: defaultNextFetchPolicy,
        ssr: SSR
      }
    }
  })
}
