import { getProviders } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from './api/auth/[...nextauth]'
import Link from 'next/link'
import { StaticLayout } from '@/components/layout'
import Login from '@/components/login'
import { isExternal } from '@/lib/url'
import { formatHost, parseSafeHost } from '@/lib/safe-url'
import { MULTI_AUTH_ANON, MULTI_AUTH_POINTER } from '@/lib/auth'
import { getDomainMapping } from '@/lib/domains'

// callbackUrl arriving at /login is expected to be same-origin: custom-domain
// auth flows are funneled through /api/auth/redirect, which wraps the user's
// destination into a /api/auth/sync URL on the main domain. anything else is a
// stale link or someone trying an open redirect, so we collapse it to '/'.

export async function getServerSideProps ({ req, res, query: { callbackUrl, multiAuth = false, domain = null, error = null } }) {
  let session = await getServerSession(req, res, getAuthOptions(req))

  // required to prevent infinite redirect loops if we switch to anon
  // but are on a page that would redirect us to /signup.
  // without this code, /signup would redirect us back to the callbackUrl.
  // also nullify session if a we come from a custom domain to force fresh auth
  if (req.cookies[MULTI_AUTH_POINTER] === MULTI_AUTH_ANON || domain) {
    session = null
  }

  // the ?domain= query param carries the custom domain's host as-is (with its port in local dev).
  // we pass the port alongside the mapping so the client can redirect back through /api/auth/sync
  const parsedDomain = domain ? parseSafeHost(domain) : null
  const mapping = parsedDomain ? await getDomainMapping(parsedDomain.hostname) : null
  const domainData = mapping ? { ...mapping, port: parsedDomain.port } : null

  // prevent open redirects. See https://github.com/stackernews/stacker.news/issues/264
  // let undefined urls through without redirect ... otherwise this interferes with multiple auth linking
  if (callbackUrl) {
    try {
      if (isExternal(decodeURIComponent(callbackUrl))) callbackUrl = '/'
    } catch (err) {
      console.error('error decoding callback:', callbackUrl, err)
      callbackUrl = '/'
    }
  }

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
      multiAuth,
      domain: domainData ? formatHost(parsedDomain) : null,
      domainData
    }
  }
}

function LoginFooter ({ callbackUrl, domain }) {
  const query = { callbackUrl, ...(domain && { domain }) }

  return (
    <small className='fw-bold text-muted pt-4'>New to town? <Link href={{ pathname: '/signup', query }}>sign up</Link></small>
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
        Footer={multiAuthBool ? undefined : () => <LoginFooter callbackUrl={props.callbackUrl} domain={props.domain} />}
        Header={multiAuthBool ? () => <MultiAuthHeader /> : () => <LoginHeader domainData={props.domainData} />}
        text='Log in'
        signin
        multiAuth={multiAuth}
        {...props}
      />
    </StaticLayout>
  )
}
