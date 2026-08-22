import Layout from '@/components/layout'
import { ITEM_OTS } from '@/fragments/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import stringifyCanon from 'canonical-json'
import { buttonClasses } from '@/components/ui/button'
import { labelClasses } from '@/components/form'
import { useQuery } from '@apollo/client/react'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'

export const getServerSideProps = getGetServerSideProps({
  query: ITEM_OTS,
  notFound: data => !data.item || !data.item.otsHash
})

export default function OtsItem ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(ITEM_OTS, { variables: { id: router.query.id } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData

  return (
    <Layout seo={false}>
      <Ots item={item} />
    </Layout>
  )
}

function Ots ({ item }) {
  const itemString = stringifyCanon({ parentHash: item.parentOtsHash, title: item.title, text: item.text, url: item.url })

  return (
    <>
      <div className={labelClasses()}>sha256 hash</div>
      {item.otsHash}
      <div className={labelClasses({ className: 'mt-2' })}>preimage</div>
      {item.deletedAt
        ? <div>item was deleted by author - original preimage is lost</div>
        : (
          <pre
            className='mb-2 p-2 rounded-md'
            style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', border: '1px solid var(--sn-borderColor)', color: 'var(--sn-body-color)' }}
          >{itemString}
          </pre>)}
      <a href={`/api/ots/preimage/${item.id}`} className={buttonClasses({ variant: 'grey-medium', className: 'mt-1' })}>download preimage</a>
      <div className={labelClasses({ className: 'mt-2' })}>merkle proof</div>
      <a href={`/api/ots/proof/${item.id}`} className={buttonClasses({ variant: 'grey-medium', className: 'mt-1' })}>download ots file</a>
    </>
  )
}
