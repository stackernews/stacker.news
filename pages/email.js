import Image from 'react-bootstrap/Image'
import { StaticLayout } from '../components/layout'

export default function Email () {
  return (
    <StaticLayout>
      <div className='p-4 text-center'>
        <Image className='rounded-1 shadow-sm' width='320' height='223' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/hello.gif`} fluid />
        <h2 className='pt-4'>Check your email</h2>
        <h4 className='text-muted pt-2'>A sign in link has been sent to your email address</h4>
      </div>
    </StaticLayout>
  )
}
