import Link from 'next/link'
import Layout from '../components/layout'
import { usePaymentTokens } from '../components/payment-tokens'
import { numWithUnits } from '../lib/format'
import Button from 'react-bootstrap/Button'

export default function Refunds () {
  const { balance } = usePaymentTokens()
  return (
    <Layout>
      <div className='mt-3 text-center'>
        <h2 className='text-center'>refunds</h2>
        <div className='my-3'>
          <div>You can withdraw your sats for failed actions here.</div>
          <div>Your current balance is: {numWithUnits(balance, { abbreviate: false })}</div>
        </div>
        <Link href='/wallet?type=withdraw'>
          <Button variant='success'>withdraw</Button>
        </Link>
      </div>

    </Layout>
  )
}
