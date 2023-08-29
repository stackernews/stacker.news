import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import { useInvoiceable } from './invoice'
import { Alert } from 'react-bootstrap'
import { useState } from 'react'

export default function FundError ({ onClose, amount, onPayment }) {
  const [error, setError] = useState(null)
  const createInvoice = useInvoiceable(onPayment, { forceInvoice: true })
  return (
    <>
      {error && <Alert variant='danger' onClose={() => setError(undefined)} dismissible>{error}</Alert>}
      <p className='fw-bolder text-center'>you need more sats</p>
      <div className='d-flex pb-3 pt-2 justify-content-center'>
        <Link href='/wallet?type=fund'>
          <Button variant='success' onClick={onClose}>fund wallet</Button>
        </Link>
        <span className='d-flex mx-3 fw-bold text-muted align-items-center'>or</span>
        <Button variant='success' onClick={() => createInvoice({ amount }).catch(err => setError(err.message || err))}>pay invoice</Button>
      </div>
    </>
  )
}

export const payOrLoginError = (error) => {
  const matches = ['insufficient funds', 'you must be logged in or pay']
  if (Array.isArray(error)) {
    return error.some(({ message }) => matches.some(m => message.includes(m)))
  }
  return matches.some(m => error.toString().includes(m))
}
