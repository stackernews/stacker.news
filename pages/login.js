import { getProviders } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './api/auth/[...nextauth]'
import Link from 'next/link'
import { StaticLayout } from '@/components/layout'
import Login from '@/components/login'
import { isExternal } from '@/lib/url'
import { MULTI_AUTH_ANON, MULTI_AUTH_POINTER } from '@/lib/auth'
import { getDomainMapping, normalizeDomain } from '@/lib/domains'

export async function getServerSideProps ({ req, res, query: { callbackUrl, multiAuth = false, syncSignup = null, domain = null, error = null } }) {
  let session = await getServerSession(req, res, getAuthOptions(req))

  // required to prevent infinite redirect loops if we switch to anon
  // but are on a page that would redirect us to /signup.
  // without this code, /signup would redirect us back to the callbackUrl.
  if (req.cookies[MULTI_AUTH_POINTER] === MULTI_AUTH_ANON || domain) {
    session = null
  }

  // the ?domain= query param carries the custom domain's host as-is (with its port in local dev).
  // we pass the port alongside the mapping so the client can redirect back through /api/auth/sync
  const mapping = domain ? await getDomainMapping(domain) : null
  const { domainPort } = domain ? normalizeDomain(domain) : { domainPort: null }
  const domainData = mapping ? { ...mapping, port: domainPort } : null

  // prevent open redirects. See https://github.com/stackernews/stacker.news/issues/264
  // let undefined urls through without redirect ... otherwise this interferes with multiple auth linking
  let external = true
  let callbackHost = null
  try {
    const decoded = decodeURIComponent(callbackUrl)
    external = isExternal(decoded)
    if (external) callbackHost = new URL(decoded).host
  } catch (err) {
    console.error('error decoding callback:', callbackUrl, err)
  }

  // external callbackUrls are only allowed when they point at the custom domain
  // we're syncing against (domainData). anything else is reset to avoid open redirects.
  const matchesDomain = callbackHost && domainData &&
    normalizeDomain(callbackHost).domainName === domainData.domainName
  if (external && !matchesDomain) {
    callbackUrl = '/'
  }

  if (session && callbackUrl && !multiAuth && !syncSignup) {
    // in the case of auth linking we want to pass the error back to settings
    // in the case of multi auth or auth sync signup, don't redirect if there is already a session
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
      multiAuth,
      syncSignup,
      domainData
    }
  }
}

function LoginFooter ({ callbackUrl }) {
  return (
    <small className='fw-bold text-muted pt-4'>New to town? <Link href={{ pathname: '/signup', query: { callbackUrl } }}>sign up</Link></small>
  )
}

function LoginHeader ({ domainData }) {
  return (
    <>
      <h3 className='w-100 pb-2'>
        Log in {domainData && ` to ~${domainData.subName}`}
      </h3>
      <div className='fw-bold text-muted w-100 text-start pb-4 line-height-md'>Nothing wrestles up a smile like a familiar face.</div>
    </>
  )
}

function MultiAuthHeader () {
  return (
    <>
      <h3 className='w-100 pb-2'>
        Switch to existing account
      </h3>
      <div className='text-muted w-100 text-start pb-4 line-height-md'>Hint: go back and switch to @anon to sign up with a new account.</div>
    </>
  )
}

export default function LoginPage ({ multiAuth, ...props }) {
  const multiAuthBool = multiAuth === 'true'
  return (
    <StaticLayout footerLinks={false}>
      <Login
        Footer={multiAuthBool ? undefined : () => <LoginFooter callbackUrl={props.callbackUrl} />}
        Header={multiAuthBool ? () => <MultiAuthHeader /> : () => <LoginHeader domainData={props.domainData} />}
        text='Log in'
        signin
        multiAuth={multiAuth}
        {...props}
      />
    </StaticLayout>
  )
}
