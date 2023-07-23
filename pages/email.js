import LayoutStatic from '../components/layout-static'
import { Image } from 'react-bootstrap'

export default function Email () {
  return (
    <LayoutStatic>
      <div className='p-4 text-center'>
        <h1>Check your email</h1>
        <h4 className='pb-4'>A sign in link has been sent to your email address</h4>
        <Image width='500' height='376' src='/hello.gif' fluid />
      </div>
    </LayoutStatic>
  )
}
