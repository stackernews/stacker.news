import Link from 'next/link'
import { StaticLayout } from '@/components/layout'
import Login from '@/components/login'
import { walletOnboardingPath } from '@/lib/safe-url'
import { getServerSideProps as getLoginServerSideProps } from './login'

export async function getServerSideProps (context) {
  const result = await getLoginServerSideProps(context)
  if (result.props && !result.props.domainData) {
    result.props.callbackUrl = walletOnboardingPath(result.props.callbackUrl, context.req.headers.host)
  }
  return result
}

function SignUpHeader ({ domainData }) {
  return (
    <>
      <h3 className='w-full pb-2'>
        Sign up {domainData && ` to ${domainData.title}`}
      </h3>
      <div className='font-bold text-muted w-full text-start pb-6 leading-normal'>We saved you a seat, pardner.</div>
    </>
  )
}

function SignUpFooter ({ callbackUrl, domain }) {
  const query = { ...(domain && { domain }), callbackUrl }

  return (
    <small className='font-bold text-muted pt-6'>Been here before? <Link href={{ pathname: '/login', query }}>log in</Link></small>
  )
}

export default function SignUp ({ ...props }) {
  return (
    <StaticLayout footerLinks={false}>
      <Login
        Header={() => <SignUpHeader domainData={props.domainData} />}
        Footer={() => <SignUpFooter callbackUrl={props.callbackUrl} domain={props.canonicalDomain} />}
        text='Continue'
        {...props}
      />
    </StaticLayout>
  )
}
