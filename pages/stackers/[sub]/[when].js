import { gql, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'
import { SubAnalyticsHeader } from '@/components/sub-analytics-header'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import PageLoading from '@/components/page-loading'
import { WhenAreaChartSkeleton, WhenComposedChartSkeleton, WhenLineChartSkeleton } from '@/components/charts-skeletons'

const WhenAreaChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenAreaChart), {
  loading: () => <WhenAreaChartSkeleton />
})
const WhenLineChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenLineChart), {
  loading: () => <WhenLineChartSkeleton />
})
const WhenComposedChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenComposedChart), {
  loading: () => <WhenComposedChartSkeleton />
})

const GROWTH_QUERY = gql`
  query Growth($when: String!, $from: String, $to: String, $sub: String, $subSelect: Boolean = false)
  {
    registrationGrowth(when: $when, from: $from, to: $to) @skip(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    itemGrowth(when: $when, from: $from, to: $to) @skip(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    spendingGrowth(when: $when, from: $from, to: $to) @skip(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    spenderGrowth(when: $when, from: $from, to: $to) @skip(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    stackingGrowth(when: $when, from: $from, to: $to) @skip(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    stackerGrowth(when: $when, from: $from, to: $to) @skip(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    itemGrowthSubs(when: $when, from: $from, to: $to, sub: $sub) @include(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
    revenueGrowthSubs(when: $when, from: $from, to: $to, sub: $sub) @include(if: $subSelect) {
      time
      data {
        name
        value
      }
    }
  }`

const variablesFunc = vars => ({ ...vars, subSelect: vars.sub !== 'all' })
export const getServerSideProps = getGetServerSideProps({ query: GROWTH_QUERY, variables: variablesFunc })

export default function Growth ({ ssrData }) {
  const router = useRouter()
  const { when, from, to, sub } = router.query

  const { data } = useQuery(GROWTH_QUERY, { variables: { when, from, to, sub, subSelect: sub !== 'all' } })
  if (!data && !ssrData) return <PageLoading />

  const genHrefDownloadBlob = (data) => {
    const blob = new Blob([
      JSON.stringify(data, null, 2),
    ], {
      type: 'text/plain'
    });
    return URL.createObjectURL(blob);
  };
  const downloadLinkStyle = { textDecoration: "inherit", color: "inherit" };

  const {
    registrationGrowth,
    itemGrowth,
    spendingGrowth,
    spenderGrowth,
    stackingGrowth,
    stackerGrowth,
    itemGrowthSubs,
    revenueGrowthSubs
  } = data || ssrData

  if (sub === 'all') {
    return (
      <Layout>
        <Row>
          <Col><SubAnalyticsHeader /></Col>
          <Col>
            <DropdownButton id="dropdown-item-button" title="Download JSON Data" style={{ float: "right" }}>            
              <Dropdown.Item as="button">
                <Button variant="outlined">
                  <a download="stacker_growth.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(stackerGrowth) }
                    style={ downloadLinkStyle }>stacker</a>
                </Button>
              </Dropdown.Item>
              <Dropdown.Item as="button">
                <Button variant="outlined">
                  <a download="stacking_growth.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(stackingGrowth) }
                    style={ downloadLinkStyle }>stacking</a>
                </Button>
              </Dropdown.Item>
              <Dropdown.Item as="button">
                <Button variant="outlined">
                  <a download="spender_growth.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(spenderGrowth) }
                    style={ downloadLinkStyle }>spenders</a>
                </Button>
              </Dropdown.Item>
              <Dropdown.Item as="button">
                <Button variant="outlined">
                  <a download="spending_growth.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(spendingGrowth) }
                    style={ downloadLinkStyle }>spending</a>
                </Button>
              </Dropdown.Item>
              <Dropdown.Item as="button">
                <Button variant="outlined">
                  <a download="registration_growth.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(registrationGrowth) }
                    style={ downloadLinkStyle }>registration</a>
                </Button>
              </Dropdown.Item>
              <Dropdown.Item as="button">
                <Button variant="outlined">
                  <a download="item_growth.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(itemGrowth) }
                    style={ downloadLinkStyle }>items</a>
                </Button>
              </Dropdown.Item>
            </DropdownButton>
          </Col>
        </Row>
        <Row>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>stackers</div>
            <WhenLineChart data={stackerGrowth} />
          </Col>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>stacking</div>
            <WhenAreaChart data={stackingGrowth} />
          </Col>
        </Row>
        <Row>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>spenders</div>
            <WhenLineChart data={spenderGrowth} />
          </Col>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>spending</div>
            <WhenAreaChart data={spendingGrowth} />
          </Col>
        </Row>
        <Row>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>registrations</div>
            <WhenAreaChart data={registrationGrowth} />
          </Col>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>items</div>
            <WhenComposedChart data={itemGrowth} areaNames={['posts', 'comments', 'jobs']} areaAxis='left' lineNames={['comments/posts', 'territories']} lineAxis='right' barNames={['zaps']} />
          </Col>
        </Row>
      </Layout>
    )
  } else {
    return (
      <Layout>
        <Row>
          <Col><SubAnalyticsHeader /></Col>
          <Col>
            <DropdownButton id="dropdown-item-button" title="Download JSON Data" style={{ float: "right" }}>
              <Dropdown.ItemText>
                <Button variant="outlined">
                  <a download="item_growth_subs.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(itemGrowthSubs) }
                    style={ downloadLinkStyle }>item</a>
                </Button>
              </Dropdown.ItemText>
              <Dropdown.Item as="button">
                <Button variant="outlined">
                  <a download="revenue_growth_subs.txt" target="_blank" rel="noreferrer"
                    href={ genHrefDownloadBlob(revenueGrowthSubs) }
                    style={ downloadLinkStyle }>sats</a>
                </Button>
              </Dropdown.Item>
            </DropdownButton>
          </Col>
        </Row>
        <Row>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>items</div>
            <WhenLineChart data={itemGrowthSubs} />
          </Col>
          <Col className='mt-3'>
            <div className='text-center text-muted fw-bold'>sats</div>
            <WhenLineChart data={revenueGrowthSubs} />
          </Col>
        </Row>
      </Layout>
    )
  }
}
