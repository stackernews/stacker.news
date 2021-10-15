import { signIn } from 'next-auth/client'
import Button from 'react-bootstrap/Button'
import styles from './login.module.css'
import GithubIcon from '../svgs/github-fill.svg'
import TwitterIcon from '../svgs/twitter-fill.svg'
import LightningIcon from '../svgs/lightning.svg'
import { Form, Input, SubmitButton } from '../components/form'
import * as Yup from 'yup'
import { useEffect, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import LayoutCenter from '../components/layout-center'
import { useRouter } from 'next/router'
import LnQR, { LnQRSkeleton } from '../components/lnqr'
import { gql, useMutation, useQuery } from '@apollo/client'

export const EmailSchema = Yup.object({
  email: Yup.string().email('email is no good').required('required').trim()
})

export default function Login ({ providers, callbackUrl, error, Header }) {
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
    <LayoutCenter noFooter>
      <div className={styles.login}>
        {Header && <Header />}
        {errorMessage &&
          <Alert variant='danger' onClose={() => setErrorMessage(undefined)} dismissible>{errorMessage}</Alert>}
        {router.query.type === 'lightning'
          ? <LightningAuth callbackUrl={callbackUrl} />
          : (
            <>
              <Button
                className={`mt-2 ${styles.providerButton}`}
                variant='primary'
                onClick={() => router.push({
                  pathname: router.pathname,
                  query: { ...router.query, type: 'lightning' }
                })}
              >
                <LightningIcon
                  className='mr-3'
                />Login with Lightning
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
                    />Login with {provider.name}
                  </Button>
                )
              })}
              <div className='mt-2 text-center text-muted font-weight-bold'>or</div>
              <Form
                initial={{
                  email: ''
                }}
                schema={EmailSchema}
                onSubmit={({ email }) => {
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
                <SubmitButton variant='secondary' className={styles.providerButton}>Login with Email</SubmitButton>
              </Form>
            </>)}
      </div>
    </LayoutCenter>
  )
}

function LnQRAuth ({ k1, encodedUrl, callbackUrl }) {
  const query = gql`
  {
    lnAuth(k1: "${k1}") {
      pubkey
      k1
    }
  }`
  const { error, data } = useQuery(query, { pollInterval: 1000 })
  if (error) return <div>error</div>

  if (data && data.lnAuth.pubkey) {
    signIn('credentials', { ...data.lnAuth, callbackUrl })
  }

  // output pubkey and k1
  return (
    <>
      <small className='mb-2'>
        <a className='text-muted text-underline' href='https://github.com/fiatjaf/awesome-lnurl#wallets' target='_blank' rel='noreferrer' style={{ textDecoration: 'underline' }}>Does my wallet support lnurl-auth?</a>
      </small>
      <LnQR value={encodedUrl} status='waiting for you' />
    </>
  )
}

export function LightningAuth ({ callbackUrl }) {
  // query for challenge
  const [createAuth, { data, error }] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
        encodedUrl
      }
    }`)

  useEffect(createAuth, [])

  if (error) return <div>error</div>

  if (!data) {
    return <LnQRSkeleton status='generating' />
  }

  return <LnQRAuth {...data.createAuth} callbackUrl={callbackUrl} />
}
