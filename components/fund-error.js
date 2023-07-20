import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import { useAnonymous } from '../lib/anonymous'

export default function FundError ({ onClose, amount, onPayment }) {
  const anonPayment = useAnonymous(onPayment, { forceInvoice: true })
  return (
    <>
      <p className='fw-bolder'>you need more sats</p>
      <div className='d-flex justify-content-end'>
        <Link href='/wallet?type=fund'>
          <Button variant='success' onClick={onClose}>fund wallet</Button>
        </Link>
        <span className='d-flex mx-3 font-weight-bold text-muted align-items-center'>or</span>
        <Button variant='success' onClick={() => anonPayment(amount)}>pay invoice</Button>
      </div>
    </>
  )
}
