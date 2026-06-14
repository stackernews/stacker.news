/* eslint-env jest */

import { cleanPageTitle, fetchYouTubeOEmbedTitle, isYouTubeUrl, youTubeOEmbedUrl } from './page-title'

describe('page title helpers', () => {
  test.each([
    'https://www.youtube.com/watch?v=AHRtMxVrP78',
    'https://youtube.com/watch?v=AHRtMxVrP78',
    'https://m.youtube.com/watch?v=AHRtMxVrP78',
    'https://youtu.be/AHRtMxVrP78'
  ])('identifies YouTube urls: %p', (url) => {
    expect(isYouTubeUrl(url)).toBe(true)
  })

  test('does not treat non-YouTube urls as YouTube', () => {
    expect(isYouTubeUrl('https://example.com/watch?v=AHRtMxVrP78')).toBe(false)
  })

  test.each([
    '- YouTube',
    ' -   YouTube ',
    'YouTube'
  ])('drops the known bad YouTube title fallback: %p', (title) => {
    expect(cleanPageTitle(title, 'https://www.youtube.com/watch?v=mvuWLob3CFU')).toBeUndefined()
  })

  test('preserves the same title for non-YouTube urls', () => {
    expect(cleanPageTitle('- YouTube', 'https://example.com')).toBe('- YouTube')
  })

  test('normalizes meaningful titles', () => {
    expect(cleanPageTitle(' Happy   4th of July Stackers! | SNL #179 ', 'https://youtu.be/AHRtMxVrP78'))
      .toBe('Happy 4th of July Stackers! | SNL #179')
  })

  test('drops the YouTube browser-title suffix from meaningful titles', () => {
    expect(cleanPageTitle('Happy 4th of July Stackers! | SNL #179 - YouTube', 'https://www.youtube.com/watch?v=AHRtMxVrP78'))
      .toBe('Happy 4th of July Stackers! | SNL #179')
  })

  test('builds a YouTube oEmbed URL', () => {
    const url = youTubeOEmbedUrl('https://www.youtube.com/watch?v=AHRtMxVrP78&t=10s')

    expect(url).toBe('https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DAHRtMxVrP78%26t%3D10s&format=json')
  })

  test('fetches a title from YouTube oEmbed', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      json: async () => ({ title: 'Happy 4th of July Stackers! | SNL #179' })
    }))

    await expect(fetchYouTubeOEmbedTitle('https://www.youtube.com/watch?v=AHRtMxVrP78', fetcher))
      .resolves.toBe('Happy 4th of July Stackers! | SNL #179')
    expect(fetcher).toHaveBeenCalledWith(
      'https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DAHRtMxVrP78&format=json',
      { timeout: 3000, size: 64 * 1024 }
    )
  })

  test('ignores unavailable oEmbed responses', async () => {
    const fetcher = jest.fn(async () => ({ ok: false }))

    await expect(fetchYouTubeOEmbedTitle('https://www.youtube.com/watch?v=mvuWLob3CFU', fetcher))
      .resolves.toBeUndefined()
  })
})
