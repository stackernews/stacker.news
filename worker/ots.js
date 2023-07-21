const { gql } = require('graphql-tag')
const stringifyCanon = require('canonical-json')
const { createHash } = require('crypto')
const Ots = require('opentimestamps')

const ITEM_OTS_FIELDS = gql`
  fragment ItemOTSFields on Item {
    parentId
    parentOtsHash
    title
    text
    url
  }`

function timestampItem ({ apollo, models }) {
  return async function ({ data: { id } }) {
    console.log('timestamping item', id)

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
    const detached = Ots.DetachedTimestampFile.fromHash(new Ots.Ops.OpSHA256(), otsHash)

    // timestamp it
    await Ots.stamp(detached)

    // get proof
    const otsFile = Buffer.from(detached.serializeToBytes())

    // store in item
    await models.item.update({ where: { id }, data: { otsHash: otsHash.toString('hex'), otsFile } })

    console.log('done timestamping item', id)
  }
}

module.exports = { timestampItem }
