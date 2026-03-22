import { gql } from 'graphql-tag'
import stringifyCanon from 'canonical-json'
import { createHash } from 'crypto'
import { DetachedTimestampFile, Notary, OpSHA256 } from '../lib/ots-mini/index.js'

const ITEM_OTS_FIELDS = gql`
  fragment ItemOTSFields on Item {
    parentId
    parentOtsHash
    title
    text
    url
  }`

export async function timestampItem ({ data: { id }, apollo, models }) {
  const { data: { item: { parentId, parentOtsHash, title, text, url } } } = await apollo.query({
    query: gql`
        ${ITEM_OTS_FIELDS}
        query Item {
          item(id: ${id}) {
            ...ItemOTSFields
          }
        }`
  })

  if (parentId && !parentOtsHash) {
    console.log('no parent hash available ... skipping')
    return
  }

  // SHA256 hash item using a canonical serialization format { parentHash, title, text, url }
  const itemString = stringifyCanon({ parentHash: parentOtsHash, title, text, url })
  const otsHash = createHash('sha256').update(itemString).digest()
  const detached = DetachedTimestampFile.fromHash(new OpSHA256(), otsHash)

  // timestamp it
  await Notary.stamp(detached)

  // get proof
  const otsFile = Buffer.from(detached.serializeToBytes())

  // store in item
  await models.item.update({ where: { id }, data: { otsHash: otsHash.toString('hex'), otsFile } })
}
