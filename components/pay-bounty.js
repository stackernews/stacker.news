import React from 'react'
import { Button } from 'react-bootstrap'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import ModalButton from './modal-button'
import { useMutation, gql } from '@apollo/client'
import { useRouter } from 'next/router'
import { signIn } from 'next-auth/client'
import { useMe } from './me'
import { abbrNum } from '../lib/format'

export default function PayBounty ({ children, item }) {
  const me = useMe()

  const router = useRouter()

  const fwd2me = me && me?.id === item?.fwdUser?.id

  const [act] = useMutation(
    gql`
          mutation act($id: ID!, $sats: Int!) {
            act(id: $id, sats: $sats) {
              vote,
              sats
            }
          }`, {
      update (cache, { data: { act: { vote, sats } } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            sats (existingSats = 0) {
              return existingSats + sats
            },
            meSats (existingSats = 0) {
              return existingSats + sats
            }
          }
        })

        // update all ancestors
        item.path.split('.').forEach(id => {
          if (Number(id) === Number(item.id)) return
          cache.modify({
            id: `Item:${id}`,
            fields: {
              commentSats (existingCommentSats = 0) {
                return existingCommentSats + sats
              }
            }
          })
        })
      }
    }
  )

  const handlePayBounty = async () => {
    if (!me) {
      signIn()
      return
    }
    act({ variables: { id: item.id, sats: item.root.bounty } })
    router.push(`/items/${item.root.id}`)
  }

  if (!me || item.root.user.name !== me.name || item.mine || item.root.bountyPaid) {
    return null
  }

  return (
          <ActionTooltip
            notForm disable={item?.mine || fwd2me}
            overlayText={`${item.root.bounty} sats`}
          >
            <ModalButton
              clicker={
                <div className={styles.pay}>
                  pay bounty
                </div>
                }
            >
                <div className='text-center font-weight-bold text-muted'>
                  Are you sure you want to pay this bounty?
                </div>
                <div className='text-center'>
                  <Button className="mt-4" variant='primary' onClick={() => handlePayBounty()}>
                    pay {abbrNum(item.root.bounty)} sats
                  </Button>
                </div>
            </ModalButton>
          </ActionTooltip>
  )
}
