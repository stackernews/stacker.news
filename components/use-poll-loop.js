import { useEffect } from 'react'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'

// setTimeout-chained poll loop: waits intervalMs, runs poll(signal) to completion
// (iterations never overlap), re-arms unless torn down. Aborts the signal on cleanup.
export function usePollLoop (poll, { enabled = true, intervalMs = NORMAL_POLL_INTERVAL_MS, name = 'poll' } = {}) {
  useEffect(() => {
    if (!enabled) return

    let timeout
    const controller = new AbortController()
    const { signal } = controller

    const queuePoll = () => {
      timeout = setTimeout(async () => {
        try {
          if (!signal.aborted) await poll(signal)
        } catch (err) {
          // safety net; callers handle their own errors
          console.warn(`${name} poll failed:`, err)
        }
        if (!signal.aborted) queuePoll()
      }, intervalMs)
    }

    queuePoll()
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [poll, enabled, intervalMs, name])
}
