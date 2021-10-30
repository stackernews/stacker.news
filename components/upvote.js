import { LightningConsumer } from './lightning'
import UpArrow from '../svgs/lightning-arrow.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import { signIn } from 'next-auth/client'
import { useFundError } from './fund-error'
import ActionTooltip from './action-tooltip'
import { useItemAct } from './item-act'
import Window from '../svgs/window-2-fill.svg'
import { useMe } from './me'
import { useState } from 'react'
import LongPressable from 'react-longpressable'

export default function UpVote ({ item, className }) {
  const { setError } = useFundError()
  const { setItem } = useItemAct()
  const [voteLock, setVoteLock] = useState()
  const me = useMe()
  const [act] = useMutation(
    gql`
      mutation act($id: ID!, $act: ItemAct! $sats: Int!, $tipDefault: Boolean) {
        act(id: $id, act: $act, sats: $sats, tipDefault: $tipDefault) {
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

  const overlayText = () => {
    if (item?.meVote) {
      if (me?.tipDefault) {
        return `tip ${me.tipDefault}`
      }
      return <Window style={{ fill: '#fff' }} width={18} height={18} />
    }

    return '1 sat'
  }

  const noSelfTips = item?.meVote && item?.user?.id === me?.id

  return (
    <LightningConsumer>
      {({ strike }) =>
        <LongPressable
          onLongPress={
              async (e) => {
                e.stopPropagation()
                if (!item || voteLock) return

                // we can't tip ourselves
                if (noSelfTips) {
                  return
                }

                if (window.getSelection) {
                  window.getSelection().removeAllRanges()
                } else if (document.selection) {
                  document.selection.empty()
                }

                setItem({ itemId: item.id, act, strike })
              }
            }
          onShortPress={
            me
              ? async (e) => {
                  e.stopPropagation()
                  if (!item || voteLock) return

                  // we can't tip ourselves
                  if (noSelfTips) {
                    return
                  }

                  if (item?.meVote) {
                    if (me?.tipDefault) {
                      try {
                        strike()
                        await act({ variables: { id: item.id, act: 'TIP', sats: me.tipDefault } })
                      } catch (e) {
                        console.log(e)
                      }
                      return
                    }
                    setItem({ itemId: item.id, act, strike })
                    return
                  }

                  strike()

                  try {
                    setVoteLock(true)
                    await act({ variables: { id: item.id, act: 'VOTE', sats: 1 } })
                  } catch (error) {
                    if (error.toString().includes('insufficient funds')) {
                      setError(true)
                      return
                    }
                    throw new Error({ message: error.toString() })
                  } finally {
                    setVoteLock(false)
                  }
                }
              : signIn
          }
        >
          <ActionTooltip notForm disable={noSelfTips} overlayText={overlayText()}>

            <UpArrow
              width={24}
              height={24}
              className={
            `${styles.upvote}
            ${className || ''}
            ${noSelfTips ? styles.noSelfTips : ''}
            ${item?.meVote ? styles.voted : ''}`
          }
            />
          </ActionTooltip>
        </LongPressable>}
    </LightningConsumer>
  )
}
