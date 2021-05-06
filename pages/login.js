import { providers, signIn, getSession, csrfToken } from 'next-auth/client'
import Button from 'react-bootstrap/Button'
import styles from '../styles/login.module.css'
import GithubIcon from '../svgs/github-fill.svg'
import TwitterIcon from '../svgs/twitter-fill.svg'
import { Input, SubmitButton, SyncForm } from '../components/form'
import * as Yup from 'yup'
import { useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import LayoutCenter from '../components/layout-center'

export async function getServerSideProps ({ req, res, query: { callbackUrl, error = null } }) {
  const session = await getSession({ req })

  if (session && res && session.accessToken) {
    res.writeHead(302, {
      Location: callbackUrl
    })
    res.end()
    return { props: {} }
  }

  return {
    props: {
      providers: await providers({ req, res }),
      csrfToken: await csrfToken({ req, res }),
      error
    }
  }
}

export const EmailSchema = Yup.object({
  email: Yup.string().email('email is no good').required('required').trim()
})

export default function login ({ providers, csrfToken, error }) {
  const errors = {
    Signin: 'Try signing with a different account.',
    OAuthSignin: 'Try signing with a different account.',
    OAuthCallback: 'Try signing with a different account.',
    OAuthCreateAccount: 'Try signing with a different account.',
    EmailCreateAccount: 'Try signing with a different account.',
    Callback: 'Try signing with a different account.',
    OAuthAccountNotLinked: 'To confirm your identity, sign in with the same account you used originally.',
    EmailSignin: 'Check your email address.',
    CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
    default: 'Unable to sign in.'
  }

  const [errorMessage, setErrorMessage] = useState(error && (errors[error] ?? errors.default))

  return (
    <LayoutCenter>
      <div className={styles.login}>
        {errorMessage &&
          <Alert variant='danger' onClose={() => setErrorMessage(undefined)} dismissible>{errorMessage}</Alert>}
        {Object.values(providers).map(provider => {
          if (provider.name === 'Email') {
            return null
          }
          const [variant, Icon] =
          provider.name === 'Twitter'
            ? ['twitter', TwitterIcon]
            : ['dark', GithubIcon]

          return (
            <Button
              className={`mt-2 ${styles.providerButton}`}
              key={provider.name}
              variant={variant}
              onClick={() => signIn(provider.id)}
            >
              <Icon
                className='mr-3'
              />Login with {provider.name}
            </Button>
          )
        })}
        <div className='mt-2 text-center text-muted font-weight-bold'>or</div>
        <SyncForm
          initial={{
            email: ''
          }}
          schema={EmailSchema}
          action='/api/auth/signin/email'
        >
          <input name='csrfToken' type='hidden' defaultValue={csrfToken} />
          <Input
            label='Email'
            name='email'
            placeholder='email@example.com'
            required
            autoFocus
          />
          <SubmitButton variant='secondary' className={styles.providerButton}>Login with Email</SubmitButton>
        </SyncForm>
      </div>
    </LayoutCenter>
  )
}
