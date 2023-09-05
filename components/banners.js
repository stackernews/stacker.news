import Alert from 'react-bootstrap/Alert'
import styles from './banners.module.css'
import { useEffect, useState } from 'react'
import { useMe } from '../components/me'
import { useMutation } from '@apollo/client'
import { WELCOME_BANNER_MUTATION } from '../fragments/users'
import { useToast } from '../components/toast'

export default function NewVisitorBanner () {
  const me = useMe()
  const toaster = useToast()
  const [state, setState] = useState(null)
  const handleClose = async () => {
    const obj = { date: state?.date || new Date().toJSON(), hidden: true }
    const str = JSON.stringify(obj)
    window.localStorage.setItem('newVisitorInfo', str)
    setState(obj)
    if (me) {
      let error
      try {
        ({ error } = await hideWelcomeBanner({ variables: { } }))
      } catch (e) {
        error = e
      }
      if (error) toaster.danger(error.toString())
    }
  }
  const [hideWelcomeBanner] = useMutation(WELCOME_BANNER_MUTATION, {
    update (cache) {
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
    }
    if (me?.hideWelcomeBanner) {
      obj.hidden = true
    }
    str = JSON.stringify(obj)
    window.localStorage.setItem('newVisitorInfo', str)
    setState(obj)
  }, [me?.hideWelcomeBanner])

  if ((me && !me.hideWelcomeBanner) || (!me && state && !state.hidden)) {
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
                <>
                  <Alert.Link href='/signup'>signup</Alert.Link> or create an{' '}
                  <Alert.Link href='/post'>anonymous post</Alert.Link>
                </>
                )
          }.
        </p>
      </Alert>
    )
  } else {
    return (<></>)
  }
}
