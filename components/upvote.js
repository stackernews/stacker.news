import UpBolt from '../svgs/bolt.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import ActionTooltip from './action-tooltip'
import ItemAct, { useAct, useZap } from './item-act'
import { useMe } from './me'
import getColor from '../lib/rainbow'
import { useCallback, useMemo, useRef, useState } from 'react'
import LongPressable from 'react-longpressable'
import Overlay from 'react-bootstrap/Overlay'
import Popover from 'react-bootstrap/Popover'
import { useShowModal } from './modal'
import { numWithUnits } from '../lib/format'
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

  return (
    <Dropdown.Item
      onClick={async () => {
        showModal(onClose =>
          <ItemAct onClose={onClose} itemId={item.id} />)
      }}
    >
      <span className='text-success'>zap</span>
    </Dropdown.Item>
  )
}

export default function UpVote ({ item, className }) {
  const showModal = useShowModal()
  const [voteShow, _setVoteShow] = useState(false)
  const [tipShow, _setTipShow] = useState(false)
  const ref = useRef()
  const me = useMe()
  const [hover, setHover] = useState(false)
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
  const zap = useZap()

  const disabled = useMemo(() => item?.mine || item?.meForward || item?.deletedAt,
    [item?.mine, item?.meForward, item?.deletedAt])

  const [meSats, overlayText, color, nextColor] = useMemo(() => {
    const meSats = (item?.meSats || item?.meAnonSats || 0)

    // what should our next tip be?
    let sats = me?.privates?.tipDefault || 1
    let raiseSats = sats
    if (me?.privates?.turboTipping) {
      while (meSats >= raiseSats) {
        raiseSats *= 10
      }

      sats = raiseSats - meSats
    } else {
      raiseSats = meSats + sats
    }

    return [
      meSats, me ? numWithUnits(sats, { abbreviate: false }) : 'zap it',
      getColor(meSats), getColor(meSats + (me?.privates?.tipDefault || 0))]
  }, [item?.meSats, item?.meAnonSats, me?.privates?.tipDefault, me?.privates?.turboDefault])

  return (
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
                  <ItemAct onClose={onClose} itemId={item.id} />)
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

                zap({ item, me })
              }
              : () => showModal(onClose => <ItemAct onClose={onClose} itemId={item.id} act={act} />)
          }
      >
        <ActionTooltip notForm disable={disabled} overlayText={overlayText}>
          <div
            className={`${disabled ? styles.noSelfTips : ''} ${styles.upvoteWrapper}`}
          >
            <UpBolt
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              width={26}
              height={26}
              className={
                      `${styles.upvote}
                      ${className || ''}
                      ${disabled ? styles.noSelfTips : ''}
                      ${meSats ? styles.voted : ''}`
                    }
              style={meSats || hover
                ? {
                    fill: hover ? nextColor : color,
                    filter: `drop-shadow(0 0 6px ${color}90)`
                  }
                : undefined}
            />
          </div>
        </ActionTooltip>
      </LongPressable>
      <TipPopover target={ref.current} show={tipShow} handleClose={() => setTipShow(false)} />
      <UpvotePopover target={ref.current} show={voteShow} handleClose={() => setVoteShow(false)} />
    </div>
  )
}
