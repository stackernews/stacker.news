import React from 'react'
import Button from 'react-bootstrap/Button'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { ActCanceledError, useAct } from './item-act'
import { useLightning } from './lightning'
import { useToast } from './toast'

export const payBountyCacheMods = {
  onPaid: (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.result) return
    const { id, path } = response.result
    const root = path.split('.')[0]
    cache.modify({
      id: `Item:${root}`,
      fields: {
        bountyPaidTo (existingPaidTo = []) {
          return [...(existingPaidTo || []), Number(id)]
        }
      }
    })
  },
  onPayError: (e, cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.result) return
    const { id, path } = response.result
    const root = path.split('.')[0]
    cache.modify({
      id: `Item:${root}`,
      fields: {
        bountyPaidTo (existingPaidTo = []) {
          return (existingPaidTo || []).filter(i => i !== Number(id))
        }
      }
    })
  }
}

export default function PayBounty ({ children, item }) {
  const { me } = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const strike = useLightning()
  const toaster = useToast()
  const variables = { id: item.id, sats: root.bounty, act: 'TIP' }
  const act = useAct({
    variables,
    optimisticResponse: { act: { __typename: 'ItemActPaidAction', result: { ...variables, path: item.path } } },
    ...payBountyCacheMods
  })

  const handlePayBounty = async onCompleted => {
    try {
      strike()
      const { error } = await act({ onCompleted })
      if (error) throw error
    } catch (error) {
      if (error instanceof ActCanceledError) {
        return
      }

      const reason = error?.message || error?.toString?.()
      toaster.danger(reason)
    }
  }

  if (!me || item.mine || root.user.name !== me.name) {
    return null
  }

  return (
    <ActionTooltip
      notForm
      overlayText={numWithUnits(root.bounty)}
    >
      <div
        className={styles.pay} onClick={() => {
          showModal(onClose => (
            <>
              <div className='text-center fw-bold text-muted'>
                Pay this bounty to {item.user.name}?
              </div>
              <div className='text-center'>
                <Button className='mt-4' variant='primary' onClick={() => handlePayBounty(onClose)}>
                  pay <small>{numWithUnits(root.bounty)}</small>
                </Button>
              </div>
            </>
          ))
        }}
      >
        pay bounty
      </div>
    </ActionTooltip>
  )
}
