import { LightningConsumer } from './lightning'
import UpArrow from '../svgs/lightning-arrow.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import { signIn, useSession } from 'next-auth/client'
import { useFundError } from './fund-error'
import ActionTooltip from './action-tooltip'
import { useItemAct } from './item-act'

export default function UpVote ({ itemId, meSats, className }) {
  const [session] = useSession()
  const { setError } = useFundError()
  const { setItem } = useItemAct()
  const [act] = useMutation(
    gql`
      mutation act($id: ID!, $act: ItemAct! $sats: Int!) {
        act(id: $id, act: $act, sats: $sats)
      }`, {
      update (cache, { data: { act } }) {
        // read in the cached object so we don't use meSats prop
        // which can be stale
        const item = cache.readFragment({
          id: `Item:${itemId}`,
          fragment: gql`
            fragment actedItem on Item {
              meSats
            }
          `
        })
        cache.modify({
          id: `Item:${itemId}`,
          fields: {
            meSats (existingMeSats = 0) {
              return existingMeSats + act
            },
            sats (existingSats = 0) {
              return item.meSats === 0 ? existingSats + act : existingSats
            },
            boost (existingBoost = 0) {
              return item.meSats >= 1 ? existingBoost + act : existingBoost
            }
          }
        })
      }
    }
  )

  return (
    <LightningConsumer>
      {({ strike }) =>
        <ActionTooltip notForm>
          <UpArrow
            width={24}
            height={24}
            className={
            `${styles.upvote}
            ${className || ''}
            ${meSats ? (meSats > 1 ? styles.stimi : styles.voted) : ''}`
          }
            onClick={
            session
              ? async (e) => {
                  e.stopPropagation()
                  if (meSats >= 1) {
                    setItem({ itemId, act, strike })
                    return
                  }

                  strike()
                  if (!itemId) return

                  try {
                    await act({ variables: { id: itemId, act: 'VOTE', sats: 1 } })
                  } catch (error) {
                    if (error.toString().includes('insufficient funds')) {
                      setError(true)
                      return
                    }
                    throw new Error({ message: error.toString() })
                  }
                }
              : signIn
          }
          />
        </ActionTooltip>}
    </LightningConsumer>
  )
}
