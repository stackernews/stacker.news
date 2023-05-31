import { providers, getSession } from 'next-auth/client'
import Link from 'next/link'
import LayoutStatic from '../components/layout-static'
import Login from '../components/login'
import { isExternal } from '../lib/url'

export async function getServerSideProps ({ req, res, query: { callbackUrl, error = null } }) {
  const session = await getSession({ req })

  // assume external by default so we will use fallback callback
  let external = true;
  try {
    external = isExternal(decodeURIComponent(callbackUrl))
  } catch (err) {
    console.error("error decoding callback:", callbackUrl, err)
  }
  if (external) {
    // This is a hotfix for open redirects. See https://github.com/stackernews/stacker.news/issues/264
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
    <small className='font-weight-bold text-muted pt-4'>Don't have an account? <Link href={{ pathname: '/signup', query: { callbackUrl } }}>sign up</Link></small>
  )
}

export default function LoginPage (props) {
  return (
    <LayoutStatic>
      <Login
        Footer={() => <LoginFooter callbackUrl={props.callbackUrl} />}
        {...props}
      />
    </LayoutStatic>
  )
}
