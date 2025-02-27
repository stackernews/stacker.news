const WebSocket = require('ws') // You might need to install this: npm install ws
const { nip19 } = require('nostr-tools') // Keep this for formatting

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

/**
 * Checks if a URL is a media file or hosted on a media platform
 * @param {String} url - URL to check
 * @returns {Boolean} - true if it's likely a media URL
 */
function isMediaUrl (url) {
  // Check for common media file extensions
  const mediaExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|tiff|ico|mp4|webm|mov|avi|mkv|flv|wmv|mp3|wav|ogg|flac|aac|m4a)($|\?)/i
  if (mediaExtensions.test(url)) return true

  // Check for common media hosting platforms
  const mediaHostingPatterns = [
    // Image hosting
    /nostr\.build\/[ai]\/\w+/i,
    /i\.imgur\.com\/\w+/i,
    /i\.ibb\.co\/\w+\//i,
    // Video hosting
    /tenor\.com\/view\//i,
    /giphy\.com\/gifs\//i,
    // Audio hosting
    /soundcloud\.com\//i,
    /spotify\.com\//i
  ]

  // Check each pattern
  for (const pattern of mediaHostingPatterns) {
    if (pattern.test(url)) return true
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
  console.log(`Fetching events with filter: ${JSON.stringify(filter)}`)
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
              console.error(`Error parsing message: ${error.message}`)
            }
          })
        })

        ws.on('error', (error) => {
          console.error(`WebSocket error for ${url}: ${error.message}`)
          clearTimeout(timeout)
          resolve([]) // Resolve with empty array on error
        })

        ws.on('close', () => {
          clearTimeout(timeout)
          resolve(localEvents)
        })
      })

      console.log(`Got ${relayEvents.length} events from ${url}`)
      events.push(...relayEvents)
    } catch (error) {
      console.error(`Error connecting to ${url}: ${error.message}`)
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
 * @returns {Promise<Array>} - Array of note objects containing external links within the time interval
 */
async function getNotesWithLinks (userPubkeys, timeIntervalHours, relayUrls) {
  // Calculate the cutoff time in seconds (Nostr uses UNIX timestamp)
  const now = Math.floor(Date.now() / 1000)
  const cutoffTime = now - (timeIntervalHours * 60 * 60)

  const allNotesWithLinks = []
  const allFollowedPubkeys = new Set() // To collect all followed pubkeys

  // First get the followings for each user
  for (const pubkey of userPubkeys) {
    try {
      console.log(`Fetching follow list for ${pubkey} from ${relayUrls.length} relays...`)

      // Get the most recent contact list (kind 3)
      const followListEvents = await fetchEvents(relayUrls, {
        kinds: [3],
        authors: [pubkey]
      })

      if (followListEvents.length === 0) {
        console.log(`No follow list found for user ${pubkey}. Verify this pubkey has contacts on these relays.`)
        continue
      }

      // Find the most recent follow list event
      const latestFollowList = followListEvents.reduce((latest, event) =>
        !latest || event.created_at > latest.created_at ? event : latest, null)

      if (!latestFollowList) {
        console.log(`No valid follow list found for user ${pubkey}`)
        continue
      }

      console.log(`Found follow list created at: ${new Date(latestFollowList.created_at * 1000).toISOString()}`)

      // Check if tags property exists
      if (!latestFollowList.tags) {
        console.log(`No tags found in follow list for user ${pubkey}`)
        console.log('Follow list data:', JSON.stringify(latestFollowList, null, 2))
        continue
      }

      // Extract followed pubkeys from the follow list (tag type 'p')
      const followedPubkeys = latestFollowList.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1])

      if (!followedPubkeys || followedPubkeys.length === 0) {
        console.log(`No followed users found for user ${pubkey}`)
        continue
      }

      // Add all followed pubkeys to our set
      followedPubkeys.forEach(pk => allFollowedPubkeys.add(pk))

      console.log(`Added ${followedPubkeys.length} followed users for ${pubkey} (total: ${allFollowedPubkeys.size})`)
    } catch (error) {
      console.error(`Error processing user ${pubkey}:`, error)
    }
  }

  // If we found any followed pubkeys, fetch their notes in a single batch
  if (allFollowedPubkeys.size > 0) {
    console.log(`Fetching notes from ${allFollowedPubkeys.size} followed users in a single batch...`)

    // Convert Set to Array for the filter
    const followedPubkeysArray = Array.from(allFollowedPubkeys)

    // Fetch notes from all followed users at once
    const notes = await fetchEvents(relayUrls, {
      kinds: [1],
      authors: followedPubkeysArray,
      since: cutoffTime
    }, 30000) // Use a longer timeout for this larger query

    console.log(`Retrieved ${notes.length} total notes from followed users`)

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

    console.log(`Found ${notesWithUrls.length} notes containing non-media URLs`)

    // Get all unique authors from the filtered notes
    const authorsWithUrls = new Set(notesWithUrls.map(note => note.pubkey))
    console.log(`Notes with URLs came from ${authorsWithUrls.size} unique authors`)

    // Fetch metadata for all relevant authors in a single batch
    if (authorsWithUrls.size > 0) {
      console.log(`Fetching metadata for ${authorsWithUrls.size} authors...`)
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
            console.error(`Error parsing metadata for ${note.pubkey}: ${e.message}`)
          }
        }
      }
    }

    // Add all notes with URLs to our results
    allNotesWithLinks.push(...notesWithUrls)
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
  const output = []

  for (const note of notes) {
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
 * Main function to execute the script
 */
async function main () {
  // Example usage
  const userPubkey = '05933d8782d155d10cf8a06f37962f329855188063903d332714fbd881bac46e'

  // List of relays that were working in our test
  const relayUrls = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://nostr.wine',
    'wss://relay.snort.social',
    'wss://relay.primal.net'
  ]

  try {
    console.log(`${colors.bright}${colors.fg.green}Fetching notes with links...${colors.reset}`)
    const notesWithLinks = await getNotesWithLinks([userPubkey], 24, relayUrls)

    if (notesWithLinks.length > 0) {
      const formattedOutput = formatNoteOutput(notesWithLinks)
      console.log(formattedOutput)
      console.log(`${colors.bright}${colors.fg.green}Total notes with links: ${notesWithLinks.length}${colors.reset}`)
    } else {
      console.log(`${colors.fg.yellow}No notes with links found in the specified time interval.${colors.reset}`)
    }
  } catch (error) {
    console.error(`${colors.fg.red}Error: ${error}${colors.reset}`)
  }
}

// Execute the script
main()
