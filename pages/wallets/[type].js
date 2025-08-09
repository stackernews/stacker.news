import { getGetServerSideProps } from '@/api/ssrApollo'
import { useData } from '@/components/use-data'
import { WalletMultiStepForm } from '@/wallets/client/components'
import { WALLET } from '@/wallets/client/fragments'
import { useDecryptedWallet } from '@/wallets/client/hooks'
import { unurlify } from '@/wallets/lib/util'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'

const variablesFunc = params => {
  const id = Number(params.type)
  return !Number.isNaN(id) ? { id } : { name: unurlify(params.type) }
}
export const getServerSideProps = getGetServerSideProps({ query: WALLET, variables: variablesFunc, authRequired: true })

export default function Wallet ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)
  // this will print the following warning in the console:
  //   Warning: fragment with name WalletTemplateFields already exists.
  //   graphql-tag enforces all fragment names across your application to be unique
  // this is not a problem because the warning is only meant to avoid overwriting fragments but we're reusing it
  const { data } = useQuery(WALLET, { variables })
  const dat = useData(data, ssrData)

  const decryptedWallet = useDecryptedWallet(dat?.wallet)
  const wallet = decryptedWallet ?? ssrData?.wallet
  if (!wallet) {
    return null
  }

  return <WalletMultiStepForm wallet={wallet} />
}
