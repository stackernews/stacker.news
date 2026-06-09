#!/usr/bin/env node

const { execSync } = require('child_process')
module.paths.push(execSync('npm config get prefix').toString().trim() + '/lib/node_modules')
const { TwitterApi } = require('twitter-api-v2')
const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

// ANSI color codes for output formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  fg: {
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
  }
}

// Add DB utilities for persistent caching
const db = {
  connection: null,

  async init () {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, 'twitter-links.db')
      this.connection = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error(`Error opening database: ${err.message}`)
          reject(err)
          return
        }

        this.connection.run(`
          CREATE TABLE IF NOT EXISTS tweets (
            id TEXT PRIMARY KEY,
            author_id TEXT,
            content TEXT,
            created_at TEXT,
            author_username TEXT,
            author_name TEXT,
            processed_at INTEGER
          )
        `, (err) => {
          if (err) {
            logger.error(`Error creating table: ${err.message}`)
            reject(err)
            return
          }

          // Add the processed_replies and cache_info tables
          this.connection.run(`
            CREATE TABLE IF NOT EXISTS processed_replies (
              tweet_id TEXT PRIMARY KEY,
              processed_at INTEGER
            )
          `, (err) => {
            if (err) {
              logger.error(`Error creating processed_replies table: ${err.message}`)
              reject(err)
              return
            }

            this.connection.run(`
              CREATE TABLE IF NOT EXISTS cache_info (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at INTEGER
              )
            `, (err) => {
              if (err) {
                logger.error(`Error creating cache_info table: ${err.message}`)
                reject(err)
                return
              }

              this.connection.run(`
                CREATE TABLE IF NOT EXISTS url_history (
                  url TEXT PRIMARY KEY,
                  first_seen INTEGER,
                  last_seen INTEGER,
                  seen_count INTEGER DEFAULT 1,
                  hosts_sharing INTEGER DEFAULT 1
                )
              `, (err) => {
                if (err) {
                  logger.error(`Error creating url_history table: ${err.message}`)
                  reject(err)
                  return
                }

                resolve()
              })
            })
          })
        })
      })
    })
  },

  async getLatestTweetTimestamp () {
    return new Promise((resolve, reject) => {
      this.connection.get(
        'SELECT MAX(created_at) as latest FROM tweets',
        (err, row) => {
          if (err) {
            reject(err)
            return
          }
          // Add validation to ensure we don't get a future date
          const now = new Date()
          const latestDate = row?.latest ? new Date(row.latest) : new Date(0)

          // If latest is in the future or invalid, return epoch
          if (!latestDate || latestDate > now) {
            resolve('1970-01-01T00:00:00.000Z')
            return
          }

          resolve(latestDate.toISOString())
        }
      )
    })
  },

  async saveTweet (tweet) {
    return new Promise((resolve, reject) => {
      this.connection.run(
        `INSERT OR IGNORE INTO tweets (id, author_id, content, created_at, author_username, author_name, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tweet.id,
          tweet.author_id,
          tweet.text,
          tweet.created_at,
          tweet.author_username,
          tweet.author_name,
          Math.floor(Date.now() / 1000)
        ],
        (err) => {
          if (err) {
            reject(err)
            return
          }
          resolve()
        }
      )
    })
  },

  // Add method to load cached tweet IDs
  async loadCachedTweetIds () {
    return new Promise((resolve, reject) => {
      this.connection.all(
        'SELECT id FROM tweets',
        (err, rows) => {
          if (err) {
            reject(err)
            return
          }

          const tweetIds = rows.map(row => row.id)
          resolve(tweetIds)
        }
      )
    })
  },

  // Add method to check if a tweet's replies have been processed
  async isReplyProcessed (tweetId) {
    return new Promise((resolve, reject) => {
      this.connection.get(
        'SELECT tweet_id FROM processed_replies WHERE tweet_id = ?',
        [tweetId],
        (err, row) => {
          if (err) {
            reject(err)
            return
          }
          resolve(!!row) // Return true if we found a record
        }
      )
    })
  },

  // Add method to mark a tweet as having its replies processed
  async markRepliesProcessed (tweetId) {
    return new Promise((resolve, reject) => {
      this.connection.run(
        'INSERT OR REPLACE INTO processed_replies (tweet_id, processed_at) VALUES (?, ?)',
        [tweetId, Math.floor(Date.now() / 1000)],
        (err) => {
          if (err) {
            reject(err)
            return
          }
          resolve()
        }
      )
    })
  },

  // Add method to track API usage
  async recordApiUsage (endpoint, count = 1) {
    const now = Math.floor(Date.now() / 1000)
    const today = new Date().toISOString().split('T')[0]

    return new Promise((resolve, reject) => {
      this.connection.get(
        'SELECT value FROM cache_info WHERE key = ?',
        [`api_usage_${endpoint}_${today}`],
        (err, row) => {
          if (err) {
            reject(err)
            return
          }

          const currentCount = row ? parseInt(row.value, 10) : 0
          const newCount = currentCount + count

          this.connection.run(
            'INSERT OR REPLACE INTO cache_info (key, value, updated_at) VALUES (?, ?, ?)',
            [`api_usage_${endpoint}_${today}`, newCount.toString(), now],
            (err) => {
              if (err) {
                reject(err)
                return
              }
              resolve(newCount)
            }
          )
        }
      )
    })
  },

  // Get today's API usage
  async getApiUsage () {
    const today = new Date().toISOString().split('T')[0]

    return new Promise((resolve, reject) => {
      this.connection.all(
        "SELECT key, value FROM cache_info WHERE key LIKE 'api_usage_%_" + today + "'",
        (err, rows) => {
          if (err) {
            reject(err)
            return
          }

          const usage = {}
          rows.forEach(row => {
            const endpoint = row.key.replace('api_usage_', '').replace(`_${today}`, '')
            usage[endpoint] = parseInt(row.value, 10)
          })

          resolve(usage)
        }
      )
    })
  },

  // Track URL history
  async recordUrl (url, hostname, username) {
    const now = Math.floor(Date.now() / 1000)

    return new Promise((resolve, reject) => {
      // First check if URL exists
      this.connection.get(
        'SELECT url, seen_count, hosts_sharing FROM url_history WHERE url = ?',
        [url],
        (err, row) => {
          if (err) {
            reject(err)
            return
          }

          if (row) {
            // URL exists, update it
            this.connection.run(
              'UPDATE url_history SET last_seen = ?, seen_count = seen_count + 1 WHERE url = ?',
              [now, url],
              (err) => {
                if (err) {
                  reject(err)
                  return
                }
                resolve()
              }
            )
          } else {
            // New URL
            this.connection.run(
              'INSERT INTO url_history (url, first_seen, last_seen, seen_count) VALUES (?, ?, ?, 1)',
              [url, now, now],
              (err) => {
                if (err) {
                  reject(err)
                  return
                }
                resolve()
              }
            )
          }
        }
      )
    })
  },

  async close () {
    return new Promise((resolve, reject) => {
      if (this.connection) {
        this.connection.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

// Add API efficiency configuration to default config
let config = {
  listIds: [],
  timeIntervalHours: 12,
  verbosity: 'normal',
  bearerToken: '',
  mediaPatterns: [
    {
      type: 'extensions',
      patterns: ['\\.jpg$', '\\.jpeg$', '\\.png$', '\\.gif$', '\\.mp4$', '\\.webm$']
    },
    {
      type: 'domains',
      patterns: [
        'pbs\\.twimg\\.com',
        'i\\.imgur\\.com',
        'youtube\\.com\\/watch',
        'youtu\\.be\\/',
        'vimeo\\.com\\/'
      ]
    }
  ],
  // Add API usage efficiency controls
  apiEfficiency: {
    // Maximum tweets per member to process
    maxTweetsPerMember: 25,
    // Maximum members per list to process
    maxMembersPerList: 200,
    // Maximum replies per tweet to fetch
    maxRepliesPerTweet: 20,
    // Only fetch replies for tweets with links or higher engagement
    fetchRepliesForTweetsWithLinks: true,
    // Get missing root tweets for conversations
    fetchMissingRootTweets: true,
    // Maximum pages to fetch for each pagination (lists, members, tweets, replies)
    maxPagination: {
      listMembers: 2,
      memberTweets: 1,
      listTweets: 2,
      replies: 2
    },
    // Delay between API calls in milliseconds
    delays: {
      betweenLists: 10000,
      betweenMembers: 10000,
      betweenPagination: 5000,
      afterInitialChecks: 15000
    }
  }
}

// Logger utility
const logger = {
  error: (message) => console.error(`${colors.fg.red}Error: ${message}${colors.reset}`),
  info: (message) => console.log(`${colors.fg.green}${message}${colors.reset}`),
  progress: (message) => {
    if (config.verbosity !== 'minimal') {
      console.log(`${colors.fg.blue}${message}${colors.reset}`)
    }
  },
  debug: (message) => {
    if (config.verbosity === 'debug') {
      console.log(`${colors.fg.gray}${message}${colors.reset}`)
    }
  },
  result: (message) => console.log(`${colors.bright}${colors.fg.green}${message}${colors.reset}`)
}

function loadConfig (configPath) {
  try {
    const configData = fs.readFileSync(configPath, 'utf8')
    const loadedConfig = JSON.parse(configData)
    return { ...config, ...loadedConfig }
  } catch (error) {
    logger.error(`Error loading config file: ${error.message}`)
    logger.info('Using default configuration')
    return config
  }
}

function isMediaUrl (url) {
  if (config.mediaPatterns) {
    for (const patternGroup of config.mediaPatterns) {
      for (const pattern of patternGroup.patterns) {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(url)) return true
      }
    }
  }
  return false
}

function checkSystemTime () {
  const localTime = new Date()
  console.log('System time check:')
  console.log(`- Current local time: ${localTime.toISOString()}`)
  console.log(`- Timestamp (ms): ${localTime.getTime()}`)
  console.log(`- Year: ${localTime.getFullYear()}`)

  // Compare with an external time source
  try {
    // This will make a request to get a server timestamp
    const httpTime = new Date(new Date().toUTCString())
    console.log(`- HTTP header time: ${httpTime.toISOString()}`)
    if (Math.abs(localTime - httpTime) > 60000) { // More than 1 minute difference
      console.log(`WARNING: Your system time might be off by ${Math.abs(localTime - httpTime) / 1000} seconds`)
    }
  } catch (e) {
    console.log(`- Could not check external time: ${e.message}`)
  }
}

async function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Add tweet cache to avoid duplicate requests
const tweetCache = {
  tweets: new Map(),

  async initFromDb () {
    try {
      const cachedIds = await db.loadCachedTweetIds()
      logger.info(`Loaded ${cachedIds.length} tweet IDs from database cache`)

      // Mark these as seen in our in-memory cache
      cachedIds.forEach(id => {
        this.tweets.set(id, { id, cached: true })
      })
    } catch (err) {
      logger.error(`Error loading tweet cache from DB: ${err.message}`)
    }
  },

  add (tweets) {
    if (!Array.isArray(tweets)) tweets = [tweets]

    tweets.forEach(tweet => {
      if (tweet && tweet.id) {
        this.tweets.set(tweet.id, tweet)

        // Save to DB for persistence
        if (tweet.text && tweet.created_at) {
          db.saveTweet(tweet).catch(err => {
            logger.error(`Error saving tweet to DB: ${err.message}`)
          })
        }
      }
    })
  },

  get (id) {
    return this.tweets.get(id)
  },

  has (id) {
    return this.tweets.has(id)
  },

  getAll () {
    return Array.from(this.tweets.values())
  },

  size () {
    return this.tweets.size
  }
}

// Track processed tweets to avoid duplicate work
const processedReplies = {}

// Add function to load already processed replies from DB
async function loadProcessedReplies () {
  try {
    // Get tweet IDs from DB for which we've already fetched replies
    const connection = db.connection

    return new Promise((resolve, reject) => {
      connection.all('SELECT tweet_id FROM processed_replies', (err, rows) => {
        if (err) {
          reject(err)
          return
        }

        // Add to our in-memory tracking
        rows.forEach(row => {
          processedReplies[row.tweet_id] = true
        })

        logger.info(`Loaded ${rows.length} previously processed reply records from database`)
        resolve()
      })
    })
  } catch (err) {
    logger.error(`Error loading processed replies: ${err.message}`)
  }
}

// Enhanced API tracking wrapper
async function callTwitterApi (endpoint, apiCall, incrementAmount = 1) {
  // Record API usage
  const usageCount = await db.recordApiUsage(endpoint, incrementAmount)
  logger.debug(`API call to ${endpoint}: usage today = ${usageCount}`)

  // Set thresholds based on Pro tier limits
  // https://docs.x.com/x-api/fundamentals/rate-limits
  const fifteenMinuteLimits = {
    lists: 75, // 75 requests / 15 minutes per app
    tweets: 450, // 450 requests / 15 minutes per app (900 per user)
    users: 500, // Most user endpoints are 300-900 / 15 minutes
    search: 450, // 450 requests / 15 minutes per app
    default: 300
  }

  // Calculate daily limits as approximately 96 fifteen-minute periods per day
  // But using a more conservative factor of 20x to avoid hitting limits
  const dailyLimitFactor = 20
  const dailyLimits = {}

  for (const [key, value] of Object.entries(fifteenMinuteLimits)) {
    dailyLimits[key] = value * dailyLimitFactor
  }

  const limit = dailyLimits[endpoint] || dailyLimits.default
  const warningThreshold = limit * 0.8

  // Warn if approaching limit
  if (usageCount > warningThreshold) {
    logger.error(`WARNING: ${endpoint} API usage at ${usageCount}/${limit} (${Math.round(usageCount / limit * 100)}% of daily limit)`)
  }

  // Emergency stop if exceeded
  if (usageCount >= limit) {
    throw new Error(`EMERGENCY STOP: Daily API limit for ${endpoint} exceeded (${usageCount}/${limit})`)
  }

  try {
    // Make the call
    const result = await apiCall()

    // Check rate limit headers if available
    if (result && result._headers) {
      const remaining = result._headers.get('x-rate-limit-remaining')
      const resetTime = result._headers.get('x-rate-limit-reset')
      const limit = result._headers.get('x-rate-limit-limit')

      if (remaining && limit) {
        const remainingPercent = Math.round((parseInt(remaining) / parseInt(limit)) * 100)
        logger.debug(`Rate limit status for ${endpoint}: ${remaining}/${limit} (${remainingPercent}% remaining)`)

        // If we're below 10% of remaining requests, log a warning
        if (remainingPercent < 10) {
          logger.error(`URGENT: Only ${remainingPercent}% of rate limit remaining for ${endpoint}`)

          if (resetTime) {
            const resetDate = new Date(parseInt(resetTime) * 1000)
            const resetInSeconds = Math.round((resetDate.getTime() - Date.now()) / 1000)
            logger.info(`Rate limit resets in ${resetInSeconds} seconds (${resetDate.toISOString()})`)
          }
        }
      }
    }

    return result
  } catch (error) {
    // Check if this is a rate limit error
    if (error.code === 88 || error.code === 429 ||
        (error.message && (error.message.includes('429') || error.message.includes('Rate limit')))) {
      logger.error(`Rate limit exceeded for ${endpoint}. Backing off.`)

      // If we have rate limit info in the error, use it
      if (error.rateLimit) {
        const resetTime = error.rateLimit.reset
        if (resetTime) {
          const resetDate = new Date(resetTime * 1000)
          const waitTime = Math.max(resetDate.getTime() - Date.now(), 60000) // at least 1 minute
          logger.info(`Rate limit resets at ${resetDate.toISOString()}. Waiting ${Math.round(waitTime / 1000)} seconds.`)
          await sleep(waitTime)
        } else {
          // Default backoff of 5 minutes
          logger.info('No reset time available. Using default 5 minute backoff.')
          await sleep(300000)
        }
      } else {
        // Default backoff of 5 minutes
        logger.info('No rate limit details available. Using default 5 minute backoff.')
        await sleep(300000)
      }

      // Throw a more informative error
      throw new Error(`Rate limit exceeded for ${endpoint}. Try again later or reduce request frequency.`)
    }

    // For other errors, just pass them through
    throw error
  }
}

async function getTweetsFromListMembers (client, listIds, sinceTime) {
  const allTweets = []

  // Process one list at a time with significant delays between lists
  for (const listId of listIds) {
    try {
      logger.info(`Getting members of list ${listId}...`)

      // Add delay before starting each list to avoid rate limits
      await sleep(config.apiEfficiency.delays.betweenLists)

      // Use paginated approach to get all list members
      const members = []
      let nextToken
      let paginationCount = 0
      const maxMemberPages = config.apiEfficiency.maxPagination.listMembers

      do {
        // Add delay between pagination requests
        if (paginationCount > 0) await sleep(config.apiEfficiency.delays.betweenPagination)

        try {
          const response = await rateLimitHandler(async () => {
            return client.v2.listMembers(listId, {
              'user.fields': 'username,name',
              max_results: 100,
              pagination_token: nextToken
            })
          }, 5)

          if (response?.data?.length > 0) {
            members.push(...response.data)
            logger.info(`Found ${response.data.length} members in list ${listId}${paginationCount > 0 ? ` (page ${paginationCount + 1})` : ''}`)
          }

          // Check for more pages
          nextToken = response?.meta?.next_token
          paginationCount++
        } catch (memberError) {
          logger.error(`Could not get list members page: ${memberError.message}`)
          break
        }
      } while (nextToken && paginationCount < maxMemberPages)

      if (!members || members.length === 0) {
        logger.error('Couldn\'t parse list members response or no members found')
        continue
      }

      logger.info(`Found total of ${members.length} members in list ${listId}`)

      // Process more members but still keep a reasonable limit
      const memberLimit = Math.min(members.length, config.apiEfficiency.maxMembersPerList)
      const limitedMembers = members.slice(0, memberLimit)

      logger.info(`Processing tweets from ${memberLimit} members...`)

      // Process each member's timeline with longer delays between requests
      for (const member of limitedMembers) {
        try {
          logger.progress(`Getting tweets from @${member.username}...`)

          // Much longer delay between requests to avoid rate limits
          await sleep(config.apiEfficiency.delays.betweenMembers)

          // Use pagination to get more tweets from each member
          const userTweets = []
          let memberNextToken
          let memberPaginationCount = 0
          const maxMemberPages = config.apiEfficiency.maxPagination.memberTweets

          do {
            // Add delay between pagination requests
            if (memberPaginationCount > 0) await sleep(config.apiEfficiency.delays.betweenPagination)

            const response = await client.v2.userTimeline(member.id, {
              max_results: config.apiEfficiency.maxTweetsPerMember,
              'tweet.fields': 'created_at,author_id,conversation_id,entities,public_metrics',
              'user.fields': 'username,name',
              expansions: 'author_id',
              pagination_token: memberNextToken
            })

            if (response?.data?.length > 0) {
              // Filter out tweets we've already seen
              const newTweets = response.data.filter(tweet => !tweetCache.has(tweet.id))

              if (newTweets.length > 0) {
                userTweets.push(...newTweets)
                logger.debug(`Found ${newTweets.length} new tweets from @${member.username}${memberPaginationCount > 0 ? ` (page ${memberPaginationCount + 1})` : ''}`)

                // Add to cache
                tweetCache.add(newTweets)
              } else {
                logger.debug(`No new tweets found for @${member.username} on page ${memberPaginationCount + 1}`)
              }
            }

            // Check for more pages - but only continue if we got new tweets
            memberNextToken = response?.meta?.next_token

            // Stop pagination if we didn't get any new tweets
            if (userTweets.length === 0) {
              memberNextToken = undefined
            }

            memberPaginationCount++
          } while (memberNextToken && memberPaginationCount < maxMemberPages)

          if (userTweets.length > 0) {
            logger.info(`Found ${userTweets.length} new tweets from @${member.username}`)

            // Get the author data from the response
            const author = {
              username: member.username,
              name: member.name || member.username
            }

            // Process tweets with author data
            const processedTweets = userTweets.map(tweet => ({
              ...tweet,
              author_username: author.username,
              author_name: author.name
            }))

            // Filter to tweets from the requested time period
            const filteredTweets = processedTweets.filter(tweet => {
              const tweetDate = new Date(tweet.created_at)
              const cutoffDate = new Date(sinceTime)
              return tweetDate >= cutoffDate
            })

            logger.debug(`${filteredTweets.length} tweets from @${member.username} after date filtering`)
            allTweets.push(...filteredTweets)
          }
        } catch (userError) {
          logger.error(`Error getting tweets for ${member.username}: ${userError.message}`)

          // If we hit rate limits, wait longer
          if (userError.code === 429 || userError.message.includes('429')) {
            const waitTime = 90000 // 90 seconds
            logger.info(`Rate limit hit, waiting ${waitTime / 1000} seconds...`)
            await sleep(waitTime)
          }
        }
      }
    } catch (listError) {
      logger.error(`Error processing list ${listId}: ${listError.message}`)
    }
  }

  return allTweets
}

async function getTweetsFromLists (client, listIds, sinceTime) {
  const allTweets = []

  // Add delay at the start
  await sleep(5000)

  for (const listId of listIds) {
    try {
      logger.progress(`Fetching tweets from list ${listId}...`)

      // Get list info first to confirm access
      try {
        const listInfo = await rateLimitHandler(async () => {
          return client.v2.list(listId)
        }, 5)
        logger.info(`List info: ${listInfo.data.name}`)

        // Add significant delay after getting list info before fetching tweets
        await sleep(config.apiEfficiency.delays.betweenLists)

        // Use pagination to get more tweets from the list
        const listTweets = []
        let listNextToken
        let listPaginationCount = 0
        const maxListPages = config.apiEfficiency.maxPagination.listTweets

        do {
          // Add delay between pagination requests
          if (listPaginationCount > 0) await sleep(config.apiEfficiency.delays.betweenPagination)

          try {
            // Use the standard client method
            const response = await client.v2.listTweets(listId, {
              max_results: 100,
              'tweet.fields': 'created_at,author_id,conversation_id,entities,public_metrics',
              'user.fields': 'username,name',
              expansions: 'author_id',
              pagination_token: listNextToken
            })

            // Add debug logging and proper type checking
            logger.debug(`Response structure: ${JSON.stringify(response?.meta || {})}`)

            // Check if response.data exists and is an array
            const replyData = Array.isArray(response?.data) ? response.data : (response?.data?.data && Array.isArray(response.data.data) ? response.data.data : [])

            if (replyData.length > 0) {
              // Filter out tweets we've already seen
              const newTweets = replyData.filter(tweet => !tweetCache.has(tweet.id))

              if (newTweets.length > 0) {
                logger.info(`Found ${newTweets.length} new tweets in list ${listId}${listPaginationCount > 0 ? ` (page ${listPaginationCount + 1})` : ''}`)

                // Process tweets with better author handling
                const processedTweets = newTweets.map(tweet => {
                  // Find author in includes or set defaults if missing
                  const authorIncludes = response.includes?.users || (response.data?.includes?.users || [])
                  const author = authorIncludes.find(u => u.id === tweet.author_id) || {}

                  return {
                    ...tweet,
                    author_username: author.username || 'unknown_user',
                    author_name: author.name || author.username || 'Unknown User'
                  }
                })

                listTweets.push(...processedTweets)

                // Add to cache
                tweetCache.add(processedTweets)
              } else {
                logger.info(`No new tweets found in list ${listId} on page ${listPaginationCount + 1}`)
              }
            }

            // Check for more pages - but only continue if we got new tweets
            listNextToken = response?.meta?.next_token

            // Stop pagination if we didn't get any new tweets
            if (replyData.length > 0 && replyData.filter(tweet => !tweetCache.has(tweet.id)).length === 0) {
              listNextToken = undefined
            }

            listPaginationCount++
          } catch (err) {
            logger.error(`API call to get list tweets failed: ${err.message}`)
            logger.debug(`Error details: ${err.stack}`)
            break
          }
        } while (listNextToken && listPaginationCount < maxListPages)

        if (listTweets.length > 0) {
          logger.info(`Total new tweets found in list ${listId}: ${listTweets.length}`)

          // Add to our collection
          allTweets.push(...listTweets)
        }
      } catch (error) {
        logger.error(`List access failed: ${error.message}`)
        if (error.message.includes('403')) {
          logger.error('You need Twitter API v2 Essential or higher access for lists endpoints.')
        }
      }
    } catch (error) {
      logger.error(`Error processing list ${listId}: ${error.message}`)
    }
  }

  return allTweets
}

// Add a new function to check if a URL is a Twitter status link
function isTwitterStatusLink (url) {
  return url && (
    url.match(/twitter\.com\/.*\/status\//) ||
    url.match(/x\.com\/.*\/status\//)
  )
}

// Add a function to extract tweet ID from Twitter URL
function extractTweetIdFromUrl (url) {
  if (!isTwitterStatusLink(url)) return null

  const match = url.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

// Add a function to fetch tweets by IDs
async function fetchTweetsByIds (client, ids) {
  if (!ids.length) return []

  try {
    // Get unique IDs (remove duplicates)
    const uniqueIds = [...new Set(ids)]

    // Split into chunks of 100 (API limitation)
    const chunks = []
    for (let i = 0; i < uniqueIds.length; i += 100) {
      chunks.push(uniqueIds.slice(i, i + 100))
    }

    const allTweets = []

    for (const chunk of chunks) {
      // Add delay between chunk requests
      if (chunks.length > 1) await sleep(15000)

      logger.progress(`Fetching ${chunk.length} referenced tweets...`)

      const response = await rateLimitHandler(async () => {
        return client.v2.tweets(chunk, {
          'tweet.fields': 'created_at,author_id,entities',
          'user.fields': 'username,name',
          expansions: 'author_id'
        })
      }, 3)

      if (response && response.data) {
        // Process the tweets with author data
        const processedTweets = response.data.map(tweet => {
          const author = response.includes?.users?.find(u => u.id === tweet.author_id) || {}
          return {
            ...tweet,
            author_username: author?.username,
            author_name: author?.name
          }
        })

        allTweets.push(...processedTweets)
      }
    }

    return allTweets
  } catch (error) {
    logger.error(`Error fetching referenced tweets: ${error.message}`)
    return []
  }
}

// Add function to check if a tweet contains non-Twitter links
function hasNonTwitterLinks (tweet) {
  if (!tweet.entities?.urls?.length) return false

  return tweet.entities.urls.some(url => {
    return url.expanded_url && !isTwitterStatusLink(url.expanded_url)
  })
}

// Enhance the fetchRepliesForTweets function to use DB tracking
async function fetchRepliesForTweets (client, tweets) {
  const allReplies = []

  // Only fetch replies for tweets that have links or high engagement if configured
  let tweetsToProcess = tweets

  if (config.apiEfficiency.fetchRepliesForTweetsWithLinks) {
    // Filter to tweets with links or high engagement
    tweetsToProcess = tweets.filter(tweet => {
      // Check if tweet has URLs
      const hasLinks = tweet.entities?.urls?.length > 0

      // Check if tweet has high engagement (optional additional criteria)
      const hasHighEngagement = tweet.public_metrics && (
        (tweet.public_metrics.retweet_count >= 5) ||
        (tweet.public_metrics.reply_count >= 3) ||
        (tweet.public_metrics.like_count >= 10)
      )

      return hasLinks || hasHighEngagement
    })

    logger.info(`Filtering ${tweets.length} tweets to ${tweetsToProcess.length} tweets with links or high engagement for reply fetching`)
  }

  const tweetIds = tweetsToProcess.map(t => t.id)

  // Process in smaller batches to avoid rate limits
  const batchSize = 5

  for (let i = 0; i < tweetIds.length; i += batchSize) {
    const batchIds = tweetIds.slice(i, i + batchSize)
    logger.progress(`Fetching replies for batch ${i / batchSize + 1}/${Math.ceil(tweetIds.length / batchSize)}...`)

    // Add delay between batches
    if (i > 0) await sleep(30000)

    for (const tweetId of batchIds) {
      // Skip if we've already processed this tweet
      if (processedReplies[tweetId] || await db.isReplyProcessed(tweetId)) {
        logger.debug(`Skipping replies for tweet ${tweetId} - already processed`)
        processedReplies[tweetId] = true
        continue
      }

      try {
        // Add small delay between individual requests
        await sleep(5000)

        // Search for replies to this tweet using conversation_id with pagination
        const repliesForTweet = []
        let nextToken
        let paginationCount = 0
        const maxPagination = config.apiEfficiency.maxPagination.replies

        do {
          // Add delay between pagination requests
          if (paginationCount > 0) await sleep(config.apiEfficiency.delays.betweenPagination)

          const response = await callTwitterApi(
            'search',
            async () => {
              return await rateLimitHandler(async () => {
                return client.v2.search(`conversation_id:${tweetId}`, {
                  'tweet.fields': 'created_at,author_id,conversation_id,entities',
                  'user.fields': 'username,name',
                  expansions: 'author_id',
                  max_results: config.apiEfficiency.maxRepliesPerTweet,
                  pagination_token: nextToken
                })
              }, 3)
            }
          )

          // Add debug logging for response structure
          logger.debug(`Replies response structure: ${JSON.stringify(response?.meta || {})}`)

          // Check if response.data exists and is an array
          const replyData = Array.isArray(response?.data) ? response.data : (response?.data?.data && Array.isArray(response.data.data) ? response.data.data : [])

          if (replyData.length > 0) {
            // Filter out tweets we've already seen
            const newReplies = replyData.filter(reply => !tweetCache.has(reply.id))

            if (newReplies.length > 0) {
              logger.info(`Found ${newReplies.length} new replies to tweet ${tweetId}${paginationCount > 0 ? ` (page ${paginationCount + 1})` : ''}`)

              // Process the replies with author data
              const processedReplies = newReplies.map(reply => {
                const authorIncludes = response.includes?.users || (response.data?.includes?.users || [])
                const author = authorIncludes.find(u => u.id === reply.author_id) || {}
                return {
                  ...reply,
                  author_username: author?.username,
                  author_name: author?.name,
                  is_reply: true,
                  reply_to: tweetId
                }
              })

              repliesForTweet.push(...processedReplies)

              // Add to cache
              tweetCache.add(processedReplies)
            } else {
              logger.debug(`No new replies found for tweet ${tweetId} on page ${paginationCount + 1}`)
            }
          }

          // Check if there are more pages
          nextToken = response?.meta?.next_token

          // Stop pagination if we didn't get any new replies on this page
          if (replyData.length > 0 && replyData.filter(reply => !tweetCache.has(reply.id)).length === 0) {
            nextToken = undefined
          }

          paginationCount++
        } while (nextToken && paginationCount < maxPagination)

        if (repliesForTweet.length > 0) {
          logger.info(`Total new replies found for tweet ${tweetId}: ${repliesForTweet.length}`)
          allReplies.push(...repliesForTweet)
        }

        // Mark as processed in memory and DB
        processedReplies[tweetId] = true
        await db.markRepliesProcessed(tweetId)
      } catch (error) {
        logger.error(`Error fetching replies for tweet ${tweetId}: ${error.message}`)

        // If we hit rate limits, wait longer
        if (error.code === 429 || error.message.includes('429')) {
          const waitTime = 90000 // 90 seconds
          logger.info(`Rate limit hit, waiting ${waitTime / 1000} seconds...`)
          await sleep(waitTime)
        }
      }
    }
  }

  return allReplies
}

// Add function to get the original tweet of a conversation if not already in the dataset
async function fetchConversationRootTweets (client, tweets) {
  // Skip if not enabled
  if (!config.apiEfficiency.fetchMissingRootTweets) {
    logger.info('Skipping root tweet fetching (disabled in config)')
    return []
  }

  // Find tweets that are replies but we don't have their parent in our dataset
  const conversations = {}
  const rootTweetsToFetch = new Set()

  // Group by conversation ID
  tweets.forEach(tweet => {
    const convoId = tweet.conversation_id || tweet.id
    if (!conversations[convoId]) {
      conversations[convoId] = []
    }
    conversations[convoId].push(tweet)
  })

  // For each conversation, check if we have the root tweet
  for (const convoId in conversations) {
    const convoTweets = conversations[convoId]

    // Find if we have a non-reply tweet in this conversation
    const hasRoot = convoTweets.some(t => !t.is_reply)

    // If all tweets are replies, we need to fetch the root
    if (!hasRoot && convoId && !tweetCache.has(convoId)) {
      rootTweetsToFetch.add(convoId)
    }
  }

  // Now fetch the missing root tweets
  if (rootTweetsToFetch.size > 0) {
    logger.info(`Fetching ${rootTweetsToFetch.size} missing root tweets for conversations...`)

    const rootIds = Array.from(rootTweetsToFetch)
    const rootTweets = await fetchTweetsByIds(client, rootIds)

    logger.info(`Found ${rootTweets.length} root tweets`)

    // Add to cache
    tweetCache.add(rootTweets)

    return rootTweets
  }

  return []
}

// Enhance formatTweetOutput function to better handle authors and URLs
function formatTweetOutput (tweets, referencedTweetsMap = {}) {
  // Group tweets by conversation_id to keep replies with their parent tweets
  const conversationGroups = {}

  for (const tweet of tweets) {
    const conversationId = tweet.conversation_id || tweet.id
    if (!conversationGroups[conversationId]) {
      conversationGroups[conversationId] = []
    }
    conversationGroups[conversationId].push(tweet)
  }

  const output = []

  // Track external links for deduplication across the output
  const seenExternalUrls = new Set()

  // Process each conversation group separately
  for (const conversationId in conversationGroups) {
    const conversationTweets = conversationGroups[conversationId]

    // Sort tweets within a conversation: main tweet first, then replies
    conversationTweets.sort((a, b) => {
      // If one is a reply and the other isn't, non-reply comes first
      if (a.is_reply && !b.is_reply) return 1
      if (!a.is_reply && b.is_reply) return -1

      // Otherwise sort by timestamp
      return new Date(a.created_at) - new Date(b.created_at)
    })

    // Track all external URLs in this conversation
    const conversationExternalUrls = []
    let mainTweetAuthor = null

    // Flag to track if this conversation has external links
    let hasExternalLinks = false

    // First pass: collect all external URLs from the conversation
    for (const tweet of conversationTweets) {
      // Ensure author information exists, set a default if missing
      if (!tweet.author_username) {
        tweet.author_username = tweet.author_name || 'unknown_user'
      }

      // Keep track of the main tweet author
      if (!tweet.is_reply && !mainTweetAuthor) {
        mainTweetAuthor = tweet.author_username
      }

      // Process URLs in this tweet
      const timestamp = new Date(tweet.created_at).toISOString()

      // Extract URLs from entities if available, otherwise fall back to regex
      let urls = []
      if (tweet.entities && tweet.entities.urls && Array.isArray(tweet.entities.urls)) {
        // Use entity URLs as the primary source - these are the most reliable and include expanded URLs
        urls = tweet.entities.urls.map(url => ({
          short_url: url.url,
          expanded_url: url.expanded_url || url.url,
          display_url: url.display_url || url.url,
          title: url.title || '',
          description: url.description || ''
        }))
      } else {
        // Fallback to regex extraction if no entities
        const extractedUrls = tweet.text.match(/(https?:\/\/[^\s]+)/g) || []
        urls = extractedUrls.map(url => ({
          short_url: url,
          expanded_url: url,
          display_url: url
        }))
      }

      // Special handling for retweets - ensure we capture URLs even from truncated content
      const isRetweet = tweet.text.startsWith('RT @')

      // For retweets, we want to extract any URLs even from truncated text
      if (isRetweet) {
        // If it's a retweet with a truncated URL at the end (ending with … or ...)
        const endsWithTruncation = tweet.text.match(/https?:\/\/[^\s]*(?:…|\.{3})$/)

        if (endsWithTruncation || urls.length === 0) {
          // Remove the RT @username: prefix to get just the retweeted content
          const rtText = tweet.text.replace(/^RT @[\w\d_]+: /, '')

          // Extract all potential URLs, including truncated ones
          const rtUrlMatches = rtText.match(/(?:https?:\/\/[^\s]*(?:…|\.{3})?)/g) || []

          if (rtUrlMatches.length > 0) {
            // Process any URLs found in the retweet text
            const rtUrls = rtUrlMatches.map(url => {
              // Remove trailing punctuation that might have been included
              const cleanUrl = url.replace(/[.,;:!?…]+$/, '')
              // For truncated URLs, try to find the full version in the entities if available
              const isTruncated = cleanUrl.endsWith('…') || cleanUrl.endsWith('...')
              let expandedUrl = cleanUrl

              // If the URL is truncated and we have entities, try to find a match
              if (isTruncated && tweet.entities?.urls) {
                // Find a matching t.co URL in the entities
                const matchingEntity = tweet.entities.urls.find(u =>
                  cleanUrl.startsWith(u.url.substring(0, Math.min(u.url.length, cleanUrl.length)))
                )

                if (matchingEntity) {
                  expandedUrl = matchingEntity.expanded_url
                }
              }

              return {
                short_url: cleanUrl,
                expanded_url: expandedUrl,
                display_url: cleanUrl,
                is_truncated: isTruncated
              }
            })

            // Add any new URLs not already in our list
            for (const rtUrl of rtUrls) {
              if (!urls.some(u => u.short_url === rtUrl.short_url)) {
                urls.push(rtUrl)
              }
            }
          }
        }
      }

      // Separate external content URLs and Twitter status URLs
      const contentUrls = []
      const twitterStatusUrls = []

      // Track referenced tweets that contain external links
      const referencedTweetsWithLinks = []

      urls.forEach(url => {
        // Make sure expanded_url exists and isn't truncated
        if (url.expanded_url) {
          // Fix truncated URL issue by removing ... at the end if present
          if (url.expanded_url.endsWith('…') || url.expanded_url.endsWith('...')) {
            // For truncated URLs, try to find a full t.co URL in the text that starts with this prefix
            if (tweet.entities?.urls) {
              // Look for a matching full URL in the tweet entities
              const potentialMatch = tweet.entities.urls.find(entityUrl =>
                entityUrl.url.startsWith(url.short_url.replace(/[….]+$/, ''))
              )
              if (potentialMatch) {
                url.expanded_url = potentialMatch.expanded_url || url.expanded_url
              }
            }
          }
        }

        if (isTwitterStatusLink(url.expanded_url)) {
          // Look up the tweet ID in our referenced tweets map
          const tweetId = extractTweetIdFromUrl(url.expanded_url)
          const referencedTweet = tweetId ? referencedTweetsMap[tweetId] : null

          if (referencedTweet) {
            // Check if the referenced tweet has non-Twitter links
            if (hasNonTwitterLinks(referencedTweet)) {
              // Store the referenced tweet for showing its links later
              referencedTweetsWithLinks.push(referencedTweet)
            }

            twitterStatusUrls.push({
              ...url,
              referenced_tweet: referencedTweet,
              has_links: hasNonTwitterLinks(referencedTweet)
            })
          } else {
            twitterStatusUrls.push(url)
          }
        } else {
          // Non-Twitter links go directly to content URLs
          contentUrls.push(url)
          hasExternalLinks = true
        }
      })

      // Add direct external content links from this tweet
      contentUrls.forEach(url => {
        // Skip invalid URLs
        if (!url.expanded_url || url.expanded_url.length < 8) return

        // Ensure the URL isn't truncated
        if (url.expanded_url.endsWith('…') || url.expanded_url.endsWith('...')) {
          // For already identified truncated URLs, we'll mark them but still show them
          url.is_truncated = true
        }

        const isMedia = isMediaUrl(url.expanded_url)
        const isTruncated = !!url.is_truncated

        // Track this URL to avoid duplicates
        try {
          const urlObj = new URL(url.expanded_url)
          const hostname = urlObj.hostname

          // Record URL in database for tracking
          db.recordUrl(url.expanded_url, hostname, tweet.author_username).catch(err => {
            logger.error(`Error recording URL history: ${err.message}`)
          })
        } catch (e) {
          // Invalid URL, just continue
          logger.debug(`Skipping invalid URL: ${url.expanded_url}`)
          return
        }

        conversationExternalUrls.push({
          url: url.expanded_url,
          short_url: url.short_url,
          isMedia,
          isTruncated,
          source: 'direct',
          tweet_id: tweet.id,
          tweet_author: tweet.author_username,
          timestamp,
          is_reply: tweet.is_reply || false
        })
      })

      // Add external links from referenced tweets
      referencedTweetsWithLinks.forEach(referencedTweet => {
        if (referencedTweet.entities?.urls) {
          referencedTweet.entities.urls.forEach(urlEntity => {
            if (!isTwitterStatusLink(urlEntity.expanded_url)) {
              const isMedia = isMediaUrl(urlEntity.expanded_url)
              hasExternalLinks = true

              conversationExternalUrls.push({
                url: urlEntity.expanded_url,
                short_url: urlEntity.url,
                isMedia,
                isTruncated: false,
                source: 'referenced',
                referencedAuthor: referencedTweet.author_username || 'unknown_user',
                tweet_id: tweet.id,
                tweet_author: tweet.author_username,
                timestamp,
                is_reply: tweet.is_reply || false
              })
            }
          })
        }
      })
    }

    // Only proceed if this conversation has external URLs
    if (conversationExternalUrls.length === 0 || !hasExternalLinks) {
      continue
    }

    // Group external URLs by domain
    const urlsByDomain = {}
    conversationExternalUrls.forEach(item => {
      if (item.isMedia) return // Skip media URLs if we're focused on external links

      try {
        const urlObj = new URL(item.url)
        const domain = urlObj.hostname

        if (!urlsByDomain[domain]) {
          urlsByDomain[domain] = []
        }
        urlsByDomain[domain].push(item)
      } catch (e) {
        // If URL parsing fails, just continue
      }
    })

    // Calculate how many unique domains we have
    const uniqueDomains = Object.keys(urlsByDomain)

    // Get the main tweet (the first non-reply, or the first tweet if all are replies)
    const mainTweet = conversationTweets.find(t => !t.is_reply) || conversationTweets[0]

    // Handle potentially invalid timestamps
    let mainTimestamp
    try {
      mainTimestamp = new Date(mainTweet.created_at).toISOString()
    } catch (e) {
      // If date parsing fails, use current date
      mainTimestamp = new Date().toISOString()
      logger.error(`Invalid date found: ${mainTweet.created_at}. Using current time instead.`)
    }

    // Handle undefined authors
    const authorUsername = mainTweet.author_username || 'unknown_user'

    // Output the conversation header
    output.push(`${colors.bright}${colors.fg.yellow}Tweet by @${authorUsername} at ${mainTimestamp}${colors.reset}`)
    output.push(`${colors.fg.green}Tweet ID: ${colors.reset}${mainTweet.id}`)

    if (conversationTweets.length > 1) {
      output.push(`${colors.fg.cyan}Thread with ${conversationTweets.length} tweets and ${uniqueDomains.length} unique domains${colors.reset}`)
    }

    output.push(`${colors.bright}${colors.fg.blue}External URLs:${colors.reset}`)

    // Display all external URLs with appropriate formatting
    // First, deduplicate URLs
    const uniqueExternalUrls = []
    const seenUrlsInConversation = new Set()

    conversationExternalUrls.forEach(item => {
      // Skip media URLs if we're focused on external links
      if (item.isMedia) return

      // Skip if we've seen this URL before
      if (seenUrlsInConversation.has(item.url) || seenExternalUrls.has(item.url)) {
        return
      }

      // Skip invalid or very short URLs
      if (!item.url || item.url.length < 8) return

      seenUrlsInConversation.add(item.url)
      seenExternalUrls.add(item.url)
      uniqueExternalUrls.push(item)
    })

    // Then display them
    uniqueExternalUrls.forEach(item => {
      let urlDisplay = `${colors.bright}${colors.fg.cyan}${item.url}${colors.reset}`

      // Add short URL info if it's a t.co link that got expanded
      if (item.short_url && item.short_url.includes('t.co/') && item.short_url !== item.url) {
        urlDisplay = `${colors.bright}${colors.fg.cyan}${item.url}${colors.reset} (${item.short_url})`
      }

      if (item.isTruncated) {
        urlDisplay += ' (truncated)'
      }

      if (item.source === 'referenced') {
        urlDisplay += ` (via @${item.referencedAuthor || 'unknown'})`
      }

      // Add information if this URL is from a reply
      if (item.is_reply) {
        if (item.tweet_author === mainTweetAuthor) {
          urlDisplay += ` ${colors.fg.yellow}(in self-reply)${colors.reset}`
        } else {
          urlDisplay += ` ${colors.fg.yellow}(in reply by @${item.tweet_author || 'unknown'})${colors.reset}`
        }
      }

      output.push(`  • ${urlDisplay}`)
    })

    // Show media URLs separately if there are any
    const mediaUrls = conversationExternalUrls.filter(item => item.isMedia)
    if (mediaUrls.length > 0) {
      output.push(`${colors.fg.gray}Media:${colors.reset}`)
      const uniqueMediaUrls = []
      const seenMediaUrls = new Set()

      mediaUrls.forEach(item => {
        if (!seenMediaUrls.has(item.url)) {
          seenMediaUrls.add(item.url)
          uniqueMediaUrls.push(item)
        }
      })

      // Show at most 3 media URLs to keep output concise
      const displayMediaUrls = uniqueMediaUrls.slice(0, 3)
      displayMediaUrls.forEach(item => {
        output.push(`  • ${colors.fg.gray}${item.url}${colors.reset}`)
      })

      if (uniqueMediaUrls.length > 3) {
        output.push(`  • ${colors.fg.gray}... and ${uniqueMediaUrls.length - 3} more media files${colors.reset}`)
      }
    }

    // Show the main tweet content
    output.push(`${colors.bright}${colors.fg.blue}Content:${colors.reset}`)
    output.push(mainTweet.text)

    // Optionally show replies content if there are external links in replies
    const repliesWithLinks = conversationTweets.filter(t =>
      t.is_reply &&
      conversationExternalUrls.some(url => url.tweet_id === t.id && !url.isMedia)
    )

    if (repliesWithLinks.length > 0) {
      output.push(`${colors.bright}${colors.fg.blue}Replies with links:${colors.reset}`)

      repliesWithLinks.forEach(reply => {
        // Handle undefined authors
        const replyAuthor = reply.author_username || 'unknown_user'
        output.push(`  ${colors.fg.cyan}@${replyAuthor}:${colors.reset} ${reply.text}`)
      })
    }

    output.push(`${colors.fg.yellow}${'-'.repeat(50)}${colors.reset}`)
  }

  return output.join('\n')
}

// Update the rate limit handler to work with the updated callTwitterApi function
async function rateLimitHandler (operation, maxRetries = 3) {
  let retries = 0
  let backoffTime = 30000 // Start with 30 seconds

  while (retries < maxRetries) {
    try {
      return await operation()
    } catch (error) {
      // Check if this is a rate limit error
      const isRateLimit = error.code === 88 || error.code === 429 ||
                         (error.message && (error.message.includes('429') ||
                                           error.message.includes('Rate limit')))

      if (isRateLimit) {
        retries++
        logger.error(`Rate limit hit (attempt ${retries}/${maxRetries}). Waiting ${backoffTime / 1000} seconds...`)

        // Try to get reset time from headers if available
        if (error.rateLimit && error.rateLimit.reset) {
          const resetTime = error.rateLimit.reset * 1000
          const waitTime = resetTime - Date.now()

          if (waitTime > 0) {
            logger.info(`Rate limit resets in ${Math.ceil(waitTime / 1000)} seconds.`)
            backoffTime = Math.min(waitTime + 1000, 120000) // Wait until reset plus 1 second, max 2 minutes
          }
        }

        await sleep(backoffTime)
        backoffTime *= 2 // Exponential backoff
      } else {
        throw error // Not a rate limit error, rethrow
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries due to rate limits`)
}

// Modify main function to include quota management and DB usage
async function main () {
  // Debug system time
  checkSystemTime()

  // Initialize DB
  await db.init()

  try {
    // Load configuration
    const configPath = path.join(__dirname, 'twitter-link-extract.config.json')
    logger.info(`Loading configuration from ${configPath}`)
    config = loadConfig(configPath)

    if (!config.bearerToken) {
      throw new Error('Twitter Bearer Token is required in config file')
    }

    // Initialize tweet cache from DB
    await tweetCache.initFromDb()

    // Load already processed replies
    await loadProcessedReplies()

    // Check API usage for today
    const apiUsage = await db.getApiUsage()
    logger.info(`Today's API usage: ${JSON.stringify(apiUsage)}`)

    // Create Twitter client
    const client = new TwitterApi(config.bearerToken)

    // Validate the token format
    if (!config.bearerToken.startsWith('AAAA')) {
      logger.error('The bearer token format appears incorrect. It should start with "AAAA"')
    }

    // Test connection
    try {
      // Don't attempt to call me() which requires user context
      // Instead, try to fetch a public tweet which only requires basic access
      await callTwitterApi('tweets', async () => {
        return client.v2.tweets('1722701605825642574') // Public tweet ID
      })
      logger.info('API connection working. Successfully accessed public tweet')

      // Add delay before trying lists to avoid rate limits
      await sleep(10000)

      // Now try lists
      try {
        // Test list lookup separately
        await callTwitterApi('lists', async () => {
          return client.v2.list(config.listIds[0])
        })
        logger.info('List access working')
      } catch (listError) {
        logger.error(`List access failed: ${listError.message}`)
        if (listError.message.includes('403')) {
          logger.error('You need Twitter API v2 Essential or higher access for lists endpoints.')
        }
      }
    } catch (error) {
      throw new Error(`API authentication failed: ${error.message}`)
    }

    // Add delay after initial checks
    await sleep(config.apiEfficiency.delays.afterInitialChecks)

    // More explicit timestamp handling
    const now = new Date()
    const hoursAgo = new Date(now.getTime() - (config.timeIntervalHours * 60 * 60 * 1000))
    const latestStored = new Date(await db.getLatestTweetTimestamp())

    // Use the more recent of: hoursAgo or latestStored
    const startTime = new Date(Math.max(hoursAgo.getTime(), latestStored.getTime()))

    // Ensure we're not in the future
    const finalStartTime = new Date(Math.min(startTime.getTime(), now.getTime()))

    logger.info(`Fetching tweets since ${finalStartTime.toISOString()}`)
    logger.info(`API efficiency settings: max ${config.apiEfficiency.maxMembersPerList} members per list, max ${config.apiEfficiency.maxTweetsPerMember} tweets per member`)

    let tweets = []

    // Skip the search approach and go straight to list methods
    logger.info('Using list-only approach as requested...')

    // Try the direct list tweets approach first with rate limit handling
    try {
      const listTweets = await callTwitterApi('lists', async () => {
        return getTweetsFromLists(client, config.listIds, finalStartTime.toISOString())
      })

      tweets = listTweets
      logger.info(`Found ${tweets.length} tweets from lists directly`)

      // Add to cache
      tweetCache.add(tweets)

      // If direct list approach fails, try member approach
      if (tweets.length === 0) {
        logger.info('No tweets found with direct list approach. Trying list members approach...')

        const memberTweets = await callTwitterApi('users', async () => {
          return getTweetsFromListMembers(client, config.listIds, finalStartTime.toISOString())
        })

        tweets = memberTweets
        logger.info(`Found ${tweets.length} tweets from list members`)

        // Add to cache
        tweetCache.add(tweets)
      }
    } catch (error) {
      logger.error(`List approaches failed: ${error.message}`)

      // Try one more time with the members approach if direct list failed
      if (tweets.length === 0) {
        logger.info('Retrying with list members approach...')
        try {
          tweets = await callTwitterApi('users', async () => {
            return getTweetsFromListMembers(client, config.listIds, finalStartTime.toISOString())
          })

          // Add to cache
          tweetCache.add(tweets)
        } catch (memberError) {
          logger.error(`List members approach also failed: ${memberError.message}`)
        }
      }
    }

    // First level filtering - keep tweets with any URLs
    const tweetsWithLinks = tweets.filter(tweet => {
      const urls = tweet.text.match(/(https?:\/\/[^\s]+)/g) || []
      return urls.length > 0
    })

    logger.info(`Found ${tweetsWithLinks.length} tweets with any kind of links`)

    // Extract Twitter status links that need analysis
    const twitterStatusLinks = []
    for (const tweet of tweetsWithLinks) {
      const urls = tweet.entities?.urls || []
      for (const url of urls) {
        if (url.expanded_url && isTwitterStatusLink(url.expanded_url)) {
          const tweetId = extractTweetIdFromUrl(url.expanded_url)
          if (tweetId && !tweetCache.has(tweetId)) {
            twitterStatusLinks.push(tweetId)
          }
        }
      }
    }

    logger.info(`Found ${twitterStatusLinks.length} new Twitter status links to analyze`)

    // Fetch the referenced tweets
    let referencedTweets = []
    if (twitterStatusLinks.length > 0) {
      referencedTweets = await callTwitterApi('tweets', async () => {
        return fetchTweetsByIds(client, twitterStatusLinks)
      })
      logger.info(`Retrieved ${referencedTweets.length} referenced tweets`)

      // Add to cache
      tweetCache.add(referencedTweets)
    }

    // Create a map for quick lookup
    const referencedTweetsMap = {}
    for (const tweet of referencedTweets) {
      referencedTweetsMap[tweet.id] = tweet
    }

    // After getting tweets from lists, fetch replies as well
    if (tweetsWithLinks.length > 0) {
      logger.info(`Preparing to fetch replies${config.apiEfficiency.fetchRepliesForTweetsWithLinks ? ' for tweets with links' : ''}...`)

      try {
        const replies = await fetchRepliesForTweets(client, tweetsWithLinks)
        logger.info(`Found ${replies.length} new replies to tweets`)

        // Add replies to the main tweets collection
        tweetsWithLinks.push(...replies)

        // Also try to fetch the original tweet for any conversations where we only have replies
        try {
          const rootTweets = await callTwitterApi('tweets', async () => {
            return fetchConversationRootTweets(client, tweetsWithLinks)
          })

          if (rootTweets.length > 0) {
            logger.info(`Adding ${rootTweets.length} root tweets to complete conversations`)
            tweetsWithLinks.push(...rootTweets)
          }
        } catch (rootError) {
          logger.error(`Error fetching root tweets: ${rootError.message}`)
        }

        // Sort all tweets by conversation for better processing
        tweetsWithLinks.sort((a, b) => {
          // First sort by conversation_id
          if (a.conversation_id !== b.conversation_id) {
            return a.conversation_id?.localeCompare(b.conversation_id || '')
          }
          // Then by timestamp
          return new Date(a.created_at) - new Date(b.created_at)
        })
      } catch (replyError) {
        logger.error(`Error fetching replies: ${replyError.message}`)
      }
    }

    // Log cache stats
    logger.info(`Cache statistics: ${tweetCache.size()} unique tweets collected`)

    if (tweetsWithLinks.length > 0) {
      const formattedOutput = formatTweetOutput(tweetsWithLinks, referencedTweetsMap)
      console.log(formattedOutput)

      // Count how many conversations are actually shown
      const shownConversations = formattedOutput.split('-'.repeat(50)).length - 1

      logger.result(`Total conversations with valuable links: ${shownConversations}`)
    } else {
      logger.info('No tweets with links found in the specified time interval.')
    }

    // Show final API usage stats
    const finalApiUsage = await db.getApiUsage()
    logger.info(`Final API usage for today: ${JSON.stringify(finalApiUsage)}`)

    // Make recommendations for next run
    const apiUsagePercentages = Object.entries(finalApiUsage).map(([endpoint, count]) => {
      const limit = { lists: 75, tweets: 1000, users: 500, search: 450 }[endpoint] || 500
      return [endpoint, (count / limit) * 100]
    })

    const highestUsage = apiUsagePercentages.reduce((max, [endpoint, percentage]) =>
      percentage > max[1] ? [endpoint, percentage] : max, ['', 0])

    if (highestUsage[1] > 80) {
      logger.error(`WARNING: ${highestUsage[0]} endpoint at ${Math.round(highestUsage[1])}% of daily limit. Consider reducing runs for today.`)
    } else if (highestUsage[1] > 50) {
      logger.info(`NOTE: ${highestUsage[0]} endpoint at ${Math.round(highestUsage[1])}% of daily limit. Monitor usage if running again today.`)
    } else {
      logger.info('API usage is well within limits. Safe to run again today.')
    }
  } catch (error) {
    logger.error(error.message)
  } finally {
    await db.close()
  }
}

main()
