import { getGetServerSideProps } from '../../../api/ssrApollo'
import { SUB } from '../../../fragments/subs'
import LayoutCenter from '../../../components/layout-center'
import JobForm from '../../../components/job-form'

export const getServerSideProps = getGetServerSideProps(SUB, null, 'sub')

// need to recent list items
export default function Post ({ data: { sub } }) {
  return (
    <LayoutCenter sub={sub.name}>
      <JobForm sub={sub} />
    </LayoutCenter>
  )
}
