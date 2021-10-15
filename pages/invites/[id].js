import Login from '../../components/login'
import { providers, getSession } from 'next-auth/client'
import models from '../../api/models'
import serialize from '../../api/resolvers/serial'
import { gql } from '@apollo/client'
import { INVITE_FIELDS } from '../../fragments/invites'
import getSSRApolloClient from '../../api/ssrApollo'
import Link from 'next/link'

export async function getServerSideProps ({ req, res, query: { id, error = null } }) {
  const session = await getSession({ req })

  const client = await getSSRApolloClient(req)
  const { data } = await client.query({
    query: gql`
      ${INVITE_FIELDS}
      {
        invite(id: "${id}") {
          ...InviteFields
        }
      }`
  })

  if (!data?.invite) {
    return {
      notFound: true
    }
  }

  if (session && res) {
    try {
      // attempt to send gift
      // catch any errors and just ignore them for now
      await serialize(models,
        models.$queryRaw('SELECT invite_drain($1, $2)', session.user.id, id))
    } catch (e) {
      console.log(e)
    }

    res.writeHead(302, {
      Location: '/'
    })
    res.end()
    return { props: {} }
  }

  return {
    props: {
      providers: await providers({ req, res }),
      callbackUrl: process.env.SELF_URL + req.url,
      invite: data.invite,
      error
    }
  }
}

function InviteHeader ({ invite }) {
  console.log(invite.poor)
  let Inner
  if (invite.revoked) {
    Inner = () => <div className='text-danger'>this invite link expired</div>
  } else if ((invite.limit && invite.limit <= invite.invitees.length) || invite.poor) {
    Inner = () => <div className='text-danger'>this invite link has no more sats</div>
  } else {
    Inner = () => (
      <div>
        get <span className='text-success'>{invite.gift} free sats</span> from{' '}
        <Link href={`/${invite.user.name}`} passHref><a>@{invite.user.name}</a></Link>{' '}
        when you sign up today
      </div>
    )
  }

  return (
    <h2 className='text-center pb-3'>
      <Inner />
    </h2>
  )
}

export default function Invite ({ invite, ...props }) {
  return <Login Header={() => <InviteHeader invite={invite} />} {...props} />
}
