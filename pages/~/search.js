import { SearchLayout } from '../../components/layout'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { useRouter } from 'next/router'
import { SUB_SEARCH } from '../../fragments/subs'
import Items from '../../components/items'
import styles from './search.module.css'

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
                  more filters
                </div>
              </div>
              <div className={styles.body}>
                <div className={styles.inner}>
                  <div><b>nym:</b>&#8203;<em>sn</em> - limit results by stacker nym</div>
                  <div><b>url:</b>&#8203;<em>stacker&#8203;.news</em> - limit to specific site</div>
                  <div><b>"</b>exact phrase<b>"</b> - demand results contain exact phrase</div>
                  <div>you are searching <em>{variables.sub || 'home'}</em><br /><em>home</em> searches show results from all</div>
                </div>
              </div>
            </div>
          </div>
          )}
    </SearchLayout>
  )
}
