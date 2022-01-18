function trust ({ boss, models }) {
  return async function () {
    console.log('doing trust')
    const graph = await getGraph(models)
    const user = await models.user.findUnique({ where: { name: process.env.WOT_SOURCE || 'k00b' } })
    const trust = await trustGivenGraph(graph, user.id)
    await storeTrust(models, trust)
    console.log('done doing trust')
  }
}

// only explore a path up to this depth from start
const MAX_DEPTH = 6
const MAX_TRUST = 0.9

function pathsOverlap (arr1 = [], arr2 = []) {
  const dp = new Array(arr1.length + 1).fill(0).map(() => new Array(arr2.length + 1).fill(0))
  for (let i = arr1.length - 1; i >= 0; i--) {
    for (let j = arr2.length - 1; j >= 0; j--) {
      if (arr1[i] === arr2[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
        if (dp[i][j] > 1) {
          return true
        }
      } else {
        dp[i][j] = 0
      }
    }
  }

  return false
}

/*
 This approximates an upper bound of trust given a list of indepent trust
 values ... we basically are compressing a trust vector into a single value
 without having to compute the trust using the inclusion-exclusion principle
*/
function boundedTrust (probs) {
  const max = Math.max(...probs)
  const sum = probs.reduce((a, c) => a + c)
  const trust = sum - max * (sum - max)
  return Math.min(trust, MAX_TRUST)
}

/*
 Given the paths to each node and the accumulated trust along that path
 this function returns an object where the keys are the node ids and
 their value is the trust of that node
*/
function trustGivenPaths (paths) {
  const trust = {}
  for (const [node, npaths] of Object.entries(paths)) {
    trust[node] = boundedTrust(Object.values(npaths))
  }
  return trust
}

/*
 Given a graph and start this function returns an object where
 the keys are the node id and their value is the trust of that node
*/
function trustGivenGraph (graph, start) {
  const queue = [] // queue of to be visited nodes
  queue.push(start) // visit start first

  const depth = {} // store the node depth ... XXX space inefficient
  depth[start] = 0 // start node is depth 0

  const paths = {} // { node : { path to node as stringified json array : trust } }
  paths[start] = { '[]': 1 } // the paths to start is an empty path with trust of 1

  // while we have nodes to visit
  while (queue.length > 0) {
    const node = queue.shift()
    if (depth[node] === MAX_DEPTH) break

    if (!graph[node]) {
      // node doesn't have outbound edges
      continue
    }

    // for all of this nodes outbound edges
    for (let i = 0; i < graph[node].length; i++) {
      const { node: sibling, trust } = graph[node][i]
      let explore = false

      // for all existing paths to this node
      for (const [key, value] of Object.entries(paths[node])) {
        const parentPath = JSON.parse(key)
        if (parentPath.includes(sibling)) {
          // sibling already exists on a path to us, ie this would be a cycle
          continue
        }

        // add this path to sibling
        const path = JSON.stringify([...parentPath, node])
        paths[sibling] = paths[sibling] || {}

        // if this sibling has not been visited along this path
        if (!paths[sibling][path]) {
          // here we exclude paths that aren't disjoint - they mininally contribute
          // to trust so we just exclude them, yielding a very small underestimation
          // of trust while reducing the number of paths we have to explore
          let disjoint = true
          // for all the paths to sibling
          for (const [key2] of Object.entries(paths[sibling])) {
            // if this existing path to sibling contains overlap with the
            // path we're exploring, ignore it
            const otherPath = JSON.parse(key2)
            const parsedPath = JSON.parse(path)
            if (pathsOverlap(otherPath, parsedPath)) {
              disjoint = false
              break
            }
          }

          // if this path is disjoint with all existing paths to sibling
          if (disjoint) {
            // accumulate the trust along the path and store it
            paths[sibling][path] = value * trust
            explore = true
          }
        }
      }

      // if we shouldn't explore this sibling, don't queue it
      if (!explore) continue
      depth[sibling] = depth[node] + 1
      queue.push(sibling)
    }
  }

  return trustGivenPaths(paths)
}

/*
  graph is returned as json in adjacency list where edges are the trust value 0-.9
  graph = {
    node1 : [{node : node2, trust: trust12}, {node: node3, trust: trust13}],
    node2 : [{node : node1, trust: trust21}],
    node3 : [{node : node2, trust: trust32}],
  }
*/
async function getGraph (models) {
  const [{ graph }] = await models.$queryRaw`
    select json_object_agg(id, hops) as graph
      from (
        select id, json_agg(json_build_object('node', oid, 'trust', trust)) as hops
          from (
            select "ItemAct"."userId" as id, "Item"."userId" as oid, least(${MAX_TRUST}, count(*)/10.0) as trust
              from "ItemAct"
              join "Item" on "itemId" = "Item".id and "ItemAct"."userId" <> "Item"."userId"
              where "ItemAct".act = 'VOTE' group by "ItemAct"."userId", "Item"."userId"
          ) a
          group by id
      ) b`
  return graph
}

async function storeTrust (models, nodeTrust) {
  // convert nodeTrust into table literal string
  let values = ''
  for (const [id, trust] of Object.entries(nodeTrust)) {
    if (values) values += ','
    values += `(${id}, ${trust})`
  }

  // update the trust of each user in graph
  await models.$executeRaw(
    `UPDATE users
      SET trust = g.trust
      FROM (values ${values}) g(id, trust)
      WHERE users.id = g.id`)
}

module.exports = { trust }
