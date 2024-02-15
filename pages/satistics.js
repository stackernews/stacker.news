import { useQuery } from '@apollo/client'
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
import PayerData from '../components/payer-data'
import { Badge } from 'react-bootstrap'
import { useMe } from '../components/me'
import dynamic from 'next/dynamic'

export const getServerSideProps = getGetServerSideProps({ query: WALLET_HISTORY, authRequired: true })

const WhenAreaChart = dynamic(() => import('../components/charts').then(mod => mod.WhenAreaChart), {
  loading: () => <div>Loading...</div>
})
const WhenLineChart = dynamic(() => import('../components/charts').then(mod => mod.WhenLineChart), {
  loading: () => <div>Loading...</div>
})
const WhenComposedChart = dynamic(() => import('../components/charts').then(mod => mod.WhenComposedChart), {
  loading: () => <div>Loading...</div>
})

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
    <span className='d-inline-block'>
      <Icon /><small className={`text-${color} fw-bold ms-2`}>{desc}</small>
    </span>
  )
}

function Detail ({ fact }) {
  if (fact.type === 'earn') {
    return (
      <Link href={`/rewards/${new Date(fact.createdAt).toISOString().slice(0, 10)}`} className='px-3 text-reset' style={{ lineHeight: '140%' }}>
        SN distributes the sats it earns back to its best stackers daily. These sats come from jobs, boosts, posting fees, and donations.
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

  if (fact.type === 'billing') {
    return (
      <div className='px-3'>billing for <Link href={`/~${fact.subName}`}>~{fact.subName}</Link></div>
    )
  }

  if (fact.type === 'revenue') {
    return (
      <div className='px-3'>revenue for <Link href={`/~${fact.subName}`}>~{fact.subName}</Link></div>
    )
  }

  if (!fact.item) {
    let zap
    try {
      zap = JSON.parse(fact.description)
    } catch { }
    return (
      <div className='px-3'>
        <Link className={satusClass(fact.status)} href={`/${fact.type}s/${fact.id}`}>
          {(!fact.bolt11 && <span className='d-block text-muted fw-bold fst-italic'>invoice deleted</span>) ||
           (zap && <span className='d-block'>nostr zap{zap.content && `: ${zap.content}`}</span>) ||
           (fact.description && <span className='d-block'>{fact.description}</span>)}
          <PayerData data={fact.invoicePayerData} className='text-muted' header />
          {fact.invoiceComment && <small className='text-muted'><b>sender says:</b> {fact.invoiceComment}</small>}
          <Satus status={fact.status} />{fact.autoWithdraw && <Badge className={styles.badge} bg={null}>autowithdraw</Badge>}
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
  const factDate = new Date(fact.createdAt)
  return (
    <>
      <div className={`${styles.type} ${satusClass(fact.status)} ${fact.sats > 0 ? '' : 'text-muted'}`}>{fact.type}</div>
      <div className={styles.detail}>
        <Detail fact={fact} />
        <div className='text-muted px-3'>{`${factDate.toLocaleDateString()} ${factDate.toLocaleTimeString()}`}</div>
      </div>
      <div className={`${styles.sats} ${satusClass(fact.status)} ${fact.sats > 0 ? '' : 'text-muted'}`}>{fact.sats}</div>
    </>
  )
}

export default function Satistics ({ ssrData }) {
  const router = useRouter()
  const { me } = useMe()
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
  const totalInvoices = facts.filter(f => f.type === 'invoice')
  const completedInvoices = facts.filter(f => f.type === 'invoice' && f.status === 'CONFIRMED')
  const totalWithdrawals = facts.filter(f => f.type === 'withdrawal')
  const completedWithdrawls = facts.filter(f => f.type === 'withdrawal' && f.status === 'CONFIRMED')
  const totalIn = facts.reduce((acc, f) => {if(f.sats > 0){acc + f.sats}}, 0)
  const totalOut = facts.reduce((acc, f) => {if(f.sats < 0){acc + f.sats}}, 0)
  return (
    <Layout contain={false} >
      <div className="mx-sm-5">
        <div className='d-flex row justify-content-between'>
          <h1 className="text-center">statistics</h1>
          <div className="col-4 col-md-4">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Invoices </h4>
                <p>Completed / Created</p>
                <h1 className="text-center">
                  {completedInvoices.length}/{totalInvoices.length}
                </h1>
              </div>
            </div>
          </div>
          <div className="col-4 col-md-4">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Withdrawals</h4>
                <p>Completed / Created</p>
                <h1 className="text-center">
                  {completedWithdrawls.length}/{totalWithdrawals.length}
                </h1>
              </div>
            </div>
          </div>
          <div className="col-4 col-md-4">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Invoices </h4>
                <p>Completed / Created</p>
                <h1 className="text-center">
                  {totalIn}/{totalOut}
                </h1>
              </div>
            </div>
          </div>

        </div>
        <div className='mt-3'>
          <h2 className='text-center'>History</h2>
          <Form
            initial={{
              invoice: included('invoice'),
              withdrawal: included('withdrawal'),
              stacked: included('stacked'),
              spent: included('spent')
            }}
          >
            <div className='d-flex justify-content-around flex-wrap'>
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
            </div>
          </Form>
          <div className="row">
            <div className="col-md-8">
              <div className="row">
                <div className="col-md-6">
                  {data && ssrData ? <WhenAreaChart data={facts} /> : "Nothin Here"}
                </div>
                <div className="col-md-6">
                  {data && ssrData ? <WhenLineChart data={facts} /> : "Nothin Here"}
                </div>
              </div>
            </div>
          <div className='col-md-4 py-2 px-0 mb-0 mw-100'>
            <div className={styles.rows}>
              <div className={[styles.type, styles.head].join(' ')}>type</div>
              <div className={[styles.detail, styles.head].join(' ')}>detail</div>
              <div className={[styles.sats, styles.head].join(' ')}>sats</div>
              {facts.map(f => <Fact key={f.type + f.id} fact={f} />)}
            </div>
          </div>
          </div>
          <MoreFooter cursor={cursor} count={facts?.length} fetchMore={fetchMore} Skeleton={PageLoading} />
        </div>
      </div>
    </Layout>
  )
}
