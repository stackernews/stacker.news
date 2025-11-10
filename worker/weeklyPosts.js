import pay from '@/api/payIn'
import { USER_ID } from '@/lib/constants'
import { datePivot } from '@/lib/time'
import gql from 'graphql-tag'

export async function autoPost ({ data: item, models, apollo, lnd, boss }) {
  return await pay('ITEM_CREATE',
    { subName: 'meta', ...item, userId: USER_ID.sn, apiKey: true },
    {
      models,
      me: { id: USER_ID.sn }
    })
}

export async function weeklyPost (args) {
  const { result: { id, bounty } } = await autoPost(args)

  if (bounty) {
    args.boss.send('payWeeklyPostBounty', { id }, { startAfter: datePivot(new Date(), { hours: 24 }) })
  }
}

export async function payWeeklyPostBounty ({ data: { id }, models, apollo, lnd }) {
  const itemQ = await apollo.query({
    query: gql`
      query item($id: ID!) {
        item(id: $id) {
          userId
          bounty
          bountyPaidTo
          comments(sort: "top") {
            comments {
              id
            }
          }
        }
      }`,
    variables: { id }
  })

  const item = itemQ.data.item

  if (item.bountyPaidTo?.length > 0) {
    throw new Error('Bounty already paid')
  }

  const winner = item.comments.comments[0]

  if (!winner) {
    throw new Error('No winner')
  }

  await pay('ZAP',
    { id: winner.id, sats: item.bounty },
    {
      models,
      me: { id: USER_ID.sn }
    })
}
