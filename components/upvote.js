import UpBolt from '../svgs/bolt.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import FundError from './fund-error'
import ActionTooltip from './action-tooltip'
import ItemAct from './item-act'
import { useMe } from './me'
import Rainbow from '../lib/rainbow'
import { useRef, useState } from 'react'
import LongPressable from 'react-longpressable'
import { Overlay, Popover } from 'react-bootstrap'
import { useShowModal } from './modal'
import { useRouter } from 'next/router'
import { LightningConsumer } from './lightning'

const getColor = (meSats) => {
  if (!meSats || meSats <= 10) {
    return 'var(--secondary)'
  }

  const idx = Math.min(
    Math.floor((Math.log(meSats) / Math.log(10000)) * (Rainbow.length - 1)),
    Rainbow.length - 1)
  return Rainbow[idx]
}

const UpvotePopover = ({ target, show, handleClose }) => {
  const me = useMe()
  return (
    <Overlay
      show={show}
      target={target}
      placement='right'
    >
      <Popover id='popover-basic'>
        <Popover.Title className='d-flex justify-content-between alert-dismissible' as='h3'>Zapping
          <button type='button' className='close' onClick={handleClose}><span aria-hidden='true'>×</span><span className='sr-only'>Close alert</span></button>
        </Popover.Title>
        <Popover.Content>
          <div className='mb-2'>Press the bolt again to zap {me?.tipDefault || 1} more sat{me?.tipDefault > 1 ? 's' : ''}.</div>
          <div>Repeatedly press the bolt to zap more sats.</div>
        </Popover.Content>
      </Popover>
    </Overlay>
  )
}

const TipPopover = ({ target, show, handleClose }) => (
  <Overlay
    show={show}
    target={target}
    placement='right'
  >
    <Popover id='popover-basic'>
      <Popover.Title className='d-flex justify-content-between alert-dismissible' as='h3'>Press and hold
        <button type='button' className='close' onClick={handleClose}><span aria-hidden='true'>×</span><span className='sr-only'>Close alert</span></button>
      </Popover.Title>
      <Popover.Content>
        <div className='mb-2'>Press and hold bolt to zap a custom amount.</div>
        <div>As you zap more, the bolt color follows the rainbow.</div>
      </Popover.Content>
    </Popover>
  </Overlay>
)

export default function UpVote ({ item, className }) {
  const showModal = useShowModal()
  const router = useRouter()
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

  const fwd2me = me && Number(me?.id) === item?.fwdUserId

  const setVoteShow = (yes) => {
    if (!me) return

    // if they haven't seen the walkthrough and they have sats
    if (yes && !me.upvotePopover && me.sats) {
      _setVoteShow(true)
    }

    if (voteShow && !yes) {
      _setVoteShow(false)
      setWalkthrough({ variables: { upvotePopover: true } })
    }
  }

  const setTipShow = (yes) => {
    if (!me) return

    // if we want to show it, yet we still haven't shown
    if (yes && !me.tipPopover && me.sats) {
      _setTipShow(true)
    }

    // if it's currently showing and we want to hide it
    if (tipShow && !yes) {
      _setTipShow(false)
      setWalkthrough({ variables: { tipPopover: true } })
    }
  }

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
              if (sats <= me.sats) {
                if (existingSats === 0) {
                  setVoteShow(true)
                } else {
                  setTipShow(true)
                }
              }

              return existingSats + sats
            },
            upvotes (existingUpvotes = 0) {
              return existingUpvotes + vote
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

  // what should our next tip be?
  let sats = me?.tipDefault || 1
  if (me?.turboTipping && item?.meSats) {
    let raiseTip = sats
    while (item?.meSats >= raiseTip) {
      raiseTip *= 10
    }

    sats = raiseTip - item.meSats
  }

  const overlayText = () => {
    return `${sats} sat${sats > 1 ? 's' : ''}`
  }

  const disabled = item?.mine || fwd2me || item?.deletedAt

  const color = getColor(item?.meSats)
  return (
    <LightningConsumer>
      {({ strike }) =>
        <div ref={ref} className='upvoteParent'>
          <LongPressable
            onLongPress={
              async (e) => {
                if (!item) return

                // we can't tip ourselves
                if (disabled) {
                  return
                }

                setTipShow(false)
                showModal(onClose =>
                  <ItemAct onClose={onClose} itemId={item.id} act={act} strike={strike} />)
              }
            }
            onShortPress={
            me
              ? async (e) => {
                  if (!item) return

                  // we can't tip ourselves
                  if (disabled) {
                    return
                  }

                  if (item?.meSats) {
                    setVoteShow(false)
                  }

                  strike()

                  try {
                    await act({
                      variables: { id: item.id, sats },
                      optimisticResponse: {
                        act: {
                          id: `Item:${item.id}`,
                          sats,
                          vote: 0
                        }
                      }
                    })
                  } catch (error) {
                    if (error.toString().includes('insufficient funds')) {
                      showModal(onClose => {
                        return <FundError onClose={onClose} />
                      })
                      return
                    }
                    throw new Error({ message: error.toString() })
                  }
                }
              : async () => await router.push({
                pathname: '/signup',
                query: { callbackUrl: window.location.origin + router.asPath }
              })
          }
          >
            <ActionTooltip notForm disable={disabled} overlayText={overlayText()}>
              <div
                className={`${disabled ? styles.noSelfTips : ''}
                    ${styles.upvoteWrapper}`}
              >
                <UpBolt
                  width={24}
                  height={24}
                  className={
                      `${styles.upvote}
                      ${className || ''}
                      ${disabled ? styles.noSelfTips : ''}
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
