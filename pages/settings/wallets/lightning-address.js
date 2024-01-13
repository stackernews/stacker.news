import { InputGroup } from 'react-bootstrap'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { Form, Input } from '../../../components/form'
import { CenterLayout } from '../../../components/layout'
import { useMe } from '../../../components/me'
import { WalletButtonBar, WalletCard } from '../../../components/wallet-card'
import { useMutation } from '@apollo/client'
import { REMOVE_AUTOWITHDRAW, SET_AUTOWITHDRAW } from '../../../fragments/users'
import { useToast } from '../../../components/toast'
import { lnAddrAutowithdrawSchema } from '../../../lib/validate'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

function useAutoWithdrawEnabled () {
  const me = useMe()
  return me?.privates?.lnAddr && !isNaN(me?.privates?.autoWithdrawThreshold) && !isNaN(me?.privates?.autoWithdrawMaxFeePercent)
}

export default function LightningAddress () {
  const me = useMe()
  const toaster = useToast()
  const router = useRouter()
  const [setAutoWithdraw] = useMutation(SET_AUTOWITHDRAW)
  const enabled = useAutoWithdrawEnabled()
  const [removeAutoWithdraw] = useMutation(REMOVE_AUTOWITHDRAW)
  const autoWithdrawThreshold = isNaN(me?.privates?.autoWithdrawThreshold) ? 10000 : me?.privates?.autoWithdrawThreshold
  const [sendThreshold, setSendThreshold] = useState(Math.max(Math.floor(autoWithdrawThreshold / 10), 1))

  useEffect(() => {
    setSendThreshold(Math.max(Math.floor(me?.privates?.autoWithdrawThreshold / 10), 1))
  }, [autoWithdrawThreshold])

  return (
    <CenterLayout>
      <h2 className='pb-2'>lightning address</h2>
      <h6 className='text-muted text-center pb-3'>autowithdraw to a lightning address when desired balance is breached</h6>
      <Form
        initial={{
          lnAddr: me?.privates?.lnAddr || '',
          autoWithdrawThreshold: isNaN(me?.privates?.autoWithdrawThreshold) ? 10000 : me?.privates?.autoWithdrawThreshold,
          autoWithdrawMaxFeePercent: isNaN(me?.privates?.autoWithdrawMaxFeePercent) ? 1 : me?.privates?.autoWithdrawMaxFeePercent
        }}
        schema={lnAddrAutowithdrawSchema({ me })}
        onSubmit={async ({ autoWithdrawThreshold, autoWithdrawMaxFeePercent, ...values }) => {
          try {
            await setAutoWithdraw({
              variables: {
                lnAddr: values.lnAddr,
                autoWithdrawThreshold: Number(autoWithdrawThreshold),
                autoWithdrawMaxFeePercent: Number(autoWithdrawMaxFeePercent)
              }
            })
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach:' + err.message || err.toString?.())
          }
        }}
      >
        <Input
          label='lightning address'
          name='lnAddr'
          required
          autoFocus
        />
        <Input
          label='desired balance'
          name='autoWithdrawThreshold'
          onChange={(formik, e) => {
            const value = e.target.value
            setSendThreshold(Math.max(Math.floor(value / 10), 1))
          }}
          hint={isNaN(sendThreshold) ? undefined : `note: will attempt withdrawal when desired balance is exceeded by ${sendThreshold} sats`}
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <Input
          label='max fee'
          name='autoWithdrawMaxFeePercent'
          hint='max fee as percent of withdrawal amount'
          append={<InputGroup.Text>%</InputGroup.Text>}
        />
        <WalletButtonBar
          enabled={enabled} onDelete={async () => {
            try {
              await removeAutoWithdraw()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to unattach:' + err.message || err.toString?.())
            }
          }}
        />
      </Form>
    </CenterLayout>
  )
}

export function LightningAddressWalletCard () {
  const enabled = useAutoWithdrawEnabled()

  return (
    <WalletCard
      title='lightning address'
      badges={['receive only', 'non-custodialish']}
      provider='lightning-address'
      enabled={enabled}
    />
  )
}
