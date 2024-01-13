import { InputGroup } from 'react-bootstrap'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { Form, Input } from '../../../components/form'
import { CenterLayout } from '../../../components/layout'
import { useMe } from '../../../components/me'
import { WalletButtonBar, WalletCard } from '../../../components/wallet-card'
import { useMutation } from '@apollo/client'
import { REMOVE_AUTOWITHDRAW, SET_AUTOWITHDRAW } from '../../../fragments/users'
import { useToast } from '../../../components/toast'
import { lnAddrAutowithdrawSchema, isNumber } from '../../../lib/validate'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { numWithUnits } from '../../../lib/format'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

function useAutoWithdrawEnabled () {
  const me = useMe()
  return me?.privates?.lnAddr && isNumber(me?.privates?.autoWithdrawThreshold) && isNumber(me?.privates?.autoWithdrawMaxFeePercent)
}

export default function LightningAddress () {
  const me = useMe()
  const toaster = useToast()
  const router = useRouter()
  const [setAutoWithdraw] = useMutation(SET_AUTOWITHDRAW)
  const enabled = useAutoWithdrawEnabled()
  const [removeAutoWithdraw] = useMutation(REMOVE_AUTOWITHDRAW)
  const autoWithdrawThreshold = isNumber(me?.privates?.autoWithdrawThreshold) ? me?.privates?.autoWithdrawThreshold : 10000
  const [sendThreshold, setSendThreshold] = useState(Math.max(Math.floor(autoWithdrawThreshold / 10), 1))

  useEffect(() => {
    setSendThreshold(Math.max(Math.floor(me?.privates?.autoWithdrawThreshold / 10), 1))
  }, [autoWithdrawThreshold])

  return (
    <CenterLayout>
      <h2 className='pb-2'>lightning address</h2>
      <h6 className='text-muted text-center pb-3'>autowithdraw to a lightning address to maintain desired balance</h6>
      <Form
        initial={{
          lnAddr: me?.privates?.lnAddr || '',
          autoWithdrawThreshold,
          autoWithdrawMaxFeePercent: isNumber(me?.privates?.autoWithdrawMaxFeePercent) ? me?.privates?.autoWithdrawMaxFeePercent : 1
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
          hint={isNumber(sendThreshold) ? `note: attempts to keep your balance within ${numWithUnits(sendThreshold)} of this amount` : undefined}
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
