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
import { datePivot } from '@/lib/time'
import * as cookie from 'cookie'
import { cookieOptions, MULTI_AUTH_ANON, MULTI_AUTH_POINTER } from '@/lib/auth'
import Link from 'next/link'
import useCookie from './use-cookie'

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
  Callback: 'Could not authenticate. Try again or choose a different method.',
  OAuthAccountNotLinked: 'This auth method is linked to another account. To link to this account first unlink the other account.',
  EmailSignin: 'Failed to send email. Make sure you entered your email address correctly.',
  CredentialsSignin: 'Could not authenticate. Try again or choose a different method.',
  default: 'Auth failed. Try again or choose a different method.'
}

export function authErrorMessage (error, signin) {
  if (!error) return null

  const message = error && (authErrorMessages[error] ?? authErrorMessages.default)
  // workaround for signin/signup awareness due to missing support from next-auth
  if (signin) {
    return (
      <>
        {message}
        <br />
        If you are new to Stacker News, please <Link className='fw-bold' href='/signup'>sign up</Link> first.
      </>
    )
  }

  return message
}

export default function Login ({ providers, callbackUrl, multiAuth, error, text, Header, Footer, signin, syncSignup }) {
  const [errorMessage, setErrorMessage] = useState(authErrorMessage(error, signin))
  const router = useRouter()
  const [, setPointerCookie] = useCookie(MULTI_AUTH_POINTER)

  // we can't signup if we're already logged in to another account
  // for signups with auth sync, we first need to switch to anon.
  useEffect(() => {
    if (syncSignup) {
      setPointerCookie(MULTI_AUTH_ANON, cookieOptions({ httpOnly: false }))
    }
  }, [syncSignup, setPointerCookie])

  // signup/signin awareness cookie
  useEffect(() => {
    // expire cookie if we're on /signup instead of /login
    // since the server will only check if the cookie is set, not its value
    const options = cookieOptions({
      expires: signin ? datePivot(new Date(), { hours: 24 }) : 0,
      maxAge: signin ? 86400 : 0,
      httpOnly: false
    })
    document.cookie = cookie.serialize('signin', signin, options)
  }, [signin])

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
                key={provider.id}
                placement='bottom'
                overlay={multiAuth ? <Tooltip>not available for account switching yet</Tooltip> : <></>}
                trigger={['hover', 'focus']}
              >
                <div className='w-100'>
                  <LoginButton
                    className={`mt-2 ${styles.providerButton}`}
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
