import { signIn } from 'next-auth/client'
import Button from 'react-bootstrap/Button'
import styles from './login.module.css'
import GithubIcon from '../svgs/github-fill.svg'
import TwitterIcon from '../svgs/twitter-fill.svg'
import LightningIcon from '../svgs/bolt.svg'
import { Form, Input, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import LayoutCenter from '../components/layout-center'
import { useRouter } from 'next/router'
import { LightningAuth } from './lightning-auth'

export const EmailSchema = Yup.object({
  email: Yup.string().email('email is no good').required('required')
})

export function EmailLoginForm ({ text, callbackUrl }) {
  return (
    <Form
      initial={{
        email: ''
      }}
      schema={EmailSchema}
      onSubmit={async ({ email }) => {
        signIn('email', { email, callbackUrl })
      }}
    >
      <Input
        label='Email'
        name='email'
        placeholder='email@example.com'
        required
        autoFocus
      />
      <SubmitButton variant='secondary' className={styles.providerButton}>{text || 'Login'} with Email</SubmitButton>
    </Form>
  )
}

export default function Login ({ providers, callbackUrl, error, text, Header, Footer }) {
  const errors = {
    Signin: 'Try signing with a different account.',
    OAuthSignin: 'Try signing with a different account.',
    OAuthCallback: 'Try signing with a different account.',
    OAuthCreateAccount: 'Try signing with a different account.',
    EmailCreateAccount: 'Try signing with a different account.',
    Callback: 'Try signing with a different account.',
    OAuthAccountNotLinked: 'To confirm your identity, sign in with the same account you used originally.',
    EmailSignin: 'Check your email address.',
    CredentialsSignin: 'Lightning auth failed.',
    default: 'Unable to sign in.'
  }

  const [errorMessage, setErrorMessage] = useState(error && (errors[error] ?? errors.default))
  const router = useRouter()

  return (
    <LayoutCenter>
      {router.query.type === 'lightning'
        ? <LightningAuth callbackUrl={callbackUrl} text={text} />
        : (
          <div className={styles.login}>
            {Header && <Header />}
            {errorMessage &&
              <Alert
                variant='danger'
                onClose={() => setErrorMessage(undefined)}
                dismissible
              >{errorMessage}
              </Alert>}
            <Button
              className={`mt-2 ${styles.providerButton}`}
              variant='primary'
              onClick={() => router.push({
                pathname: router.pathname,
                query: { ...router.query, type: 'lightning' }
              })}
            >
              <LightningIcon
                width={20}
                height={20}
                className='mr-3'
              />{text || 'Login'} with Lightning
            </Button>
            {Object.values(providers).map(provider => {
              if (provider.name === 'Email' || provider.name === 'Lightning') {
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
                  onClick={() => signIn(provider.id, { callbackUrl })}
                >
                  <Icon
                    className='mr-3'
                  />{text || 'Login'} with {provider.name}
                </Button>
              )
            })}
            <div className='mt-2 text-center text-muted font-weight-bold'>or</div>
            <EmailLoginForm text={text} callbackUrl={callbackUrl} />
            {Footer && <Footer />}
          </div>)}
    </LayoutCenter>
  )
}
