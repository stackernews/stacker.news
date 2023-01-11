import LayoutError from '../components/layout-error'
import { Image } from 'react-bootstrap'

export default function Email () {
  return (
    <LayoutError>
      <div className='p-4 text-center'>
        <h1>Check your email</h1>
        <h4 className='pb-4'>A sign in link has been sent to your email address</h4>
        <Image width='500' height='376' src='/hello.gif' fluid />
      </div>
    </LayoutError>
  )
}
