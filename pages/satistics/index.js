import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Nav from 'react-bootstrap/Nav'
import Layout from '@/components/layout'
import MoreFooter from '@/components/more-footer'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import navStyles from '@/styles/nav.module.css'
import { SATISTICS } from '@/fragments/payIn'
import PayInTable from '@/components/payIn/table'

export const getServerSideProps = getGetServerSideProps({ query: SATISTICS, authRequired: true, variables: { inc: '' } })

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
  const { data, fetchMore } = useQuery(SATISTICS, { variables: { inc: '' } })
  if (!ssrData && !data) return <PageLoading />

  const { satistics: { payIns, cursor } } = data || ssrData

  return (
    <Layout>
      <div className='mt-2'>
        <div className='py-2 px-0 mb-0 mw-100'>
          <PayInTable payIns={payIns} />
        </div>
        <MoreFooter cursor={cursor} count={payIns?.length} fetchMore={fetchMore} Skeleton={PageLoading} />
      </div>
    </Layout>
  )
}
