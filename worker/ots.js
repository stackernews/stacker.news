import { gql } from 'graphql-tag'
import stringifyCanon from 'canonical-json'
import { createHash } from 'crypto'
import Ots from 'opentimestamps'

/** fetches the necessary fields to compute the ots hash */
const ITEM_OTS_HASH_FIELDS = gql`
  fragment ItemOtsHashFields on Item {
    parentId
    parentOtsHash
    title
    text
    url
  }`

export async function timestampItem ({ data: { id }, apollo, models }) {
  const { data: { item: { parentId, parentOtsHash, title, text, url } } } = await apollo.query({
    query: gql`
        ${ITEM_OTS_HASH_FIELDS}
        query Item {
          item(id: ${id}) {
            ...ItemOtsHashFields
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
  const detached = Ots.DetachedTimestampFile.fromHash(new Ots.Ops.OpSHA256(), otsHash)

  // timestamp it
  await Ots.stamp(detached)

  // get proof
  const otsFile = Buffer.from(detached.serializeToBytes())

  // store in item
  await models.item.update({ where: { id }, data: { otsHash: otsHash.toString('hex'), otsFile } })
}
