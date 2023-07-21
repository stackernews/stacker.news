import { Image } from 'react-bootstrap'
import { StaticLayout } from '../components/layout'

export default function Email () {
  return (
    <StaticLayout>
      <div className='p-4 text-center'>
        <h1>Check your email</h1>
        <h4 className='pb-4'>A sign in link has been sent to your email address</h4>
        <Image width='500' height='376' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/hello.gif`} fluid />
      </div>
    </StaticLayout>
  )
}
