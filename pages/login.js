import { providers, getSession } from 'next-auth/client'
import Link from 'next/link'
import { StaticLayout } from '../components/layout'
import Login from '../components/login'
import { isExternal } from '../lib/url'

export async function getServerSideProps ({ req, res, query: { callbackUrl, error = null } }) {
  const session = await getSession({ req })

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

  if (session && res && callbackUrl) {
    res.writeHead(302, {
      Location: callbackUrl
    })
    res.end()
    return { props: {} }
  }

  return {
    props: {
      providers: await providers({ req, res }),
      callbackUrl,
      error
    }
  }
}

function LoginFooter ({ callbackUrl }) {
  return (
    <small className='fw-bold text-muted pt-4'>Don't have an account? <Link href={{ pathname: '/signup', query: { callbackUrl } }}>sign up</Link></small>
  )
}

export default function LoginPage (props) {
  return (
    <StaticLayout footerLinks={false}>
      <Login
        Footer={() => <LoginFooter callbackUrl={props.callbackUrl} />}
        {...props}
      />
    </StaticLayout>
  )
}
