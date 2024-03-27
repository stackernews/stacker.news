import { SearchLayout } from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { useRouter } from 'next/router'
import { SUB_SEARCH } from '@/fragments/subs'
import Items from '@/components/items'
import styles from '@/styles/search.module.css'

export const getServerSideProps = getGetServerSideProps({
  query: SUB_SEARCH,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query, includeComments: true }

  const sub = ssrData?.sub?.name || variables.sub

  return (
    <SearchLayout sub={sub}>
      {variables.q
        ? <Items
            ssrData={ssrData}
            query={SUB_SEARCH}
            destructureData={data => data.search}
            variables={variables}
            noMoreText='NO MORE'
          />
        : (
          <div className={styles.content}>
            <div className={styles.box}>
              <div className={styles.header}>
                <div className='text-muted text-center' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.75' }}>
                  filters
                </div>
              </div>
              <div className={styles.body}>
                <ul className={styles.inner}>
                  <li><b>@</b>&#8203;<em>nym</em> - limit to results authored by nym</li>
                  <li><b>~</b>&#8203;<em>territory</em> - limit to results from territory</li>
                  <li><b>url:</b>&#8203;<em>stacker&#8203;.news</em> - limit to link posts from a specific url</li>
                  <li><b>"</b><em>exact phrase</em><b>"</b> - limit to results that contain an exact phrase</li>
                </ul>
              </div>
            </div>
          </div>
          )}
    </SearchLayout>
  )
}
