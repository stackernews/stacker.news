import React from 'react'
import Button from 'react-bootstrap/Button'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { actOptimisticUpdate, useAct } from './item-act'
import { InvoiceCanceledError, usePayment } from './payment'
import { useApolloClient } from '@apollo/client'
import { NotificationType, useNotifications } from './notifications'

const bountyPaidOptimisticUpdate = (cache, variables, { me, onComplete }) => {
  onComplete()
  const revert = [
    (({ id: itemId, path }) => {
      // update root bounty status
      const root = path.split('.')[0]
      cache.modify({
        id: `Item:${root}`,
        fields: {
          bountyPaidTo (existingPaidTo = []) {
            return [...(existingPaidTo || []), Number(itemId)]
          }
        }
      })

      return () => {
        cache.modify({
          id: `Item:${root}`,
          fields: {
            bountyPaidTo (existingPaidTo = []) {
              return existingPaidTo.filter(id => id !== Number(itemId))
            }
          }
        })
      }
    })(variables),
    actOptimisticUpdate(cache, variables, { me })
  ]
  return () => {
    revert.forEach(r => r())
  }
}

export default function PayBounty ({ children, item }) {
  const me = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const payment = usePayment()
  const cache = useApolloClient().cache
  const { notify, unnotify } = useNotifications()

  const act = useAct()

  const handlePayBounty = async onComplete => {
    let cancel, revert, nid
    try {
      let hash, hmac
      const sats = root.bounty
      const variables = { id: item.id, sats, path: item.path, act: 'TIP' }
      revert = bountyPaidOptimisticUpdate(cache, variables, { me, onComplete })
      nid = notify(NotificationType.BountyPending, { sats, item: { ...item, root } }, false);
      [{ hash, hmac }, cancel] = await payment.request(sats)
      await act({ variables: { ...variables, hash, hmac } })
    } catch (err) {
      revert?.()
      if (err instanceof InvoiceCanceledError) {
        return
      }
      const reason = err?.message || err?.toString?.()
      notify(NotificationType.BountyError, { reason, sats: root.bounty, item: { ...item, root } })
      cancel?.()
    } finally {
      unnotify(nid)
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
