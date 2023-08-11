import UpBolt from '../svgs/bolt.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import FundError, { isInsufficientFundsError } from './fund-error'
import ActionTooltip from './action-tooltip'
import ItemAct from './item-act'
import { useMe } from './me'
import Rainbow from '../lib/rainbow'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LongPressable from 'react-longpressable'
import Overlay from 'react-bootstrap/Overlay'
import Popover from 'react-bootstrap/Popover'
import { useShowModal } from './modal'
import { LightningConsumer, useLightning } from './lightning'
import { numWithUnits } from '../lib/format'

const getColor = (meSats) => {
  if (!meSats || meSats <= 10) {
    return 'var(--bs-secondary)'
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
        <Popover.Body className='d-flex justify-content-between alert-dismissible' as='h3'>Zapping
          <button type='button' className='close' onClick={handleClose}><span aria-hidden='true'>×</span><span className='visually-hidden-focusable'>Close alert</span></button>
        </Popover.Body>
        <Popover.Body>
          <div className='mb-2'>Press the bolt again to zap {me?.tipDefault || 1} more sat{me?.tipDefault > 1 ? 's' : ''}.</div>
          <div>Repeatedly press the bolt to zap more sats.</div>
        </Popover.Body>
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
      <Popover.Body className='d-flex justify-content-between alert-dismissible' as='h3'>Press and hold
        <button type='button' className='close' onClick={handleClose}><span aria-hidden='true'>×</span><span className='visually-hidden-focusable'>Close alert</span></button>
      </Popover.Body>
      <Popover.Body>
        <div className='mb-2'>Press and hold bolt to zap a custom amount.</div>
        <div>As you zap more, the bolt color follows the rainbow.</div>
      </Popover.Body>
    </Popover>
  </Overlay>
)

export default function UpVote ({ item, className, pendingSats, setPendingSats }) {
  const showModal = useShowModal()
  const [voteShow, _setVoteShow] = useState(false)
  const [tipShow, _setTipShow] = useState(false)
  const ref = useRef()
  const timerRef = useRef(null)
  const me = useMe()
  const strike = useLightning()
  const [setWalkthrough] = useMutation(
    gql`
      mutation setWalkthrough($upvotePopover: Boolean, $tipPopover: Boolean) {
        setWalkthrough(upvotePopover: $upvotePopover, tipPopover: $tipPopover)
      }`
  )

  const setVoteShow = useCallback((yes) => {
    if (!me) return

    // if they haven't seen the walkthrough and they have sats
    if (yes && !me.upvotePopover && me.sats) {
      _setVoteShow(true)
    }

    if (voteShow && !yes) {
      _setVoteShow(false)
      setWalkthrough({ variables: { upvotePopover: true } })
    }
  }, [me, voteShow, setWalkthrough])

  const setTipShow = useCallback((yes) => {
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
  }, [me, tipShow, setWalkthrough])

  const [act] = useMutation(
    gql`
      mutation act($id: ID!, $sats: Int!, $invoiceHash: String, $invoiceHmac: String) {
        act(id: $id, sats: $sats, invoiceHash: $invoiceHash, invoiceHmac: $invoiceHmac) {
          sats
        }
      }`, {
      update (cache, { data: { act: { sats } } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            sats (existingSats = 0) {
              return existingSats + sats
            },
            meSats: me
              ? (existingSats = 0) => {
                  if (sats <= me.sats) {
                    if (existingSats === 0) {
                      setVoteShow(true)
                    } else {
                      setTipShow(true)
                    }
                  }

                  return existingSats + sats
                }
              : undefined
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

  // if we want to use optimistic response, we need to buffer the votes
  // because if someone votes in quick succession, responses come back out of order
  // so we wait a bit to see if there are more votes coming in
  // this effectively performs our own debounced optimistic response
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if (pendingSats > 0) {
      timerRef.current = setTimeout(async (sats) => {
        const variables = { id: item.id, sats: pendingSats }
        try {
          timerRef.current && setPendingSats(0)
          await act({
            variables,
            optimisticResponse: {
              act: {
                sats
              }
            }
          })
        } catch (error) {
          if (isInsufficientFundsError(error)) {
            showModal(onClose => {
              return (
                <FundError
                  onClose={onClose}
                  amount={pendingSats}
                  onPayment={async (_, invoiceHash) => {
                    await act({ variables: { ...variables, invoiceHash } })
                    strike()
                  }}
                />
              )
            })
            return
          }
          if (!timerRef.current) return
          throw new Error({ message: error.toString() })
        }
      }, 500, pendingSats)
    }

    return async () => {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [pendingSats, act, item, showModal, setPendingSats])

  const disabled = useMemo(() => {
    return item?.mine || (me && Number(me.id) === item?.fwdUserId) || item?.deletedAt
  }, [me?.id, item?.fwdUserId, item?.mine, item?.deletedAt])

  const [meSats, sats, overlayText, color] = useMemo(() => {
    const meSats = (item?.meSats || item?.meAnonSats || 0) + pendingSats

    // what should our next tip be?
    let sats = me?.tipDefault || 1
    if (me?.turboTipping) {
      let raiseTip = sats
      while (meSats >= raiseTip) {
        raiseTip *= 10
      }

      sats = raiseTip - meSats
    }

    return [meSats, sats, me ? numWithUnits(sats, { abbreviate: false }) : 'zap it', getColor(meSats)]
  }, [item?.meSats, item?.meAnonSats, pendingSats, me?.tipDefault, me?.turboDefault])

  return (
    <LightningConsumer>
      {(strike) =>
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

                if (meSats) {
                  setVoteShow(false)
                }

                strike()

                setPendingSats(pendingSats + sats)
              }
              : () => showModal(onClose => <ItemAct onClose={onClose} itemId={item.id} act={act} strike={strike} />)
          }
          >
            <ActionTooltip notForm disable={disabled} overlayText={overlayText}>
              <div
                className={`${disabled ? styles.noSelfTips : ''} ${styles.upvoteWrapper}`}
              >
                <UpBolt
                  width={26}
                  height={26}
                  className={
                      `${styles.upvote}
                      ${className || ''}
                      ${disabled ? styles.noSelfTips : ''}
                      ${meSats ? styles.voted : ''}`
                    }
                  style={meSats
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
