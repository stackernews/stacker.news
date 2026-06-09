import Alert from 'react-bootstrap/Alert'
import styles from './banners.module.css'
import { useMe } from '@/components/me'
import Link from 'next/link'

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

export function AuthBanner () {
  return (
    <Alert className={`${styles.banner} mt-0`} key='info' variant='danger'>
      Please add more than one <Link className='text-reset fw-bold text-decoration-underline' href='/settings/logins'>login method</Link> to avoid losing access to your account.
    </Alert>
  )
}
