import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { Table } from 'react-bootstrap'
import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import MoreFooter from '../components/more-footer'
import UserHeader from '../components/user-header'
import { WALLET_HISTORY } from '../fragments/wallet'
import styles from '../styles/satistics.module.css'
import Moon from '../svgs/moon-fill.svg'
import Check from '../svgs/check-double-line.svg'
import ThumbDown from '../svgs/thumb-down-fill.svg'
import { Checkbox, Form } from '../components/form'
import { useRouter } from 'next/router'
import Item from '../components/item'
import Comment from '../components/comment'
import React from 'react'

export const getServerSideProps = getGetServerSideProps(WALLET_HISTORY)

function satusClass (status) {
  if (!status) {
    return ''
  }

  switch (status) {
    case 'CONFIRMED':
      return ''
    case 'PENDING':
      return 'text-muted'
    default:
      return styles.failed
  }
}

function Satus ({ status }) {
  if (!status) {
    return null
  }

  const desc = () => {
    switch (status) {
      case 'CONFIRMED':
        return 'confirmed'
      case 'EXPIRED':
        return 'expired'
      case 'INSUFFICIENT_BALANCE':
        return "you didn't have enough sats"
      case 'INVALID_PAYMENT':
        return 'invalid payment'
      case 'PATHFINDING_TIMEOUT':
      case 'ROUTE_NOT_FOUND':
        return 'no route found'
      case 'PENDING':
        return 'pending'
      default:
        return 'unknown failure'
    }
  }

  const color = () => {
    switch (status) {
      case 'CONFIRMED':
        return 'success'
      case 'PENDING':
        return 'muted'
      default:
        return 'danger'
    }
  }

  const Icon = () => {
    switch (status) {
      case 'CONFIRMED':
        return <Check width='14' height='14' className='fill-success' />
      case 'PENDING':
        return <Moon width='14' height='14' className='spin fill-grey' />
      default:
        return <ThumbDown width='14' height='14' className='fill-danger' />
    }
  }

  return (
    <div>
      <Icon /><small className={`text-${color()}`}>{' ' + desc()}</small>
    </div>
  )
}

function Detail ({ fact }) {
  if (fact.type === 'earn') {
    return (
      <>
        <div className={satusClass(fact.status)}>
            SN distributes the sats it earns back to its best users daily. These sats come from <Link href='/~jobs' passHref><a>jobs</a></Link>, boosts, posting fees, and donations. You can see the daily rewards pool and make a donation <Link href='/rewards' passHref><a>here</a></Link>.
        </div>
      </>
    )
  }
  if (fact.type === 'donation') {
    return (
      <>
        <div className={satusClass(fact.status)}>
          You made a donation to <Link href='/rewards' passHref><a>daily rewards</a></Link>!
        </div>
      </>
    )
  }
  if (fact.type === 'referral') {
    return (
      <>
        <div className={satusClass(fact.status)}>
          You stacked sats from <Link href='/referrals/month' passHref><a>a referral</a></Link>!
        </div>
      </>
    )
  }

  if (!fact.item) {
    return (
      <>
        <div className={satusClass(fact.status)}>
          {fact.description || 'no description'}
        </div>
        <Satus status={fact.status} />
      </>
    )
  }

  if (fact.item.title) {
    return <div className={styles.itemWrapper}><Item item={fact.item} /></div>
  }

  return <div className={styles.commentWrapper}><Comment item={fact.item} includeParent noReply truncate /></div>
}

export default function Satistics ({ data: { me, walletHistory: { facts, cursor } } }) {
  const router = useRouter()
  const { data, fetchMore } = useQuery(WALLET_HISTORY, { variables: { inc: router.query.inc } })

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

  function href (fact) {
    switch (fact.type) {
      case 'withdrawal':
      case 'invoice':
        return `/${fact.type}s/${fact.factId}`
      case 'earn':
      case 'donation':
      case 'referral':
        return
      default:
        return `/items/${fact.factId}`
    }
  }

  if (data) {
    ({ me, walletHistory: { facts, cursor } } = data)
  }

  const SatisticsSkeleton = () => (
    <div className='d-flex justify-content-center mt-3 mb-1'>
      <Moon className='spin fill-grey' />
    </div>)

  return (
    <Layout noSeo>
      <UserHeader user={me} />
      <div className='mt-3'>
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
        <Table className='mt-3 mb-0' bordered hover responsive size='sm'>
          <thead>
            <tr>
              <th className={styles.type}>type</th>
              <th>detail</th>
              <th className={styles.sats}>
                sats
              </th>
            </tr>
          </thead>
          <tbody>
            {facts.map((f, i) => {
              const uri = href(f)
              const Wrapper = uri ? Link : ({ href, ...props }) => <React.Fragment {...props} />
              return (
                <Wrapper href={uri} key={f.id}>
                  <tr className={styles.row}>
                    <td className={`${styles.type} ${satusClass(f.status)}`}>{f.type}</td>
                    <td className={styles.description}>
                      <Detail fact={f} />
                    </td>
                    <td className={`${styles.sats} ${satusClass(f.status)}`}>{f.sats}</td>
                  </tr>
                </Wrapper>
              )
            })}
          </tbody>
        </Table>
        <MoreFooter cursor={cursor} fetchMore={fetchMore} Skeleton={SatisticsSkeleton} />
      </div>
    </Layout>
  )
}
