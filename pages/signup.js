import Link from 'next/link'
import LayoutStatic from '../components/layout-static'
import Login from '../components/login'
export { getServerSideProps } from '../components/login'

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
