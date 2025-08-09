import { useCallback } from 'react'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import { useField } from 'formik'
import classNames from 'classnames'
import { useRouter } from 'next/router'
import { useMutation, useQuery } from '@apollo/client'
import { Checkbox, Form, Input, SubmitButton } from '@/components/form'
import Info from '@/components/info'
import { useToast } from '@/components/toast'
import AccordianItem from '@/components/accordian-item'
import { isNumber } from '@/lib/format'
import { walletSettingsSchema } from '@/lib/validate'
import styles from '@/styles/wallet.module.css'
import { useShowModal } from '@/components/modal'
import { SET_WALLET_SETTINGS, WALLET_SETTINGS } from '@/wallets/client/fragments'
import { useWalletDelete } from '@/wallets/client/hooks'

import { useSaveWallet, useWallet } from './hooks'
import { BackButton } from './button'
import { isWallet } from '@/wallets/lib/util'

export function Settings () {
  const wallet = useWallet()
  const { data } = useQuery(WALLET_SETTINGS)
  const [setSettings] = useMutation(SET_WALLET_SETTINGS)
  const toaster = useToast()
  const saveWallet = useSaveWallet()
  const router = useRouter()

  const onSubmit = useCallback(async ({ send, receive, ...settings }) => {
    try {
      await saveWallet({ send, receive })
      await setSettings({
        variables: { settings },
        update: (cache, { data }) => {
          cache.writeQuery({
            query: WALLET_SETTINGS,
            data: {
              walletSettings: {
                __typename: 'WalletSettings',
                ...settings
              }
            }
          })
        }
      })
      router.push('/wallets')
    } catch (err) {
      console.error(err)
      toaster.danger('failed to save wallet')
    }
  }, [saveWallet, setSettings, toaster, router])

  const initial = {
    receiveCreditsBelowSats: data?.walletSettings?.receiveCreditsBelowSats ?? 10,
    sendCreditsBelowSats: data?.walletSettings?.sendCreditsBelowSats ?? 10,
    autoWithdrawThreshold: data?.walletSettings?.autoWithdrawThreshold ?? 10000,
    autoWithdrawMaxFeePercent: data?.walletSettings?.autoWithdrawMaxFeePercent ?? 1,
    autoWithdrawMaxFeeTotal: data?.walletSettings?.autoWithdrawMaxFeeTotal ?? 1,
    proxyReceive: data?.walletSettings?.proxyReceive ?? true
  }

  return (
    <>
      <Form
        enableReinitialize
        initial={initial}
        schema={walletSettingsSchema}
        onSubmit={onSubmit}
      >
        <GlobalSettings />
        <div className='d-flex mt-1 justify-content-end'>
          <BackButton className='me-auto' />
          {isWallet(wallet) && <WalletDeleteButton className='me-2' />}
          <SubmitButton variant='primary'>save</SubmitButton>
        </div>
      </Form>
    </>
  )
}

function Separator ({ children, className }) {
  return (
    <div className={classNames(styles.separator, 'fw-bold', className)}>{children}</div>
  )
}

function WalletDeleteButton ({ className }) {
  const showModal = useShowModal()
  const wallet = useWallet()

  return (
    <Button
      variant='danger'
      className={className}
      onClick={() => {
        showModal(onClose => {
          // need to pass wallet as prop because the modal can't use the hooks
          // since it's not rendered as a children of the form
          return <WalletDeleteObstacle wallet={wallet} onClose={onClose} />
        })
      }}
    >delete
    </Button>
  )
}

function WalletDeleteObstacle ({ wallet, onClose }) {
  const deleteWallet = useWalletDelete(wallet)
  const toaster = useToast()
  const router = useRouter()

  const onClick = useCallback(async () => {
    try {
      await deleteWallet()
      onClose()
      router.push('/wallets')
    } catch (err) {
      console.error('failed to delete wallet:', err)
      toaster.danger('failed to delete wallet')
    }
  }, [deleteWallet, onClose, toaster, router])

  return (
    <div>
      <h4>Delete wallet</h4>
      <p className='line-height-md fw-bold mt-3'>
        Are you sure you want to delete this wallet?
      </p>
      <div className='mt-3 d-flex justify-content-end align-items-center'>
        <Button className='me-3 text-muted nav-link fw-bold' variant='link' onClick={onClose}>cancel</Button>
        <Button variant='danger' onClick={onClick}>delete </Button>
      </div>
    </div>
  )
}

function GlobalSettings () {
  return (
    <>
      <Separator>global settings</Separator>
      <AutowithdrawSettings />
      <AccordianItem
        header='advanced'
        body={
          <>
            <LightningAddressSettings />
            <CowboyCreditsSettings />
          </>
        }
      />
    </>
  )
}

function AutowithdrawSettings () {
  const [{ value: threshold }] = useField('autoWithdrawThreshold')
  const sendThreshold = Math.max(Math.floor(threshold / 10), 1)

  return (
    <>
      <Input
        label='desired balance'
        name='autoWithdrawThreshold'
        hint={isNumber(sendThreshold) ? `will attempt autowithdrawal when your balance exceeds ${sendThreshold * 11} sats` : undefined}
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        required
        type='number'
        min={0}
        groupClassName='mb-2'
      />
      <Input
        label={
          <div className='d-flex align-items-center'>
            max fee rate
            <Info>
              <ul>
                <li>configure fee budget for autowithdrawals</li>
                <li>if max fee total is higher for a withdrawal, we will use it instead to find a route</li>
                <li>higher fee settings increase the likelihood of successful withdrawals</li>
              </ul>
            </Info>
          </div>
        }
        name='autoWithdrawMaxFeePercent'
        append={<InputGroup.Text>%</InputGroup.Text>}
        required
        type='number'
        min={0}
      />
      <Input
        label={
          <div className='d-flex align-items-center'>
            max fee total
            <Info>
              <ul>
                <li>configure fee budget for autowithdrawals</li>
                <li>if max fee rate is higher for a withdrawal, we will use it instead to find a route to your wallet</li>
                <li>higher fee settings increase the likelihood of successful withdrawals</li>
              </ul>
            </Info>
          </div>
        }
        name='autoWithdrawMaxFeeTotal'
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        required
        type='number'
        min={0}
      />
    </>
  )
}

function LightningAddressSettings () {
  return (
    <>
      <Checkbox
        label={
          <div className='d-flex align-items-center'>enhance privacy of my lightning address
            <Info>
              <ul>
                <li>Enabling this setting hides details (ie node pubkey) of your attached wallets when anyone pays your SN lightning address or lnurl-pay</li>
                <li>The lightning invoice will appear to have SN's node as the destination to preserve your wallet's privacy</li>
                <li className='fw-bold'>This will incur in a 10% fee</li>
                <li>Disable this setting to receive payments directly to your attached wallets (which will reveal their details to the payer)</li>
                <li>Note: this privacy behavior is standard for internal zaps/payments on SN, and this setting only applies to external payments</li>
              </ul>
            </Info>
          </div>
            }
        name='proxyReceive'
        groupClassName='mb-3'
      />
    </>
  )
}

function CowboyCreditsSettings () {
  return (
    <>
      <Input
        label={
          <div className='d-flex align-items-center'>
            receive credits for zaps below
            <Info>
              <ul>
                <li>we will not attempt to forward zaps below this amount to you, you will receive credits instead</li>
                <li>this setting is useful if small amounts are expensive to receive for you</li>
              </ul>
            </Info>
          </div>
        }
        name='receiveCreditsBelowSats'
        required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        type='number'
        min={0}
      />
      <Input
        label={
          <div className='d-flex align-items-center'>
            send credits for zaps below
            <Info>
              <ul>
                <li>we will not attempt to send zaps below this amount from your wallet if you have enough credits</li>
                <li>this setting is useful if small amounts are expensive to send for you</li>
              </ul>
            </Info>
          </div>
        }
        name='sendCreditsBelowSats'
        required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        type='number'
        min={0}
      />
    </>
  )
}
