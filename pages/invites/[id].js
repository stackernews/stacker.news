import Login from '@/components/login'
import { getProviders } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import models from '@/api/models'
import { gql } from '@apollo/client'
import { INVITE_FIELDS } from '@/fragments/invites'
import getSSRApolloClient from '@/api/ssrApollo'
import Link from 'next/link'
import { CenterLayout } from '@/components/layout'
import { getAuthOptions } from '@/pages/api/auth/[...nextauth]'
import performPaidAction from '@/api/paidAction'

export async function getServerSideProps ({ req, res, query: { id, error = null } }) {
  const session = await getServerSession(req, res, getAuthOptions(req))

  const client = await getSSRApolloClient({ req, res })
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
    res.writeHead(302, {
      Location: '/404'
    }).end()
    return { props: {} }
  }

  if (session && res) {
    try {
      // attempt to send gift
      // catch any errors and just ignore them for now
      await performPaidAction({
        action: 'INVITE_GIFT',
        id,
        userId: session.user.id
      }, { models, me: { id: data.invite.user.id } })
    } catch (e) {
      console.log(e)
    }

    res.writeHead(302, {
      Location: '/'
    }).end()
    return { props: {} }
  }

  return {
    props: {
      providers: await getProviders(),
      callbackUrl: process.env.NEXT_PUBLIC_URL + req.url,
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
        <Link href={`/${invite.user.name}`}>@{invite.user.name}</Link>{' '}
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
    <CenterLayout>
      <Login Header={() => <InviteHeader invite={invite} />} text='Sign up' {...props} />
    </CenterLayout>
  )
}
