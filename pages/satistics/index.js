import { useQuery } from '@apollo/client/react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import MoreFooter from '@/components/more-footer'
import { SATISTICS } from '@/fragments/payIn'
import PayInTable, { PayInSkeleton } from '@/components/payIn/table'
import { useData } from '@/components/use-data'
import navStyles from '@/styles/nav.module.css'
import { Nav, NavLink, NavItem } from '@/components/ui/nav'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps({ query: SATISTICS, authRequired: true, variables: { } })

export function SatisticsHeader () {
  const router = useRouter()
  const pathParts = router.asPath.split('?')[0].split('/').filter(segment => !!segment)
  const activeKey = pathParts[1] ?? 'history'
  return (
    <>
      <h2 className='mb-2 text-start'>satistics</h2>
      <Nav
        className={navStyles.nav}
        activeKey={activeKey}
      >
        <NavItem>
          <NavLink href='/satistics' eventKey='history' className='py-0.5 pe-4 ps-0'>history</NavLink>
        </NavItem>
        <NavItem>
          <NavLink href='/satistics/graphs/day' eventKey='graphs' className='py-0.5 pe-4 ps-0'>graphs</NavLink>
        </NavItem>
      </Nav>
    </>
  )
}

export default function Satistics ({ ssrData }) {
  const { data, fetchMore } = useQuery(SATISTICS, { variables: { } })
  const dat = useData(data, ssrData)
  if (!dat) {
    return (
      <Layout>
        <div className='mt-2'>
          <SatisticsHeader />
          <div className='py-2 px-0 mb-0 max-w-full'>
            <PayInSkeleton header />
          </div>
        </div>
      </Layout>
    )
  }

  const { satistics: { txs: items, cursor } } = dat

  return (
    <Layout>
      <div className='mt-2'>
        <SatisticsHeader />
        <div className='py-2 px-0 mb-0 max-w-full'>
          <PayInTable items={items} />
        </div>
        <MoreFooter cursor={cursor} count={items?.length} fetchMore={fetchMore} Skeleton={PayInSkeleton} />
      </div>
    </Layout>
  )
}
