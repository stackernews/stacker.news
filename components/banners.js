import Alert from 'react-bootstrap/Alert'
import styles from './banners.module.css'
import { useEffect, useState } from 'react'

export default function NewVisitorBanner () {
  const dateKey = (d) => {
    return d.toLocaleDateString('en-us', { year: 'numeric', month: 'numeric', day: 'numeric' })
  }
  const [state, setState] = useState(null)
  const handleClose = () => {
    const obj = { date: state.date, dismissed: true }
    const str = JSON.stringify(obj)
    window.localStorage.setItem('newVisitorInfo', str)
    setState(obj)
  }
  useEffect(() => {
    let str = window.localStorage.getItem('newVisitorInfo')
    let obj = JSON.parse(str)
    if (!str) {
      obj = { date: dateKey(new Date()), dismissed: false }
      str = JSON.stringify(obj)
      window.localStorage.setItem('newVisitorInfo', str)
    }
    setState(obj)
  }, [])

  if (state && state.date === dateKey(new Date()) && !state.dismissed) {
    return (
      <Alert className={styles.banner} key='info' variant='info' onClose={handleClose} dismissible>
        <Alert.Heading>
          👋 Welcome to Stacker News!
        </Alert.Heading>
        <p>
          To get started, check out our{' '}
          <Alert.Link href='/faq'>FAQs</Alert.Link>,{' '}
          <Alert.Link href='/guide'>content guidelines</Alert.Link>, or go ahead and{' '}
          <Alert.Link href='/signup'>sign up</Alert.Link>.
        </p>
      </Alert>
    )
  } else {
    return (<></>)
  }
}
