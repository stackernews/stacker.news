import { getGetServerSideProps } from '@/api/ssrApollo'
import { Checkbox, Form, Input, SubmitButton } from '@/components/form'
import Info from '@/components/info'
import { isNumber } from '@/lib/format'
import { WalletLayout, WalletLayoutHeader, WalletLayoutSubHeader } from '@/wallets/client/components'
import { useMutation, useQuery } from '@apollo/client'
import Link from 'next/link'
import { useCallback, useMemo } from 'react'
import { InputGroup } from 'react-bootstrap'
import styles from '@/styles/wallet.module.css'
import classNames from 'classnames'
import { useField } from 'formik'
import { SET_WALLET_SETTINGS, WALLET_SETTINGS } from '@/wallets/client/fragments'
import { walletSettingsSchema } from '@/lib/validate'
import { useToast } from '@/components/toast'
import CancelButton from '@/components/cancel-button'

export const getServerSideProps = getGetServerSideProps({ query: WALLET_SETTINGS, authRequired: true })

export default function WalletSettings ({ ssrData }) {
  const { data } = useQuery(WALLET_SETTINGS)
  const [setSettings] = useMutation(SET_WALLET_SETTINGS)
  const { walletSettings: settings } = useMemo(() => data ?? ssrData, [data, ssrData])
  const toaster = useToast()

  const initial = {
    receiveCreditsBelowSats: settings?.receiveCreditsBelowSats,
    sendCreditsBelowSats: settings?.sendCreditsBelowSats,
    autoWithdrawThreshold: settings?.autoWithdrawThreshold ?? 10000,
    autoWithdrawMaxFeePercent: settings?.autoWithdrawMaxFeePercent ?? 1,
    autoWithdrawMaxFeeTotal: settings?.autoWithdrawMaxFeeTotal ?? 1,
    proxyReceive: settings?.proxyReceive
  }

  const onSubmit = useCallback(async (values) => {
    try {
      await setSettings({
        variables: {
          settings: values
        }
      })
      toaster.success('saved settings')
    } catch (err) {
      console.error(err)
      toaster.danger('failed to save settings')
    }
  }, [toaster])

  return (
    <WalletLayout>
      <div className='py-5 mx-auto w-100' style={{ maxWidth: '600px' }}>
        <WalletLayoutHeader>wallet settings</WalletLayoutHeader>
        <WalletLayoutSubHeader>apply globally to all wallets</WalletLayoutSubHeader>
        <Form
          enableReinitialize
          initial={initial}
          schema={walletSettingsSchema}
          className='mt-3'
          onSubmit={onSubmit}
        >
          <CowboyCreditsSettings />
          <LightningAddressSettings />
          <AutowithdrawSettings />
          <LightningNetworkFeesSettings />
          <div className='d-flex mt-1 justify-content-end'>
            <CancelButton />
            <SubmitButton variant='info'>save</SubmitButton>
          </div>
        </Form>
      </div>
    </WalletLayout>
  )
}

function CowboyCreditsSettings () {
  return (
    <>
      <Separator>cowboy credits</Separator>
      <Input
        label='receive credits for zaps below'
        name='receiveCreditsBelowSats'
        required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        type='number'
        min={0}
      />
      <Input
        label='send credits for zaps below'
        name='sendCreditsBelowSats'
        required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        type='number'
        min={0}
      />

    </>
  )
}

function LightningAddressSettings () {
  return (
    <>
      <Separator>@stacker.news lightning address</Separator>
      <Checkbox
        label={
          <div className='d-flex align-items-center'>enhance privacy of my lightning address
            <Info>
              <ul>
                <li>Enabling this setting hides details (ie node pubkey) of your attached wallets when anyone pays your SN lightning address or lnurl-pay</li>
                <li>The lightning invoice will appear to have SN's node as the destination to preserve your wallet's privacy</li>
                <li>This will incur in a 10% fee</li>
                <li>Disable this setting to receive payments directly to your attached wallets (which will reveal their details to the payer)</li>
                <li>Note: this privacy behavior is standard for internal zaps/payments on SN, and this setting only applies to external payments</li>
              </ul>
            </Info>
          </div>
            }
        name='proxyReceive'
        groupClassName='mb-0'
      />
    </>
  )
}

function AutowithdrawSettings () {
  const [{ value: threshold }] = useField('autoWithdrawThreshold')
  const sendThreshold = Math.max(Math.floor(threshold / 10), 1)

  return (
    <>
      <Separator>autowithdrawal</Separator>
      <Input
        label='desired balance'
        name='autoWithdrawThreshold'
        hint={isNumber(sendThreshold) ? `will attempt autowithdrawal when your balance exceeds ${sendThreshold * 11} sats` : undefined}
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        required
        type='number'
        min={0}
      />

    </>
  )
}

function LightningNetworkFeesSettings () {
  return (
    <>
      <Separator className='mb-0'>lightning network fees</Separator>
      <div className='text-center text-muted mb-2'>
        we'll use whichever setting is higher during{' '}
        <Link
          target='_blank'
          href='https://docs.lightning.engineering/the-lightning-network/pathfinding'
          rel='noreferrer'
        >pathfinding
        </Link>
      </div>
      <Input
        label='max fee rate'
        name='autoWithdrawMaxFeePercent'
        hint='max fee as percent of withdrawal amount'
        append={<InputGroup.Text>%</InputGroup.Text>}
        required
        type='number'
        min={0}
      />
      <Input
        label='max fee total'
        name='autoWithdrawMaxFeeTotal'
        hint='max fee for any withdrawal amount'
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        required
        type='number'
        min={0}
      />
    </>
  )
}

function Separator ({ children, className }) {
  return (
    <div className={classNames(styles.separator, 'fw-bold', className)}>{children}</div>
  )
}
