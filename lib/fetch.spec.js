/* eslint-env jest */

import { assertSafeOutboundUrl, isPubliclyRoutableIp, UnsafeOutboundUrlError } from './fetch'

describe('isPubliclyRoutableIp', () => {
  test.each([
    ['127.0.0.1', false],
    ['10.0.0.8', false],
    ['172.16.0.1', false],
    ['192.168.1.2', false],
    ['169.254.1.9', false],
    ['8.8.8.8', true],
    ['::1', false],
    ['fc00::1', false],
    ['fe80::1', false],
    ['2606:4700:4700::1111', true],
    ['::ffff:127.0.0.1', false]
  ])('classifies %p as publicly routable: %p', (ip, expected) => {
    expect(isPubliclyRoutableIp(ip)).toBe(expected)
  })
})

describe('assertSafeOutboundUrl', () => {
  test('rejects localhost hostnames before dns lookup', async () => {
    await expect(assertSafeOutboundUrl('http://localhost:3000')).rejects.toBeInstanceOf(UnsafeOutboundUrlError)
  })

  test('rejects direct private ips', async () => {
    await expect(assertSafeOutboundUrl('http://127.0.0.1:3000')).rejects.toBeInstanceOf(UnsafeOutboundUrlError)
  })

  test('rejects hostnames resolving to private ips', async () => {
    const lookup = jest.fn().mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    await expect(assertSafeOutboundUrl('https://example.com', { lookup })).rejects.toBeInstanceOf(UnsafeOutboundUrlError)
  })

  test('allows hostnames resolving only to public ips', async () => {
    const lookup = jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeOutboundUrl('https://example.com', { lookup })).resolves.toBeInstanceOf(URL)
  })
})
