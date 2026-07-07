import Alert from '@/components/ui/alert'
import YouTube from '@/svgs/youtube-line.svg'
import { useEffect, useState } from 'react'
import { gql } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import { datePivot } from '@/lib/time'

export default function Snl ({ ignorePreference }) {
  const [show, setShow] = useState()
  const { data } = useQuery(gql`{ snl }`, {
    fetchPolicy: 'cache-and-network'
  })

  useEffect(() => {
    const dismissed = window.localStorage.getItem('snl')
    if (!ignorePreference && dismissed && dismissed > new Date(dismissed) < datePivot(new Date(), { days: -6 })) {
      return
    }

    setShow(data?.snl)
  }, [data, ignorePreference])

  if (!show) return null

  return (
    <div className='flex'>
      <Alert
        variant='info' className='font-bold mb-4 flex items-center'
        onClose={() => {
          setShow(undefined)
          window.localStorage.setItem('snl', new Date())
        }}
        dismissible
      >
        <a href='https://www.youtube.com/@stackernews/live'>
          <YouTube width={24} height={24} className='me-2 fill-info' />Stacker News Live is streaming this week's top stories
        </a>
      </Alert>
    </div>
  )
}
