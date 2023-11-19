import { useEffect, useContext, createContext, useState, useCallback, useMemo } from 'react'
import Table from 'react-bootstrap/Table'
import ActionTooltip from './action-tooltip'
import Info from './info'
import styles from './fee-button.module.css'
import { gql, useQuery } from '@apollo/client'
import { SSR, UPPER_CHARS_TITLE_FEE_MULT } from '../lib/constants'
import { numWithUnits } from '../lib/format'
import { useMe } from './me'
import AnonIcon from '../svgs/spy-fill.svg'
import { useShowModal } from './modal'
import Link from 'next/link'
import { SubmitButton } from './form'
import { titleExceedsFreeUppercase } from '../lib/item'

const FeeButtonContext = createContext()

export function postCommentBaseLineItems ({ baseCost = 1, comment = false, me }) {
  // XXX this doesn't match the logic on the server but it has the same
  // result on fees ... will need to change the server logic to match
  const anonCharge = me
    ? {}
    : {
        anonCharge: {
          term: 'x 100',
          label: 'anon mult',
          modifier: (cost) => cost * 100
        }
      }
  return {
    baseCost: {
      term: baseCost,
      label: `${comment ? 'comment' : 'post'} cost`,
      modifier: (cost) => cost + baseCost
    },
    ...anonCharge
  }
}

export function postCommentUseRemoteLineItems ({ parentId, me } = {}) {
  if (!me) return () => {}
  const query = parentId
    ? gql`{ itemRepetition(parentId: "${parentId}") }`
    : gql`{ itemRepetition }`
  return function useRemoteLineItems () {
    const [line, setLine] = useState({})

    const { data } = useQuery(query, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })

    useEffect(() => {
      const repetition = data?.itemRepetition || 0
      if (!repetition) return
      setLine({
        itemRepetition: {
          term: <>x 10<sup>{repetition}</sup></>,
          label: <>{repetition} {parentId ? 'repeat or self replies' : 'posts'} in 10m</>,
          modifier: (cost) => cost * Math.pow(10, repetition)
        }
      })
    }, [data?.itemRepetition])

    return line
  }
}

export function FeeButtonProvider ({ baseLineItems = {}, useRemoteLineItems = () => null, children }) {
  const [lineItems, setLineItems] = useState({})
  const [disabled, setDisabled] = useState(false)

  const remoteLineItems = useRemoteLineItems()

  const mergeLineItems = useCallback((newLineItems) => {
    setLineItems(lineItems => ({
      ...lineItems,
      ...newLineItems
    }))
  }, [setLineItems])

  const value = useMemo(() => {
    const lines = { ...baseLineItems, ...lineItems, ...remoteLineItems }
    return {
      lines,
      merge: mergeLineItems,
      total: Object.entries(lines)
        .sort((entryA, entryB) => {
          // boost comes last, so it doesn't get multiplied by any multipliers
          if (entryB[0] === 'boost') {
            return -1
          }
          if (entryA[0] === 'boost') {
            return 1
          }
          return 0
        })
        .map(entry => entry[1])
        .reduce((acc, { modifier }) => modifier(acc), 0),
      disabled,
      setDisabled
    }
  }, [baseLineItems, lineItems, remoteLineItems, mergeLineItems, disabled, setDisabled])

  return (
    <FeeButtonContext.Provider value={value}>
      {children}
    </FeeButtonContext.Provider>
  )
}

export function useFeeButton () {
  return useContext(FeeButtonContext)
}

export default function FeeButton ({ ChildButton = SubmitButton, variant, text, disabled }) {
  const me = useMe()
  const { lines, total, disabled: ctxDisabled } = useFeeButton()

  return (
    <div className={styles.feeButton}>
      <ActionTooltip overlayText={numWithUnits(total, { abbreviate: false })}>
        <ChildButton variant={variant} disabled={disabled || ctxDisabled}>{text}{total > 1 && <small> {numWithUnits(total, { abbreviate: false, format: true })}</small>}</ChildButton>
      </ActionTooltip>
      {!me && <AnonInfo />}
      {total > 1 &&
        <Info>
          <Receipt lines={lines} total={total} />
        </Info>}
    </div>
  )
}

export const uppercaseTitleFeeHandler = (feeButtonHook, title, item) => {
  const tooManyUppercase = !item?.hasPaidUpperTitleFee && titleExceedsFreeUppercase({ title })
  feeButtonHook.merge({
    uppercaseTitle: {
      term: `x ${UPPER_CHARS_TITLE_FEE_MULT}`,
      label: 'uppercase title mult',
      modifier: cost => cost * (tooManyUppercase ? UPPER_CHARS_TITLE_FEE_MULT : 1),
      omit: !tooManyUppercase
    }
  })
}

function Receipt ({ lines, total }) {
  return (
    <Table className={styles.receipt} borderless size='sm'>
      <tbody>
        {Object.entries(lines).map(([key, { term, label, omit }]) => (
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
      className='fill-muted ms-2 theme' height={22} width={22}
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
