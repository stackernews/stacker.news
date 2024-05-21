import React, { useCallback } from 'react'
import Button from 'react-bootstrap/Button'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { useAct, actUpdate, ACT_MUTATION } from './item-act'
import { InvoiceCanceledError, usePayment } from './payment'
import { optimisticUpdate } from '@/lib/apollo'
import { useLightning } from './lightning'
import { useToast } from './toast'
import { Types as ClientNotification, useClientNotifications } from './client-notifications'

export default function PayBounty ({ children, item }) {
  const me = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const payment = usePayment()
  const strike = useLightning()
  const toaster = useToast()
  const { notify, unnotify } = useClientNotifications()

  const onUpdate = useCallback(onComplete => (cache, { data: { act: { id, path } } }) => {
    // update root bounty status
    const root = path.split('.')[0]
    cache.modify({
      id: `Item:${root}`,
      fields: {
        bountyPaidTo (existingPaidTo = []) {
          return [...(existingPaidTo || []), Number(id)]
        }
      }
    })
    strike()
    onComplete()
  }, [strike])

  const act = useAct()

  const handlePayBounty = async onComplete => {
    const sats = root.bounty
    const variables = { id: item.id, sats, act: 'TIP', path: item.path }
    const notifyProps = { itemId: item.id, sats }
    const optimisticResponse = { act: { ...variables, path: item.path } }

    let revert, cancel, nid
    try {
      revert = optimisticUpdate({
        mutation: ACT_MUTATION,
        variables,
        optimisticResponse,
        update: actUpdate({ me, onUpdate: onUpdate(onComplete) })
      })

      if (me) {
        nid = notify(ClientNotification.Bounty.PENDING, notifyProps)
      }

      let hash, hmac;
      [{ hash, hmac }, cancel] = await payment.request(sats)
      await act({
        variables: { hash, hmac, ...variables },
        optimisticResponse: {
          act: variables
        }
      })
      onComplete()
    } catch (error) {
      revert?.()

      if (error instanceof InvoiceCanceledError) {
        return
      }

      const reason = error?.message || error?.toString?.()
      if (me) {
        notify(ClientNotification.Bounty.ERROR, { ...notifyProps, reason })
      } else {
        toaster.danger('pay bounty failed: ' + reason)
      }
      cancel?.()
    } finally {
      if (nid) unnotify(nid)
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
