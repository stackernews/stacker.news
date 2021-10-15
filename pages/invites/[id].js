import Login from '../../components/login'
import { providers, getSession } from 'next-auth/client'

export async function getServerSideProps ({ req, res, query: { id, error = null } }) {
  const session = await getSession({ req })

  if (session && res) {
    // send down the userid and the invite to the db
    res.writeHead(302, {
      Location: '/'
    })
    res.end()
    return { props: {} }
  }

  return {
    props: {
      providers: await providers({ req, res }),
      callbackUrl: process.env.SELF_URL + req.url,
      error
    }
  }
}

export default Login
