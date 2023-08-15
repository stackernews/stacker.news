import { Checkbox, Form, Input, SubmitButton, Select, VariableInput } from '../components/form'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import { CenterLayout } from '../components/layout'
import { useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '../api/ssrApollo'
import LoginButton from '../components/login-button'
import { signIn } from 'next-auth/react'
import { LightningAuth, SlashtagsAuth } from '../components/lightning-auth'
import { SETTINGS, SET_SETTINGS } from '../fragments/users'
import { useRouter } from 'next/router'
import Info from '../components/info'
import Link from 'next/link'
import AccordianItem from '../components/accordian-item'
import { bech32 } from 'bech32'
import { NOSTR_MAX_RELAY_NUM, NOSTR_PUBKEY_BECH32 } from '../lib/nostr'
import { emailSchema, lastAuthRemovalSchema, settingsSchema } from '../lib/validate'
import { SUPPORTED_CURRENCIES } from '../lib/currency'
import PageLoading from '../components/page-loading'
import { useShowModal } from '../components/modal'
import { authErrorMessage } from '../components/login'
import { NostrAuth } from '../components/nostr-auth'

export const getServerSideProps = getGetServerSideProps(SETTINGS)

function bech32encode (hexString) {
  return bech32.encode('npub', bech32.toWords(Buffer.from(hexString, 'hex')))
}

export default function Settings ({ ssrData }) {
  const [success, setSuccess] = useState()
  const [setSettings] = useMutation(SET_SETTINGS, {
    update (cache, { data: { setSettings } }) {
      cache.modify({
        id: 'ROOT_QUERY',
        fields: {
          settings () {
            return setSettings
          }
        }
      })
    }
  }
  )

  const { data } = useQuery(SETTINGS)
  const { settings } = data || ssrData
  if (!data && !ssrData) return <PageLoading />

  return (
    <CenterLayout>
      <div className='py-3 w-100'>
        <h2 className='mb-2 text-start'>settings</h2>
        <Form
          initial={{
            tipDefault: settings?.tipDefault || 21,
            turboTipping: settings?.turboTipping,
            fiatCurrency: settings?.fiatCurrency || 'USD',
            noteItemSats: settings?.noteItemSats,
            noteEarning: settings?.noteEarning,
            noteAllDescendants: settings?.noteAllDescendants,
            noteMentions: settings?.noteMentions,
            noteDeposits: settings?.noteDeposits,
            noteInvites: settings?.noteInvites,
            noteJobIndicator: settings?.noteJobIndicator,
            noteCowboyHat: settings?.noteCowboyHat,
            hideInvoiceDesc: settings?.hideInvoiceDesc,
            hideFromTopUsers: settings?.hideFromTopUsers,
            hideCowboyHat: settings?.hideCowboyHat,
            clickToLoadImg: settings?.clickToLoadImg,
            wildWestMode: settings?.wildWestMode,
            greeterMode: settings?.greeterMode,
            nostrPubkey: settings?.nostrPubkey ? bech32encode(settings.nostrPubkey) : '',
            nostrRelays: settings?.nostrRelays?.length ? settings?.nostrRelays : ['']
          }}
          schema={settingsSchema}
          onSubmit={async ({ tipDefault, nostrPubkey, nostrRelays, ...values }) => {
            if (nostrPubkey.length === 0) {
              nostrPubkey = null
            } else {
              if (NOSTR_PUBKEY_BECH32.test(nostrPubkey)) {
                const { words } = bech32.decode(nostrPubkey)
                nostrPubkey = Buffer.from(bech32.fromWords(words)).toString('hex')
              }
            }

            const nostrRelaysFiltered = nostrRelays?.filter(word => word.trim().length > 0)

            await setSettings({
              variables: {
                tipDefault: Number(tipDefault),
                nostrPubkey,
                nostrRelays: nostrRelaysFiltered,
                ...values
              }
            })
            setSuccess('settings saved')
          }}
        >
          {success && <Alert variant='info' onClose={() => setSuccess(undefined)} dismissible>{success}</Alert>}
          <Input
            label='zap default'
            name='tipDefault'
            groupClassName='mb-0'
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            hint={<small className='text-muted'>note: you can also press and hold the lightning bolt to zap custom amounts</small>}
          />
          <div className='mb-2'>
            <AccordianItem
              show={settings?.turboTipping}
              header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>advanced</div>}
              body={<Checkbox
                name='turboTipping'
                label={
                  <div className='d-flex align-items-center'>turbo zapping
                    <Info>
                      <ul className='fw-bold'>
                        <li>Makes every additional bolt click raise your total zap to another 10x multiple of your default zap</li>
                        <li>e.g. if your zap default is 10 sats
                          <ul>
                            <li>1st click: 10 sats total zapped</li>
                            <li>2nd click: 100 sats total zapped</li>
                            <li>3rd click: 1000 sats total zapped</li>
                            <li>4th click: 10000 sats total zapped</li>
                            <li>and so on ...</li>
                          </ul>
                        </li>
                        <li>You can still custom zap via long press
                          <ul>
                            <li>the next bolt click rounds up to the next greatest 10x multiple of your default</li>
                          </ul>
                        </li>
                      </ul>
                    </Info>
                  </div>
                  }
                    />}
            />
          </div>
          <Select
            label='fiat currency'
            name='fiatCurrency'
            size='sm'
            items={SUPPORTED_CURRENCIES}
            required
          />
          <div className='form-label'>notify me when ...</div>
          <Checkbox
            label='I stack sats from posts and comments'
            name='noteItemSats'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I get a daily airdrop'
            name='noteEarning'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone replies to someone who replied to me'
            name='noteAllDescendants'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone joins using my invite or referral links'
            name='noteInvites'
            groupClassName='mb-0'
          />
          <Checkbox
            label='sats are deposited in my account'
            name='noteDeposits'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone mentions me'
            name='noteMentions'
            groupClassName='mb-0'
          />
          <Checkbox
            label='there is a new job'
            name='noteJobIndicator'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I find or lose a cowboy hat'
            name='noteCowboyHat'
          />
          <div className='form-label'>privacy</div>
          <Checkbox
            label={
              <div className='d-flex align-items-center'>hide invoice descriptions
                <Info>
                  <ul className='fw-bold'>
                    <li>Use this if you don't want funding sources to be linkable to your SN identity.</li>
                    <li>It makes your invoice descriptions blank.</li>
                    <li>This only applies to invoices you create
                      <ul>
                        <li>lnurl-pay and lightning addresses still reference your nym</li>
                      </ul>
                    </li>
                  </ul>
                </Info>
              </div>
            }
            name='hideInvoiceDesc'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide me from  <Link href='/top/stackers/day'>top stackers</Link></>}
            name='hideFromTopUsers'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide my cowboy hat</>}
            name='hideCowboyHat'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>click to load external images</>}
            name='clickToLoadImg'
          />
          <div className='form-label'>content</div>
          <Checkbox
            label={
              <div className='d-flex align-items-center'>wild west mode
                <Info>
                  <ul className='fw-bold'>
                    <li>don't hide flagged content</li>
                    <li>don't down rank flagged content</li>
                  </ul>
                </Info>
              </div>
            }
            name='wildWestMode'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>greeter mode
                <Info>
                  <ul className='fw-bold'>
                    <li>see and screen free posts and comments</li>
                    <li>help onboard new stackers to SN and Lightning</li>
                    <li>you might be subject to more spam</li>
                  </ul>
                </Info>
              </div>
            }
            name='greeterMode'
          />
          <AccordianItem
            headerColor='var(--bs-body-color)'
            show={settings?.nostrPubkey}
            header={<h4 className='text-start'>nostr <small><a href='https://github.com/nostr-protocol/nips/blob/master/05.md' target='_blank' rel='noreferrer'>NIP-05</a></small></h4>}
            body={
              <>
                <Input
                  label={<>pubkey <small className='text-muted ms-2'>optional</small></>}
                  name='nostrPubkey'
                  clear
                />
                <VariableInput
                  label={<>relays <small className='text-muted ms-2'>optional</small></>}
                  name='nostrRelays'
                  clear
                  min={0}
                  max={NOSTR_MAX_RELAY_NUM}
                />
              </>
              }
          />
          <div className='d-flex'>
            <SubmitButton variant='info' className='ms-auto mt-1 px-4'>save</SubmitButton>
          </div>
        </Form>
        <div className='text-start w-100'>
          <div className='form-label'>saturday newsletter</div>
          <Button href='https://mail.stacker.news/subscription/form' target='_blank'>(re)subscribe</Button>
          {settings?.authMethods && <AuthMethods methods={settings.authMethods} />}
        </div>
      </div>
    </CenterLayout>
  )
}

function QRLinkButton ({ provider, unlink, status }) {
  const showModal = useShowModal()
  const text = status ? 'Unlink' : 'Link'
  const onClick = status
    ? unlink
    : () => showModal(onClose =>
      <div className='d-flex flex-column align-items-center'>
        {provider === 'slashtags' ? <SlashtagsAuth /> : <LightningAuth />}
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
        <NostrAuth text='Unlink' />
      </div>)

  return (
    <LoginButton
      className='d-block mt-2' type='nostr' text={text} onClick={onClick}
    />
  )
}

function UnlinkObstacle ({ onClose, type, unlinkAuth }) {
  const router = useRouter()

  return (
    <div>
      You are removing your last auth method. It is recommended you link another auth method before removing
      your last auth method. If you'd like to proceed anyway, type the following below
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
          await unlinkAuth({ variables: { authType: type } })
          router.push('/settings')
          onClose()
        }}
      >
        <Input
          name='warning'
          required
        />
        <SubmitButton className='d-flex ms-auto' variant='danger'>do it</SubmitButton>
      </Form>
    </div>
  )
}

function AuthMethods ({ methods }) {
  const showModal = useShowModal()
  const router = useRouter()
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
              return { ...existing, authMethods: { ...unlinkAuth } }
            }
          }
        })
      }
    }
  )

  // sort to prevent hydration mismatch
  const providers = Object.keys(methods).filter(k => k !== '__typename').sort()

  const unlink = async type => {
    // if there's only one auth method left
    const links = providers.reduce((t, p) => t + (methods[p] ? 1 : 0), 0)
    if (links === 1) {
      showModal(onClose => (<UnlinkObstacle onClose={onClose} type={type} unlinkAuth={unlinkAuth} />))
    } else {
      await unlinkAuth({ variables: { authType: type } })
    }
  }

  return (
    <>
      <div className='form-label mt-3'>auth methods</div>
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
                <Input
                  name='email'
                  placeholder={methods.email}
                  groupClassName='mb-0'
                  readOnly
                  noForm
                />
                <Button
                  className='ms-2' variant='secondary' onClick={
                    async () => {
                      await unlink('email')
                    }
                  }
                >Unlink Email
                </Button>
              </div>
              )
            : <div key={provider} className='mt-2'><EmailLinkForm /></div>
        } else if (provider === 'lightning' || provider === 'slashtags') {
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
