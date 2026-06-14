/* eslint-env jest */

import { getManifest } from './site-webmanifest'

describe('site webmanifest', () => {
  test('sets an explicit app scope and reuses an existing launch client', () => {
    const manifest = getManifest()

    expect(manifest.scope).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest.launch_handler).toEqual({
      client_mode: 'focus-existing'
    })
  })

  test('keeps custom-domain URL handling without changing launch behavior', () => {
    const manifest = getManifest(undefined, { title: 'Territory', tagline: 'Stack sats' }, 'https://example.com')

    expect(manifest.name).toBe('Territory')
    expect(manifest.url_handlers).toEqual([{ origin: 'https://example.com' }])
    expect(manifest.scope).toBe('/')
    expect(manifest.launch_handler).toEqual({
      client_mode: 'focus-existing'
    })
  })
})
