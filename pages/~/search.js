import { SearchLayout } from '../../components/layout'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { useRouter } from 'next/router'
import { SUB_SEARCH } from '../../fragments/subs'
import Down from '../../svgs/arrow-down-line.svg'
import Items from '../../components/items'

export const getServerSideProps = getGetServerSideProps(SUB_SEARCH, null,
  (data, vars) => vars.sub && !data.sub)

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }

  return (
    <SearchLayout sub={variables.sub}>
      {variables.q
        ? <Items
            ssrData={ssrData}
            query={SUB_SEARCH}
            destructureData={data => data.search}
            variables={variables}
            noMoreText='NO MORE'
          />
        : (
          <div className='text-muted text-center mt-5' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>
            <Down width={22} height={22} className='me-2' />search for something<Down width={22} height={22} className='ms-2' />
          </div>)}
    </SearchLayout>
  )
}
