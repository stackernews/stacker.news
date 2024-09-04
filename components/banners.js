import Alert from 'react-bootstrap/Alert'
import styles from './banners.module.css'
import { useEffect, useState } from 'react'
import { useMe } from '@/components/me'
import { useMutation } from '@apollo/client'
import { WELCOME_BANNER_MUTATION } from '@/fragments/users'
import { useToast } from '@/components/toast'
import { BALANCE_LIMIT_MSATS } from '@/lib/constants'
import { msatsToSats, numWithUnits } from '@/lib/format'

export function WelcomeBanner ({ Banner }) {
  const me = useMe()
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
  const me = useMe()
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

export function WalletLimitBanner () {
  const me = useMe()

  const limitReached = me?.privates?.sats >= msatsToSats(BALANCE_LIMIT_MSATS)
  if (!me || !limitReached) return

  return (
    <Alert className={styles.banner} key='info' variant='warning'>
      <Alert.Heading>
        Your wallet is over the current limit ({numWithUnits(msatsToSats(BALANCE_LIMIT_MSATS))})
      </Alert.Heading>
      <p className='mb-1'>
        Deposits to your wallet from <strong>outside</strong> of SN are blocked.
      </p>
      <p>
        Please spend or withdraw sats to restore full wallet functionality.
      </p>
    </Alert>
  )
}

export function WalletSecurityBanner () {
  return (
    <Alert className={styles.banner} key='info' variant='warning'>
      <Alert.Heading>
        Wallet Security Disclaimer
      </Alert.Heading>
      <p className='mb-1'>
        Your wallet's credentials for spending are stored in the browser and never go to the server.
        However, you should definitely <strong>set a budget in your wallet</strong> if you can.
      </p>
      <p>
        Also, for the time being, you will have to reenter your credentials on other devices.
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
