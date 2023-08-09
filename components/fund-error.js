import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import { useInvoiceable } from './invoice'

export default function FundError ({ onClose, amount, onPayment }) {
  const createInvoice = useInvoiceable(onPayment, { forceInvoice: true })
  return (
    <>
      <p className='fw-bolder'>you need more sats</p>
      <div className='d-flex justify-content-end'>
        <Link href='/wallet?type=fund'>
          <Button variant='success' onClick={onClose}>fund wallet</Button>
        </Link>
        <span className='d-flex mx-3 font-weight-bold text-muted align-items-center'>or</span>
        <Button variant='success' onClick={() => createInvoice(amount)}>pay invoice</Button>
      </div>
    </>
  )
}

export const isInsufficientFundsError = (error) => {
  if (Array.isArray(error)) {
    return error.some(({ message }) => message.includes('insufficient funds'))
  }
  return error.toString().includes('insufficient funds')
}
