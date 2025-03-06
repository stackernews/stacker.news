const WebSocket = require('ws') // You might need to install this: npm install ws
const { nip19 } = require('nostr-tools') // Keep this for formatting
const fs = require('fs')
const path = require('path')

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    crimson: '\x1b[38m'
  },
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    gray: '\x1b[100m',
    crimson: '\x1b[48m'
  }
}

// Default configuration
let config = {
  userPubkeys: [],
  ignorePubkeys: [],
  timeIntervalHours: 12,
  verbosity: 'normal', // Can be 'minimal', 'normal', or 'debug'
  relayUrls: [
    'wss://relay.nostr.band',
    'wss://relay.primal.net',
    'wss://relay.damus.io'
  ],
  batchSize: 100,
  mediaPatterns: [
    {
      type: 'extensions',
      patterns: ['\\.jpg$', '\\.jpeg$', '\\.png$', '\\.gif$', '\\.bmp$', '\\.webp$', '\\.tiff$', '\\.ico$',
        '\\.mp4$', '\\.webm$', '\\.mov$', '\\.avi$', '\\.mkv$', '\\.flv$', '\\.wmv$',
        '\\.mp3$', '\\.wav$', '\\.ogg$', '\\.flac$', '\\.aac$', '\\.m4a$']
    },
    {
      type: 'domains',
      patterns: [
        'nostr\\.build\\/[ai]\\/\\w+',
        'i\\.imgur\\.com\\/\\w+',
        'i\\.ibb\\.co\\/\\w+\\/',
        'tenor\\.com\\/view\\/',
        'giphy\\.com\\/gifs\\/',
        'soundcloud\\.com\\/',
        'spotify\\.com\\/',
        'fountain\\.fm\\/'
      ]
    }
  ]
}

/**
 * Logger utility that respects the configured verbosity level
 */
const logger = {
  // Always show error messages
  error: (message) => {
    console.error(`${colors.fg.red}Error: ${message}${colors.reset}`)
  },

  // Minimal essential info - always show regardless of verbosity
  info: (message) => {
    console.log(`${colors.fg.green}${message}${colors.reset}`)
  },

  // Progress updates - show in normal and debug modes
  progress: (message) => {
    if (config.verbosity !== 'minimal') {
      console.log(`${colors.fg.blue}${message}${colors.reset}`)
    }
  },

  // Detailed debug info - only show in debug mode
  debug: (message) => {
    if (config.verbosity === 'debug') {
      console.log(`${colors.fg.gray}${message}${colors.reset}`)
    }
  },

  // Results info - formatted differently for clarity
  result: (message) => {
    console.log(`${colors.bright}${colors.fg.green}${message}${colors.reset}`)
  }
}

/**
 * Load configuration from a JSON file
 * @param {String} configPath - Path to the config file
 * @returns {Object} - Configuration object
 */
function loadConfig (configPath) {
  try {
    const configData = fs.readFileSync(configPath, 'utf8')
    const loadedConfig = JSON.parse(configData)

    // Merge with default config to ensure all properties exist
    return { ...config, ...loadedConfig }
  } catch (error) {
    logger.error(`Error loading config file: ${error.message}`)
    logger.info('Using default configuration')
    return config
  }
}

/**
 * Checks if a URL is a media file or hosted on a media platform based on configured patterns
 * @param {String} url - URL to check
 * @returns {Boolean} - true if it's likely a media URL
 */
function isMediaUrl (url) {
  // Check for media patterns from config
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

/**
 * Fetches events from Nostr relays using WebSockets
 * @param {Array} relayUrls - Array of relay URLs
 * @param {Object} filter - Nostr filter object
 * @param {Number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Array>} - Array of events matching the filter
 */
async function fetchEvents (relayUrls, filter, timeoutMs = 10000) {
  logger.debug(`Fetching events with filter: ${JSON.stringify(filter)}`)
  const events = []

  for (const url of relayUrls) {
    try {
      const ws = new WebSocket(url)

      const relayEvents = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close()
          resolve([]) // Resolve with empty array on timeout
        }, timeoutMs)

        const localEvents = []

        ws.on('open', () => {
          // Create a unique request ID
          const requestId = `req${Math.floor(Math.random() * 10000)}`

          // Format and send the request
          const request = JSON.stringify(['REQ', requestId, filter])
          ws.send(request)

          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString())

              // Check if it's an EVENT message
              if (message[0] === 'EVENT' && message[2]) {
                localEvents.push(message[2])
              } else if (message[0] === 'EOSE') {
                clearTimeout(timeout)
                ws.close()
                resolve(localEvents)
              }
            } catch (error) {
              logger.debug(`Error parsing message: ${error.message}`)
            }
          })
        })

        ws.on('error', (error) => {
          logger.debug(`WebSocket error for ${url}: ${error.message}`)
          clearTimeout(timeout)
          resolve([]) // Resolve with empty array on error
        })

        ws.on('close', () => {
          clearTimeout(timeout)
          resolve(localEvents)
        })
      })

      logger.debug(`Got ${relayEvents.length} events from ${url}`)
      events.push(...relayEvents)
    } catch (error) {
      logger.debug(`Error connecting to ${url}: ${error.message}`)
    }
  }

  // Remove duplicates based on event ID
  const uniqueEvents = {}
  events.forEach(event => {
    if (!uniqueEvents[event.id]) {
      uniqueEvents[event.id] = event
    }
  })

  return Object.values(uniqueEvents)
}

/**
 * Get Nostr notes from followings of specified users that contain external links
 * and were posted within the specified time interval.
 *
 * @param {Array} userPubkeys - Array of Nostr user public keys
 * @param {Number} timeIntervalHours - Number of hours to look back from now
 * @param {Array} relayUrls - Array of Nostr relay URLs
 * @param {Array} ignorePubkeys - Array of pubkeys to ignore (optional)
 * @returns {Promise<Array>} - Array of note objects containing external links within the time interval
 */
async function getNotesWithLinks (userPubkeys, timeIntervalHours, relayUrls, ignorePubkeys = []) {
  // Calculate the cutoff time in seconds (Nostr uses UNIX timestamp)
  const now = Math.floor(Date.now() / 1000)
  const cutoffTime = now - (timeIntervalHours * 60 * 60)

  const allNotesWithLinks = []
  const allFollowedPubkeys = new Set() // To collect all followed pubkeys
  const ignoreSet = new Set(ignorePubkeys) // Convert ignore list to Set for efficient lookups

  if (ignoreSet.size > 0) {
    logger.debug(`Ignoring ${ignoreSet.size} author(s) as requested`)
  }

  logger.info(`Fetching follow lists for ${userPubkeys.length} users...`)
  // First get the followings for each user
  for (const pubkey of userPubkeys) {
    try {
      // Skip if this pubkey is in the ignore list
      if (ignoreSet.has(pubkey)) {
        logger.debug(`Skipping user ${pubkey} as it's in the ignore list`)
        continue
      }

      logger.debug(`Fetching follow list for ${pubkey} from ${relayUrls.length} relays...`)

      // Get the most recent contact list (kind 3)
      const followListEvents = await fetchEvents(relayUrls, {
        kinds: [3],
        authors: [pubkey]
      })

      if (followListEvents.length === 0) {
        logger.debug(`No follow list found for user ${pubkey}. Verify this pubkey has contacts on these relays.`)
        continue
      }

      // Find the most recent follow list event
      const latestFollowList = followListEvents.reduce((latest, event) =>
        !latest || event.created_at > latest.created_at ? event : latest, null)

      if (!latestFollowList) {
        logger.debug(`No valid follow list found for user ${pubkey}`)
        continue
      }

      logger.debug(`Found follow list created at: ${new Date(latestFollowList.created_at * 1000).toISOString()}`)

      // Check if tags property exists
      if (!latestFollowList.tags) {
        logger.debug(`No tags found in follow list for user ${pubkey}`)
        logger.debug('Follow list data:', JSON.stringify(latestFollowList, null, 2))
        continue
      }

      // Extract followed pubkeys from the follow list (tag type 'p')
      const followedPubkeys = latestFollowList.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1])
        .filter(pk => !ignoreSet.has(pk)) // Filter out pubkeys from the ignore list

      if (!followedPubkeys || followedPubkeys.length === 0) {
        logger.debug(`No followed users found for user ${pubkey} (after filtering ignore list)`)
        continue
      }

      // Add all followed pubkeys to our set
      followedPubkeys.forEach(pk => allFollowedPubkeys.add(pk))

      logger.debug(`Added ${followedPubkeys.length} followed users for ${pubkey} (total: ${allFollowedPubkeys.size})`)
    } catch (error) {
      logger.error(`Error processing user ${pubkey}: ${error}`)
    }
  }

  // If we found any followed pubkeys, fetch their notes in batches
  if (allFollowedPubkeys.size > 0) {
    // Convert Set to Array for the filter
    const followedPubkeysArray = Array.from(allFollowedPubkeys)
    const batchSize = config.batchSize || 100 // Use config batch size or default to 100
    const totalBatches = Math.ceil(followedPubkeysArray.length / batchSize)

    logger.progress(`Processing ${followedPubkeysArray.length} followed users in ${totalBatches} batches...`)

    // Process in batches
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const start = batchNum * batchSize
      const end = Math.min(start + batchSize, followedPubkeysArray.length)
      const batch = followedPubkeysArray.slice(start, end)

      logger.progress(`Fetching batch ${batchNum + 1}/${totalBatches} (${batch.length} authors)...`)

      // Fetch notes from the current batch of users
      const notes = await fetchEvents(relayUrls, {
        kinds: [1],
        authors: batch,
        since: cutoffTime
      }, 30000) // Use a longer timeout for this larger query

      logger.debug(`Retrieved ${notes.length} notes from batch ${batchNum + 1}`)

      // Filter notes that have URLs (excluding notes with only media URLs)
      const notesWithUrls = notes.filter(note => {
        // Extract all URLs from content
        const urlRegex = /(https?:\/\/[^\s]+)/g
        const matches = note.content.match(urlRegex) || []

        if (matches.length === 0) return false // No URLs at all

        // Check if any URL is not a media file
        const hasNonMediaUrl = matches.some(url => !isMediaUrl(url))

        return hasNonMediaUrl
      })

      logger.debug(`Found ${notesWithUrls.length} notes containing non-media URLs in batch ${batchNum + 1}`)

      // Get all unique authors from the filtered notes in this batch
      const authorsWithUrls = new Set(notesWithUrls.map(note => note.pubkey))

      // Fetch metadata for all relevant authors in this batch
      if (authorsWithUrls.size > 0) {
        logger.debug(`Fetching metadata for ${authorsWithUrls.size} authors from batch ${batchNum + 1}...`)
        const allMetadata = await fetchEvents(relayUrls, {
          kinds: [0],
          authors: Array.from(authorsWithUrls)
        })

        // Create a map of author pubkey to their latest metadata
        const metadataByAuthor = {}
        allMetadata.forEach(meta => {
          if (!metadataByAuthor[meta.pubkey] || meta.created_at > metadataByAuthor[meta.pubkey].created_at) {
            metadataByAuthor[meta.pubkey] = meta
          }
        })

        // Attach metadata to notes
        for (const note of notesWithUrls) {
          if (metadataByAuthor[note.pubkey]) {
            try {
              const metadata = JSON.parse(metadataByAuthor[note.pubkey].content)
              note.userMetadata = metadata
            } catch (e) {
              logger.debug(`Error parsing metadata for ${note.pubkey}: ${e.message}`)
            }
          }
        }
      }

      // Add all notes with URLs from this batch to our results
      allNotesWithLinks.push(...notesWithUrls)

      // Show incremental progress during batch processing
      if (allNotesWithLinks.length > 0 && batchNum < totalBatches - 1) {
        logger.progress(`Found ${allNotesWithLinks.length} notes with links so far...`)
      }
    }

    logger.progress(`Completed processing all ${totalBatches} batches`)
  }

  return allNotesWithLinks
}

/**
 * Format the notes for display with colorful output
 *
 * @param {Array} notes - Array of note objects
 * @returns {String} - Formatted string with note information
 */
function formatNoteOutput (notes) {
  // Sort notes by timestamp (newest first)
  const sortedNotes = [...notes].sort((a, b) => b.created_at - a.created_at)

  const output = []

  for (const note of sortedNotes) {
    // Get note ID as npub
    const noteId = nip19.noteEncode(note.id)
    const pubkey = nip19.npubEncode(note.pubkey)

    // Get user display name or fall back to npub
    const userName = note.userMetadata
      ? (note.userMetadata.display_name || note.userMetadata.name || pubkey)
      : pubkey

    // Get timestamp as readable date
    const timestamp = new Date(note.created_at * 1000).toISOString()

    // Extract URLs from content, marking media URLs with colors
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const matches = note.content.match(urlRegex) || []

    // Format URLs with colors
    const markedUrls = matches.map(url => {
      const isMedia = isMediaUrl(url)
      if (isMedia) {
        return `${colors.fg.gray}${url}${colors.reset} (media)`
      } else {
        return `${colors.bright}${colors.fg.cyan}${url}${colors.reset}`
      }
    })

    // Format output with colors
    output.push(`${colors.bright}${colors.fg.yellow}Note by ${colors.fg.magenta}${userName}${colors.fg.yellow} at ${timestamp}${colors.reset}`)
    output.push(`${colors.fg.green}Note ID: ${colors.reset}${noteId}`)
    output.push(`${colors.fg.green}Pubkey: ${colors.reset}${pubkey}`)

    // Add links with a heading
    output.push(`${colors.bright}${colors.fg.blue}External URLs:${colors.reset}`)
    markedUrls.forEach(url => {
      output.push(`  • ${url}`)
    })

    // Add content with a heading
    output.push(`${colors.bright}${colors.fg.blue}Note content:${colors.reset}`)

    // Colorize any links in content when displaying
    let coloredContent = note.content
    for (const url of matches) {
      const isMedia = isMediaUrl(url)
      const colorCode = isMedia ? colors.fg.gray : colors.bright + colors.fg.cyan
      coloredContent = coloredContent.replace(
        new RegExp(escapeRegExp(url), 'g'),
        `${colorCode}${url}${colors.reset}`
      )
    }
    output.push(coloredContent)

    output.push(`${colors.fg.yellow}${'-'.repeat(50)}${colors.reset}`)
  }

  return output.join('\n')
}

/**
 * Escape special characters for use in a regular expression
 * @param {String} string - String to escape
 * @returns {String} - Escaped string
 */
function escapeRegExp (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convert a pubkey from npub to hex format if needed
 * @param {String} key - Pubkey in either npub or hex format
 * @returns {String} - Pubkey in hex format
 */
function normalizeToHexPubkey (key) {
  // If it's an npub, decode it
  if (typeof key === 'string' && key.startsWith('npub1')) {
    try {
      const { type, data } = nip19.decode(key)
      if (type === 'npub') {
        return data
      }
    } catch (e) {
      logger.error(`Error decoding npub ${key}: ${e.message}`)
    }
  }
  // Otherwise assume it's already in hex format
  return key
}

/**
 * Main function to execute the script
 */
async function main () {
  // Load configuration from file
  const configPath = path.join(__dirname, 'nostr-link-extract.config.json')
  logger.info(`Loading configuration from ${configPath}`)
  config = loadConfig(configPath)

  try {
    logger.info(`Starting Nostr link extraction (time interval: ${config.timeIntervalHours} hours)`)

    // Convert any npub format keys to hex
    const hexUserPubkeys = config.userPubkeys.map(normalizeToHexPubkey)
    const hexIgnorePubkeys = config.ignorePubkeys.map(normalizeToHexPubkey)

    // Log the conversion for clarity (helpful for debugging)
    if (config.userPubkeys.some(key => key.startsWith('npub1'))) {
      logger.debug('Converted user npubs to hex format for Nostr protocol')
    }
    if (config.ignorePubkeys.some(key => key.startsWith('npub1'))) {
      logger.debug('Converted ignore list npubs to hex format for Nostr protocol')
    }

    const notesWithLinks = await getNotesWithLinks(
      hexUserPubkeys,
      config.timeIntervalHours,
      config.relayUrls,
      hexIgnorePubkeys
    )

    if (notesWithLinks.length > 0) {
      const formattedOutput = formatNoteOutput(notesWithLinks)
      console.log(formattedOutput)
      logger.result(`Total notes with links: ${notesWithLinks.length}`)
    } else {
      logger.info('No notes with links found in the specified time interval.')
    }
  } catch (error) {
    logger.error(`${error}`)
  }
}

// Execute the script
main()
