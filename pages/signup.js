import { providers, getSession } from 'next-auth/client'
import Link from 'next/link'
import LayoutStatic from '../components/layout-static'
import Login from '../components/login'
import { isExternal } from '../lib/url'

export async function getServerSideProps ({ req, res, query: { callbackUrl, error = null } }) {
  const session = await getSession({ req })

  const external = isExternal(decodeURIComponent(callbackUrl))
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

function SignUpHeader () {
  return (
    <>
      <h3 className='w-100 pb-2'>
        Sign up
      </h3>
      <div className='font-weight-bold text-muted pb-4'>Join 10,000+ bitcoiners and start stacking sats today</div>
    </>
  )
}

function SignUpFooter ({ callbackUrl }) {
  return (
    <small className='font-weight-bold text-muted pt-4'>Already have an account? <Link href={{ pathname: '/login', query: { callbackUrl } }}>login</Link></small>
  )
}

export default function SignUp ({ ...props }) {
  return (
    <LayoutStatic>
      <Login
        Header={() => <SignUpHeader />}
        Footer={() => <SignUpFooter callbackUrl={props.callbackUrl} />}
        text='Sign up'
        {...props}
      />
    </LayoutStatic>
  )
}
