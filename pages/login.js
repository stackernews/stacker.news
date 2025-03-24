import { getProviders } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './api/auth/[...nextauth]'
import Link from 'next/link'
import { StaticLayout } from '@/components/layout'
import Login from '@/components/login'
import { isExternal } from '@/lib/url'
import { MULTI_AUTH_ANON, MULTI_AUTH_POINTER } from '@/lib/auth'

export async function getServerSideProps ({ req, res, query: { callbackUrl, multiAuth = false, error = null, domain = null } }) {
  let session = await getServerSession(req, res, getAuthOptions(req))

  // required to prevent infinite redirect loops if we switch to anon
  // but are on a page that would redirect us to /signup.
  // without this code, /signup would redirect us back to the callbackUrl.
  if (req.cookies[MULTI_AUTH_POINTER] === MULTI_AUTH_ANON) {
    session = null
  }

  // prevent open redirects. See https://github.com/stackernews/stacker.news/issues/264
  // let undefined urls through without redirect ... otherwise this interferes with multiple auth linking
  let external = true
  try {
    external = isExternal(decodeURIComponent(callbackUrl))
  } catch (err) {
    console.error('error decoding callback:', callbackUrl, err)
  }

  if (external) {
    callbackUrl = '/'
  }

  // TODO: custom domain mapping security
  if (domain) {
    callbackUrl = '/api/auth/sync' + (multiAuth ? '?multiAuth=true' : '') + '&redirectUrl=https://' + domain
  }

  console.log('callbackUrl', callbackUrl)

  if (session && callbackUrl && !multiAuth) {
    // in the case of auth linking we want to pass the error back to settings
    // in the case of multi auth, don't redirect if there is already a session
    if (error) {
      const url = new URL(callbackUrl, process.env.NEXT_PUBLIC_URL)
      url.searchParams.set('error', error)
      callbackUrl = url.pathname + url.search
    }

    return {
      redirect: {
        destination: callbackUrl,
        permanent: false
      }
    }
  }

  const providers = await getProviders()

  return {
    props: {
      providers,
      callbackUrl,
      error,
      multiAuth
    }
  }
}

function LoginFooter ({ callbackUrl, multiAuth }) {
  return (
    <small className='fw-bold text-muted pt-4'>New to town? <Link href={{ pathname: '/signup', query: { multiAuth, callbackUrl } }}>sign up</Link></small>
  )
}

function LoginHeader () {
  return (
    <>
      <h3 className='w-100 pb-2'>
        Login
      </h3>
      <div className='fw-bold text-muted w-100 text-start pb-4'>Ain't you a sight for sore eyes.</div>
    </>
  )
}

export default function LoginPage (props) {
  return (
    <StaticLayout footerLinks={false}>
      <Login
        Footer={() => <LoginFooter callbackUrl={props.callbackUrl} multiAuth={props.multiAuth} />}
        Header={() => <LoginHeader />}
        signin
        {...props}
      />
    </StaticLayout>
  )
}
