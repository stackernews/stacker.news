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
    throw new Error('no parent hash available ... retrying later')
  }

  let otsHash
  let detached
  try {
    // SHA256 hash item using a canonical serialization format { parentHash, title, text, url }
    const itemString = stringifyCanon({ parentHash: parentOtsHash, title, text, url })
    otsHash = createHash('sha256').update(itemString).digest()
    detached = DetachedTimestampFile.fromHash(new OpSHA256(), otsHash)
  } catch (e) {
    // if any of this errors out, it's non-recoverable: do not retry
    console.error('Fatal error while generating ots timestamp data:', e)
    return
  }

  // timestamp it
  await Notary.stamp(detached)

  // get proof
  const otsFile = Buffer.from(detached.serializeToBytes())

  // store in item
  await models.item.update({ where: { id }, data: { otsHash: otsHash.toString('hex'), otsFile } })
}
