import Alert from 'react-bootstrap/Alert'
import styles from './banners.module.css'
import { useEffect, useState } from 'react'
import { useMe } from '@/components/me'
import { useMutation } from '@apollo/client'
import { WELCOME_BANNER_MUTATION } from '@/fragments/users'
import { useToast } from '@/components/toast'
import Link from 'next/link'
import AccordianItem from '@/components/accordian-item'

export function WelcomeBanner ({ Banner }) {
  const { me } = useMe()
  const toaster = useToast()
  const [hidden, setHidden] = useState(true)
  const handleClose = async () => {
    window.localStorage.setItem('hideWelcomeBanner', true)
    setHidden(true)
    if (me) {
      try {
        await hideWelcomeBanner()
      } catch (err) {
        console.log(err)
        toaster.danger('mutation failed')
      }
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
    setHidden(me?.privates?.hideWelcomeBanner || (!me && window.localStorage.getItem('hideWelcomeBanner')))
  }, [me?.privates?.hideWelcomeBanner])

  if (hidden) return null

  return Banner
    ? <Banner handleClose={handleClose} />
    : (
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
                <Alert.Link href='/signup'>sign up</Alert.Link> or create an{' '}
                <Alert.Link href='/post'>anonymous post</Alert.Link>
              </>
              )
        }.
        </p>
      </Alert>)
}

export function MadnessBanner ({ handleClose }) {
  const { me } = useMe()
  return (
    <Alert className={styles.banner} key='info' variant='info' onClose={handleClose} dismissible>
      <Alert.Heading>
        ⚡️ Million Sat Madness Is Here!
      </Alert.Heading>
      {me
        ? (
          <div>
            <div>
              We're giving away 3 million sats to the top Stacker News contributors in March. <Alert.Link href='/rewards'>See the leaderboard!</Alert.Link>
            </div>
            <div>
              How does Million Sat Madness work? <Alert.Link href='/items/444168'>Click here</Alert.Link>.
            </div>
          </div>
          )
        : (
          <div>
            <div>
              We're giving away 3 million sats to the top Stacker News contributors in March. <Alert.Link href='/signup'>Sign up!</Alert.Link>
            </div>
            <div>
              Need help? Check out our <Alert.Link href='/faq'>FAQs</Alert.Link>.
            </div>
          </div>
          )}
    </Alert>
  )
}

export function WalletSecurityBanner ({ isActive }) {
  return (
    <Alert className={styles.banner} key='info' variant='warning'>
      <Alert.Heading>
        Gunslingin' Safety Tips
      </Alert.Heading>
      <p className='mb-3 line-height-md'>
        Listen up, pardner! Put a limit on yer spendin' wallet or hook up a wallet that's only for Stacker News. It'll keep them varmints from cleanin' out yer whole goldmine if they rustle up yer wallet.
      </p>
      <p className='line-height-md'>
        Your spending wallet's credentials are never sent to our servers in plain text. To sync across devices, <Alert.Link as={Link} href='/settings/passphrase'>enable device sync in your settings</Alert.Link>.
      </p>
    </Alert>
  )
}

export function AuthBanner () {
  return (
    <Alert className={`${styles.banner} mt-0`} key='info' variant='danger'>
      Please add a second auth method to avoid losing access to your account.
    </Alert>
  )
}

export function MultiAuthErrorBanner ({ errors }) {
  return (
    <Alert className={styles.banner} key='info' variant='danger'>
      <div className='fw-bold mb-3'>Account switching is currently unavailable</div>
      <AccordianItem
        className='my-3'
        header='We have detected the following issues:'
        headerColor='var(--bs-danger-text-emphasis)'
        body={
          <ul>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
      }
      />
      <div className='mt-3'>To resolve these issues, please sign out and sign in again.</div>
    </Alert>
  )
}
