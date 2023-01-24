import Layout from '../../../components/layout'
import { ITEM_OTS } from '../../../fragments/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import stringifyCanon from 'canonical-json'
import { Button } from 'react-bootstrap'

export const getServerSideProps = getGetServerSideProps(ITEM_OTS, null,
  data => !data.item || !data.item.otsHash)

export default function OtsItem ({ data: { item } }) {
  return (
    <Layout noSeo>
      <Ots item={item} />
    </Layout>
  )
}

function Ots ({ item }) {
  const itemString = stringifyCanon({ parentHash: item.parentOtsHash, title: item.title, text: item.text, url: item.url })

  return (
    <>
      <div className='form-label'>sha256 hash</div>
      {item.otsHash}
      <div className='form-label mt-2'>preimage</div>
      {item.deletedAt
        ? <div>item was deleted by author - original preimage is lost</div>
        : (
          <pre
            className='mb-2 p-2 rounded'
            style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', border: '1px solid var(--theme-borderColor)', color: 'var(--theme-color)' }}
          >{itemString}
          </pre>)}
      <Button href={`/api/ots/preimage/${item.id}`} className='mt-1' variant='grey-medium'>download preimage</Button>
      <div className='form-label mt-2'>merkle proof</div>
      <Button href={`/api/ots/proof/${item.id}`} className='mt-1' variant='grey-medium'>download ots file</Button>
    </>
  )
}
