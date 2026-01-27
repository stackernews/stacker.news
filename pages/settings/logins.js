import { Form, Input, SubmitButton, CopyInput } from '@/components/form'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Layout from '@/components/layout'
import { useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import LoginButton from '@/components/login-button'
import { signIn } from 'next-auth/react'
import { LightningAuthWithExplainer } from '@/components/lightning-auth'
import { SETTINGS } from '@/fragments/users'
import { useRouter } from 'next/router'
import Info from '@/components/info'
import Link from 'next/link'
import { emailSchema, lastAuthRemovalSchema } from '@/lib/validate'
import PageLoading from '@/components/page-loading'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { authErrorMessage } from '@/components/login'
import { NostrAuth } from '@/components/nostr-auth'
import { useToast } from '@/components/toast'
import { useMe } from '@/components/me'
import { SettingsHeader, hasOnlyOneAuthMethod } from './index'
import { AuthBanner } from '@/components/banners'

export const getServerSideProps = getGetServerSideProps({ query: SETTINGS, authRequired: true })

// sort to prevent hydration mismatch
const getProviders = (authMethods) =>
  Object.keys(authMethods).filter(k => k !== '__typename' && k !== 'apiKey').sort()

export default function Logins ({ ssrData }) {
  const { me } = useMe()
  const { data } = useQuery(SETTINGS)
  const settings = data?.settings?.privates ?? ssrData?.settings?.privates

  if (!data && !ssrData) return <PageLoading />
  if (!me) return <PageLoading />

  return (
    <Layout>
      <div className='pb-3 w-100 mt-2' style={{ maxWidth: '600px' }}>
        <SettingsHeader />
        {hasOnlyOneAuthMethod(settings?.authMethods) && <AuthBanner />}
        {settings?.authMethods && (
          <AuthMethods methods={settings.authMethods} apiKeyEnabled={settings.apiKeyEnabled} />
        )}
      </div>
    </Layout>
  )
}

function QRLinkButton ({ provider, unlink, status }) {
  const showModal = useShowModal()
  const text = status ? 'Unlink' : 'Link'
  const onClick = status
    ? unlink
    : () => showModal(onClose =>
      <div className='d-flex flex-column align-items-center'>
        <LightningAuthWithExplainer callbackUrl='/settings/logins' backButton={false} md={12} lg={12} />
      </div>)

  return (
    <LoginButton
      key={provider}
      className='d-block mt-2' type={provider} text={text} onClick={onClick}
    />
  )
}

function NostrLinkButton ({ unlink, status }) {
  const showModal = useShowModal()
  const text = status ? 'Unlink' : 'Link'
  const onClick = status
    ? unlink
    : () => showModal(onClose =>
      <div className='d-flex flex-column align-items-center'>
        <NostrAuth text='Link' callbackUrl='/settings/logins' />
      </div>)

  return (
    <LoginButton
      className='d-block mt-2' type='nostr' text={text} onClick={onClick}
    />
  )
}

function UnlinkObstacle ({ onClose, type, unlinkAuth }) {
  const router = useRouter()
  const toaster = useToast()

  return (
    <div className='text-left'>
      <p>
        You are removing your last auth method. It is recommended you link another auth method before removing
        your last auth method. If you'd like to proceed anyway, type the following below
      </p>
      <div className='text-danger fw-bold my-2'>
        If I logout, even accidentally, I will never be able to access my account again
      </div>
      <Form
        className='mt-3'
        initial={{
          warning: ''
        }}
        schema={lastAuthRemovalSchema}
        onSubmit={async () => {
          try {
            await unlinkAuth({ variables: { authType: type } })
            router.push('/settings/logins')
            onClose()
            toaster.success('unlinked auth method')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to unlink auth method')
          }
        }}
      >
        <Input
          name='warning'
          required
        />
        <ObstacleButtons onClose={onClose} confirmText='do it' type='submit' />
      </Form>
    </div>
  )
}

function AuthMethods ({ methods, apiKeyEnabled }) {
  const showModal = useShowModal()
  const router = useRouter()
  const toaster = useToast()
  const [err, setErr] = useState(authErrorMessage(router.query.error))
  const [unlinkAuth] = useMutation(
    gql`
      mutation unlinkAuth($authType: String!) {
        unlinkAuth(authType: $authType) {
          lightning
          email
          twitter
          github
          nostr
        }
      }`, {
      update (cache, { data: { unlinkAuth } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            settings (existing) {
              return {
                ...existing,
                privates: {
                  ...existing.privates,
                  authMethods: { ...unlinkAuth }
                }
              }
            }
          }
        })
      }
    }
  )

  const providers = getProviders(methods)

  const unlink = async type => {
    // if there's only one auth method left
    const links = providers.reduce((t, p) => t + (methods[p] ? 1 : 0), 0)
    if (links === 1) {
      showModal(onClose => <UnlinkObstacle onClose={onClose} type={type} unlinkAuth={unlinkAuth} />)
    } else {
      try {
        await unlinkAuth({ variables: { authType: type } })
        toaster.success('unlinked auth method')
      } catch (err) {
        console.error(err)
        toaster.danger('failed to unlink auth method')
      }
    }
  }

  return (
    <>
      {err && (
        <Alert
          variant='danger' onClose={() => {
            const { pathname, query: { error, nodata, ...rest } } = router
            router.replace({
              pathname,
              query: { nodata, ...rest }
            }, { pathname, query: { ...rest } }, { shallow: true })
            setErr(undefined)
          }} dismissible
        >{err}
        </Alert>
      )}

      {providers?.map(provider => {
        if (provider === 'email') {
          return methods.email
            ? (
              <div key={provider} className='mt-2 d-flex align-items-center'>
                <Button
                  variant='secondary' onClick={
                    async () => {
                      await unlink('email')
                    }
                  }
                >Unlink Email
                </Button>
              </div>
              )
            : <div key={provider} className='mt-2'><EmailLinkForm callbackUrl='/settings/logins' /></div>
        } else if (provider === 'lightning') {
          return (
            <QRLinkButton
              key={provider} provider={provider}
              status={methods[provider]} unlink={async () => await unlink(provider)}
            />
          )
        } else if (provider === 'nostr') {
          return <NostrLinkButton key='nostr' status={methods[provider]} unlink={async () => await unlink(provider)} />
        } else {
          return (
            <LoginButton
              className='mt-2 d-block'
              key={provider}
              type={provider.toLowerCase()}
              onClick={async () => {
                if (methods[provider]) {
                  await unlink(provider)
                } else {
                  signIn(provider)
                }
              }}
              text={methods[provider] ? 'Unlink' : 'Link'}
            />
          )
        }
      })}
      <ApiKey apiKey={methods.apiKey} enabled={apiKeyEnabled} />
    </>
  )
}

export function EmailLinkForm ({ callbackUrl }) {
  const [linkUnverifiedEmail] = useMutation(
    gql`
      mutation linkUnverifiedEmail($email: String!) {
        linkUnverifiedEmail(email: $email)
      }`
  )

  return (
    <Form
      initial={{
        email: ''
      }}
      schema={emailSchema}
      onSubmit={async ({ email }) => {
        // add email to user's account
        // then call signIn
        const { data } = await linkUnverifiedEmail({ variables: { email } })
        if (data.linkUnverifiedEmail) {
          window.sessionStorage.setItem('callback', JSON.stringify({ email, callbackUrl }))
          signIn('email', { email, callbackUrl })
        }
      }}
    >
      <div className='d-flex align-items-center'>
        <Input
          name='email'
          placeholder='email@example.com'
          required
          groupClassName='mb-0'
        />
        <SubmitButton className='ms-2' variant='secondary'>Link Email</SubmitButton>
      </div>
    </Form>
  )
}

function ApiKey ({ enabled, apiKey }) {
  const showModal = useShowModal()
  const { me } = useMe()
  const toaster = useToast()

  const [generateApiKey] = useMutation(
    gql`
      mutation generateApiKey($id: ID!) {
        generateApiKey(id: $id)
      }`,
    {
      update (cache, { data: { generateApiKey } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            settings (existing) {
              return {
                ...existing,
                privates: {
                  ...existing.privates,
                  apiKey: generateApiKey,
                  authMethods: { ...existing.privates.authMethods, apiKey: true }
                }
              }
            }
          }
        })
      }
    }
  )

  // don't show if not enabled and no existing key
  if (!enabled && !apiKey) return null

  const subject = '[API Key Request] <your title here>'
  const body =
  encodeURI(`**[API Key Request]**

Hi, I would like to use API keys with the [Stacker News GraphQL API](/api/graphql) for the following reasons:

...

I expect to call the following GraphQL queries or mutations:

... (you can leave empty if unknown)

I estimate that I will call the GraphQL API this many times (rough estimate is fine):

... (you can leave empty if unknown)
`)
  const metaLink = encodeURI(`/~meta/post?type=discussion&title=${subject}&text=${body}`)
  const mailto = `mailto:hello@stacker.news?subject=${subject}&body=${body}`
  const telegramLink = 'https://t.me/k00bideh'
  const simplexLink = 'https://simplex.chat/contact#/?v=1-2&smp=smp%3A%2F%2F6iIcWT_dF2zN_w5xzZEY7HI2Prbh3ldP07YTyDexPjE%3D%40smp10.simplex.im%2FxNnPk9DkTbQJ6NckWom9mi5vheo_VPLm%23%2F%3Fv%3D1-2%26dh%3DMCowBQYDK2VuAyEAnFUiU0M8jS1JY34LxUoPr7mdJlFZwf3pFkjRrhprdQs%253D%26srv%3Drb2pbttocvnbrngnwziclp2f4ckjq65kebafws6g4hy22cdaiv5dwjqd.onion'

  return (
    <>
      <div className='form-label mt-4'>api key</div>
      <div className='mt-2 d-flex align-items-center'>
        <Button
          variant={apiKey ? 'danger' : 'secondary'}
          onClick={async () => {
            if (apiKey) {
              showModal(onClose => <ApiKeyDeleteObstacle onClose={onClose} />)
              return
            }

            try {
              const { data } = await generateApiKey({ variables: { id: me.id } })
              const { generateApiKey: apiKey } = data
              showModal(() => <ApiKeyModal apiKey={apiKey} />, { keepOpen: true })
            } catch (err) {
              console.error(err)
              toaster.danger('error generating api key')
            }
          }}
        >{apiKey ? 'Delete' : 'Generate'} API key
        </Button>
        {!enabled && (
          <Info>
            <ul>
              <li>use API keys with our <Link target='_blank' href='/api/graphql'>GraphQL API</Link> for authentication</li>
              <li>you need to add the API key to the <span className='text-monospace'>X-API-Key</span> header of your requests</li>
              <li>you can currently only generate API keys if we enabled it for your account</li>
              <li>
                you can{' '}
                <Link target='_blank' href={metaLink} rel='noreferrer'>create a post in ~meta</Link> to request access
                or reach out to us via
                <ul>
                  <li><Link target='_blank' href={mailto} rel='noreferrer'>email</Link></li>
                  <li><Link target='_blank' href={telegramLink} rel='noreferrer'>Telegram</Link></li>
                  <li><Link target='_blank' href={simplexLink} rel='noreferrer'>SimpleX</Link></li>
                </ul>
              </li>
              <li>please include following information in your request:
                <ul>
                  <li>your nym on SN</li>
                  <li>what you want to achieve with authenticated API access</li>
                  <li>which GraphQL queries or mutations you expect to call</li>
                  <li>your (rough) estimate how often you will call the GraphQL API</li>
                </ul>
              </li>
            </ul>
          </Info>
        )}
      </div>
    </>
  )
}

function ApiKeyModal ({ apiKey }) {
  return (
    <>
      <p className='fw-bold'>
        Make sure to copy your API key now.<br />
        This is the only time we will show it to you.
      </p>
      <CopyInput readOnly noForm placeholder={apiKey} hint={<>use the <span className='text-monospace'>X-API-Key</span> header to include this key in your requests</>} />
    </>
  )
}

function ApiKeyDeleteObstacle ({ onClose }) {
  const { me } = useMe()
  const toaster = useToast()
  const [deleteApiKey] = useMutation(
    gql`
      mutation deleteApiKey($id: ID!) {
        deleteApiKey(id: $id) {
          id
        }
      }`,
    {
      update (cache, { data: { deleteApiKey } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            settings (existing) {
              return {
                ...existing,
                privates: {
                  ...existing.privates,
                  authMethods: { ...existing.privates.authMethods, apiKey: false }
                }
              }
            }
          }
        })
      }
    }
  )

  const handleConfirm = async () => {
    try {
      await deleteApiKey({ variables: { id: me.id } })
      onClose()
    } catch (err) {
      console.error(err)
      toaster.danger('error deleting api key')
    }
  }

  return (
    <div className='text-center'>
      <p className='fw-bold'>
        Do you really want to delete your API key?
      </p>
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='do it' />
    </div>
  )
}
