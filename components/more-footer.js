import { Button } from 'react-bootstrap'
import { useState } from 'react'

export default function MoreFooter ({ cursor, fetchMore, Skeleton, noMoreText }) {
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
      <div className='text-muted' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>{noMoreText || 'GENESIS'}</div>
    )
  }

  return <div className='d-flex justify-content-center mt-3 mb-1'><Footer /></div>
}
