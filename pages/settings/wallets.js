import { useCallback } from 'react'
import InputGroup from 'react-bootstrap/InputGroup'
import { useField } from 'formik'
import { useMutation, useQuery } from '@apollo/client'
import { Form, Input, SubmitButton } from '@/components/form'
import Info from '@/components/info'
import { useToast } from '@/components/toast'
import { isNumber } from '@/lib/format'
import { walletSettingsSchema } from '@/lib/validate'
import { SET_WALLET_SETTINGS, WALLET_SETTINGS } from '@/wallets/client/fragments'
import Layout from '@/components/layout'
import { SettingsHeader, hasOnlyOneAuthMethod } from './index'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { AuthBanner } from '@/components/banners'
import { SETTINGS } from '@/fragments/users'

export const getServerSideProps = getGetServerSideProps({ query: WALLET_SETTINGS, authRequired: true })

export default function WalletSettings ({ ssrData }) {
  const toaster = useToast()
  const { data } = useQuery(WALLET_SETTINGS)
  const { data: settingsData } = useQuery(SETTINGS)
  const [setSettings] = useMutation(SET_WALLET_SETTINGS, {
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

  const settings = data?.walletSettings ?? ssrData?.walletSettings
  const authMethods = settingsData?.settings?.privates?.authMethods

  const onSubmit = useCallback(async (values) => {
    try {
      await setSettings({ variables: { settings: values } })
      toaster.success('wallet settings saved')
    } catch (err) {
      console.error(err)
      toaster.danger('failed to save wallet settings')
    }
  }, [setSettings, toaster])

  const initial = {
    receiveCreditsBelowSats: settings?.receiveCreditsBelowSats ?? 10,
    sendCreditsBelowSats: settings?.sendCreditsBelowSats ?? 10,
    autoWithdrawThreshold: settings?.autoWithdrawThreshold ?? 10000,
    autoWithdrawMaxFeePercent: settings?.autoWithdrawMaxFeePercent ?? 1,
    autoWithdrawMaxFeeTotal: settings?.autoWithdrawMaxFeeTotal ?? 1
  }

  return (
    <Layout>
      <div className='pb-3 w-100 mt-2' style={{ maxWidth: '600px' }}>
        <SettingsHeader />
        {authMethods && hasOnlyOneAuthMethod(authMethods) && <AuthBanner />}
        <Form
          enableReinitialize
          initial={initial}
          schema={walletSettingsSchema}
          onSubmit={onSubmit}
        >
          <AutowithdrawSettings />
          <CowboyCreditsSettings />
          <div className='d-flex mt-4'>
            <SubmitButton variant='primary' className='ms-auto'>save</SubmitButton>
          </div>
        </Form>
      </div>
    </Layout>
  )
}

function AutowithdrawSettings () {
  const [{ value: threshold }] = useField('autoWithdrawThreshold')
  const sendThreshold = Math.max(Math.floor(threshold / 10), 1)

  return (
    <>
      <h4 className='mb-3'>Autowithdrawal Settings</h4>
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
      <h4 className='pt-4 mb-3'>Cowboy Credits Settings</h4>
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
