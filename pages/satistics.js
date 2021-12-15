import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { Table } from 'react-bootstrap'
import useDarkMode from 'use-dark-mode'
import { getGetServerSideProps } from '../api/ssrApollo'
import Layout from '../components/layout'
import { useMe } from '../components/me'
import MoreFooter from '../components/more-footer'
import UserHeader from '../components/user-header'
import { WALLET_HISTORY } from '../fragments/wallet'
import styles from '../styles/satistics.module.css'
import Moon from '../svgs/moon-fill.svg'
import Check from '../svgs/check-double-line.svg'
import ThumbDown from '../svgs/thumb-down-fill.svg'

export const getServerSideProps = getGetServerSideProps(WALLET_HISTORY)

function satusClass (status) {
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

export default function Satistics ({ data: { walletHistory: { facts, cursor } } }) {
  const me = useMe()
  const { value: darkMode } = useDarkMode()
  const { data, fetchMore } = useQuery(WALLET_HISTORY)

  if (data) {
    ({ walletHistory: { facts, cursor } } = data)
  }

  const SatisticsSkeleton = () => (
    <div className='d-flex justify-content-center mt-3 mb-1'>
      <Moon className='spin fill-grey' />
    </div>)

  return (
    <Layout noSeo>
      <UserHeader user={me} />
      <Table className='mt-3 mb-0' bordered hover size='sm' variant={darkMode ? 'dark' : undefined}>
        <thead>
          <tr>
            <th className={styles.type}>type</th>
            <th>detail</th>
            <th className={styles.sats}>sats</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f, i) => (
            <Link href={`${f.type}s/${f.id}`} key={`${f.type}-${f.id}`}>
              <tr className={styles.row}>
                <td className={`${styles.type} ${satusClass(f.status)}`}>{f.type}</td>
                <td className={styles.description}>
                  <div className={satusClass(f.status)}>
                    {f.description || 'no description'}
                  </div>
                  <Satus status={f.status} />
                </td>
                <td className={`${styles.sats} ${satusClass(f.status)}`}>{f.msats / 1000}</td>
              </tr>
            </Link>
          ))}
        </tbody>
      </Table>
      <MoreFooter cursor={cursor} fetchMore={fetchMore} Skeleton={SatisticsSkeleton} />
    </Layout>
  )
}
