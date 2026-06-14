/* eslint-env jest */

import { createPayload, firstPushImageUrl } from './webPushPayload.js'

const parsePayload = notification => JSON.parse(createPayload(notification)).notification

describe('web push payload', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_URL = 'https://stacker.news'
  })

  test('uses the first markdown image as the notification image', () => {
    const image = 'https://example.com/first.png'
    const second = 'https://example.com/second.png'

    expect(firstPushImageUrl(`![](${image})\n![](${second})`)).toBe(image)
  })

  test('uses imgproxy metadata for uploaded image URLs without extensions', () => {
    const image = 'https://m.stacker.news/12345'

    expect(firstPushImageUrl(`![](${image})`, {
      [image]: { width: 640, height: 480 }
    })).toBe(image)
  })

  test('skips uploaded videos when choosing a push image', () => {
    const video = 'https://m.stacker.news/12345'
    const image = 'https://m.stacker.news/67890'

    expect(firstPushImageUrl(`![](${video})\n![](${image})`, {
      [video]: { video: true },
      [image]: { width: 640, height: 480 }
    })).toBe(image)
  })

  test('finds bare image URLs in notification bodies', () => {
    const image = 'https://example.com/photo.webp'

    expect(firstPushImageUrl(`look ${image}`)).toBe(image)
  })

  test('adds image while preserving formatted text as plain body', () => {
    const image = 'https://example.com/photo.jpg'
    const notification = parsePayload({
      title: '@alice replied to you',
      body: `**hello**\n\n![](${image})`
    })

    expect(notification.title).toBe('@alice replied to you')
    expect(notification.body).toBe('hello')
    expect(notification.image).toBe(image)
    expect(notification.icon).toBe('https://stacker.news/icons/icon_x96.png')
    expect(notification.navigate).toBe('https://stacker.news/notifications')
  })

  test('normalizes formatted markdown replies to a plain notification body', () => {
    const notification = parsePayload({
      title: '@alice replied to you',
      body: '> **hello** [stackers](https://stacker.news)\n\n`ship it`'
    })

    expect(notification.body).toBe('hello stackers\n\nship it')
    expect(notification.image).toBeUndefined()
  })

  test('does not override an explicit notification image', () => {
    const notification = parsePayload({
      title: 'title',
      body: '![](https://example.com/from-body.jpg)',
      image: 'https://example.com/explicit.jpg'
    })

    expect(notification.image).toBe('https://example.com/explicit.jpg')
  })

  test('does not leak imgproxy metadata into the payload', () => {
    const image = 'https://m.stacker.news/12345'
    const notification = parsePayload({
      title: 'title',
      body: `![](${image})`,
      imgproxyUrls: {
        [image]: { width: 640, height: 480 }
      }
    })

    expect(notification.image).toBe(image)
    expect(notification.imgproxyUrls).toBeUndefined()
  })
})
