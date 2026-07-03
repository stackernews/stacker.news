import { useRouter } from 'next/router'
import Button from 'react-bootstrap/Button'

export default function CancelButton ({ onClick }) {
  const router = useRouter()
  return (
    <Button className='me-4 text-muted nav-link font-bold' variant='link' onClick={onClick || (() => router.back())}>cancel</Button>
  )
}
