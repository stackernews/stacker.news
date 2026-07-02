import { numWithUnits } from './format'

export function timeSince (timeStamp) {
  const now = new Date()
  const secondsPast = Math.abs(now.getTime() - timeStamp) / 1000
  if (secondsPast < 60) {
    return parseInt(secondsPast) + 's'
  }
  if (secondsPast < 3600) {
    return parseInt(secondsPast / 60) + 'm'
  }
  if (secondsPast <= 86400) {
    return parseInt(secondsPast / 3600) + 'h'
  }
  if (secondsPast > 86400) {
    const day = timeStamp.getDate()
    const month = timeStamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(' ', '')
    const year = timeStamp.getFullYear() === now.getFullYear() ? '' : ' ' + timeStamp.getFullYear()
    return day + ' ' + month + year
  }

  return 'now'
}

export function datePivot (date,
  { years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0 }) {
  return new Date(
    date.getFullYear() + years,
    date.getMonth() + months,
    date.getDate() + days + weeks * 7,
    date.getHours() + hours,
    date.getMinutes() + minutes,
    date.getSeconds() + seconds,
    date.getMilliseconds() + milliseconds
  )
}

export function diffDays (date1, date2) {
  const diffTime = Math.abs(date2 - date1)
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export const dayMonthYear = when => new Date(when).toISOString().slice(0, 10)
export const dayMonthYearToDate = when => {
  const [year, month, day] = when.split('-')
  return new Date(+year, month - 1, day)
}

export function timeLeft (timeStamp) {
  const now = new Date()
  const secondsPast = (timeStamp - now.getTime()) / 1000

  if (secondsPast < 0) {
    return false
  }

  if (secondsPast < 60) {
    return parseInt(secondsPast) + 's'
  }
  if (secondsPast < 3600) {
    return parseInt(secondsPast / 60) + 'm'
  }
  if (secondsPast <= 86400) {
    return parseInt(secondsPast / 3600) + 'h'
  }
  if (secondsPast > 86400) {
    const days = parseInt(secondsPast / (3600 * 24))
    return numWithUnits(days, { unitSingular: 'day', unitPlural: 'days' })
  }
}

export function whenRange (when, from, to) {
  const toDate = to ? new Date(Number(to)) : new Date()
  switch (when) {
    case 'custom':
      return [from ? new Date(Number(from)) : new Date(whenToFrom(when)), toDate]
    default:
      return [new Date(whenToFrom(when)), toDate]
  }
}

export function timeUnitForRange ([from, to]) {
  const date1 = new Date(Number(from))
  const date2 = new Date(Number(to))
  const diffTime = Math.abs(date2 - date1)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 7) {
    return 'hour'
  }

  if (diffDays < 120) {
    return 'day'
  }

  return 'month'
}

export const whenToFrom = (when) => {
  switch (when) {
    case 'day':
      return datePivot(new Date(), { days: -1 }).getTime()
    case 'week':
      return datePivot(new Date(), { days: -7 }).getTime()
    case 'month':
      return datePivot(new Date(), { days: -30 }).getTime()
    case 'year':
      return datePivot(new Date(), { days: -365 }).getTime()
    default:
      return new Date('2021-05-01').getTime()
  }
}

export const sleep = (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms))

export async function raceAbort (promise, signal) {
  if (!signal) return await promise
  throwIfAborted(signal)

  let onAbort
  const abort = new Promise((_resolve, reject) => {
    onAbort = () => reject(abortReason(signal))
    signal.addEventListener('abort', onAbort, { once: true })
  })

  try {
    return await Promise.race([promise, abort])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

export function throwIfAborted (signal) {
  if (signal?.aborted) throw abortReason(signal)
}

function abortReason (signal) {
  return signal.reason ?? new DOMException('aborted', 'AbortError')
}

// True for caller-initiated aborts and timeouts. Matches by name (DOMException
// 'AbortError'; 'TimeoutError' from AbortSignal.timeout or our TimeoutError) and
// by class, so TimeoutError subclasses like FetchTimeoutError are covered too.
export function isAbortLike (err) {
  return err instanceof TimeoutError || err?.name === 'AbortError' || err?.name === 'TimeoutError'
}

// Sleep that rejects with the signal's reason as soon as it aborts. Useful for
// adapter poll loops so the caller's abort propagates between iterations.
export function abortableSleep (ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortReason(signal))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function dateToTimeZone (date, tz) {
  return date.getTime() + tzOffset(tz) * 60 * 60 * 1000
}

function tzOffset (tz) {
  const date = new Date()
  date.setMilliseconds(0)
  const targetDate = new Date(date.toLocaleString('en-US', { timeZone: tz }))
  const targetOffsetHours = (date.getTime() - targetDate.getTime()) / 1000 / 60 / 60
  return targetOffsetHours
}

export class TimeoutError extends Error {
  constructor (timeout) {
    super(`timeout after ${timeout / 1000}s`)
    this.name = 'TimeoutError'
    this.timeout = timeout
  }
}

// AbortSignal.timeout with our custom timeout error message, optionally cancelled by a parent signal.
export function timeoutSignal (timeout, parentSignal) {
  const controller = new AbortController()
  let timer
  const onParentAbort = () => abort(abortReason(parentSignal))

  function cleanup () {
    if (timer) clearTimeout(timer)
    timer = null
    parentSignal?.removeEventListener('abort', onParentAbort)
  }

  function abort (reason) {
    if (controller.signal.aborted) return
    cleanup()
    controller.abort(reason)
  }

  if (timeout) {
    timer = setTimeout(() => abort(new TimeoutError(timeout)), timeout)
  }

  if (parentSignal?.aborted) onParentAbort()
  else parentSignal?.addEventListener('abort', onParentAbort, { once: true })

  return { signal: controller.signal, cleanup }
}

// scope-owning wrapper around timeoutSignal: runs fn with the timeout signal and
// guarantees cleanup (timer + parent abort listener) in exactly one place, so
// callers can't leak a live timer by forgetting cleanup(). Prefer this over
// calling timeoutSignal directly.
export async function withTimeoutSignal (timeout, fn, { parentSignal } = {}) {
  const { signal, cleanup } = timeoutSignal(timeout, parentSignal)
  try {
    return await fn(signal)
  } finally {
    cleanup()
  }
}
