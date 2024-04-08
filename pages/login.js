import { getProviders } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './api/auth/[...nextauth]'
import Link from 'next/link'
import { StaticLayout } from '@/components/layout'
import Login from '@/components/login'
import { isExternal } from '@/lib/url'

export async function getServerSideProps ({ req, res, query: { callbackUrl, error = null } }) {
  const session = await getServerSession(req, res, getAuthOptions(req))

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

  if (session && callbackUrl) {
    // in the cause of auth linking we want to pass the error back to
    // settings
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

  return {
    props: {
      providers: await getProviders(),
      callbackUrl,
      error
    }
  }
}

function LoginFooter ({ callbackUrl }) {
  return (
    <small className='fw-bold text-muted pt-4'>New to town? <Link href={{ pathname: '/signup', query: { callbackUrl } }}>sign up</Link></small>
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
        Footer={() => <LoginFooter callbackUrl={props.callbackUrl} />}
        Header={() => <LoginHeader />}
        {...props}
      />
    </StaticLayout>
  )
}
