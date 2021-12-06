import { LightningConsumer } from './lightning'
import UpBolt from '../svgs/bolt.svg'
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
import Rainbow from '../lib/rainbow'
import { OverlayTrigger, Popover } from 'react-bootstrap'

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
            meSats (existingSats = 0) {
              if (act === 'VOTE' || act === 'TIP') {
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
        return `${me.tipDefault} sat${me.tipDefault > 1 ? 's' : ''}`
      }
      return <Window style={{ fill: '#fff' }} width={18} height={18} />
    }

    return '1 sat'
  }

  const getColor = (meSats) => {
    if (!meSats || meSats <= 10) {
      return 'var(--secondary)'
    }

    const idx = Math.min(
      Math.floor((Math.log(meSats) / Math.log(100000)) * (Rainbow.length - 1)),
      Rainbow.length - 1)
    return Rainbow[idx]
  }

  const popover = (
    <Popover id='popover-basic'>
      <Popover.Title as='h3'>Tipping</Popover.Title>
      <Popover.Content>
        Press bolt again to tip
      </Popover.Content>
    </Popover>
  )

  const noSelfTips = item?.meVote && item?.mine
  // 12 px default height
  const cover = (item?.meSats < 10 ? ((10 - item.meSats) / 10.0) : 0) * 12
  const color = getColor(item?.meSats)
  return (
    <LightningConsumer>
      {({ strike }) =>
        <LongPressable
          onLongPress={
              async (e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!item || voteLock) return

                // we can't tip ourselves
                if (noSelfTips) {
                  return
                }

                setItem({ itemId: item.id, act, strike })
              }
            }
          onShortPress={
            me
              ? async (e) => {
                  e.preventDefault()
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
            <div className={`${noSelfTips ? styles.noSelfTips : ''}
              ${styles.upvoteWrapper}`}
            >
              <OverlayTrigger placement='right' overlay={popover} show>
                <UpBolt
                  width={24}
                  height={24}
                  className={
                `${styles.upvote}
                ${className || ''}
                ${noSelfTips ? styles.noSelfTips : ''}
                ${item?.meVote ? styles.voted : ''}`
              }
                  style={item?.meVote
                    ? {
                        fill: color,
                        filter: `drop-shadow(0 0 6px ${color}90)`
                      }
                    : undefined}
                  onClick={e => {
                    e.stopPropagation()
                  }}
                />
              </OverlayTrigger>
              <div className={styles.cover} style={{ top: item?.parentId ? '9px' : '4px', height: `${cover}px` }} />
            </div>
          </ActionTooltip>
        </LongPressable>}
    </LightningConsumer>
  )
}
