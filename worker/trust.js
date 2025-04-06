import * as math from 'mathjs'
import { USER_ID } from '@/lib/constants'
import { Prisma } from '@prisma/client'
import { initialTrust, GLOBAL_SEEDS } from '@/api/paidAction/lib/territory'

const MAX_DEPTH = 40
const MAX_TRUST = 1
const MIN_SUCCESS = 0
// https://en.wikipedia.org/wiki/Normal_distribution#Quantile_function
const Z_CONFIDENCE = 6.109410204869 // 99.9999999% confidence
const SEED_WEIGHT = 0.83
const AGAINST_MSAT_MIN = 1000
const MSAT_MIN = 1001 // 20001 is the minimum for a tip to be counted in trust
const IRRELEVANT_CUMULATIVE_TRUST = 0.001 // if a user has less than this amount of cumulative trust, they are irrelevant

// for each subName, we'll need to get two graphs
// one for comments and one for posts
// then we'll need to do two trust calculations on each graph
// one with global seeds and one with subName seeds
export async function trust ({ boss, models }) {
  console.time('trust')
  const territories = await models.sub.findMany({
    where: {
      status: 'ACTIVE'
    }
  })
  for (const territory of territories) {
    const seeds = GLOBAL_SEEDS.includes(territory.userId) ? GLOBAL_SEEDS : GLOBAL_SEEDS.concat(territory.userId)
    try {
      console.timeLog('trust', `getting post graph for ${territory.name}`)
      const postGraph = await getGraph(models, territory.name, true, seeds)
      console.timeLog('trust', `getting comment graph for ${territory.name}`)
      const commentGraph = await getGraph(models, territory.name, false, seeds)
      console.timeLog('trust', `computing global post trust for ${territory.name}`)
      const vGlobalPost = await trustGivenGraph(postGraph)
      console.timeLog('trust', `computing global comment trust for ${territory.name}`)
      const vGlobalComment = await trustGivenGraph(commentGraph)
      console.timeLog('trust', `computing sub post trust for ${territory.name}`)
      const vSubPost = await trustGivenGraph(postGraph, [territory.userId])
      console.timeLog('trust', `computing sub comment trust for ${territory.name}`)
      const vSubComment = await trustGivenGraph(commentGraph, [territory.userId])
      console.timeLog('trust', `storing trust for ${territory.name}`)
      let results = reduceVectors(territory.name, {
        zapPostTrust: {
          graph: postGraph,
          vector: vGlobalPost
        },
        subZapPostTrust: {
          graph: postGraph,
          vector: vSubPost
        },
        zapCommentTrust: {
          graph: commentGraph,
          vector: vGlobalComment
        },
        subZapCommentTrust: {
          graph: commentGraph,
          vector: vSubComment
        }
      })

      if (results.length === 0) {
        console.timeLog('trust', `no results for ${territory.name} - adding seeds`)
        results = initialTrust({ name: territory.name, userId: territory.userId })
      }

      await storeTrust(models, territory.name, results)
    } catch (e) {
      console.error(`error computing trust for ${territory.name}:`, e)
    } finally {
      console.timeLog('trust', `finished computing trust for ${territory.name}`)
    }
  }
  console.timeEnd('trust')
}

/*
 Given a graph and start this function returns an object where
 the keys are the node id and their value is the trust of that node
*/
// I'm going to need to send subName, and multiply by a vector instead of a matrix
function trustGivenGraph (graph, seeds = GLOBAL_SEEDS) {
  console.timeLog('trust', `creating matrix of size ${graph.length} x ${graph.length}`)
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
  const matT = math.transpose(mat)
  const vTrust = math.zeros(graph.length)
  for (const seed of seeds) {
    vTrust.set([posByUserId[seed], 0], 1.0 / seeds.length)
  }
  let result = vTrust.clone()
  console.timeLog('trust', 'matrix multiply')
  for (let i = 0; i < MAX_DEPTH; i++) {
    result = math.multiply(matT, result)
    result = math.add(math.multiply(1 - SEED_WEIGHT, result), math.multiply(SEED_WEIGHT, vTrust))
  }
  result = math.squeeze(result)

  console.timeLog('trust', 'transforming result')

  const seedIdxs = seeds.map(id => posByUserId[id])
  const filterZeroAndSeed = (val, idx) => {
    return val !== 0 && !seedIdxs.includes(idx[0])
  }
  const filterSeed = (val, idx) => {
    return !seedIdxs.includes(idx[0])
  }
  const sqapply = (vec, filterFn, fn) => {
    // if the vector is smaller than the seeds, don't filter
    const filtered = vec.size()[0] > seeds.length ? math.filter(vec, filterFn) : vec
    if (filtered.size()[0] === 0) return 0
    return fn(filtered)
  }

  console.timeLog('trust', 'normalizing')
  console.timeLog('trust', 'stats')
  const std = sqapply(result, filterZeroAndSeed, math.std) // math.squeeze(math.std(mat, 1))
  const mean = sqapply(result, filterZeroAndSeed, math.mean) // math.squeeze(math.mean(mat, 1))
  console.timeLog('trust', 'std', std)
  console.timeLog('trust', 'mean', mean)
  const zscore = math.map(result, (val) => {
    if (std === 0) return 0
    return (val - mean) / std
  })
  console.timeLog('trust', 'minmax')
  const min = sqapply(zscore, filterSeed, math.min) // math.squeeze(math.min(zscore, 1))
  const max = sqapply(zscore, filterSeed, math.max) // math.squeeze(math.max(zscore, 1))
  console.timeLog('trust', 'min', min)
  console.timeLog('trust', 'max', max)
  const normalized = math.map(zscore, (val) => {
    const zrange = max - min
    if (val > max) return MAX_TRUST
    return zrange ? (val - min) / zrange : 0
  })

  return normalized
}

/*
  graph is returned as json in adjacency list where edges are the trust value 0-1
  graph = [
    { id: node1, hops: [{node : node2, trust: trust12}, {node: node3, trust: trust13}] },
    ...
  ]
*/
// I'm going to want to send subName to this function
// and whether it's for comments or posts
async function getGraph (models, subName, postTrust = true, seeds = GLOBAL_SEEDS) {
  return await models.$queryRaw`
    SELECT id, json_agg(json_build_object(
      'node', oid,
      'trust', CASE WHEN total_trust > 0 THEN trust / total_trust::float ELSE 0 END)) AS hops
    FROM (
      WITH user_votes AS (
        SELECT "ItemAct"."userId" AS user_id, users.name AS name, "ItemAct"."itemId" AS item_id, max("ItemAct".created_at) AS act_at,
            users.created_at AS user_at, "ItemAct".act = 'DONT_LIKE_THIS' AS against,
            count(*) OVER (partition by "ItemAct"."userId") AS user_vote_count,
            sum("ItemAct".msats) as user_msats
        FROM "ItemAct"
        JOIN "Item" ON "Item".id = "ItemAct"."itemId" AND "ItemAct".act IN ('FEE', 'TIP', 'DONT_LIKE_THIS')
          AND NOT "Item".bio AND "Item"."userId" <> "ItemAct"."userId"
          AND ${postTrust
            ? Prisma.sql`"Item"."parentId" IS NULL AND "Item"."subName" = ${subName}::TEXT`
            : Prisma.sql`
              "Item"."parentId" IS NOT NULL
              JOIN "Item" root ON "Item"."rootId" = root.id AND root."subName" = ${subName}::TEXT`
          }
        JOIN users ON "ItemAct"."userId" = users.id AND users.id <> ${USER_ID.anon}
        WHERE ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        GROUP BY user_id, users.name, item_id, user_at, against
        HAVING CASE WHEN
          "ItemAct".act = 'DONT_LIKE_THIS' THEN sum("ItemAct".msats) > ${AGAINST_MSAT_MIN}
          ELSE sum("ItemAct".msats) > ${MSAT_MIN} END
      ),
      user_pair AS (
        SELECT a.user_id AS a_id, b.user_id AS b_id,
            sum(CASE WHEN b.user_msats > a.user_msats THEN a.user_msats / b.user_msats::FLOAT ELSE b.user_msats / a.user_msats::FLOAT END) FILTER(WHERE a.act_at > b.act_at AND a.against = b.against) AS before,
            sum(CASE WHEN b.user_msats > a.user_msats THEN a.user_msats / b.user_msats::FLOAT ELSE b.user_msats / a.user_msats::FLOAT END) FILTER(WHERE b.act_at > a.act_at AND a.against = b.against) AS after,
            count(*) FILTER(WHERE a.against <> b.against) AS disagree,
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
        UNION ALL
        SELECT seed_id AS id, seed_id AS oid, 0 AS trust
        FROM unnest(${seeds}::int[]) seed_id
      )
      SELECT id, oid, trust, sum(trust) OVER (PARTITION BY id) AS total_trust
      FROM trust_pairs
    ) a
    GROUP BY a.id
    ORDER BY id ASC`
}

function reduceVectors (subName, fieldGraphVectors) {
  function reduceVector (field, graph, vector, result = {}) {
    vector.forEach((val, [idx]) => {
      if (isNaN(val) || val <= 0) return
      result[graph[idx].id] = {
        ...result[graph[idx].id],
        subName,
        userId: graph[idx].id,
        [field]: val
      }
    })
    return result
  }

  let result = {}
  for (const field in fieldGraphVectors) {
    result = reduceVector(field, fieldGraphVectors[field].graph, fieldGraphVectors[field].vector, result)
  }

  // return only the users with trust > 0
  return Object.values(result).filter(s =>
    Object.keys(fieldGraphVectors).reduce(
      (acc, key) => acc + (s[key] ?? 0),
      0
    ) > IRRELEVANT_CUMULATIVE_TRUST
  )
}

async function storeTrust (models, subName, results) {
  console.timeLog('trust', `storing trust for ${subName} with ${results.length} users`)
  // update the trust of each user in graph
  await models.$transaction([
    models.userSubTrust.deleteMany({
      where: {
        subName
      }
    }),
    models.userSubTrust.createMany({
      data: results
    })
  ])
}
