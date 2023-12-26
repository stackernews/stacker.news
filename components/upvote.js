import UpBolt from '../svgs/bolt.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import ActionTooltip from './action-tooltip'
import ItemAct, { useAct } from './item-act'
import { useMe } from './me'
import getColor from '../lib/rainbow'
import { useCallback, useMemo, useRef, useState } from 'react'
import LongPressable from 'react-longpressable'
import Overlay from 'react-bootstrap/Overlay'
import Popover from 'react-bootstrap/Popover'
import { useShowModal } from './modal'
import { LightningConsumer, useLightning } from './lightning'
import { numWithUnits } from '../lib/format'
import { payOrLoginError, useInvoiceModal } from './invoice'
import useDebounceCallback from './use-debounce-callback'
import { useToast } from './toast'
import { Dropdown } from 'react-bootstrap'

const UpvotePopover = ({ target, show, handleClose }) => {
  const me = useMe()
  return (
    <Overlay
      show={show}
      target={target}
      placement='right'
    >
      <Popover id='popover-basic'>
        <Popover.Header className='d-flex justify-content-between alert-dismissible' as='h4'>Zapping
          <button type='button' className='btn-close' onClick={handleClose}><span className='visually-hidden-focusable'>Close alert</span></button>
        </Popover.Header>
        <Popover.Body>
          <div className='mb-2'>Press the bolt again to zap {me?.privates?.tipDefault || 1} more sat{me?.privates?.tipDefault > 1 ? 's' : ''}.</div>
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
      <Popover.Header className='d-flex justify-content-between alert-dismissible' as='h4'>Press and hold
        <button type='button' className='btn-close' onClick={handleClose}><span className='visually-hidden-focusable'>Close alert</span></button>
      </Popover.Header>
      <Popover.Body>
        <div className='mb-2'>Press and hold bolt to zap a custom amount.</div>
        <div>As you zap more, the bolt color follows the rainbow.</div>
      </Popover.Body>
    </Popover>
  </Overlay>
)

export function DropdownItemUpVote ({ item }) {
  const showModal = useShowModal()
  const strike = useLightning()

  return (
    <Dropdown.Item
      onClick={async () => {
        showModal(onClose =>
          <ItemAct onClose={onClose} itemId={item.id} strike={strike} />)
      }}
    >
      <span className='text-success'>zap</span>
    </Dropdown.Item>
  )
}

export default function UpVote ({ item, className, pendingSats, setPendingSats }) {
  const showModal = useShowModal()
  const [voteShow, _setVoteShow] = useState(false)
  const [tipShow, _setTipShow] = useState(false)
  const ref = useRef()
  const me = useMe()
  const strike = useLightning()
  const toaster = useToast()
  const [setWalkthrough] = useMutation(
    gql`
      mutation setWalkthrough($upvotePopover: Boolean, $tipPopover: Boolean) {
        setWalkthrough(upvotePopover: $upvotePopover, tipPopover: $tipPopover)
      }`
  )

  const setVoteShow = useCallback((yes) => {
    if (!me) return

    // if they haven't seen the walkthrough and they have sats
    if (yes && !me.privates?.upvotePopover && me.privates?.sats) {
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
    if (yes && !me.privates?.tipPopover && me.privates?.sats) {
      _setTipShow(true)
    }

    // if it's currently showing and we want to hide it
    if (tipShow && !yes) {
      _setTipShow(false)
      setWalkthrough({ variables: { tipPopover: true } })
    }
  }, [me, tipShow, setWalkthrough])

  const [act] = useAct()

  const showInvoiceModal = useInvoiceModal(
    async ({ hash, hmac }, { variables }) => {
      await act({ variables: { ...variables, hash, hmac } })
      strike()
    }, [act, strike])

  const zap = useDebounceCallback(async (sats) => {
    if (!sats) return
    const variables = { id: item.id, sats, act: 'TIP' }

    act({
      variables,
      optimisticResponse: {
        act: {
          id: item.id,
          sats,
          path: item.path,
          act: 'TIP'
        }
      }
    }).catch((error) => {
      if (payOrLoginError(error)) {
        showInvoiceModal({ amount: sats }, { variables })
        return
      }
      console.error(error)
      toaster.danger(error?.message || error?.toString?.())
    })
    setPendingSats(0)
  }, 500, [act, toaster, item?.id, item?.path, showInvoiceModal, setPendingSats])

  const disabled = useMemo(() => item?.mine || item?.meForward || item?.deletedAt,
    [item?.mine, item?.meForward, item?.deletedAt])

  const [meSats, sats, overlayText, color] = useMemo(() => {
    const meSats = (item?.meSats || item?.meAnonSats || 0) + pendingSats

    // what should our next tip be?
    let sats = me?.privates?.tipDefault || 1
    if (me?.privates?.turboTipping) {
      let raiseTip = sats
      while (meSats >= raiseTip) {
        raiseTip *= 10
      }

      sats = raiseTip - meSats
    }

    return [meSats, sats, me ? numWithUnits(sats, { abbreviate: false }) : 'zap it', getColor(meSats)]
  }, [item?.meSats, item?.meAnonSats, pendingSats, me?.privates?.tipDefault, me?.privates?.turboDefault])

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
                  <ItemAct onClose={onClose} itemId={item.id} strike={strike} />)
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
                } else {
                  setTipShow(true)
                }

                strike()

                setPendingSats(pendingSats => {
                  const zapAmount = pendingSats + sats
                  zap(zapAmount)
                  return zapAmount
                })
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
