const math = require('mathjs')
const { ANON_USER_ID } = require('../lib/constants')

function trust ({ boss, models }) {
  return async function () {
    try {
      console.time('trust')
      console.timeLog('trust', 'getting graph')
      const graph = await getGraph(models)
      console.timeLog('trust', 'computing trust')
      const trust = await trustGivenGraph(graph)
      console.timeLog('trust', 'storing trust')
      await storeTrust(models, trust)
      console.timeEnd('trust')
    } catch (e) {
      console.error(e)
      throw e
    }
  }
}

const MAX_DEPTH = 10
const MAX_TRUST = 1
const MIN_SUCCESS = 1
// increasing disgree_mult increases distrust when there's disagreement
// ... this cancels DISAGREE_MULT number of "successes" for every disagreement
const DISAGREE_MULT = 10
// https://en.wikipedia.org/wiki/Normal_distribution#Quantile_function
const Z_CONFIDENCE = 6.109410204869 // 99.9999999% confidence
const SEEDS = [616, 6030, 946, 4502]
const SEED_WEIGHT = 0.25
const AGAINST_MSAT_MIN = 1000
const MSAT_MIN = 1000

/*
 Given a graph and start this function returns an object where
 the keys are the node id and their value is the trust of that node
*/
function trustGivenGraph (graph) {
  // empty matrix of proper size nstackers x nstackers
  const mat = math.zeros(graph.length, graph.length, 'sparse')

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

  console.timeLog('trust', 'normalizing result')
  // we normalize the result taking the z-score, then min-max to [0,1]
  // we remove seeds and 0 trust people from the result because they are known outliers
  // but we need to keep them in the result to keep positions correct
  function resultForId (id) {
    let result = math.squeeze(math.subset(math.transpose(matT), math.index(posByUserId[id], math.range(0, graph.length))))
    const outliers = SEEDS.concat([id])
    outliers.forEach(id => result.set([posByUserId[id]], 0))
    const withoutZero = math.filter(result, val => val > 0)
    // NOTE: this might be improved by using median and mad (modified z score)
    // given the distribution is skewed
    const mean = math.mean(withoutZero)
    const std = math.std(withoutZero)
    result = result.map(val => val >= 0 ? (val - mean) / std : 0)
    const min = math.min(result)
    const max = math.max(result)
    result = math.map(result, val => (val - min) / (max - min))
    outliers.forEach(id => result.set([posByUserId[id]], MAX_TRUST))
    return result
  }

  // turn the result vector into an object
  const result = {}
  resultForId(616).forEach((val, idx) => {
    result[graph[idx].id] = val
  })

  return result
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
    SELECT id, array_agg(json_build_object(
      'node', oid,
      'trust', CASE WHEN total_trust > 0 THEN trust / total_trust::float ELSE 0 END)) AS hops
    FROM (
      WITH user_votes AS (
        SELECT "ItemAct"."userId" AS user_id, users.name AS name, "ItemAct"."itemId" AS item_id, min("ItemAct".created_at) AS act_at,
            users.created_at AS user_at, "ItemAct".act = 'DONT_LIKE_THIS' AS against,
            count(*) OVER (partition by "ItemAct"."userId") AS user_vote_count
        FROM "ItemAct"
        JOIN "Item" ON "Item".id = "ItemAct"."itemId" AND "ItemAct".act IN ('FEE', 'TIP', 'DONT_LIKE_THIS')
          AND "Item"."parentId" IS NULL AND NOT "Item".bio AND "Item"."userId" <> "ItemAct"."userId"
        JOIN users ON "ItemAct"."userId" = users.id AND users.id <> ${ANON_USER_ID}
        GROUP BY user_id, name, item_id, user_at, against
        HAVING CASE WHEN
          "ItemAct".act = 'DONT_LIKE_THIS' THEN sum("ItemAct".msats) > ${AGAINST_MSAT_MIN}
          ELSE sum("ItemAct".msats) > ${MSAT_MIN} END
      ),
      user_pair AS (
        SELECT a.user_id AS a_id, b.user_id AS b_id,
            count(*) FILTER(WHERE a.act_at > b.act_at AND a.against = b.against) AS before,
            count(*) FILTER(WHERE b.act_at > a.act_at AND a.against = b.against) AS after,
            count(*) FILTER(WHERE a.against <> b.against) * ${DISAGREE_MULT} AS disagree,
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
        WHERE b_id <> ANY (${SEEDS})
        UNION ALL
        SELECT a_id AS id, seed_id AS oid, ${MAX_TRUST}::numeric/ARRAY_LENGTH(${SEEDS}::int[], 1) as trust
        FROM user_pair, unnest(${SEEDS}::int[]) seed_id
        GROUP BY a_id, a_total, seed_id
      )
      SELECT id, oid, trust, sum(trust) OVER (PARTITION BY id) AS total_trust
      FROM trust_pairs
    ) a
    GROUP BY a.id
    ORDER BY id ASC`
}

async function storeTrust (models, nodeTrust) {
  // convert nodeTrust into table literal string
  let values = ''
  for (const [id, trust] of Object.entries(nodeTrust)) {
    if (values) values += ','
    values += `(${id}, ${trust})`
  }

  // update the trust of each user in graph
  await models.$transaction([
    models.$executeRaw`UPDATE users SET trust = 0`,
    models.$executeRawUnsafe(
      `UPDATE users
        SET trust = g.trust
        FROM (values ${values}) g(id, trust)
        WHERE users.id = g.id`)])
}

module.exports = { trust }
