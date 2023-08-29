import Alert from 'react-bootstrap/Alert'
import styles from './banners.module.css'
import { useEffect, useState } from 'react'
import { useMe } from '../components/me'

export default function NewVisitorBanner () {
  const sameDay = (a, b) => {
    return Math.abs(a.getTime() - b.getTime()) < 1000 * 24 * 60 * 60
  }
  const me = useMe()
  const meHidden = me ? 'hidden_' + me.id : 'hidden'
  const [state, setState] = useState(null)
  const handleClose = () => {
    const obj = { date: state?.date || new Date().toJSON(), hidden: true }
    obj[meHidden] = true
    const str = JSON.stringify(obj)
    window.localStorage.setItem('newVisitorInfo', str)
    setState(obj)
  }
  useEffect(() => {
    let str = window.localStorage.getItem('newVisitorInfo')
    let obj = JSON.parse(str)
    if (!str) {
      obj = { date: new Date().toJSON(), hidden: false }
      str = JSON.stringify(obj)
      window.localStorage.setItem('newVisitorInfo', str)
    }
    if (me && (new Date(me.createdAt).toJSON() !== today && !obj[meHidden])) {
      obj.hidden = true
      obj[meHidden] = true
      str = JSON.stringify(obj)
      window.localStorage.setItem('newVisitorInfo', str)
    }
    setState(obj)
  }, [])

  const today = new Date()
  if ((me && sameDay(new Date(me.createdAt), today) && !state[meHidden]) ||
  (state && sameDay(new Date(state.date), today) && !state.hidden)) {
    return (
      <Alert className={styles.banner} key='info' variant='info' onClose={handleClose} dismissible>
        <Alert.Heading>
          👋 Welcome to Stacker News!
        </Alert.Heading>
        <p>
          To get started, check out our{' '}
          <Alert.Link href='/faq'>FAQs</Alert.Link> or{' '}
          <Alert.Link href='/guide'>content guidelines</Alert.Link>, or go ahead and{' '}
          {
            me
              ? (
                <Alert.Link href='/post'>make a post</Alert.Link>
                )
              : (
                <Alert.Link href='/signup'>sign up</Alert.Link>
                )
          }.
        </p>
      </Alert>
    )
  } else {
    return (<></>)
  }
}
