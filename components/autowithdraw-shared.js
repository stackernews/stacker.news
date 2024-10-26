import { InputGroup } from 'react-bootstrap'
import { Checkbox, Input } from './form'
import { useMe } from './me'
import { useEffect, useState } from 'react'
import { isNumber } from '@/lib/validate'
import { useIsClient } from './use-client'
import Link from 'next/link'

function autoWithdrawThreshold ({ me }) {
  return isNumber(me?.privates?.autoWithdrawThreshold) ? me?.privates?.autoWithdrawThreshold : 10000
}

export function autowithdrawInitial ({ me }) {
  return {
    autoWithdrawThreshold: autoWithdrawThreshold({ me }),
    autoWithdrawMaxFeePercent: isNumber(me?.privates?.autoWithdrawMaxFeePercent) ? me?.privates?.autoWithdrawMaxFeePercent : 1,
    autoWithdrawMaxFeeTotal: isNumber(me?.privates?.autoWithdrawMaxFeeTotal) ? me?.privates?.autoWithdrawMaxFeeTotal : 1
  }
}

export function AutowithdrawSettings ({ wallet }) {
  const { me } = useMe()
  const threshold = autoWithdrawThreshold({ me })

  const [sendThreshold, setSendThreshold] = useState(Math.max(Math.floor(threshold / 10), 1))

  useEffect(() => {
    setSendThreshold(Math.max(Math.floor(threshold / 10), 1))
  }, [autoWithdrawThreshold])

  const isClient = useIsClient()

  return (
    <>
      <Checkbox
        disabled={isClient && !wallet.isConfigured}
        label='enabled'
        id='enabled'
        name='enabled'
      />
      <div className='my-4 border border-3 rounded'>
        <div className='p-3'>
          <h3 className='text-center text-muted'>desired balance</h3>
          <h6 className='text-center pb-3'>applies globally to all autowithdraw methods</h6>
          <Input
            label='desired balance'
            name='autoWithdrawThreshold'
            onChange={(formik, e) => {
              const value = e.target.value
              setSendThreshold(Math.max(Math.floor(value / 10), 1))
            }}
            hint={isNumber(sendThreshold) ? `will attempt auto-withdraw when your balance exceeds ${sendThreshold * 11} sats` : undefined}
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            required
          />
          <h3 className='text-center text-muted pt-3'>network fees</h3>
          <h6 className='text-center pb-3'>
            we'll use whichever setting is higher during{' '}
            <Link
              target='_blank'
              href='https://docs.lightning.engineering/the-lightning-network/pathfinding'
              rel='noreferrer'
            >pathfinding
            </Link>
          </h6>
          <Input
            label='max fee rate'
            name='autoWithdrawMaxFeePercent'
            hint='max fee as percent of withdrawal amount'
            append={<InputGroup.Text>%</InputGroup.Text>}
            required
          />
          <Input
            label='max fee total'
            name='autoWithdrawMaxFeeTotal'
            hint='max fee for any withdrawal amount'
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            required
          />
        </div>
      </div>
    </>

  )
}
