import Link from 'next/link'
import { StaticLayout } from '@/components/layout'
import Login from '@/components/login'
export { getServerSideProps } from './login'

function SignUpHeader () {
  return (
    <>
      <h3 className='w-100 pb-2'>
        Sign up
      </h3>
      <div className='fw-bold text-muted w-100 text-start pb-4'>You sure you want to stack sats, pardner?</div>
    </>
  )
}

function SignUpFooter ({ callbackUrl }) {
  return (
    <small className='fw-bold text-muted pt-4'>Been here before? <Link href={{ pathname: '/login', query: { callbackUrl } }}>login</Link></small>
  )
}

export default function SignUp ({ ...props }) {
  return (
    <StaticLayout footerLinks={false}>
      <Login
        Header={() => <SignUpHeader />}
        Footer={() => <SignUpFooter callbackUrl={props.callbackUrl} />}
        text='Sign up'
        {...props}
      />
    </StaticLayout>
  )
}
