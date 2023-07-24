import Link from 'next/link'
import Button from 'react-bootstrap/Button'

export default function FundError ({ onClose }) {
  return (
    <>
      <p className='fw-bolder'>you need more sats</p>
      <div className='d-flex justify-content-end'>
        <Link href='/wallet?type=fund'>
          <Button variant='success' onClick={onClose}>fund</Button>
        </Link>
      </div>
    </>
  )
}
