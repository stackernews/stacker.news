import { LightningConsumer } from './lightning'
import UpArrow from '../svgs/lightning-arrow.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import { signIn, useSession } from 'next-auth/client'
import { useFundError } from './fund-error'
import ActionTooltip from './action-tooltip'
import { useItemAct } from './item-act'
import Window from '../svgs/window-2-fill.svg'

export default function UpVote ({ item, className }) {
  const [session] = useSession()
  const { setError } = useFundError()
  const { setItem } = useItemAct()
  const [act] = useMutation(
    gql`
      mutation act($id: ID!, $act: ItemAct! $sats: Int!) {
        act(id: $id, act: $act, sats: $sats) {
          act,
          sats
        }
      }`, {
      update (cache, { data: { act: { act, sats } } }) {
        // read in the cached object so we don't use meSats prop
        // which can be stale
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            meVote (existingMeVote = 0) {
              if (act === 'VOTE') {
                return existingMeVote + sats
              }
              return existingMeVote
            },
            meBoost (existingMeBoost = 0) {
              if (act === 'BOOST') {
                return existingMeBoost + sats
              }
              return existingMeBoost
            },
            meTip (existingMeTip = 0) {
              if (act === 'TIP') {
                return existingMeTip + sats
              }
              return existingMeTip
            },
            sats (existingSats = 0) {
              if (act === 'VOTE') {
                return existingSats + sats
              }
              return existingSats
            },
            boost (existingBoost = 0) {
              if (act === 'BOOST') {
                return existingBoost + sats
              }
              return existingBoost
            },
            tips (existingTips = 0) {
              if (act === 'TIP') {
                return existingTips + sats
              }
              return existingTips
            }
          }
        })
      }
    }
  )

  return (
    <LightningConsumer>
      {({ strike }) =>
        <ActionTooltip notForm overlayText={item?.meVote ? <Window style={{ fill: '#fff' }} /> : '1 sat'}>
          <UpArrow
            width={24}
            height={24}
            className={
            `${styles.upvote}
            ${className || ''}
            ${item?.meVote ? styles.voted : ''}`
          }
            onClick={
            session
              ? async (e) => {
                  e.stopPropagation()
                  if (item?.meVote) {
                    setItem({ itemId: item.id, act, strike })
                    return
                  }

                  strike()
                  if (!item) return

                  try {
                    await act({ variables: { id: item.id, act: 'VOTE', sats: 1 } })
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
