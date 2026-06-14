/* eslint-env jest */

import {
  createPWAResumeEntry,
  getPWAResumePath,
  isPWAResumePath,
  isPWAStartPath,
  isStandalonePWA,
  PWA_RESUME_MAX_AGE_MS
} from './pwa-resume'

describe('PWA resume helpers', () => {
  test('detects standalone display modes', () => {
    expect(isStandalonePWA({
      navigator: { standalone: true }
    })).toBe(true)

    expect(isStandalonePWA({
      navigator: {},
      matchMedia: () => ({ matches: true })
    })).toBe(true)

    expect(isStandalonePWA({
      navigator: {},
      matchMedia: () => ({ matches: false })
    })).toBe(false)
  })

  test('treats only root paths as PWA start paths', () => {
    expect(isPWAStartPath('/')).toBe(true)
    expect(isPWAStartPath('/?nodata=true')).toBe(true)
    expect(isPWAStartPath('/?disablePrompt=true')).toBe(false)
    expect(isPWAStartPath('/items/123')).toBe(false)
  })

  test('stores item threads and ignores other app paths', () => {
    expect(isPWAResumePath('/items/123')).toBe(true)
    expect(isPWAResumePath('/items/123?commentId=456#comments')).toBe(true)
    expect(isPWAResumePath('/wallets/send')).toBe(false)
    expect(isPWAResumePath('/')).toBe(false)
  })

  test('round trips a valid resume entry', () => {
    const entry = createPWAResumeEntry('/items/123?commentId=456#comments', 1000)

    expect(getPWAResumePath(entry, 2000)).toBe('/items/123?commentId=456#comments')
  })

  test('rejects stale, future, malformed, and non-resumable entries', () => {
    expect(getPWAResumePath(createPWAResumeEntry('/items/123', 1000), 1000 + PWA_RESUME_MAX_AGE_MS + 1)).toBe(null)
    expect(getPWAResumePath(createPWAResumeEntry('/items/123', 2000), 1000)).toBe(null)
    expect(getPWAResumePath('nope', 1000)).toBe(null)
    expect(getPWAResumePath(JSON.stringify({ asPath: '/wallets/send', ts: 1000 }), 2000)).toBe(null)
  })
})
