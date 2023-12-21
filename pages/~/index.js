import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import Layout from '../../components/layout'
import { SUB_FULL, SUB_ITEMS } from '../../fragments/subs'
import Snl from '../../components/snl'
import { WelcomeBanner } from '../../components/banners'
import { AccordianCard } from '../../components/accordian-item'
import Text from '../../components/text'
import { useMe } from '../../components/me'
import Gear from '../../svgs/settings-5-fill.svg'
import Link from 'next/link'
import { useQuery } from '@apollo/client'
import PageLoading from '../../components/page-loading'
import CardFooter from 'react-bootstrap/CardFooter'
import Hat from '../../components/hat'
import styles from '../../components/item.module.css'
import TerritoryPaymentDue, { TerritoryBillingLine } from '../../components/territory-payment-due'
import Badge from 'react-bootstrap/Badge'
import { numWithUnits } from '../../lib/format'

export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Sub ({ ssrData }) {
  const router = useRouter()
  const me = useMe()
  const variables = { ...router.query }
  const { data } = useQuery(SUB_FULL, { variables })

  if (!data && !ssrData) return <PageLoading />
  const { sub } = data || ssrData

  return (
    <Layout sub={variables.sub}>
      {sub
        ? (
          <>
            <TerritoryPaymentDue sub={sub} />
            <div className='mb-3 d-flex'>
              <div className='flex-grow-1'>
                <AccordianCard
                  header={<small className='text-muted fw-bold'>territory details{sub.status === 'STOPPED' && <Badge className='ms-2' bg='danger'>archived</Badge>}</small>}
                >
                  <div className='py-2'>
                    <Text>{sub.desc}</Text>
                  </div>
                  <CardFooter className={`py-1 ${styles.other}`}>
                    <div className='text-muted'>
                      <span>founded by </span>
                      <Link href={`/${sub.user.name}`}>
                        @{sub.user.name}<span> </span><Hat className='fill-grey' user={sub.user} height={12} width={12} />
                      </Link>
                    </div>
                    <div className='text-muted'>
                      <span>post cost </span>
                      <span className='fw-bold'>{numWithUnits(sub.baseCost)}</span>
                    </div>
                    <TerritoryBillingLine sub={sub} />
                  </CardFooter>
                </AccordianCard>
              </div>
              {Number(sub.userId) === Number(me?.id) &&
                <Link href={`/~${sub.name}/edit`} className='d-flex align-items-center flex-shrink-1 ps-2'>
                  <Gear className='fill-grey' width={22} height={22} />
                </Link>}
            </div>
          </>)
        : (
          <>
            <Snl />
            <WelcomeBanner />
          </>)}
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
