import Link from 'next/link'
import { StaticLayout } from '@/components/layout'
import Login from '@/components/login'
export { getServerSideProps } from './login'

function SignUpHeader ({ domainData }) {
  return (
    <>
      <h3 className='w-100 pb-2'>
        Sign up {domainData && ` to ~${domainData.subName}`}
      </h3>
      <div className='fw-bold text-muted w-100 text-start pb-4 line-height-md'>We saved you a seat, pardner.</div>
    </>
  )
}

function SignUpFooter ({ callbackUrl, domain }) {
  const query = { ...(domain && { domain }), callbackUrl }

  return (
    <small className='fw-bold text-muted pt-4'>Been here before? <Link href={{ pathname: '/login', query }}>log in</Link></small>
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
