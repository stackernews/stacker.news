import { gql, useQuery, useMutation } from '@apollo/client'
import Link from 'next/link'
import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import MoreFooter from '../components/more-footer'
import { WALLET_HISTORY } from '../fragments/wallet'
import styles from '../styles/satistics.module.css'
import Moon from '../svgs/moon-fill.svg'
import Check from '../svgs/check-double-line.svg'
import ThumbDown from '../svgs/thumb-down-fill.svg'
import { Checkbox, Form } from '../components/form'
import { useRouter } from 'next/router'
import Item from '../components/item'
import { CommentFlat } from '../components/comment'
import ItemJob from '../components/item-job'
import PageLoading from '../components/page-loading'
import DownloadFile from '../svgs/file-download-line.svg'
import { useMe } from '../components/me'
import { CsvStatus } from '../lib/constants'
import { useToast } from '../components/toast'
import { useEffect, useState } from 'react'

export const getServerSideProps = getGetServerSideProps({ query: WALLET_HISTORY, authRequired: true })

function satusClass (status) {
  if (!status) {
    return ''
  }

  switch (status) {
    case 'CONFIRMED':
      return 'text-reset'
    case 'PENDING':
      return 'text-muted'
    default:
      return `${styles.failed} text-muted`
  }
}

function Satus ({ status }) {
  if (!status) {
    return null
  }

  let color = 'danger'; let desc
  switch (status) {
    case 'CONFIRMED':
      desc = 'confirmed'
      color = 'success'
      break
    case 'EXPIRED':
      desc = 'expired'
      color = 'muted'
      break
    case 'PENDING':
      desc = 'pending'
      color = 'muted'
      break
    case 'INSUFFICIENT_BALANCE':
      desc = "you didn't have enough sats"
      break
    case 'INVALID_PAYMENT':
      desc = 'invalid payment'
      break
    case 'PATHFINDING_TIMEOUT':
    case 'ROUTE_NOT_FOUND':
      desc = 'no route found'
      break
    default:
      return 'unknown failure'
  }

  const Icon = () => {
    switch (status) {
      case 'CONFIRMED':
        return <Check width='20' height='20' className={`fill-${color}`} />
      case 'PENDING':
        return <Moon width='20' height='20' className={`fill-${color} spin`} />
      default:
        return <ThumbDown width='18' height='18' className={`fill-${color}`} />
    }
  }

  return (
    <span className='d-block'>
      <Icon /><small className={`text-${color} fw-bold ms-2`}>{desc}</small>
    </span>
  )
}

function Detail ({ fact }) {
  if (fact.type === 'earn') {
    return (
      <Link href={`/rewards/${new Date(fact.createdAt).toISOString().slice(0, 10)}`} className='px-3 text-reset' style={{ lineHeight: '140%' }}>
        SN distributes the sats it earns back to its best stackers daily. These sats come from <Link href='/~jobs'>jobs</Link>, boosts, posting fees, and donations.
      </Link>
    )
  }
  if (fact.type === 'donation') {
    return (
      <div className='px-3'>
        You made a donation to <Link href='/rewards'>daily rewards</Link>!
      </div>
    )
  }
  if (fact.type === 'referral') {
    return (
      <div className='px-3'>
        You stacked sats from <Link href='/referrals/month'>a referral</Link>!
      </div>
    )
  }

  if (!fact.item) {
    return (
      <div className='px-3'>
        <Link className={satusClass(fact.status)} href={`/${fact.type}s/${fact.factId}`}>
          {fact.description || 'no invoice description'}
          <Satus status={fact.status} />
        </Link>
      </div>
    )
  }

  if (fact.item.title) {
    if (fact.item.isJob) {
      return <ItemJob className={styles.itemWrapper} item={fact.item} />
    }
    return <Item item={fact.item} siblingComments />
  }

  return <CommentFlat item={fact.item} includeParent noReply truncate />
}

function Fact ({ fact }) {
  return (
    <>
      <div className={`${styles.type} ${satusClass(fact.status)} ${fact.sats > 0 ? '' : 'text-muted'}`}>{fact.type}</div>
      <div className={styles.detail}>
        <Detail fact={fact} />
      </div>
      <div className={`${styles.sats} ${satusClass(fact.status)} ${fact.sats > 0 ? '' : 'text-muted'}`}>{fact.sats}</div>
    </>
  )
}

export default function Satistics ({ ssrData }) {
  const router = useRouter()
  const toaster = useToast()
  const { data, fetchMore } = useQuery(WALLET_HISTORY, { variables: { inc: router.query.inc } })
  if (!data && !ssrData) return <PageLoading />

  function filterRoutePush (filter, add) {
    const inc = new Set(router.query.inc?.split(','))
    inc.delete('')
    // depending on addrem, add or remove filter
    if (add) {
      inc.add(filter)
    } else {
      inc.delete(filter)
    }

    const incstr = [...inc].join(',')
    router.push(`/satistics?inc=${incstr}`)
  }

  function included (filter) {
    const inc = new Set(router.query.inc?.split(','))
    return inc.has(filter)
  }

  const { walletHistory: { facts, cursor } } = data || ssrData

  const me = useMe()
  const csvBtnClass =
    !me.requestingCsv
      ? 'btn-grey-darkmode'
      : me.csvStatus === CsvStatus.DONE
        ? 'btn-success'
        : 'btn-danger'
  const iconClass =
    me.requestingCsv && me.csvStatus === CsvStatus.IN_PROGRESS
      ? styles.busyanim
      : ''
  const handleCsvClick = async (event) => {
    if (me.requestingCsv && me.csvStatus === CsvStatus.DONE) {
      toaster.success('downloading...')
      return
    }
    event.preventDefault()
    const request = !me.requestingCsv
    toaster.success(request ? 'preparing...please wait' : 'canceled')
    try {
      await requestingCsv({ variables: { value: request } })
    } catch (err) {
      console.log(err)
      toaster.danger('mutation failed')
    }
  }
  const [requestingCsv] = useMutation(gql`
    mutation requestingCsv($value: Boolean!) {
      requestingCsv(value: $value)
    }`, {
    update (cache, { data: { requestingCsv } }) {
      cache.modify({
        id: `User:${me.id}`,
        fields: {
          requestingCsv: () => requestingCsv
        }
      })
    }
  })
  const [btnState, setBtnState] = useState('')
  useEffect(() => {
    if (csvBtnClass !== btnState) {
      setBtnState(csvBtnClass)
      if (csvBtnClass === 'btn-success') toaster.success('ready to download')
    }
  }, [csvBtnClass])

  return (
    <Layout>
      <div className='mt-3'>
        <h2 className='text-center'>satistics</h2>
        <Form
          initial={{
            invoice: included('invoice'),
            withdrawal: included('withdrawal'),
            stacked: included('stacked'),
            spent: included('spent')
          }}
        >
          <div className={`${styles.options} d-flex justify-content-between flex-wrap`}>
            <Checkbox
              label='invoice' name='invoice' inline
              checked={included('invoice')}
              handleChange={c => filterRoutePush('invoice', c)}
            />
            <Checkbox
              label='withdrawal' name='withdrawal' inline
              checked={included('withdrawal')}
              handleChange={c => filterRoutePush('withdrawal', c)}
            />
            <Checkbox
              label='stacked' name='stacked' inline
              checked={included('stacked')}
              handleChange={c => filterRoutePush('stacked', c)}
            />
            <Checkbox
              label='spent' name='spent' inline
              checked={included('spent')}
              handleChange={c => filterRoutePush('spent', c)}
            />
            <div className='form-group undefined'>
              <Link
                className={`btn ${csvBtnClass} btn-sm px-3`}
                onClick={handleCsvClick}
                href={`/satistics.csv?inc=${router.query.inc}`}
                download={`statistics-${router.query.inc?.split(',').join('-')}.csv`}
                target='_blank' rel='noreferrer'
              >
                <DownloadFile className={`fill-white ${iconClass}`} height={18} weight={18} />
              </Link>
            </div>
          </div>
        </Form>
        <div className='py-2 px-0 mb-0 mw-100'>
          <div className={styles.rows}>
            <div className={[styles.type, styles.head].join(' ')}>type</div>
            <div className={[styles.detail, styles.head].join(' ')}>detail</div>
            <div className={[styles.sats, styles.head].join(' ')}>sats</div>
            {facts.map(f => <Fact key={f.id} fact={f} />)}
          </div>
        </div>
        <MoreFooter cursor={cursor} count={facts?.length} fetchMore={fetchMore} Skeleton={PageLoading} />
      </div>
    </Layout>
  )
}
