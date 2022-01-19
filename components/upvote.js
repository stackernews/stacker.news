import { LightningConsumer } from './lightning'
import UpBolt from '../svgs/bolt.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import { signIn } from 'next-auth/client'
import { useFundError } from './fund-error'
import ActionTooltip from './action-tooltip'
import { useItemAct } from './item-act'
import { useMe } from './me'
import Rainbow from '../lib/rainbow'
import { useRef, useState } from 'react'
import LongPressable from 'react-longpressable'
import { Overlay, Popover } from 'react-bootstrap'

const getColor = (meSats) => {
  if (!meSats || meSats <= 10) {
    return 'var(--secondary)'
  }

  const idx = Math.min(
    Math.floor((Math.log(meSats) / Math.log(10000)) * (Rainbow.length - 1)),
    Rainbow.length - 1)
  return Rainbow[idx]
}

const UpvotePopover = ({ target, show, handleClose }) => (
  <Overlay
    show={show}
    target={target}
    placement='right'
  >
    <Popover id='popover-basic'>
      <Popover.Title className='d-flex justify-content-between alert-dismissible' as='h3'>Tipping
        <button type='button' className='close' onClick={handleClose}><span aria-hidden='true'>×</span><span className='sr-only'>Close alert</span></button>
      </Popover.Title>
      <Popover.Content>
        Press bolt again to tip 1 sat.
      </Popover.Content>
    </Popover>
  </Overlay>
)

const TipPopover = ({ target, show, handleClose }) => (
  <Overlay
    show={show}
    target={target}
    placement='right'
  >
    <Popover id='popover-basic'>
      <Popover.Title className='d-flex justify-content-between alert-dismissible' as='h3'>Press and hold
        <button type='button' class='close' onClick={handleClose}><span aria-hidden='true'>×</span><span class='sr-only'>Close alert</span></button>
      </Popover.Title>
      <Popover.Content>
        <div className='mb-2'>Press and hold bolt to tip a custom amount.</div>
        <div>As you tip more, the bolt color follows the rainbow.</div>
      </Popover.Content>
    </Popover>
  </Overlay>
)

export default function UpVote ({ item, className }) {
  const { setError } = useFundError()
  const { setItem } = useItemAct()
  const [voteLock, setVoteLock] = useState()
  const [voteShow, _setVoteShow] = useState(false)
  const [tipShow, _setTipShow] = useState(false)
  const ref = useRef()
  const me = useMe()
  const [setWalkthrough] = useMutation(
    gql`
      mutation setWalkthrough($upvotePopover: Boolean, $tipPopover: Boolean) {
        setWalkthrough(upvotePopover: $upvotePopover, tipPopover: $tipPopover)
      }`
  )

  const setVoteShow = (yes) => {
    if (!me) return

    if (yes && !me.upvotePopover) {
      _setVoteShow(yes)
    }

    if (voteShow && !yes) {
      _setVoteShow(yes)
      setWalkthrough({ variables: { upvotePopover: true } })
    }
  }

  const setTipShow = (yes) => {
    if (!me) return

    // if we want to show it, yet we still haven't shown
    if (yes && !me.tipPopover) {
      _setTipShow(yes)
    }

    // if it's currently showing and we want to hide it
    if (tipShow && !yes) {
      _setTipShow(yes)
      setWalkthrough({ variables: { tipPopover: true } })
    }
  }

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
        if (act === 'VOTE') {
          setVoteShow(true)
        }
        if (act === 'TIP') {
          setTipShow(true)
        }

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
      return '1 sat'
    }
  }

  const noSelfTips = item?.meVote && item?.mine
  const color = getColor(item?.meSats)
  return (
    <LightningConsumer>
      {({ strike }) =>
        <div ref={ref} className='upvoteParent'>
          <LongPressable
            onLongPress={
              async (e) => {
                if (!item || voteLock) return

                // we can't tip ourselves
                if (noSelfTips) {
                  return
                }

                setTipShow(false)
                setItem({ itemId: item.id, act, strike })
              }
            }
            onShortPress={
            me
              ? async (e) => {
                  if (!item || voteLock) return

                  // we can't tip ourselves
                  if (noSelfTips) {
                    return
                  }

                  if (item?.meVote) {
                    setVoteShow(false)
                    try {
                      strike()
                      await act({ variables: { id: item.id, act: 'TIP', sats: me.tipDefault || 1 } })
                    } catch (e) {
                      console.log(e)
                    }
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
              <div
                className={`${noSelfTips ? styles.noSelfTips : ''}
                    ${styles.upvoteWrapper}`}
              >
                <UpBolt
                  width={24}
                  height={24}
                  className={
                      `${styles.upvote}
                      ${className || ''}
                      ${noSelfTips ? styles.noSelfTips : ''}
                      ${item?.meSats ? styles.voted : ''}`
                    }
                  style={item?.meSats
                    ? {
                        fill: color,
                        filter: `drop-shadow(0 0 6px ${color}90)`
                      }
                    : undefined}
                />
              </div>
            </ActionTooltip>
          </LongPressable>
          <TipPopover target={ref.current} show={tipShow} handleClose={() => setTipShow(false)} />
          <UpvotePopover target={ref.current} show={voteShow} handleClose={() => setVoteShow(false)} />
        </div>}
    </LightningConsumer>
  )
}
