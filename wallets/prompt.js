import { useCallback } from 'react'
import { boolean, object } from 'yup'
import { Button } from 'react-bootstrap'
import { Form, ClientInput, SubmitButton, Checkbox } from '@/components/form'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import Link from 'next/link'
import { useWallet } from '@/wallets/index'
import { useWalletConfigurator } from '@/wallets/config'
import styles from '@/styles/wallet.module.css'
import { externalLightningAddressValidator } from '@/lib/validate'
import { autowithdrawInitial } from '@/components/autowithdraw-shared'
import { useMutation } from '@apollo/client'
import { HIDE_WALLET_PROMPT_MUTATION } from '@/fragments/users'

export class WalletPromptClosed extends Error {
  constructor () {
    super('wallet prompt closed')
  }
}

export default function useWalletPrompt () {
  const { me } = useMe()
  const showModal = useShowModal()

  const onAttachOrSkip = useCallback(({ onClose, resolve }) =>
    () => {
      // XXX need to resolve promise before closing modal because close will call reject
      resolve()
      onClose()
    }, []
  )

  return useCallback((e) => {
    return new Promise((resolve, reject) => {
      // TODO: check if user told us to not show again
      if (!me || me.optional?.hasRecvWallet || me.privates?.hideWalletPrompt) return resolve()

      showModal(onClose => {
        const innerOnAttach = onAttachOrSkip({ onClose, resolve })
        return (
          <>
            <Header />
            <LnAddrForm onAttach={innerOnAttach} className='mt-3' />
            <div className={styles.separator}>or</div>
            <WalletLink />
            <div className={styles.separator}>or</div>
            <SkipForm onSkip={innerOnAttach} />
            <Footer />
          </>
        )
      }, { keepOpen: true, onClose: () => reject(new WalletPromptClosed()) })
    })
  }, [!!me, me?.optional?.hasRecvWallet, me?.privates?.hideWalletPrompt, showModal])
}

const Header = () => (
  <div className='fw-bold text-center mb-3'>
    You need to attach a<br />
    <span className='fw-bold text-primary fs-1' style={{ fontFamily: 'lightning' }}>lightning wallet</span>
    <br />
    to receive sats
  </div>
)

const LnAddrForm = ({ onAttach }) => {
  const { me } = useMe()
  const wallet = useWallet('lightning-address')
  const { save } = useWalletConfigurator(wallet)

  const schema = object({ lnAddr: externalLightningAddressValidator.required('required') })

  const onSubmit = useCallback(async ({ lnAddr }) => {
    await save({
      ...autowithdrawInitial({ me }),
      priority: 0,
      enabled: true,
      address: lnAddr
    }, true)
    onAttach()
  }, [save])

  return (
    <>
      <span>You can enter a <span className='fw-bold'>lightning address</span>:</span>
      <Form
        schema={schema}
        onSubmit={onSubmit}
        initial={{ lnAddr: '' }}
      >
        <ClientInput
          name='lnAddr'
          groupClassName='mt-1 mb-3'
          append={<SubmitButton variant='primary' size='sm'>save</SubmitButton>}
        />
      </Form>
    </>
  )
}

const WalletLink = () => <span>visit <Link href='/wallets'>wallets</Link> to set up a different wallet</span>

const SkipForm = ({ onSkip }) => {
  const { me } = useMe()
  const [hideWalletPrompt] = useMutation(HIDE_WALLET_PROMPT_MUTATION, {
    update (cache) {
      cache.modify({
        id: `User:${me.id}`,
        fields: {
          hideWalletPrompt () {
            return true
          }
        }
      })
    }
  })

  const onSubmit = useCallback(({ dontShowAgain }) => {
    if (dontShowAgain) {
      // XXX this is not so important to wait for it to complete or make sure it succeeds
      hideWalletPrompt().catch(err => console.error('hideWalletPrompt error:', err))
    }
    onSkip()
  }, [hideWalletPrompt])

  const schema = object({ dontShowAgain: boolean().required() })
  return (
    <Form
      initial={{ dontShowAgain: false }}
      className='d-flex justify-content-between align-items-center mt-3'
      onSubmit={onSubmit}
      schema={schema}
    >
      <Checkbox label="don't show this again" name='dontShowAgain' groupClassName='mb-0' />
      <Button type='submit' variant='secondary' size='sm'>skip</Button>
    </Form>
  )
}

const Footer = () => (
  <div className='mt-3 text-center text-muted small'>
    Stacker News is non-custodial. If you don't attach a wallet, you will receive credits when zapped.
    See the <Link href='/faq#wallets'>FAQ</Link> for the details.
  </div>
)
