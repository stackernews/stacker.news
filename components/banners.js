import { Alert, AlertHeading, AlertLink } from '@/components/ui/alert'
import styles from './banners.module.css'
import { useMe } from '@/components/me'
import Link from 'next/link'

export function MadnessBanner ({ handleClose }) {
  const { me } = useMe()
  return (
    <Alert className={styles.banner} key='info' variant='info' onClose={handleClose} dismissible>
      <AlertHeading>
        ⚡️ Million Sat Madness Is Here!
      </AlertHeading>
      {me
        ? (
          <div>
            <div>
              We're giving away 3 million sats to the top Stacker News contributors in March. <AlertLink href='/rewards'>See the leaderboard!</AlertLink>
            </div>
            <div>
              How does Million Sat Madness work? <AlertLink href='/items/444168'>Click here</AlertLink>.
            </div>
          </div>
          )
        : (
          <div>
            <div>
              We're giving away 3 million sats to the top Stacker News contributors in March. <AlertLink href='/signup'>Sign up!</AlertLink>
            </div>
            <div>
              Need help? Check out our <AlertLink href='/faq'>FAQs</AlertLink>.
            </div>
          </div>
          )}
    </Alert>
  )
}

export function AuthBanner () {
  return (
    <Alert className={`${styles.banner} mt-0`} key='info' variant='danger'>
      Please add more than one <Link className='text-reset font-bold underline' href='/settings/logins'>login method</Link> to avoid losing access to your account.
    </Alert>
  )
}
