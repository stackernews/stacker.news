import Alert from 'react-bootstrap/Alert'
import YouTube from '../svgs/youtube-line.svg'
import { useEffect, useState } from 'react'
import { gql, useQuery } from '@apollo/client'
import { datePivot } from '../lib/time'

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
    <div className='d-flex'>
      <Alert
        variant='info' className='fw-bold mb-3 d-flex py-2 flex-shrink align-items-center'
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
