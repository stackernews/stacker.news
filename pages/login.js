import { providers, getSession } from 'next-auth/client'
import Link from 'next/link'
import LayoutCenter from '../components/layout-center'
import Login from '../components/login'

export async function getServerSideProps ({ req, res, query: { callbackUrl, error = null } }) {
  const session = await getSession({ req })

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
    <LayoutCenter>
      <Login
        Footer={() => <LoginFooter callbackUrl={props.callbackUrl} />}
        {...props}
      />
    </LayoutCenter>
  )
}
