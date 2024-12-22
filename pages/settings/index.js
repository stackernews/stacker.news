import { Checkbox, Form, Input, SubmitButton, Select, VariableInput, CopyInput } from '@/components/form'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import Nav from 'react-bootstrap/Nav'
import Layout from '@/components/layout'
import { useState, useMemo } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import LoginButton from '@/components/login-button'
import { signIn } from 'next-auth/react'
import { LightningAuth } from '@/components/lightning-auth'
import { SETTINGS, SET_SETTINGS } from '@/fragments/users'
import { useRouter } from 'next/router'
import Info from '@/components/info'
import Link from 'next/link'
import AccordianItem from '@/components/accordian-item'
import { bech32 } from 'bech32'
import { NOSTR_MAX_RELAY_NUM, NOSTR_PUBKEY_BECH32, DEFAULT_CROSSPOSTING_RELAYS } from '@/lib/nostr'
import { emailSchema, lastAuthRemovalSchema, settingsSchema } from '@/lib/validate'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import PageLoading from '@/components/page-loading'
import { useShowModal } from '@/components/modal'
import { authErrorMessage } from '@/components/login'
import { NostrAuth } from '@/components/nostr-auth'
import { useToast } from '@/components/toast'
import { useServiceWorkerLogger } from '@/components/logger'
import { useMe } from '@/components/me'
import { INVOICE_RETENTION_DAYS, ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useField } from 'formik'
import styles from './settings.module.css'
import { AuthBanner } from '@/components/banners'

export const getServerSideProps = getGetServerSideProps({ query: SETTINGS, authRequired: true })

function bech32encode (hexString) {
  return bech32.encode('npub', bech32.toWords(Buffer.from(hexString, 'hex')))
}

// sort to prevent hydration mismatch
const getProviders = (authMethods) =>
  Object.keys(authMethods).filter(k => k !== '__typename' && k !== 'apiKey').sort()

// Show alert message if user only has one auth method activated
// as users are losing access to their accounts
const hasOnlyOneAuthMethod = (authMethods) => {
  const activatedAuths = getProviders(authMethods)
    .filter(provider => !!authMethods[provider])

  return activatedAuths.length === 1
}

export function SettingsHeader () {
  const router = useRouter()
  const pathParts = router.asPath.split('/').filter(segment => !!segment)
  const activeKey = pathParts[1] ?? 'general'
  return (
    <>
      <h2 className='mb-2 text-start'>settings</h2>
      <Nav
        className={styles.nav}
        activeKey={activeKey}
      >
        <Nav.Item>
          <Link href='/settings' passHref legacyBehavior>
            <Nav.Link eventKey='general'>general</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/settings/subscriptions' passHref legacyBehavior>
            <Nav.Link eventKey='subscriptions'>subscriptions</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/settings/mutes' passHref legacyBehavior>
            <Nav.Link eventKey='mutes'>muted stackers</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/settings/passphrase' passHref legacyBehavior>
            <Nav.Link eventKey='passphrase'>device sync</Nav.Link>
          </Link>
        </Nav.Item>
      </Nav>
    </>
  )
}

export default function Settings ({ ssrData }) {
  const toaster = useToast()
  const { me } = useMe()
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
  })
  const logger = useServiceWorkerLogger()

  const { data } = useQuery(SETTINGS)
  const { settings: { privates: settings } } = useMemo(() => data ?? ssrData, [data, ssrData])

  // if we switched to anon, me is null before the page is reloaded
  if ((!data && !ssrData) || !me) return <PageLoading />

  return (
    <Layout>
      <div className='pb-3 w-100 mt-2' style={{ maxWidth: '600px' }}>
        <SettingsHeader />
        {hasOnlyOneAuthMethod(settings?.authMethods) && <AuthBanner />}
        <Form
          enableReinitialize
          initial={{
            tipDefault: settings?.tipDefault || 21,
            tipRandom: settings?.tipRandom,
            tipRandomMin: settings?.tipRandomMin || 1,
            tipRandomMax: settings?.tipRandomMax || 10,
            turboTipping: settings?.turboTipping,
            disableFreebies: settings?.disableFreebies || undefined,
            zapUndos: settings?.zapUndos || (settings?.tipDefault ? 100 * settings.tipDefault : 2100),
            zapUndosEnabled: settings?.zapUndos !== null,
            fiatCurrency: settings?.fiatCurrency || 'USD',
            withdrawMaxFeeDefault: settings?.withdrawMaxFeeDefault,
            noteItemSats: settings?.noteItemSats,
            noteEarning: settings?.noteEarning,
            noteAllDescendants: settings?.noteAllDescendants,
            noteMentions: settings?.noteMentions,
            noteItemMentions: settings?.noteItemMentions,
            noteDeposits: settings?.noteDeposits,
            noteWithdrawals: settings?.noteWithdrawals,
            noteInvites: settings?.noteInvites,
            noteJobIndicator: settings?.noteJobIndicator,
            noteCowboyHat: settings?.noteCowboyHat,
            noteForwardedSats: settings?.noteForwardedSats,
            hideInvoiceDesc: settings?.hideInvoiceDesc,
            autoDropBolt11s: settings?.autoDropBolt11s,
            hideFromTopUsers: settings?.hideFromTopUsers,
            hideCowboyHat: settings?.hideCowboyHat,
            hideGithub: settings?.hideGithub,
            hideNostr: settings?.hideNostr,
            hideTwitter: settings?.hideTwitter,
            imgproxyOnly: settings?.imgproxyOnly,
            showImagesAndVideos: settings?.showImagesAndVideos,
            wildWestMode: settings?.wildWestMode,
            satsFilter: settings?.satsFilter,
            nsfwMode: settings?.nsfwMode,
            nostrPubkey: settings?.nostrPubkey ? bech32encode(settings.nostrPubkey) : '',
            nostrCrossposting: settings?.nostrCrossposting,
            nostrRelays: settings?.nostrRelays?.length ? settings?.nostrRelays : [''],
            hideBookmarks: settings?.hideBookmarks,
            hideWalletBalance: settings?.hideWalletBalance,
            diagnostics: settings?.diagnostics,
            hideIsContributor: settings?.hideIsContributor,
            noReferralLinks: settings?.noReferralLinks,
            proxyReceive: settings?.proxyReceive,
            directReceive: settings?.directReceive,
            receiveCreditsBelowSats: settings?.receiveCreditsBelowSats,
            sendCreditsBelowSats: settings?.sendCreditsBelowSats
          }}
          schema={settingsSchema}
          onSubmit={async ({
            tipDefault, tipRandom, tipRandomMin, tipRandomMax, withdrawMaxFeeDefault,
            zapUndos, zapUndosEnabled, nostrPubkey, nostrRelays, satsFilter,
            receiveCreditsBelowSats, sendCreditsBelowSats,
            ...values
          }) => {
            if (nostrPubkey.length === 0) {
              nostrPubkey = null
            } else {
              if (NOSTR_PUBKEY_BECH32.test(nostrPubkey)) {
                const { words } = bech32.decode(nostrPubkey)
                nostrPubkey = Buffer.from(bech32.fromWords(words)).toString('hex')
              }
            }

            const nostrRelaysFiltered = nostrRelays
              ?.filter(word => word.trim().length > 0)
              .map(relay => relay.startsWith('wss://') ? relay : `wss://${relay}`)

            try {
              await setSettings({
                variables: {
                  settings: {
                    tipDefault: Number(tipDefault),
                    tipRandomMin: tipRandom ? Number(tipRandomMin) : null,
                    tipRandomMax: tipRandom ? Number(tipRandomMax) : null,
                    withdrawMaxFeeDefault: Number(withdrawMaxFeeDefault),
                    satsFilter: Number(satsFilter),
                    zapUndos: zapUndosEnabled ? Number(zapUndos) : null,
                    receiveCreditsBelowSats: Number(receiveCreditsBelowSats),
                    sendCreditsBelowSats: Number(sendCreditsBelowSats),
                    nostrPubkey,
                    nostrRelays: nostrRelaysFiltered,
                    ...values
                  }
                }
              })
              toaster.success('saved settings')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to save settings')
            }
          }}
        >
          <Input
            label='zap default'
            name='tipDefault'
            groupClassName='mb-0'
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            hint={<small className='text-muted'>note: you can also press and hold the lightning bolt to zap custom amounts</small>}
          />
          <div className='pb-4'>
            <AccordianItem
              show={settings?.turboTipping}
              header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>advanced</div>}
              body={
                <>
                  <Checkbox
                    name='turboTipping'
                    label={
                      <div className='d-flex align-items-center'>turbo zapping
                        <Info>
                          <ul>
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
                    groupClassName='mb-0'
                  />
                  <ZapUndosField />
                  <TipRandomField />
                </>
              }
            />
          </div>
          <Select
            label='fiat currency'
            name='fiatCurrency'
            size='sm'
            items={SUPPORTED_CURRENCIES}
            required
          />
          <Input
            label='default max fee for withdrawals'
            name='withdrawMaxFeeDefault'
            required
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>disable freebies
                <Info>
                  <p>Some comments can be created without paying. However, those comments have limited visibility.</p>

                  <p>If you disable freebies, you will always pay for your comments and get standard visibility.</p>

                  <p>If you attach a sending wallet, we disable freebies for you unless you have checked/unchecked this value already.</p>
                </Info>
              </div>
            }
            name='disableFreebies'
          />
          <div className='form-label'>notify me when ...</div>
          <Checkbox
            label='I stack sats from posts and comments'
            name='noteItemSats'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I get forwarded sats from a post'
            name='noteForwardedSats'
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
            label='sats are withdrawn from my account'
            name='noteWithdrawals'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone mentions me'
            name='noteMentions'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone mentions one of my items'
            name='noteItemMentions'
            groupClassName='mb-0'
          />
          <Checkbox
            label='there is a new job'
            name='noteJobIndicator'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I find or lose cowboy essentials (e.g. cowboy hat)'
            name='noteCowboyHat'
          />
          <div className='form-label'>wallet</div>
          <Input
            label='receive credits for zaps and deposits below'
            name='receiveCreditsBelowSats'
            required
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <Input
            label='send credits for zaps below'
            name='sendCreditsBelowSats'
            required
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>proxy deposits to attached wallets
                <Info>
                  <ul>
                    <li>Forward deposits directly to your attached wallets if they cause your balance to exceed your auto-withdraw threshold</li>
                    <li>Payments will be wrapped by the SN node to preserve your wallet's privacy</li>
                    <li>This will incur in a 10% fee</li>
                  </ul>
                </Info>
              </div>
            }
            name='proxyReceive'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>directly deposit to attached wallets
                <Info>
                  <ul>
                    <li>Directly deposit to your attached wallets if they cause your balance to exceed your auto-withdraw threshold</li>
                    <li>Senders will be able to see your wallet's lightning node public key</li>
                    <li>If 'proxy deposits' is also checked, it will take precedence and direct deposits will only be used as a fallback</li>
                    <li>Because we can't determine if a payment succeeds, you won't be notified about direct deposits</li>
                  </ul>
                </Info>
              </div>
            }
            name='directReceive'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>hide invoice descriptions
                <Info>
                  <ul>
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
          <DropBolt11sCheckbox
            groupClassName='mb-0'
            ssrData={ssrData}
            label={
              <div className='d-flex align-items-center'>autodelete withdrawal invoices
                <Info>
                  <ul>
                    <li>use this to protect receiver privacy</li>
                    <li>applies retroactively, cannot be reversed</li>
                    <li>withdrawal invoices are kept at least {INVOICE_RETENTION_DAYS} days for security and debugging purposes</li>
                    <li>autodeletions are run on a daily basis at night</li>
                  </ul>
                </Info>
              </div>
            }
            name='autoDropBolt11s'
          />
          <Checkbox
            label={<>hide my wallet balance</>}
            name='hideWalletBalance'
          />
          <div className='form-label'>privacy</div>
          <Checkbox
            label={<>hide me from  <Link href='/top/stackers/day'>top stackers</Link></>}
            name='hideFromTopUsers'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide my cowboy essentials (e.g. cowboy hat)</>}
            name='hideCowboyHat'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide my bookmarks from other stackers</>}
            name='hideBookmarks'
            groupClassName='mb-0'
          />
          <Checkbox
            disabled={!settings?.authMethods?.github}
            label={
              <div className='d-flex align-items-center'>hide my linked github profile
                <Info>
                  <ul>
                    <li>Linked accounts are hidden from your profile by default</li>
                    <li>uncheck this to display your github on your profile</li>
                    {!settings?.authMethods?.github &&
                      <div className='my-2'>
                        <li><i>You don't seem to have a linked github account</i></li>
                        <ul><li>If this is wrong, try unlinking/relinking</li></ul>
                      </div>}
                  </ul>
                </Info>
              </div>
            }
            name='hideGithub'
            groupClassName='mb-0'
          />
          <Checkbox
            disabled={!settings?.authMethods?.nostr}
            label={
              <div className='d-flex align-items-center'>hide my linked nostr profile
                <Info>
                  <ul>
                    <li>Linked accounts are hidden from your profile by default</li>
                    <li>Uncheck this to display your npub on your profile</li>
                    {!settings?.authMethods?.nostr &&
                      <div className='my-2'>
                        <li>You don't seem to have a linked nostr account</li>
                        <ul><li>If this is wrong, try unlinking/relinking</li></ul>
                      </div>}
                  </ul>
                </Info>
              </div>
            }
            name='hideNostr'
            groupClassName='mb-0'
          />
          <Checkbox
            disabled={!settings?.authMethods?.twitter}
            label={
              <div className='d-flex align-items-center'>hide my linked twitter profile
                <Info>
                  <ul>
                    <li>Linked accounts are hidden from your profile by default</li>
                    <li>Uncheck this to display your twitter on your profile</li>
                    {!settings?.authMethods?.twitter &&
                      <div className='my-2'>
                        <i>You don't seem to have a linked twitter account</i>
                        <ul><li>If this is wrong, try unlinking/relinking</li></ul>
                      </div>}
                  </ul>
                </Info>
              </div>
            }
            name='hideTwitter'
            groupClassName='mb-0'
          />
          {me.optional?.isContributor &&
            <Checkbox
              label={<>hide that I'm a stacker.news contributor</>}
              name='hideIsContributor'
              groupClassName='mb-0'
            />}
          <Checkbox
            label={
              <div className='d-flex align-items-center'>do not load images, videos, or content from external sites
                <Info>
                  <ul>
                    <li>only load images and videos when we can proxy them</li>
                    <li>this prevents IP address leaks to arbitrary sites</li>
                    <li>if we can't, the raw link will be shown instead</li>
                  </ul>
                </Info>
              </div>
            }
            name='imgproxyOnly'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>allow anonymous diagnostics
                <Info>
                  <ul>
                    <li>collect and send back anonymous diagnostics data</li>
                    <li>this information is used to fix bugs</li>
                    <li>this information includes:
                      <ul><li>timestamps</li></ul>
                      <ul><li>a randomly generated fancy name</li></ul>
                      <ul><li>your user agent</li></ul>
                      <ul><li>your operating system</li></ul>
                    </li>
                    <li>this information can not be traced back to you without your fancy name</li>
                    <li>fancy names are generated in your browser</li>
                  </ul>
                  <div className='text-muted fst-italic'>your fancy name: {logger.name}</div>
                </Info>
              </div>
            }
            name='diagnostics'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>don't create referral links on copy</>}
            name='noReferralLinks'
          />
          <h4>content</h4>
          <Input
            label={
              <div className='d-flex align-items-center'>filter by sats
                <Info>
                  <ul>
                    <li>hide the post if the sum of these is less than your setting:</li>
                    <ul>
                      <li>posting cost</li>
                      <li>total sats from zaps</li>
                      <li>boost</li>
                    </ul>
                    <li>set to zero to be a greeter, with the tradeoff of seeing more spam</li>
                  </ul>
                </Info>
              </div>
            }
            name='satsFilter'
            required
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>show images, video, and 3rd party embeds
                <Info>
                  <ul>
                    <li>if checked and a link is an image, video or can be embedded in another way, we will do it</li>
                    <li>we support embeds from following sites:</li>
                    <ul>
                      <li>njump.me</li>
                      <li>youtube.com</li>
                      <li>twitter.com</li>
                      <li>spotify.com</li>
                      <li>rumble.com</li>
                      <li>wavlake.com</li>
                      <li>bitcointv.com</li>
                      <li>peertube.tv</li>
                    </ul>
                  </ul>
                </Info>
              </div>
            }
            name='showImagesAndVideos'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>wild west mode
                <Info>
                  <ul>
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
              <div className='d-flex align-items-center'>nsfw mode
                <Info>
                  <ul>
                    <li>see posts from nsfw territories</li>
                  </ul>
                </Info>
              </div>
            }
            name='nsfwMode'
          />
          <h4>nostr</h4>
          <Checkbox
            label={
              <div className='d-flex align-items-center'>crosspost to nostr
                <Info>
                  <ul>
                    <li>crosspost your items to nostr</li>
                    <li>requires NIP-07 extension for signing</li>
                    <li>we use your NIP-05 relays if set</li>
                    <li>we use these relays by default:</li>
                    <ul>
                      {DEFAULT_CROSSPOSTING_RELAYS.map((relay, i) => (
                        <li key={i}>{relay}</li>
                      ))}
                    </ul>
                  </ul>
                </Info>
              </div>
            }
            name='nostrCrossposting'
          />
          <Input
            label={<>pubkey <small className='text-muted ms-2'>optional</small></>}
            name='nostrPubkey'
            clear
            hint={<small className='text-muted'>used for NIP-05</small>}
          />
          <VariableInput
            label={<>relays <small className='text-muted ms-2'>optional</small></>}
            name='nostrRelays'
            clear
            min={0}
            max={NOSTR_MAX_RELAY_NUM}
            hint={<small className='text-muted'>used for NIP-05 and crossposting</small>}
          />
          <div className='d-flex'>
            <SubmitButton variant='info' className='ms-auto mt-1 px-4'>save</SubmitButton>
          </div>
        </Form>
        <div className='text-start w-100'>
          <div className='form-label'>saturday newsletter</div>
          <Button href='https://mail.stacker.news/subscription/form' target='_blank'>(re)subscribe</Button>
          {settings?.authMethods && <AuthMethods methods={settings.authMethods} apiKeyEnabled={settings.apiKeyEnabled} />}
        </div>
      </div>
    </Layout>
  )
}

const DropBolt11sCheckbox = ({ ssrData, ...props }) => {
  const showModal = useShowModal()
  const { data } = useQuery(gql`{ numBolt11s }`)
  const { numBolt11s } = data || ssrData

  return (
    <Checkbox
      onClick={e => {
        if (e.target.checked) {
          showModal(onClose => {
            return (
              <>
                <p className='fw-bolder'>{numBolt11s} withdrawal invoices will be deleted with this setting.</p>
                <p className='fw-bolder'>You sure? This is a gone forever kind of delete.</p>
                <div className='d-flex justify-content-end'>
                  <Button
                    variant='danger' onClick={async () => {
                      await onClose()
                    }}
                  >I am sure
                  </Button>
                </div>
              </>
            )
          })
        }
      }}
      {...props}
    />
  )
}

function QRLinkButton ({ provider, unlink, status }) {
  const showModal = useShowModal()
  const text = status ? 'Unlink' : 'Link'
  const onClick = status
    ? unlink
    : () => showModal(onClose =>
      <div className='d-flex flex-column align-items-center'>
        <LightningAuth />
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
  const toaster = useToast()

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
          try {
            await unlinkAuth({ variables: { authType: type } })
            router.push('/settings')
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
        <SubmitButton className='d-flex ms-auto' variant='danger'>do it</SubmitButton>
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
      showModal(onClose => (<UnlinkObstacle onClose={onClose} type={type} unlinkAuth={unlinkAuth} />))
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
            : <div key={provider} className='mt-2'><EmailLinkForm /></div>
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
  const toaster = useToast()

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
  // link to DM with k00b on Telegram
  const telegramLink = 'https://t.me/k00bideh'
  // link to DM with ek on SimpleX
  const simplexLink = 'https://simplex.chat/contact#/?v=1-2&smp=smp%3A%2F%2F6iIcWT_dF2zN_w5xzZEY7HI2Prbh3ldP07YTyDexPjE%3D%40smp10.simplex.im%2FxNnPk9DkTbQJ6NckWom9mi5vheo_VPLm%23%2F%3Fv%3D1-2%26dh%3DMCowBQYDK2VuAyEAnFUiU0M8jS1JY34LxUoPr7mdJlFZwf3pFkjRrhprdQs%253D%26srv%3Drb2pbttocvnbrngnwziclp2f4ckjq65kebafws6g4hy22cdaiv5dwjqd.onion'

  return (
    <>
      <div className='form-label mt-3'>api key</div>
      <div className='mt-2 d-flex align-items-center'>
        <OverlayTrigger
          placement='bottom'
          overlay={!enabled ? <Tooltip>{apiKey ? 'you can have only one API key at a time' : 'request access to API keys in ~meta'}</Tooltip> : <></>}
          trigger={['hover', 'focus']}
        >
          <div>
            <Button
              disabled={!enabled}
              variant={apiKey ? 'danger' : 'secondary'}
              onClick={async () => {
                if (apiKey) {
                  showModal((onClose) => <ApiKeyDeleteObstacle onClose={onClose} />)
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
          </div>
        </OverlayTrigger>
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
  const toaster = useToast()

  return (
    <div className='m-auto' style={{ maxWidth: 'fit-content' }}>
      <p className='fw-bold'>
        Do you really want to delete your API key?
      </p>
      <div className='d-flex flex-row justify-content-end'>
        <Button
          variant='danger' onClick={async () => {
            try {
              await deleteApiKey({ variables: { id: me.id } })
              onClose()
            } catch (err) {
              console.error(err)
              toaster.danger('error deleting api key')
            }
          }}
        >do it
        </Button>
      </div>
    </div>
  )
}

const ZapUndosField = () => {
  const [checkboxField] = useField({ name: 'zapUndosEnabled' })
  return (
    <>
      <Checkbox
        name='zapUndosEnabled'
        groupClassName='mb-0'
        label={
          <div className='d-flex align-items-center'>
            zap undos
            <Info>
              <ul>
                <li>After every zap that exceeds or is equal to the threshold, the bolt will pulse</li>
                <li>You can undo the zap if you click the bolt while it's pulsing</li>
                <li>The bolt will pulse for {ZAP_UNDO_DELAY_MS / 1000} seconds</li>
              </ul>
            </Info>
          </div>
          }
      />
      {checkboxField.value &&
        <Input
          name='zapUndos'
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          hint={<small className='text-muted'>threshold at which undos will be possible</small>}
          groupClassName='mt-1'
        />}
    </>
  )
}

const TipRandomField = () => {
  const [tipRandomField] = useField({ name: 'tipRandom' })
  const [tipRandomMinField] = useField({ name: 'tipRandomMin' })
  const [tipRandomMaxField] = useField({ name: 'tipRandomMax' })
  return (
    <>
      <Checkbox
        name='tipRandom'
        groupClassName='mb-0'
        label={
          <div className='d-flex align-items-center'>
            random zaps
            <Info>
              <ul>
                <li>Set a minimum and maximum zap amount</li>
                <li>Each time you zap something, a random amount of sats between your minimum and maximum will be zapped</li>
                <li>If this setting is enabled, it will ignore your default zap amount</li>
              </ul>
            </Info>
          </div>
        }
      />
      {tipRandomField.value &&
        <>
          <Input
            type='number'
            label='minimum random zap'
            name='tipRandomMin'
            disabled={!tipRandomField.value}
            groupClassName='mb-1'
            required
            autoFocus
            max={tipRandomMaxField.value ? tipRandomMaxField.value - 1 : undefined}
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <Input
            type='number'
            label='maximum random zap'
            name='tipRandomMax'
            disabled={!tipRandomField.value}
            required
            autoFocus
            min={tipRandomMinField.value ? tipRandomMinField.value + 1 : undefined}
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
        </>}
    </>
  )
}
