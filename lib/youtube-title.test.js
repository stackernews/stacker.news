/* eslint-env jest */

import { isYoutubeUrl, isUsefulYoutubeTitle, fetchYoutubeTitle } from './youtube-title'

describe('isYoutubeUrl', () => {
  it('detects youtube hostnames', () => {
    expect(isYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isYoutubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })

  it('rejects non-youtube hostnames', () => {
    expect(isYoutubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isYoutubeUrl('not a url')).toBe(false)
  })
})

describe('isUsefulYoutubeTitle', () => {
  it('rejects the placeholder title', () => {
    expect(isUsefulYoutubeTitle('- YouTube')).toBe(false)
    expect(isUsefulYoutubeTitle(' - YouTube ')).toBe(false)
  })

  it('accepts real titles', () => {
    expect(isUsefulYoutubeTitle('Happy 4th of July Stackers!')).toBe(true)
  })

  it('rejects empty titles', () => {
    expect(isUsefulYoutubeTitle(undefined)).toBe(false)
    expect(isUsefulYoutubeTitle('')).toBe(false)
  })
})

describe('fetchYoutubeTitle', () => {
  it('returns the oEmbed title', async () => {
    const fetchImpl = async url => ({
      ok: true,
      json: async () => ({ title: 'Stacker News Weekly', author_name: 'Stacker News' })
    })
    await expect(fetchYoutubeTitle('https://www.youtube.com/watch?v=dQw4w9WgXcQ', fetchImpl))
      .resolves.toBe('Stacker News Weekly')
  })

  it('returns undefined when oEmbed fails', async () => {
    const fetchImpl = async () => ({ ok: false })
    await expect(fetchYoutubeTitle('https://www.youtube.com/watch?v=dQw4w9WgXcQ', fetchImpl))
      .resolves.toBeUndefined()
  })

  it('returns undefined for non-youtube urls', async () => {
    const fetchImpl = async () => { throw new Error('should not be called') }
    await expect(fetchYoutubeTitle('https://example.com/', fetchImpl))
      .resolves.toBeUndefined()
  })
})
