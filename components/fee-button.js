import { useEffect, useContext, createContext, useState, useCallback, useMemo } from 'react'
import Table from 'react-bootstrap/Table'
import ActionTooltip from './action-tooltip'
import Info from './info'
import styles from './fee-button.module.css'
import { gql, useQuery } from '@apollo/client'
import { ANON_FEE_MULTIPLIER, FAST_POLL_INTERVAL_MS, SSR } from '@/lib/constants'
import { numWithUnits } from '@/lib/format'
import { useMe } from './me'
import AnonIcon from '@/svgs/spy-fill.svg'
import { useShowModal } from './modal'
import Link from 'next/link'
import { SubmitButton } from './form'

const FeeButtonContext = createContext()

export function postCommentBaseLineItems ({ subs, comment = false, bio = false, me }) {
  const anonCharge = me
    ? {}
    : {
        anonCharge: {
          term: `x ${ANON_FEE_MULTIPLIER}`,
          label: 'anon mult',
          op: '*',
          modifier: (cost) => cost * ANON_FEE_MULTIPLIER
        }
      }

  // Comments and bios are eligible for freebies (posts are not)
  const allowFreebies = comment || bio

  if (subs.length === 0) {
    return {
      baseCost: {
        term: 1,
        label: comment ? 'comment' : 'post',
        op: '_',
        modifier: (cost) => cost + 1,
        allowFreebies,
        isComment: comment
      },
      ...anonCharge
    }
  }

  return {
    ...subs.reduce((acc, s) => ({
      ...acc,
      ...{
        [`${s.name}-baseCost`]: {
          term: `+ ${comment ? s.replyCost : s.baseCost}`,
          label: `~${s.name} ${comment ? 'comment' : 'post'}`,
          op: '_',
          modifier: (cost) => cost + (comment ? s.replyCost : s.baseCost),
          allowFreebies,
          isComment: comment
        }
      }
    }), {}),
    ...anonCharge
  }
}

export function postCommentUseRemoteLineItems ({ parentId } = {}) {
  const query = parentId
    ? gql`{ itemRepetition(parentId: "${parentId}") }`
    : gql`{ itemRepetition }`

  return function useRemoteLineItems () {
    const [line, setLine] = useState({})

    const { data } = useQuery(query, SSR ? {} : { pollInterval: FAST_POLL_INTERVAL_MS, nextFetchPolicy: 'cache-and-network' })

    useEffect(() => {
      const repetition = data?.itemRepetition
      if (!repetition) return setLine({})
      setLine({
        itemRepetition: {
          term: <>x 10<sup>{repetition}</sup></>,
          label: <>{repetition} {parentId ? 'repeat or self replies' : 'posts'} in 10m</>,
          op: '*',
          modifier: (cost) => cost * Math.pow(10, repetition)
        }
      })
    }, [data?.itemRepetition])

    return line
  }
}

function sortHelper (a, b) {
  if (a.op === '_') {
    return -1
  } else if (b.op === '_') {
    return 1
  } else if (a.op === '*' || a.op === '/') {
    if (b.op === '*' || b.op === '/') {
      return 0
    }
    // a is higher precedence
    return -1
  } else {
    if (b.op === '*' || b.op === '/') {
      // b is higher precedence
      return 1
    }

    // postive first
    if (a.op === '+' && b.op === '-') {
      return -1
    }
    if (a.op === '-' && b.op === '+') {
      return 1
    }
    // both are + or -
    return 0
  }
}

const DEFAULT_BASE_LINE_ITEMS = {}
const DEFAULT_USE_REMOTE_LINE_ITEMS = () => null

export function FeeButtonProvider ({ baseLineItems = DEFAULT_BASE_LINE_ITEMS, useRemoteLineItems = DEFAULT_USE_REMOTE_LINE_ITEMS, children }) {
  const [lineItems, setLineItems] = useState({})
  const [disabled, setDisabled] = useState(false)
  const { me } = useMe()

  const remoteLineItems = useRemoteLineItems()

  const mergeLineItems = useCallback((newLineItems) => {
    setLineItems(lineItems => ({
      ...lineItems,
      ...newLineItems
    }))
  }, [setLineItems])

  const value = useMemo(() => {
    const lines = { ...baseLineItems, ...lineItems, ...remoteLineItems }
    const total = Object.values(lines).sort(sortHelper).reduce((acc, { modifier }) => modifier(acc), 0)

    // Find base cost line item (could be 'baseCost' or '*-baseCost' for territories)
    const baseCostLine = Object.values(lines).find(line => line.op === '_' && line.allowFreebies !== undefined)

    // freebies: there's only a base cost, we don't have enough sats/credits,
    // no send wallet attached, and have free comments left (for comments only)
    const cantAfford = me?.privates?.sats < total && me?.privates?.credits < total
    const hasSendWallet = me?.optional?.hasSendWallet
    const freeCommentsLeft = me?.privates?.freeCommentsLeft ?? 0
    const isComment = baseCostLine?.isComment
    const free = me &&
      total === baseCostLine?.modifier(0) &&
      baseCostLine?.allowFreebies &&
      cantAfford &&
      !hasSendWallet &&
      (!isComment || freeCommentsLeft > 0)
    return {
      lines,
      merge: mergeLineItems,
      total,
      disabled,
      setDisabled,
      free,
      freeCommentsLeft: isComment ? freeCommentsLeft : null
    }
  }, [me, me?.privates?.sats, me?.privates?.credits, me?.privates?.freeCommentsLeft, me?.optional?.hasSendWallet, baseLineItems, lineItems, remoteLineItems, mergeLineItems, disabled, setDisabled])

  return (
    <FeeButtonContext.Provider value={value}>
      {children}
    </FeeButtonContext.Provider>
  )
}

export function useFeeButton () {
  const context = useContext(FeeButtonContext)
  return context
}

function FreebieDialog ({ freeCommentsLeft }) {
  return (
    <>
      <div className='fw-bold'>you don't have enough sats, so this one is on us</div>
      <ul className='mt-2'>
        <li>Free items have limited visibility and can only earn cowboy credits until other stackers zap them.</li>
        {freeCommentsLeft !== null && (
          <li>You have {freeCommentsLeft} free comment{freeCommentsLeft !== 1 ? 's' : ''} left this month.</li>
        )}
        <li>To get fully visible right away, fund your account with a few sats or earn some on Stacker News.</li>
      </ul>
    </>
  )
}

export default function FeeButton ({ ChildButton = SubmitButton, variant, text, disabled }) {
  const { me } = useMe()
  const { lines, total, disabled: ctxDisabled, free, freeCommentsLeft } = useFeeButton()
  const feeText = free
    ? 'free'
    : total > 1
      ? numWithUnits(total, { abbreviate: false, format: true })
      : undefined
  disabled ||= ctxDisabled

  return (
    <div className={styles.feeButton}>
      <ActionTooltip overlayText={!free && total === 1 ? '1 sat' : feeText}>
        <ChildButton
          variant={variant} disabled={disabled}
          appendText={feeText}
          submittingText={free || !feeText ? undefined : 'paying...'}
        >{text}
        </ChildButton>
      </ActionTooltip>
      {!me && <AnonInfo />}
      {(free && <Info><FreebieDialog freeCommentsLeft={freeCommentsLeft} /></Info>) ||
       (total > 1 && <Info><Receipt lines={lines} total={total} /></Info>)}
    </div>
  )
}

function Receipt ({ lines, total }) {
  return (
    <Table className={styles.receipt} borderless size='sm'>
      <tbody>
        {Object.entries(lines).sort(([, a], [, b]) => sortHelper(a, b)).map(([key, { term, label, omit }]) => (
          !omit &&
            <tr key={key}>
              <td>{term}</td>
              <td align='right' className='font-weight-light'>{label}</td>
            </tr>))}
      </tbody>
      <tfoot>
        <tr>
          <td className='fw-bold'>{numWithUnits(total, { abbreviate: false, format: true })}</td>
          <td align='right' className='font-weight-light'>total fee</td>
        </tr>
      </tfoot>
    </Table>
  )
}

function AnonInfo () {
  const showModal = useShowModal()

  return (
    <AnonIcon
      className='ms-2 fill-theme-color pointer' height={22} width={22}
      onClick={
        (e) =>
          showModal(onClose =>
            <div><div className='fw-bold text-center'>You are posting without an account</div>
              <ol className='my-3'>
                <li>You'll pay by invoice</li>
                <li>Your content will be content-joined (get it?!) under the <Link href='/anon' target='_blank'>@anon</Link> account</li>
                <li>Any sats your content earns will go toward <Link href='/rewards' target='_blank'>rewards</Link></li>
                <li>We won't be able to notify you when you receive replies</li>
              </ol>
              <small className='text-center fst-italic text-muted'>btw if you don't need to be anonymous, posting is cheaper with an account</small>
            </div>)
      }
    />
  )
}
