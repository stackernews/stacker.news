import Login from '../../components/login'
import { providers, getSession } from 'next-auth/client'
import models from '../../api/models'
import serialize from '../../api/resolvers/serial'
import { gql } from '@apollo/client'
import { INVITE_FIELDS } from '../../fragments/invites'
import getSSRApolloClient from '../../api/ssrApollo'
import Link from 'next/link'
import LayoutCenter from '../../components/layout-center'

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
        models.$queryRawUnsafe('SELECT invite_drain($1, $2)', session.user.id, id))
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
      callbackUrl: process.env.PUBLIC_URL + req.url,
      invite: data.invite,
      error
    }
  }
}

function InviteHeader ({ invite }) {
  let Inner
  if (invite.revoked) {
    Inner = () => <div className='text-danger'>this invite link expired</div>
  } else if ((invite.limit && invite.limit <= invite.invitees.length) || invite.poor) {
    Inner = () => <div className='text-danger'>this invite link has no more sats</div>
  } else {
    Inner = () => (
      <div>
        Get <span className='text-success'>{invite.gift} free sats</span> from{' '}
        <Link href={`/${invite.user.name}`} passHref><a>@{invite.user.name}</a></Link>{' '}
        when you sign up today
      </div>
    )
  }

  return (
    <h3 className='text-center pb-3'>
      <Inner />
    </h3>
  )
}

export default function Invite ({ invite, ...props }) {
  return (
    <LayoutCenter>
      <Login Header={() => <InviteHeader invite={invite} />} text='Sign up' {...props} />
    </LayoutCenter>
  )
}
