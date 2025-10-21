import { useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import MoreFooter from '@/components/more-footer'
import { SATISTICS } from '@/fragments/payIn'
import PayInTable, { PayInSkeleton } from '@/components/payIn/table'
import { useData } from '@/components/use-data'
import navStyles from '@/styles/nav.module.css'
import { Nav } from 'react-bootstrap'
import Link from 'next/link'
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
        <Nav.Item>
          <Link href='/satistics?inc=invoice,withdrawal,stacked,spent' passHref legacyBehavior>
            <Nav.Link eventKey='history'>history</Nav.Link>
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link href='/satistics/graphs/day' passHref legacyBehavior>
            <Nav.Link eventKey='graphs'>graphs</Nav.Link>
          </Link>
        </Nav.Item>
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
          <div className='py-2 px-0 mb-0 mw-100'>
            <PayInSkeleton header />
          </div>
        </div>
      </Layout>
    )
  }

  const { satistics: { payIns, cursor } } = dat

  return (
    <Layout>
      <div className='mt-2'>
        <SatisticsHeader />
        <div className='py-2 px-0 mb-0 mw-100'>
          <PayInTable payIns={payIns} />
        </div>
        <MoreFooter cursor={cursor} count={payIns?.length} fetchMore={fetchMore} Skeleton={PayInSkeleton} />
      </div>
    </Layout>
  )
}
