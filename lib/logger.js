// ts-check
import { SSR } from '@/lib/constants'

const isBrowser = !SSR

export const LogLevel = {
  TRACE: 600,
  DEBUG: 500,
  INFO: 400,
  WARN: 300,
  ERROR: 200,
  FATAL: 100,
  OFF: 0
}

/**
 * @abstract
 */
export class LogAttachment {
  /**
     * Log something
     * @param {Logger} logger - the logger that called this attachment
     * @param {number} level - the log level
     * @param {string[]} tags - the tags
     * @param  {...any} message - the message to log
     * @abstract
     * @protected
     */
  log (logger, level, tags, ...message) {
    throw new Error('Method not implemented.')
  }
}

export class ConsoleLogAttachment extends LogAttachment {
  level = undefined
  /**
     * @param {number} level
     */
  constructor (level) {
    super()
    this.level = level
  }

  log (logger, level, tags, ...message) {
    if (this.level && level > this.level) return

    let head = ''
    if (!isBrowser) {
      const date = new Date()
      const year = date.getFullYear()
      const month = ('0' + (date.getMonth() + 1)).slice(-2)
      const day = ('0' + date.getDate()).slice(-2)
      const hour = ('0' + date.getHours()).slice(-2)
      const minute = ('0' + date.getMinutes()).slice(-2)
      const second = ('0' + date.getSeconds()).slice(-2)
      head += `[${year}-${month}-${day} ${hour}:${minute}:${second}] `
    }
    head += `[${logger.name}]`
    if (!isBrowser) {
      head += ` [${Object.entries(LogLevel).find(([k, v]) => v === level)[0]}]`
    }

    const tail = tags.length ? `   ${tags.join(',')}` : ''
    if (level <= LogLevel.ERROR) {
      console.error(head, ...message, tail)
    } else if (level <= LogLevel.WARN) {
      console.warn(head, ...message, tail)
    } else if (level <= LogLevel.INFO) {
      console.info(head, ...message, tail)
    } else {
      console.log(head, ...message, tail)
    }
  }
}

export class JSONLogAttachment extends LogAttachment {
  level = undefined
  endpoint = null

  constructor (endpoint, level) {
    super()
    this.endpoint = endpoint
    this.level = level
  }

  log (logger, level, tags, ...message) {
    if (this.level && level > this.level) return

    const serialize = (m) => {
      const type = typeof m
      if (type === 'function') {
        return m.toString() + '\n' + new Error().stack
      } else if (type === 'undefined') {
        return 'undefined'
      } else if (m === null) {
        return 'null'
      } else if (type === 'string' || type === 'number' || type === 'bigint' || type === 'boolean') {
        return String(m)
      } else if (m instanceof Error) {
        return m.message || m.toString()
      } else if (m instanceof ArrayBuffer || m instanceof Uint8Array) {
        return 'Buffer:' + Array.prototype.map.call(new Uint8Array(m), (x) => ('00' + x.toString(16)).slice(-2)).join('')
      } else if (type === 'object' && Array.isArray(m)) {
        return JSON.stringify(m.map(serialize), null, 2)
      } else {
        try {
          const str = m.toString()
          if (str !== '[object Object]') return str
        } catch (e) {
          console.error(e)
        }
        return JSON.stringify(m, null, 2)
      }
    }

    const logLevelStr = Object.entries(LogLevel).find(([k, v]) => v === level)[0]
    fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logger: logger.name,
        tags,
        level: logLevelStr,
        message: message.map((m) => serialize(m)).join(' '),
        createdAt: new Date().toISOString()
      })
    }).catch((e) => console.error('Error in JSONLogAttachment', e))
  }
}

/**
 * A logger.
 * Use debug, trace, info, warn, error, fatal to log messages unless you need to do some expensive computation to get the message,
 * in that case do it in a function you pass to debugLazy, traceLazy, infoLazy, warnLazy, errorLazy, fatalLazy
 * that will be called only if the log level is enabled.
 */
export class Logger {
  tags = []
  globalTags = {}
  attachments = []
  name = null
  level = null
  groupTags = []

  /**
     *
     * @param {string} name
     * @param {number} [level]
     * @param {string[]} [tags]
     * @param {{[key: string]: string}} [globalTags]
     * @param {string[]} [groupTags]
     */
  constructor (name, level, tags, globalTags, groupTags) {
    this.name = name
    this.tags.push(...tags)
    this.globalTags = globalTags || {}
    this.level = level
    if (groupTags) this.groupTags.push(...groupTags)
  }

  /**
     * Add a log attachment
     * @param {LogAttachment} attachment - the attachment to add
     * @public
     */
  addAttachment (attachment) {
    this.attachments.push(attachment)
  }

  group (label) {
    this.groupTags.push(label)
  }

  groupEnd () {
    this.groupTags.pop()
  }

  fork (label) {
    const logger = new Logger(this.name, this.level, [...this.tags], this.globalTags, [...this.groupTags, label])
    for (const attachment of this.attachments) {
      logger.addAttachment(attachment)
    }
    return logger
  }

  /**
 * Log something
 * @param {number} level - the log level
 * @param  {...any} message - the message to log
 * @public
 */
  log (level, ...message) {
    if (level > this.level) return
    for (const attachment of this.attachments) {
      try {
        attachment.log(this, level, [...this.tags, ...this.groupTags, ...Object.entries(this.globalTags).map(([k, v]) => `${k}:${v}`)], ...message)
      } catch (e) {
        console.error('Error in log attachment', e)
      }
    }
  }

  /**
 * Log something lazily.
 * @param {number} level - the log level
 * @param {() => (any|Promise<any>)} func - The function to call (can be async, but better not)
 * @throws {Error} if func is not a function
 * @public
 */
  logLazy (level, func) {
    if (typeof func !== 'function') {
      throw new Error('lazy log needs a function to call')
    }

    if (level > this.level) return

    try {
      const res = func()

      const _log = (message) => {
        message = Array.isArray(message) ? message : [message]
        this.log(level, ...message)
      }

      if (res instanceof Promise) {
        res.then(_log)
          .catch((e) => this.error('Error in lazy log', e))
          .catch((e) => console.error('Error in lazy log', e))
      } else {
        _log(res)
      }
    } catch (e) {
      this.error('Error in lazy log', e)
    }
  }

  debug (...message) {
    this.log(LogLevel.DEBUG, ...message)
  }

  trace (...message) {
    this.log(LogLevel.TRACE, ...message)
  }

  info (...message) {
    this.log(LogLevel.INFO, ...message)
  }

  warn (...message) {
    this.log(LogLevel.WARN, ...message)
  }

  error (...message) {
    this.log(LogLevel.ERROR, ...message)
  }

  fatal (...message) {
    this.log(LogLevel.FATAL, ...message)
  }

  debugLazy (func) {
    this.logLazy(LogLevel.DEBUG, func)
  }

  traceLazy (func) {
    this.logLazy(LogLevel.TRACE, func)
  }

  infoLazy (func) {
    this.logLazy(LogLevel.INFO, func)
  }

  warnLazy (func) {
    this.logLazy(LogLevel.WARN, func)
  }

  errorLazy (func) {
    this.logLazy(LogLevel.ERROR, func)
  }

  fatalLazy (func) {
    this.logLazy(LogLevel.FATAL, func)
  }
}

const globalLoggerTags = {}

export function setGlobalLoggerTag (key, value) {
  if (value === undefined || value === null) {
    delete globalLoggerTags[key]
  } else {
    globalLoggerTags[key] = value
  }
}

export function getLogger (name = 'default', tags = [], level) {
  if (!Array.isArray(tags)) tags = [tags]

  let httpEndpoint = !isBrowser ? 'http://logpipe:7068/write' : 'http://localhost:7068/write'
  let env = 'production'

  if (typeof process !== 'undefined') {
    env = process.env.NODE_ENV || env
    httpEndpoint = process.env.SN_LOG_HTTP_ENDPOINT || httpEndpoint
    level = level ?? process.env.SN_LOG_LEVEL
  }
  level = level ?? (env === 'development' ? 'TRACE' : 'INFO')

  if (!isBrowser) {
    tags.push('backend')
  } else {
    tags.push('frontend')
  }

  const logger = new Logger(name, LogLevel[level], tags, globalLoggerTags)

  if (env === 'development') {
    logger.addAttachment(new ConsoleLogAttachment())
    logger.addAttachment(new JSONLogAttachment(httpEndpoint))
  } else {
    logger.addAttachment(new ConsoleLogAttachment())
  }

  return logger
}
