import { useRouter } from 'next/router'
import { NavLink } from '@/components/ui/nav'

export default function CancelButton ({ onClick }) {
  const router = useRouter()
  return (
    <NavLink className='me-4 text-muted font-bold' onClick={onClick || (() => router.back())}>cancel</NavLink>
  )
}
