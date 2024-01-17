import Button from 'react-bootstrap/Button'
import { useState } from 'react'
import Link from 'next/link'

export default function MoreFooter ({ cursor, count, fetchMore, Skeleton, invisible, noMoreText = 'GENESIS' }) {
  const [loading, setLoading] = useState(false)

  if (loading) {
    return <div><Skeleton /></div>
  }

  let Footer
  if (cursor) {
    Footer = () => (
      <Button
        variant='primary'
        size='md'
        onClick={async () => {
          setLoading(true)
          await fetchMore({
            variables: {
              cursor
            }
          })
          setTimeout(() => setLoading(false), 100)
        }}
      >more
      </Button>
    )
  } else {
    Footer = () => (
      <div className='text-muted' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>{count === 0 ? 'EMPTY' : noMoreText}</div>
    )
  }

  return <div className={`d-flex justify-content-center mt-3 mb-1 ${invisible ? 'invisible' : ''}`}><Footer /></div>
}

export function NavigateFooter ({ cursor, count, fetchMore, href, text, invisible, noMoreText = 'NO MORE' }) {
  let Footer
  if (cursor) {
    Footer = () => (
      <Link href={href} className='text-reset text-muted fw-bold'>{text}</Link>
    )
  } else {
    Footer = () => (
      <div className='text-muted' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>{count === 0 ? 'EMPTY' : noMoreText}</div>
    )
  }

  return <div className={`d-flex justify-content-start my-1 ${invisible ? 'invisible' : ''}`}><Footer /></div>
}
