import { signIn } from 'next-auth/react'
import styles from './login.module.css'
import { Form, Input, SubmitButton } from '@/components/form'
import { useState, useEffect } from 'react'
import Alert from 'react-bootstrap/Alert'
import { useRouter } from 'next/router'
import { LightningAuthWithExplainer } from './lightning-auth'
import { NostrAuthWithExplainer } from './nostr-auth'
import LoginButton from './login-button'
import { emailSchema } from '@/lib/validate'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'

export function EmailLoginForm ({ text, callbackUrl, multiAuth }) {
  const disabled = multiAuth

  return (
    <Form
      initial={{
        email: ''
      }}
      schema={emailSchema}
      onSubmit={async ({ email }) => {
        window.sessionStorage.setItem('callback', JSON.stringify({ email, callbackUrl }))
        signIn('email', { email, callbackUrl, multiAuth })
      }}
    >
      <Input
        label='Email'
        name='email'
        placeholder='email@example.com'
        required
        autoFocus
        disabled={disabled}
      />
      <SubmitButton disabled={disabled} variant='secondary' className={styles.providerButton}>{text || 'Login'} with Email</SubmitButton>
    </Form>
  )
}

const authErrorMessages = {
  OAuthSignin: 'Error constructing OAuth URL. Try again or choose a different method.',
  OAuthCallback: 'Error handling OAuth response. Try again or choose a different method.',
  OAuthCreateAccount: 'Could not create OAuth account. Try again or choose a different method.',
  EmailCreateAccount: 'Could not create Email account. Try again or choose a different method.',
  Callback: 'Try again or choose a different method.',
  OAuthAccountNotLinked: 'This auth method is linked to another account. To link to this account first unlink the other account.',
  EmailSignin: 'Failed to send email. Make sure you entered your email address correctly.',
  CredentialsSignin: 'Auth failed. Try again or choose a different method.',
  default: 'Auth failed. Try again or choose a different method.'
}

export function authErrorMessage (error) {
  return error && (authErrorMessages[error] ?? authErrorMessages.default)
}

export default function Login ({ providers, callbackUrl, multiAuth, error, text, Header, Footer, signup }) {
  const [errorMessage, setErrorMessage] = useState(authErrorMessage(error))
  const router = useRouter()

  // signup/signin awareness cookie
  useEffect(() => {
    const cookieOptions = [
      `signup=${!!signup}`,
      'path=/',
      'max-age=' + 60 * 60 * 24, // 24 hours
      'SameSite=Lax',
      process.env.NODE_ENV === 'production' ? 'Secure' : ''
    ].filter(Boolean).join(';')

    document.cookie = cookieOptions
  }, [signup])

  if (router.query.type === 'lightning') {
    return <LightningAuthWithExplainer callbackUrl={callbackUrl} text={text} multiAuth={multiAuth} />
  }

  if (router.query.type === 'nostr') {
    return <NostrAuthWithExplainer callbackUrl={callbackUrl} text={text} multiAuth={multiAuth} />
  }

  return (
    <div className={styles.login}>
      {Header && <Header />}
      {errorMessage &&
        <Alert
          variant='danger'
          onClose={() => setErrorMessage(undefined)}
          dismissible
        >{errorMessage}
        </Alert>}
      {providers && Object.values(providers).map(provider => {
        switch (provider.name) {
          case 'Email':
            return (
              <OverlayTrigger
                key={provider.id}
                placement='bottom'
                overlay={multiAuth ? <Tooltip>not available for account switching yet</Tooltip> : <></>}
                trigger={['hover', 'focus']}
              >
                <div className='w-100' key={provider.id}>
                  <div className='mt-2 text-center text-muted fw-bold'>or</div>
                  <EmailLoginForm text={text} callbackUrl={callbackUrl} multiAuth={multiAuth} />
                </div>
              </OverlayTrigger>
            )
          case 'Lightning':
          case 'Slashtags':
          case 'Nostr':
            return (
              <LoginButton
                className={`mt-2 ${styles.providerButton}`}
                key={provider.id}
                type={provider.id.toLowerCase()}
                onClick={() => {
                  const { nodata, ...query } = router.query
                  router.push({
                    pathname: router.pathname,
                    query: { ...query, type: provider.name.toLowerCase() }
                  })
                }}
                text={`${text || 'Login'} with`}
              />
            )
          default:
            return (
              <OverlayTrigger
                placement='bottom'
                overlay={multiAuth ? <Tooltip>not available for account switching yet</Tooltip> : <></>}
                trigger={['hover', 'focus']}
              >
                <div className='w-100'>
                  <LoginButton
                    className={`mt-2 ${styles.providerButton}`}
                    key={provider.id}
                    type={provider.id.toLowerCase()}
                    onClick={() => signIn(provider.id, { callbackUrl, multiAuth })}
                    text={`${text || 'Login'} with`}
                    disabled={multiAuth}
                  />
                </div>
              </OverlayTrigger>
            )
        }
      })}
      {Footer && <Footer />}
    </div>
  )
}
