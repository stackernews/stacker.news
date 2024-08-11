import { CenterLayout } from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLogs } from '@/components/wallet-logger'

export const getServerSideProps = getGetServerSideProps({ query: null })

export default function () {
  return (
    <>
      <CenterLayout>
        <h2 className='text-center'>wallet logs</h2>
        <WalletLogs />
      </CenterLayout>
    </>
  )
}
