import { Checkbox, Form, Input, SubmitButton, Select, VariableInput, Range } from '@/components/form'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import Nav from 'react-bootstrap/Nav'
import Layout from '@/components/layout'
import { useMemo } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { SETTINGS, SET_SETTINGS } from '@/fragments/users'
import { useRouter } from 'next/router'
import Info from '@/components/info'
import Link from 'next/link'
import AccordianItem from '@/components/accordian-item'
import { bech32 } from 'bech32'
import { NOSTR_MAX_RELAY_NUM, NOSTR_PUBKEY_BECH32, DEFAULT_CROSSPOSTING_RELAYS } from '@/lib/nostr'
import { settingsSchema } from '@/lib/validate'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import PageLoading from '@/components/page-loading'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { useMe } from '@/components/me'
import { INVOICE_RETENTION_DAYS, ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { useField } from 'formik'
import styles from '@/styles/nav.module.css'
import { AuthBanner } from '@/components/banners'

export const getServerSideProps = getGetServerSideProps({ query: SETTINGS, authRequired: true })

function bech32encode (hexString) {
  return bech32.encode('npub', bech32.toWords(Buffer.from(hexString, 'hex')))
}

// Show alert message if user only has one auth method activated
export const hasOnlyOneAuthMethod = (authMethods) => {
  const providers = Object.keys(authMethods).filter(k => k !== '__typename' && k !== 'apiKey')
  const activatedAuths = providers.filter(provider => !!authMethods[provider])
  return activatedAuths.length <= 1
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
          <Link href='/settings/logins' passHref legacyBehavior>
            <Nav.Link eventKey='logins'>logins</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/settings/wallets' passHref legacyBehavior>
            <Nav.Link eventKey='wallets'>wallets</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/settings/subscriptions/stackers' passHref legacyBehavior>
            <Nav.Link eventKey='subscriptions'>subscriptions</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/settings/mutes' passHref legacyBehavior>
            <Nav.Link eventKey='mutes'>mutes</Nav.Link>
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
            zapUndos: settings?.zapUndos || (settings?.tipDefault ? 100 * settings.tipDefault : 2100),
            zapUndosEnabled: settings?.zapUndos !== null,
            fiatCurrency: settings?.fiatCurrency || 'USD',
            noteItemSats: settings?.noteItemSats,
            noteEarning: settings?.noteEarning,
            noteAllDescendants: settings?.noteAllDescendants,
            noteMentions: settings?.noteMentions,
            noteItemMentions: settings?.noteItemMentions,
            noteDeposits: settings?.noteDeposits,
            noteWithdrawals: settings?.noteWithdrawals,
            noteInvites: settings?.noteInvites,
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
            postsSatsFilter: settings?.postsSatsFilter,
            commentsSatsFilter: settings?.commentsSatsFilter,
            nsfwMode: settings?.nsfwMode,
            nostrPubkey: settings?.nostrPubkey ? bech32encode(settings.nostrPubkey) : '',
            nostrCrossposting: settings?.nostrCrossposting,
            nostrRelays: settings?.nostrRelays?.length ? settings?.nostrRelays : [''],
            hideBookmarks: settings?.hideBookmarks,
            noReferralLinks: settings?.noReferralLinks
          }}
          schema={settingsSchema}
          onSubmit={async ({
            tipDefault, tipRandom, tipRandomMin, tipRandomMax,
            zapUndos, zapUndosEnabled, nostrPubkey, nostrRelays, postsSatsFilter, commentsSatsFilter,
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
                    postsSatsFilter: Number(postsSatsFilter),
                    commentsSatsFilter: Number(commentsSatsFilter),
                    zapUndos: zapUndosEnabled ? Number(zapUndos) : null,
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
            className='mb-2'
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
            label='I get daily rewards'
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
            label='sats are proxied to my attached wallet'
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
            label='I find or lose cowboy essentials (e.g. cowboy hat)'
            name='noteCowboyHat'
            groupClassName='mb-3'
          />
          <div className='form-label'>wallet</div>
          <Checkbox
            label={
              <div className='d-flex align-items-center'>use blank invoice descriptions
                <Info>
                  <ul>
                    <li>Use this if you don't want funding sources to know you're using stacker.news.</li>
                    <li>It makes your bolt11 descriptions blank.</li>
                    <li>Note: lnurl-pay and lightning addresses still reference SN and your nym</li>
                  </ul>
                </Info>
              </div>
            }
            name='hideInvoiceDesc'
            groupClassName='mb-0'
          />
          <DropBolt11sCheckbox
            groupClassName='mb-3'
            ssrData={ssrData}
            label={
              <div className='d-flex align-items-center'>autodelete outgoing invoices
                <Info>
                  <ul>
                    <li>applies retroactively, cannot be reversed</li>
                    <li>outgoing invoices are kept at least {INVOICE_RETENTION_DAYS} days for security and debugging purposes</li>
                    <li>autodeletions are run on a daily basis at night</li>
                  </ul>
                </Info>
              </div>
            }
            name='autoDropBolt11s'
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
                    <li>Uncheck this to display your github on your profile</li>
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
          <Checkbox
            label={
              <div className='d-flex align-items-center'>do not load images, videos, or content from external sites
                <Info>
                  <ul>
                    <li>only load images and videos when we can proxy them</li>
                    <li>this prevents IP address leaks to arbitrary sites</li>
                    <li>if we can't proxy them, the raw link will be shown instead</li>
                  </ul>
                </Info>
              </div>
            }
            name='imgproxyOnly'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>don't create referral links on copy</>}
            name='noReferralLinks'
          />
          <h4 className='mt-5'>content</h4>
          <Range
            label={
              <div className='d-flex align-items-center'>posts sat filter
                <Info>
                  <ul>
                    <li>hide posts if net investment (cost + zaps + boost - downzaps) is less than this</li>
                    <li>set to zero or negative to see more content, including heavily downzapped posts</li>
                  </ul>
                </Info>
              </div>
            }
            name='postsSatsFilter'
            min={-1000}
            max={1000}
            suffix=' sats'
          />
          <Range
            label={
              <div className='d-flex align-items-center'>comments sat filter
                <Info>
                  <ul>
                    <li>collapse comments and rank at bottom if net investment is less than this</li>
                    <li>set to zero or negative to see all comments normally, including heavily downzapped ones</li>
                  </ul>
                </Info>
              </div>
            }
            name='commentsSatsFilter'
            min={-1000}
            max={1000}
            suffix=' sats'
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
          <h4 className='mt-5'>nostr</h4>
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
