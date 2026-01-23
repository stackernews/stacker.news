import { useCallback } from 'react'
import InputGroup from 'react-bootstrap/InputGroup'
import { useField } from 'formik'
import classNames from 'classnames'
import { useRouter } from 'next/router'
import { useMutation, useQuery } from '@apollo/client'
import { Form, Input, SubmitButton } from '@/components/form'
import Info from '@/components/info'
import { useToast } from '@/components/toast'
import AccordianItem from '@/components/accordian-item'
import { isNumber } from '@/lib/format'
import { walletSettingsSchema } from '@/lib/validate'
import styles from '@/styles/wallet.module.css'
import { SET_WALLET_SETTINGS, WALLET_SETTINGS } from '@/wallets/client/fragments'

import { useSaveWallet } from './hooks'
import { BackButton } from './button'

export function Settings () {
  const { data } = useQuery(WALLET_SETTINGS)
  const [setSettings] = useMutation(SET_WALLET_SETTINGS)
  const toaster = useToast()
  const saveWallet = useSaveWallet()
  const router = useRouter()

  const onSubmit = useCallback(async (settings) => {
    try {
      await saveWallet()
      await setSettings({
        variables: { settings },
        update: (cache, { data }) => {
          cache.writeQuery({
            query: WALLET_SETTINGS,
            data: {
              walletSettings: {
                __typename: 'WalletSettings',
                ...data?.setWalletSettings
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
    autoWithdrawMaxFeeTotal: data?.walletSettings?.autoWithdrawMaxFeeTotal ?? 1
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
        <div className='d-flex mt-5 justify-content-end align-items-center'>
          <BackButton className='me-auto' />
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

function GlobalSettings () {
  return (
    <>
      <Separator>global settings</Separator>
      <AutowithdrawSettings />
      <AccordianItem
        header='advanced'
        body={
          <>
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
