import { providers, signIn, getSession, csrfToken } from 'next-auth/client'
import Button from 'react-bootstrap/Button'
import styles from '../styles/login.module.css'
import GithubIcon from '../svgs/github-fill.svg'
import TwitterIcon from '../svgs/twitter-fill.svg'
import LightningIcon from '../svgs/lightning.svg'
import { Input, SubmitButton, SyncForm } from '../components/form'
import * as Yup from 'yup'
import { useEffect, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import LayoutCenter from '../components/layout-center'
import router, { useRouter } from 'next/router'
import LnQR, { LnQRSkeleton } from '../components/lnqr'
import { gql, useMutation, useQuery } from '@apollo/client'

export async function getServerSideProps ({ req, res, query: { callbackUrl, error = null } }) {
  const session = await getSession({ req })

  if (session && res && callbackUrl) {
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

export default function Login ({ providers, csrfToken, error }) {
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
        {errorMessage &&
          <Alert variant='danger' onClose={() => setErrorMessage(undefined)} dismissible>{errorMessage}</Alert>}
        {router.query.type === 'lightning'
          ? <LightningAuth />
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
            </>)}
      </div>
    </LayoutCenter>
  )
}

function LnQRAuth ({ k1, encodedUrl }) {
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
    signIn('credentials', { ...data.lnAuth, callbackUrl: router.query.callbackUrl })
  }

  // output pubkey and k1
  return (
    <>
      <small className='mb-2'>
        <a className='text-muted' href='https://github.com/fiatjaf/awesome-lnurl#wallets' target='_blank' rel='noreferrer'>Does my wallet support lnurl-auth?</a>
      </small>
      <LnQR value={encodedUrl} status='waiting for you' />
    </>
  )
}

export function LightningAuth () {
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

  return <LnQRAuth {...data.createAuth} />
}
