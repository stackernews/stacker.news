import { useRouter } from 'next/router'
import Button from 'react-bootstrap/Button'

export default function CancelButton ({ onClick }) {
  const router = useRouter()
  return (
    <Button className='me-3 text-muted nav-link fw-bold' variant='link' onClick={onClick || (() => router.back())}>cancel</Button>
  )
}
