import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { datePivot, dayMonthYearToDate } from '@/lib/time'
import { gql, useQuery } from '@apollo/client'
import { numWithUnits, suffix, abbrNum } from '@/lib/format'
import PageLoading from '@/components/page-loading'
import { useRouter } from 'next/router'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

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
    users: topUsers(when: "custom", from: $from, to: $to) {
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

export default function Index () {
  const router = useRouter()
  const days = []
  let day = router.query.day
    ? datePivot(dayMonthYearToDate(router.query.day), { years: -1 })
    : datePivot(new Date(), { years: -1 })
  while (day > new Date('2021-06-10')) {
    days.push(day)
    day = datePivot(day, { years: -1 })
  }

  const sep = `
https://imgprxy.stacker.news/fsFoWlgwKYsk5mxx2ijgqU8fg04I_2zA_D28t_grR74/rs:fit:960:540/aHR0cHM6Ly9tLnN0YWNrZXIubmV3cy8yMzc5Ng
`

  return (
    <Layout>
      <code style={{ whiteSpace: 'pre-line' }}>
        * * -
        {days
          .map(day => <ThisDay key={day} day={day} />)
          .reduce((acc, x) => acc === null
            ? [x]
            : [acc, sep, x], null)}
      </code>
    </Layout>
  )
}

function ThisDay ({ day }) {
  const [from, to] = [
    String(new Date(new Date(day).setHours(0, 0, 0, 0)).getTime()),
    String(new Date(new Date(day).setHours(23, 59, 59, 999)).getTime())]

  const { data } = useQuery(THIS_DAY, { variables: { from, to } })

  if (!data) return <PageLoading />

  return `
### ${day.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' })} 📅

----

### 📝 \`TOP POST\`

${topPost(data.posts.items)}

----

### 💬 \`TOP COMMENT\`

${topComment(data.comments.items)}

----

### 🏆 \`TOP STACKER\`

${topStacker(data.users.users)}

----

### 🗺️ \`TOP TERRITORY\`

${topTerritory(data.territories.subs)}
`
}

const truncateString = (string = '', maxLength = 140) =>
  string.length > maxLength
    ? `${string.substring(0, 250)} […]`
    : string

function topPost (posts) {
  const post = posts?.[0]

  if (!post) return 'No top post'

  return `**[${post.title}](https://stacker.news/items/${post.id}/r/Undisciplined)**
${post.text
? `
#### Excerpt
> ${truncateString(post.text)}`
: ''}
*${numWithUnits(post.sats)} \\ ${numWithUnits(post.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })} \\ @${post.user.name} \\ ~${post.subName}*`
}

function topComment (comments) {
  const comment = comments?.[0]

  if (!comment) return 'No top comment'

  return `**https://stacker.news/items/${comment.root.id}/r/Undisciplined?commentId=${comment.id}**

${comment.text
? `
#### Excerpt
> ${truncateString(comment.text)}`
: ''}

*${numWithUnits(comment.sats)} \\ ${numWithUnits(comment.ncomments, { unitSingular: 'reply', unitPlural: 'replies' })} \\ @${comment.user.name}*

From **[${comment.root.title}](https://stacker.news/items/${comment.root.id}/r/Undisciplined)** by @${comment.root.user.name} in ~${comment.root.subName}`
}

function topStacker (users) {
  const userIdx = users.findIndex(u => !!u)

  if (userIdx === -1) return 'No top stacker'
  const user = users[userIdx]

  return `${suffix(userIdx + 1)} place **@${user.name}** ${userIdx > 0 ? `(1st${userIdx > 1 ? `-${suffix(userIdx - 1)}` : ''} hiding)` : ''}

*${abbrNum(user.optional?.stacked)} stacked \\ ${abbrNum(user.optional?.spent)} spent \\ ${numWithUnits(user.nposts, { unitSingular: 'post', unitPlural: 'posts' })} \\ ${numWithUnits(user.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })} \\ ${numWithUnits(user.optional.referrals, { unitSingular: 'referral', unitPlural: 'referrals' })}*`
}

function topTerritory (subs) {
  const sub = subs?.[0]

  if (!sub) return 'No top territory'

  return `**~${sub.name}**
${sub.desc
? `> ${truncateString(sub.desc)}`
: ''}

founded by @${sub.user.name} on ${new Date(sub.createdAt).toDateString()}

*${abbrNum(sub.optional?.stacked)} stacked \\ ${abbrNum(sub.optional?.revenue)} revenue \\ ${abbrNum(sub.optional?.spent)} spent \\ ${numWithUnits(sub.nposts, { unitSingular: 'post', unitPlural: 'posts' })} \\ ${numWithUnits(sub.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })}*`
}
