require('@next/env').loadEnvConfig('..')
const PgBoss = require('pg-boss')
// const { PrismaClient } = require('@prisma/client')
const { ApolloClient, HttpLink, InMemoryCache } = require('@apollo/client')
const fetch = require('cross-fetch')

const { checkTrending } = require('./check-trending')
const { checkRewards } = require('./check-rewards')
const { postTopStories } = require('./post-top-stories')
const { postTopStackers } = require('./post-top-stackers')

async function work () {
  console.log(process.env.DATABASE_URL)
  const boss = new PgBoss(process.env.DATABASE_URL)
  const models = undefined // new PrismaClient()
  const apollo = new ApolloClient({
    link: new HttpLink({
      uri: `${process.env.SELF_URL}/api/graphql`,
      fetch
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache'
      },
      query: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache'
      }
    }
  })

  const args = { boss, models, apollo }

  boss.on('error', error => console.error(error))

  await boss.start()
  await boss.work('trending-social', checkTrending(args))
  await boss.work('rewards-social', checkRewards(args))
  await boss.work('topStories-social', postTopStories(args))
  await boss.work('topStackers-social', postTopStackers(args))

  await boss.schedule('trending-social', '* * * * *', null, { tz: 'America/Chicago', singletonKey: '1' })
  await boss.schedule('rewards-social', '0 16 * * *', null, { tz: 'America/Chicago' })
  await boss.schedule('topStories-social', '0 12 * * 6', null, { tz: 'America/Chicago' })
  await boss.schedule('topStackers-social', '0 12 * * 0', null, { tz: 'America/Chicago' })

  console.log('working jobs')
}

work()
