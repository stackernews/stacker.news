import { useCallback } from 'react'
import { boolean, object } from 'yup'
import { Button } from 'react-bootstrap'
import { Form, ClientInput, SubmitButton, Checkbox } from '@/components/form'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import Link from 'next/link'
import styles from '@/styles/wallet.module.css'
import { useMutation } from '@apollo/client'
import { HIDE_WALLET_RECV_PROMPT_MUTATION } from '@/fragments/users'
import { useToast } from '@/components/toast'
import { useLightningAddressUpsert } from '@/wallets/client/hooks/query'
import { protocolClientSchema } from '@/wallets/lib/util'

export class WalletPromptClosed extends Error {
  constructor () {
    super('wallet prompt closed')
  }
}

export function useWalletRecvPrompt () {
  const { me } = useMe()
  const showModal = useShowModal()
  const toaster = useToast()

  const onAttach = useCallback(({ onClose, resolve }) =>
    () => {
      toaster.success('lightning address saved', { persistOnNavigate: true })
      resolve()
      onClose()
    }, [toaster])

  const onSkip = useCallback(({ onClose, resolve }) =>
    () => {
      resolve()
      onClose()
    }, [])

  return useCallback((e) => {
    return new Promise((resolve, reject) => {
      if (!me || me.optional?.hasRecvWallet || me.privates?.hideWalletRecvPrompt) return resolve()

      showModal(onClose => {
        return (
          <>
            <Header />
            <LnAddrForm onAttach={onAttach({ onClose, resolve })} className='mt-3' />
            <div className={styles.separator}>or</div>
            <WalletLink />
            <div className={styles.separator}>or</div>
            <SkipForm onSkip={onSkip({ onClose, resolve })} />
            <Footer />
          </>
        )
      }, { keepOpen: true, onClose: () => reject(new WalletPromptClosed()) })
    })
  }, [!!me, me?.optional?.hasRecvWallet, me?.privates?.hideWalletRecvPrompt, showModal, onAttach, onSkip])
}

function Header () {
  return (
    <div className='fw-bold text-center mb-3'>
      You need to attach a<br />
      <span className='fw-bold text-primary fs-1' style={{ fontFamily: 'lightning' }}>lightning wallet</span>
      <br />
      to receive sats
    </div>
  )
}

function LnAddrForm ({ onAttach }) {
  const upsert = useLightningAddressUpsert()
  const schema = protocolClientSchema({ name: 'LN_ADDR', send: false })
  const initial = { address: '' }

  const onSubmit = useCallback(async ({ address }) => {
    await upsert({ address })
    onAttach()
  }, [upsert, onAttach])

  return (
    <>
      <span>You can enter a <span className='fw-bold'>lightning address</span>:</span>
      <Form
        schema={schema}
        onSubmit={onSubmit}
        initial={initial}
      >
        <ClientInput
          name='address'
          groupClassName='mt-1 mb-3'
          append={<SubmitButton variant='primary' size='sm'>save</SubmitButton>}
        />
      </Form>
    </>
  )
}

function WalletLink () {
  return <span>visit <Link href='/wallets'>wallets</Link> to set up a different wallet</span>
}

function SkipForm ({ onSkip }) {
  const { me } = useMe()
  const [hideWalletRecvPrompt] = useMutation(HIDE_WALLET_RECV_PROMPT_MUTATION, {
    update (cache) {
      cache.modify({
        id: `User:${me.id}`,
        fields: {
          hideWalletRecvPrompt () {
            return true
          }
        }
      })
    }
  })

  const onSubmit = useCallback(({ dontShowAgain }) => {
    if (dontShowAgain) {
      // XXX this is not so important to wait for it to complete or make sure it succeeds
      hideWalletRecvPrompt().catch(err => console.error('hideWalletRecvPrompt error:', err))
    }
    onSkip()
  }, [hideWalletRecvPrompt])

  const schema = object({ dontShowAgain: boolean().required() })
  return (
    <Form
      initial={{ dontShowAgain: false }}
      className='d-flex align-items-center mt-3'
      onSubmit={onSubmit}
      schema={schema}
    >
      <Button type='submit' variant='secondary' size='sm'>skip</Button>
      <Checkbox label="don't show again" name='dontShowAgain' groupClassName='mb-0 ms-3' />
    </Form>
  )
}

function Footer () {
  return (
    <div className='mt-3 text-center text-muted small'>
      Stacker News is non-custodial. If you don't attach a wallet, you will receive credits when zapped.
      See the <Link href='/faq#wallets'>FAQ</Link> for the details.
    </div>
  )
}
