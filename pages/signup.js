import Link from 'next/link'
import { StaticLayout } from '../components/layout'
import Login from '../components/login'
export { getServerSideProps } from './login'

function SignUpHeader () {
  return (
    <>
      <h3 className='w-100 pb-2'>
        Sign up
      </h3>
      <div className='fw-bold text-muted pb-4'>Join 15,000+ bitcoiners and start stacking sats today</div>
    </>
  )
}

function SignUpFooter ({ callbackUrl }) {
  return (
    <small className='fw-bold text-muted pt-4'>Already have an account? <Link href={{ pathname: '/login', query: { callbackUrl } }}>login</Link></small>
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
