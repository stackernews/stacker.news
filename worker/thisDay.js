import { datePivot } from '@/lib/time'
import gql from 'graphql-tag'
import { numWithUnits, abbrNum } from '@/lib/format'
import { paidActions } from '@/api/paidAction'
import { USER_ID } from '@/lib/constants'
import { getForwardUsers } from '@/api/resolvers/item'

export async function thisDay ({ models, apollo }) {
  const days = []
  let yearsAgo = 1
  while (datePivot(new Date(), { years: -yearsAgo }) > new Date('2021-06-10')) {
    const [{ from, to }] = await models.$queryRaw`
    SELECT (date_trunc('day',  (now() AT TIME ZONE 'America/Chicago')) AT TIME ZONE 'America/Chicago') - ${`${yearsAgo} year`}::interval as from,
           (date_trunc('day',  (now() AT TIME ZONE 'America/Chicago')) AT TIME ZONE 'America/Chicago') - ${`${yearsAgo} year`}::interval + interval '1 day - 1 second' as to`

    const { data } = await apollo.query({
      query: THIS_DAY,
      variables: { from: new Date(from).getTime().toString(), to: new Date(to).getTime().toString() }
    })

    days.push({
      data,
      day: new Date(from).toLocaleString('default', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' })
    })

    yearsAgo++
  }

  const date = new Date().toLocaleString('default', { timeZone: 'America/Chicago', month: 'long', day: 'numeric' })

  const text = `${topPosts(days)}
${topStackers(days)}
${topComments(days)}
${topSubs(days)}`

  const user = await models.user.findUnique({ where: { id: USER_ID.sn } })
  const forward = days.map(({ data }) => data.users.users?.[0]?.name).filter(Boolean).map(name => ({ nym: name, pct: 10 }))
  forward.push({ nym: 'Undisciplined', pct: 50 })
  const forwardUsers = await getForwardUsers(models, forward)
  await models.$transaction(async tx => {
    const context = { tx, cost: BigInt(1), user, models }
    const result = await paidActions.ITEM_CREATE.perform({
      text, title: `This Day on SN: ${date}`, subName: 'meta', userId: USER_ID.sn, forwardUsers
    }, context)
    await paidActions.ITEM_CREATE.onPaid(result, context)
  })
}

function topPosts (days) {
  let text = '#### Top Posts'
  for (const { day, data } of days) {
    const post = data.posts.items?.[0]
    if (post) {
      text += `
- [${post.title}](${process.env.NEXT_PUBLIC_URL}/items/${post.id})
    - ${numWithUnits(post.sats)} \\ ${numWithUnits(post.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })} \\ @${post.user.name} \\ ~${post.subName} \\ \`${day}\``
    } else {
      text += `
- no top post for \`${day}\``
    }
  }
  return text
}

function topStackers (days) {
  let text = '#### Top Stackers'
  for (const { day, data } of days) {
    const user = data.users.users?.[0]
    if (user) {
      text += `
- @${user.name}
    - ${abbrNum(user.optional?.stacked)} stacked \\ ${abbrNum(user.optional?.spent)} spent \\ ${numWithUnits(user.nposts, { unitSingular: 'post', unitPlural: 'posts' })} \\ ${numWithUnits(user.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })} \\ \`${day}\``
    } else {
      text += `
- stacker is in hiding for \`${day}\``
    }
  }
  return text
}

function topComments (days) {
  let text = '#### Top Comments'
  for (const { day, data } of days) {
    const comment = data.comments.items?.[0]
    if (comment) {
      text += `
- ${process.env.NEXT_PUBLIC_URL}/items/${comment.root.id}?commentId=${comment.id} on [${comment.root.title}](${process.env.NEXT_PUBLIC_URL}/items/${comment.root.id})
    - ${numWithUnits(comment.sats)} \\ ${numWithUnits(comment.ncomments, { unitSingular: 'reply', unitPlural: 'replies' })} \\ @${comment.user.name} \\ \`${day}\`
        > ${comment.text.trim().split('\n')[0]} [...]`
    } else {
      text += `
- no top comment for \`${day}\``
    }
  }
  return text
}

function topSubs (days) {
  let text = '#### Top Territories'
  for (const { day, data } of days) {
    const sub = data.territories.subs?.[0]
    if (sub) {
      text += `
- ~${sub.name}
    - ${abbrNum(sub.optional?.stacked)} stacked \\ ${abbrNum(sub.optional?.revenue)} revenue \\ ${abbrNum(sub.optional?.spent)} spent \\ ${numWithUnits(sub.nposts, { unitSingular: 'post', unitPlural: 'posts' })} \\ ${numWithUnits(sub.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })} \\ \`${day}\``
    } else {
      text += `
- no top territory for \`${day}\``
    }
  }
  return text
}

const THIS_DAY = gql`
  query thisDay($to: String, $from: String) {
    posts: items (sort: "top", when: "custom", from: $from, to: $to, limit: 1) {
      items {
        id
        title
        text
        url
        ncomments
        sats
        boost
        subName
        user {
          name
        }
      }
    }
    comments: items (sort: "top", type: "comments", when: "custom", from: $from, to: $to, limit: 1) {
      items {
        id
        parentId
        text
        ncomments
        sats
        boost
        user {
          name
        }
        root {
          title
          id
          subName
          user {
            name
          }
        }
      }
    }
    users: topUsers(when: "custom", from: $from, to: $to, limit: 1) {
      users {
        name
        nposts(when: "custom", from: $from, to: $to)
        ncomments(when: "custom", from: $from, to: $to)
        optional {
          stacked(when: "custom", from: $from, to: $to)
          spent(when: "custom", from: $from, to: $to)
          referrals(when: "custom", from: $from, to: $to)
        }
      }
    }
    territories: topSubs(when: "custom", from: $from, to: $to, limit: 1) {
      subs {
        name
        createdAt
        desc
        user {
          name
          id
          optional {
            streak
          }
        }
        ncomments(when: "custom", from: $from, to: $to)
        nposts(when: "custom", from: $from, to: $to)

        optional {
          stacked(when: "custom", from: $from, to: $to)
          spent(when: "custom", from: $from, to: $to)
          revenue(when: "custom", from: $from, to: $to)
        }
      }
    }
  }
`
