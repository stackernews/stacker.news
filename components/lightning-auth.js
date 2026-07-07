import { gql } from '@apollo/client'
import { useMutation, useQuery } from '@apollo/client/react'
import { signIn } from 'next-auth/react'
import { useEffect } from 'react'
import Container from '@/components/ui/container'
import AccordianItem from './accordian-item'
import Qr, { QrSkeleton } from './qr'
import styles from './lightning-auth.module.css'
import BackIcon from '@/svgs/arrow-left-line.svg'
import { useRouter } from 'next/router'
import { FAST_POLL_INTERVAL_MS, SSR } from '@/lib/constants'

function QrAuth ({ k1, encodedUrl, callbackUrl, multiAuth }) {
  const query = gql`
  {
    lnAuth(k1: "${k1}") {
      pubkey
      k1
    }
  }`
  const { data } = useQuery(query, SSR ? {} : { pollInterval: FAST_POLL_INTERVAL_MS, nextFetchPolicy: 'cache-and-network' })

  useEffect(() => {
    if (data?.lnAuth?.pubkey) {
      signIn('lightning', { ...data.lnAuth, callbackUrl, multiAuth })
    }
  }, [data?.lnAuth])

  useEffect(() => {
    if (typeof window.webln === 'undefined') return

    // optimistically use WebLN for authentication
    async function effect () {
      // this will also enable our WebLN wallet
      await window.webln.enable()
      await window.webln.lnurl(encodedUrl)
    }
    effect().catch(console.error)
  }, [encodedUrl])

  // output pubkey and k1
  return (
    <Qr value={encodedUrl} status='waiting for you' />
  )
}

function LightningExplainer ({ text, children, backButton, stacked }) {
  const router = useRouter()
  return (
    <Container>
      <div className={styles.login}>
        {backButton && <div className='w-full mb-4 text-muted pointer' onClick={() => router.back()}><BackIcon /></div>}
        <h3 className='w-full pb-2'>
          {text || 'Login'} with Lightning
        </h3>
        <div className='font-bold text-muted pb-6'>This is the most private way to use Stacker News. Just open your Lightning wallet and scan the QR code.</div>
        <div className={`grid grid-cols-1 gap-8 w-full text-muted${stacked ? '' : ' lg:grid-cols-2'}`}>
          <div className='mb-6'>
            <AccordianItem
              header='Which wallets support lnurl-auth?'
              body={
                <>
                  <div className='mb-4'>
                    You can use any wallet that supports lnurl-auth. These are some wallets that claim to support it:
                  </div>
                  <div className='grid grid-cols-2 gap-8'>
                    <ul className='mb-0'>
                      <li>Alby</li>
                      <li>Balance of Satoshis</li>
                      <li>Blixt</li>
                      <li>Breez</li>
                      <li>Coinos</li>
                      <li>LNBits</li>
                    </ul>
                    <ul>
                      <li>Phoenix</li>
                      <li>ThunderHub</li>
                      <li>Zeus</li>
                    </ul>
                  </div>
                </>
              }
            />
          </div>
          <div className='w-full max-w-75 mx-auto'>
            {children}
          </div>
        </div>
      </div>
    </Container>
  )
}

export function LightningAuthWithExplainer ({ text, callbackUrl, multiAuth, backButton = true, stacked }) {
  return (
    <LightningExplainer text={text} backButton={backButton} stacked={stacked}>
      <LightningAuth callbackUrl={callbackUrl} multiAuth={multiAuth} />
    </LightningExplainer>
  )
}

export function LightningAuth ({ callbackUrl, multiAuth }) {
  // query for challenge
  const [createAuth, { data, error }] = useMutation(gql`
    mutation createAuth {
      createAuth {
        k1
        encodedUrl
      }
    }`)

  useEffect(() => {
    createAuth()
  }, [])

  if (error) return <div>error</div>

  return data ? <QrAuth {...data.createAuth} callbackUrl={callbackUrl} multiAuth={multiAuth} /> : <QrSkeleton status='generating' />
}
