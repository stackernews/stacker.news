import { Alert } from 'react-bootstrap'
import YouTube from '../svgs/youtube-line.svg'
import { useEffect, useState } from 'react'
import { gql, useQuery } from '@apollo/client'

export default function Snl () {
  const [show, setShow] = useState()
  const { data } = useQuery(gql`{ snl }`, {
    fetchPolicy: 'cache-and-network'
  })

  useEffect(() => {
    const dismissed = localStorage.getItem('snl')
    if (dismissed && dismissed > new Date(dismissed) < new Date(new Date().setDate(new Date().getDate() - 6))) {
      return
    }

    if (data?.snl) {
      setShow(true)
    }
  }, [data])

  if (!show) return null

  return (
    <div className='d-flex'>
      <Alert
        variant='info' className='font-weight-bold mb-3 d-flex py-2 flex-shrink align-items-center'
        onClose={() => {
          setShow(undefined)
          localStorage.setItem('snl', new Date())
        }}
        dismissible
      >
        <a href='https://www.youtube.com/@stackernews/live'>
          <YouTube width={24} height={24} className='mr-2 fill-info' />Stacker News Live is streaming this week's top stories
        </a>
      </Alert>
    </div>
  )
}
