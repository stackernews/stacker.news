import { getGetServerSideProps } from '../api/ssrApollo'
import { CenterLayout } from '../components/layout'
import TerritoryForm from '../components/territory-form'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function TerritoryPage () {
  return (
    <CenterLayout>
      <h1 className='mt-5'>break new ground</h1>
      <TerritoryForm />
    </CenterLayout>
  )
}
