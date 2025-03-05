import * as math from 'mathjs'
import { USER_ID, SN_ADMIN_IDS } from '@/lib/constants'

export async function trust ({ boss, models }) {
  try {
    console.time('trust')
    console.timeLog('trust', 'getting graph')
    const graph = await getGraph(models)
    console.timeLog('trust', 'computing trust')
    const [vGlobal, mPersonal] = await trustGivenGraph(graph)
    console.timeLog('trust', 'storing trust')
    await storeTrust(models, graph, vGlobal, mPersonal)
  } finally {
    console.timeEnd('trust')
  }
}

const MAX_DEPTH = 10
const MAX_TRUST = 1
const MIN_SUCCESS = 1
// https://en.wikipedia.org/wiki/Normal_distribution#Quantile_function
const Z_CONFIDENCE = 6.109410204869 // 99.9999999% confidence
const GLOBAL_ROOT = 616
const SEED_WEIGHT = 1.0
const AGAINST_MSAT_MIN = 1000
const MSAT_MIN = 20001 // 20001 is the minimum for a tip to be counted in trust
const SIG_DIFF = 0.1 // need to differ by at least 10 percent

/*
 Given a graph and start this function returns an object where
 the keys are the node id and their value is the trust of that node
*/
function trustGivenGraph (graph) {
  // empty matrix of proper size nstackers x nstackers
  let mat = math.zeros(graph.length, graph.length, 'sparse')

  // create a map of user id to position in matrix
  const posByUserId = {}
  for (const [idx, val] of graph.entries()) {
    posByUserId[val.id] = idx
  }

  // iterate over graph, inserting edges into matrix
  for (const [idx, val] of graph.entries()) {
    for (const { node, trust } of val.hops) {
      try {
        mat.set([idx, posByUserId[node]], Number(trust))
      } catch (e) {
        console.log('error:', idx, node, posByUserId[node], trust)
        throw e
      }
    }
  }

  // perform random walk over trust matrix
  // the resulting matrix columns represent the trust a user (col) has for each other user (rows)
  // XXX this scales N^3 and mathjs is slow
  let matT = math.transpose(mat)
  const original = matT.clone()
  for (let i = 0; i < MAX_DEPTH; i++) {
    console.timeLog('trust', `matrix multiply ${i}`)
    matT = math.multiply(original, matT)
    matT = math.add(math.multiply(1 - SEED_WEIGHT, matT), math.multiply(SEED_WEIGHT, original))
  }

  console.timeLog('trust', 'transforming result')

  const seedIdxs = SN_ADMIN_IDS.map(id => posByUserId[id])
  const isOutlier = (fromIdx, idx) => [...seedIdxs, fromIdx].includes(idx)
  const sqapply = (mat, fn) => {
    let idx = 0
    return math.squeeze(math.apply(mat, 1, d => {
      const filtered = math.filter(d, (val, fidx) => {
        return val !== 0 && !isOutlier(idx, fidx[0])
      })
      idx++
      if (filtered.length === 0) return 0
      return fn(filtered)
    }))
  }

  console.timeLog('trust', 'normalizing')
  console.timeLog('trust', 'stats')
  mat = math.transpose(matT)
  const std = sqapply(mat, math.std) // math.squeeze(math.std(mat, 1))
  const mean = sqapply(mat, math.mean) // math.squeeze(math.mean(mat, 1))
  const zscore = math.map(mat, (val, idx) => {
    const zstd = math.subset(std, math.index(idx[0], 0))
    const zmean = math.subset(mean, math.index(idx[0], 0))
    return zstd ? (val - zmean) / zstd : 0
  })
  console.timeLog('trust', 'minmax')
  const min = sqapply(zscore, math.min) // math.squeeze(math.min(zscore, 1))
  const max = sqapply(zscore, math.max) // math.squeeze(math.max(zscore, 1))
  const mPersonal = math.map(zscore, (val, idx) => {
    const zmin = math.subset(min, math.index(idx[0], 0))
    const zmax = math.subset(max, math.index(idx[0], 0))
    const zrange = zmax - zmin
    if (val > zmax) return MAX_TRUST
    return zrange ? (val - zmin) / zrange : 0
  })
  const vGlobal = math.squeeze(math.row(mPersonal, posByUserId[GLOBAL_ROOT]))

  return [vGlobal, mPersonal]
}

/*
  graph is returned as json in adjacency list where edges are the trust value 0-1
  graph = [
    { id: node1, hops: [{node : node2, trust: trust12}, {node: node3, trust: trust13}] },
    ...
  ]
*/
async function getGraph (models) {
  return await models.$queryRaw`
    SELECT id, json_agg(json_build_object(
      'node', oid,
      'trust', CASE WHEN total_trust > 0 THEN trust / total_trust::float ELSE 0 END)) AS hops
    FROM (
      WITH user_votes AS (
        SELECT "ItemAct"."userId" AS user_id, users.name AS name, "ItemAct"."itemId" AS item_id, min("ItemAct".created_at) AS act_at,
            users.created_at AS user_at, "ItemAct".act = 'DONT_LIKE_THIS' AS against,
            count(*) OVER (partition by "ItemAct"."userId") AS user_vote_count,
            sum("ItemAct".msats) as user_msats
        FROM "ItemAct"
        JOIN "Item" ON "Item".id = "ItemAct"."itemId" AND "ItemAct".act IN ('FEE', 'TIP', 'DONT_LIKE_THIS')
          AND "Item"."parentId" IS NULL AND NOT "Item".bio AND "Item"."userId" <> "ItemAct"."userId"
        JOIN users ON "ItemAct"."userId" = users.id AND users.id <> ${USER_ID.anon}
        WHERE "ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'
        GROUP BY user_id, name, item_id, user_at, against
        HAVING CASE WHEN
          "ItemAct".act = 'DONT_LIKE_THIS' THEN sum("ItemAct".msats) > ${AGAINST_MSAT_MIN}
          ELSE sum("ItemAct".msats) > ${MSAT_MIN} END
      ),
      user_pair AS (
        SELECT a.user_id AS a_id, b.user_id AS b_id,
            sum(CASE WHEN b.user_msats > a.user_msats THEN a.user_msats / b.user_msats::FLOAT ELSE b.user_msats / a.user_msats::FLOAT END) FILTER(WHERE a.act_at > b.act_at AND a.against = b.against) AS before,
            sum(CASE WHEN b.user_msats > a.user_msats THEN a.user_msats / b.user_msats::FLOAT ELSE b.user_msats / a.user_msats::FLOAT END) FILTER(WHERE b.act_at > a.act_at AND a.against = b.against) AS after,
            sum(log(1 + a.user_msats / 10000::float) + log(1 + b.user_msats / 10000::float)) FILTER(WHERE a.against <> b.against) AS disagree,
            b.user_vote_count AS b_total, a.user_vote_count AS a_total
        FROM user_votes a
        JOIN user_votes b ON a.item_id = b.item_id
        WHERE a.user_id <> b.user_id
        GROUP BY a.user_id, a.user_vote_count, b.user_id, b.user_vote_count
      ),
      trust_pairs AS (
        SELECT a_id AS id, b_id AS oid,
          CASE WHEN before - disagree >= ${MIN_SUCCESS} AND b_total - after > 0 THEN
            confidence(before - disagree, b_total - after, ${Z_CONFIDENCE})
          ELSE 0 END AS trust
        FROM user_pair
        WHERE NOT (b_id = ANY (${SN_ADMIN_IDS}))
        UNION ALL
        SELECT a_id AS id, seed_id AS oid, ${MAX_TRUST}::numeric as trust
        FROM user_pair, unnest(${SN_ADMIN_IDS}::int[]) seed_id
        GROUP BY a_id, a_total, seed_id
        UNION ALL
        SELECT a_id AS id, a_id AS oid, ${MAX_TRUST}::float as trust
        FROM user_pair
      )
      SELECT id, oid, trust, sum(trust) OVER (PARTITION BY id) AS total_trust
      FROM trust_pairs
    ) a
    GROUP BY a.id
    ORDER BY id ASC`
}

async function storeTrust (models, graph, vGlobal, mPersonal) {
  // convert nodeTrust into table literal string
  let globalValues = ''
  let personalValues = ''
  vGlobal.forEach((val, [idx]) => {
    if (isNaN(val)) return
    if (globalValues) globalValues += ','
    globalValues += `(${graph[idx].id}, ${val}::FLOAT)`
    if (personalValues) personalValues += ','
    personalValues += `(${GLOBAL_ROOT}, ${graph[idx].id}, ${val}::FLOAT)`
  })

  math.forEach(mPersonal, (val, [fromIdx, toIdx]) => {
    const globalVal = vGlobal.get([toIdx, 0])
    if (isNaN(val) || val - globalVal <= SIG_DIFF) return
    if (personalValues) personalValues += ','
    personalValues += `(${graph[fromIdx].id}, ${graph[toIdx].id}, ${val}::FLOAT)`
  })

  // update the trust of each user in graph
  await models.$transaction([
    models.$executeRaw`UPDATE users SET trust = 0`,
    models.$executeRawUnsafe(
      `UPDATE users
        SET trust = g.trust
        FROM (values ${globalValues}) g(id, trust)
        WHERE users.id = g.id`),
    models.$executeRawUnsafe(
      `INSERT INTO "Arc" ("fromId", "toId", "zapTrust")
        SELECT id, oid, trust
        FROM (values ${personalValues}) g(id, oid, trust)
        ON CONFLICT ("fromId", "toId") DO UPDATE SET "zapTrust" = EXCLUDED."zapTrust"`
    ),
    // select all arcs that don't exist in personalValues and delete them
    models.$executeRawUnsafe(
      `DELETE FROM "Arc"
        WHERE ("fromId", "toId") NOT IN (
          SELECT id, oid
          FROM (values ${personalValues}) g(id, oid, trust)
        )`
    )
  ])
}
