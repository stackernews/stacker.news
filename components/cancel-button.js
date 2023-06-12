import { useRouter } from 'next/router'
import { Button } from 'react-bootstrap'

export default function CancelButton ({ onClick }) {
  const router = useRouter()
  return (
    <Button className='mr-3 text-muted nav-link font-weight-bold' variant='link' onClick={onClick || (() => router.back())}>cancel</Button>
  )
}
