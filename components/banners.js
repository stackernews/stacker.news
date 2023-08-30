import Alert from 'react-bootstrap/Alert'
import styles from './banners.module.css'
import { useEffect, useState } from 'react'
import { useMe } from '../components/me'
import { useMutation } from '@apollo/client'
import { WELCOME_BANNER_MUTATION } from '../fragments/users'

export default function NewVisitorBanner () {
  const today = new Date()
  const sameDay = (a, b) => {
    return Math.abs(a.getTime() - b.getTime()) < 1000 * 24 * 60 * 60
  }
  const me = useMe()
  const [state, setState] = useState(null)
  const handleClose = async () => {
    const obj = { date: state?.date || new Date().toJSON(), hidden: true }
    const str = JSON.stringify(obj)
    window.localStorage.setItem('newVisitorInfo', str)
    setState(obj)
    const { error } = await hideWelcomeBanner({ variables: { } })
    if (error) {
      throw new Error({ message: error.toString() })
    }
  }
  const [hideWelcomeBanner] = useMutation(WELCOME_BANNER_MUTATION, {
    update (cache, { data: { _ } }) {
      cache.modify({
        id: `User:${me.id}`,
        fields: {
          hideWelcomeBanner () {
            return true
          }
        }
      })
    }
  })
  useEffect(() => {
    let str = window.localStorage.getItem('newVisitorInfo')
    let obj = JSON.parse(str)
    if (!str) {
      obj = { date: new Date().toJSON(), hidden: false }
      str = JSON.stringify(obj)
      window.localStorage.setItem('newVisitorInfo', str)
    }
    if (me && (me.hideWelcomeBanner || !sameDay(new Date(me.createdAt), today))) {
      obj.hidden = true
      str = JSON.stringify(obj)
      window.localStorage.setItem('newVisitorInfo', str)
    }
    setState(obj)
  }, [me?.hideWelcomeBanner])

  if ((me && sameDay(new Date(me.createdAt), today) && !me.hideWelcomeBanner) ||
  (!me && state && sameDay(new Date(state.date), today) && !state.hidden)) {
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
