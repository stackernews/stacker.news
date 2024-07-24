import { InputGroup } from 'react-bootstrap'
import { Checkbox, Input } from './form'
import { useMe } from './me'
import { useEffect, useState } from 'react'
import { isNumber } from 'mathjs'

function autoWithdrawThreshold ({ me }) {
  return isNumber(me?.privates?.autoWithdrawThreshold) ? me?.privates?.autoWithdrawThreshold : 10000
}

export function autowithdrawInitial ({ me }) {
  return {
    autoWithdrawThreshold: autoWithdrawThreshold({ me }),
    autoWithdrawMaxFeePercent: isNumber(me?.privates?.autoWithdrawMaxFeePercent) ? me?.privates?.autoWithdrawMaxFeePercent : 1
  }
}

export function AutowithdrawSettings ({ wallet }) {
  const me = useMe()
  const threshold = autoWithdrawThreshold({ me })

  const [sendThreshold, setSendThreshold] = useState(Math.max(Math.floor(threshold / 10), 1))

  useEffect(() => {
    setSendThreshold(Math.max(Math.floor(threshold / 10), 1))
  }, [autoWithdrawThreshold])

  return (
    <>
      <Checkbox
        disabled={!wallet.isConfigured}
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
          <Input
            label='max fee'
            name='autoWithdrawMaxFeePercent'
            hint='max fee as percent of withdrawal amount'
            append={<InputGroup.Text>%</InputGroup.Text>}
            required
          />
        </div>
      </div>
    </>

  )
}
