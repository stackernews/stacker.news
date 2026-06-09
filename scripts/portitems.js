const { PrismaClient } = require('@prisma/client')

// Configure database connections
const targetDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://sn:password@localhost:5431/stackernews?schema=public'
    }
  }
})

const sourceDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://sn:password@localhost:5433/stackernews?schema=public'
    }
  }
})

const BATCH_SIZE = 500

// In StackerNews, posts are items with no parent, comments have a parentId
async function getTopPosts (limit) {
  console.log(`Fetching top ${limit} posts from source database...`)

  const posts = await sourceDb.item.findMany({
    where: {
      parentId: null,
      deletedAt: null
    },
    select: {
      id: true,
      title: true,
      text: true,
      url: true,
      subName: true,
      parentId: true,
      rootId: true
    },
    orderBy: {
      weightedVotes: 'desc'
    },
    take: limit
  })

  console.log(`Found ${posts.length} posts`)
  return posts
}

async function getTopComments (limit) {
  console.log(`Fetching top ${limit} comments from source database...`)

  const comments = await sourceDb.item.findMany({
    where: {
      parentId: { not: null },
      deletedAt: null
    },
    select: {
      id: true,
      text: true,
      parentId: true,
      rootId: true
    },
    orderBy: {
      weightedVotes: 'desc'
    },
    take: limit
  })

  console.log(`Found ${comments.length} comments`)
  return comments
}

async function getTargetPostCount () {
  const count = await targetDb.item.count({
    where: {
      parentId: null
    }
  })
  return count
}

async function getTargetCommentCount () {
  const count = await targetDb.item.count({
    where: {
      parentId: { not: null }
    }
  })
  return count
}

async function updatePosts (posts) {
  console.log(`Updating ${posts.length} posts in target database...`)

  // Get all placeholder posts from target DB
  const placeholderPosts = await targetDb.item.findMany({
    where: {
      parentId: null
    },
    select: {
      id: true
    }
  })

  if (placeholderPosts.length === 0) {
    console.log('No placeholder posts found in target database')
    return
  }

  console.log(`Found ${placeholderPosts.length} placeholder posts in target database`)

  // Process in batches
  let updatedCount = 0
  const batchCount = Math.ceil(Math.min(posts.length, placeholderPosts.length) / BATCH_SIZE)

  for (let batch = 0; batch < batchCount; batch++) {
    const start = batch * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, Math.min(posts.length, placeholderPosts.length))

    console.log(`Processing post batch ${batch + 1}/${batchCount} (${start + 1}-${end})`)

    const batchPromises = []

    for (let i = start; i < end; i++) {
      if (i >= posts.length || i >= placeholderPosts.length) break

      batchPromises.push(
        targetDb.item.update({
          where: {
            id: placeholderPosts[i].id
          },
          data: {
            title: posts[i].title || null,
            text: posts[i].text || null,
            url: posts[i].url || null
          }
        })
      )
    }

    await Promise.all(batchPromises)
    updatedCount += batchPromises.length
  }

  console.log(`Updated ${updatedCount} posts`)
}

async function updateComments (comments) {
  console.log(`Updating ${comments.length} comments in target database...`)

  // Get all placeholder comments from target DB
  const placeholderComments = await targetDb.item.findMany({
    where: {
      parentId: { not: null }
    },
    select: {
      id: true
    }
  })

  if (placeholderComments.length === 0) {
    console.log('No placeholder comments found in target database')
    return
  }

  console.log(`Found ${placeholderComments.length} placeholder comments in target database`)

  // Process in batches
  let updatedCount = 0
  const batchCount = Math.ceil(Math.min(comments.length, placeholderComments.length) / BATCH_SIZE)

  for (let batch = 0; batch < batchCount; batch++) {
    const start = batch * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, Math.min(comments.length, placeholderComments.length))

    console.log(`Processing comment batch ${batch + 1}/${batchCount} (${start + 1}-${end})`)

    const batchPromises = []

    for (let i = start; i < end; i++) {
      if (i >= comments.length || i >= placeholderComments.length) break

      batchPromises.push(
        targetDb.item.update({
          where: {
            id: placeholderComments[i].id
          },
          data: {
            text: comments[i].text || null
          }
        })
      )
    }

    await Promise.all(batchPromises)
    updatedCount += batchPromises.length
  }

  console.log(`Updated ${updatedCount} comments`)
}

async function main () {
  try {
    console.log('Getting target database stats...')
    const targetPostCount = await getTargetPostCount()
    const targetCommentCount = await getTargetCommentCount()

    console.log(`Target database has ${targetPostCount} posts and ${targetCommentCount} comments that need content`)
    console.log('Will fetch exactly this many top posts and comments from the source database')

    try {
      // Get data from source DB - using exact counts of placeholder items
      const topPosts = await getTopPosts(targetPostCount)
      const topComments = await getTopComments(targetCommentCount)

      // Update target DB
      await updatePosts(topPosts)
      await updateComments(topComments)

      console.log('Database port completed successfully!')
    } catch (error) {
      console.error('Error during database port:', error)
    } finally {
      // Disconnect from databases
      await targetDb.$disconnect()
      await sourceDb.$disconnect()
    }
  } catch (error) {
    console.error('Error initializing script:', error)
    process.exit(1)
  }
}

main()
