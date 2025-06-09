// Polyfill TextDecoder and TextEncoder for jsdom
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder
}
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder
}

// Mock use-crossposter before any imports that might load it transitively
jest.mock('../use-crossposter', () => {
  const mockFn = jest.fn()
  return {
    __esModule: true,
    default: jest.fn(() => mockFn)
  }
})
const mockCrossposter = require('../use-crossposter').default

import React from 'react'
import { renderHook, act } from '@testing-library/react-hooks'
import useItemSubmit from '../use-item-submit'

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../toast', () => ({ useToast: () => ({}) }))
jest.mock('../use-paid-mutation', () => ({
  usePaidMutation: () => [jest.fn(() => ({ data: { mutation: { result: { id: 123 } } } }))],
  paidActionCacheMods: {}
}))
jest.mock('../me', () => ({ useMe: () => ({ me: { id: 1 } }) }))
jest.mock('../../wallets/prompt', () => ({ useWalletRecvPrompt: () => jest.fn(), WalletPromptClosed: class {} }))


describe('useItemSubmit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls crossposter on new post creation', async () => {
    const crossposterMock = jest.fn()
    mockCrossposter.mockReturnValueOnce(crossposterMock)
    const { result } = renderHook(() => useItemSubmit('mutation', {}))

    await act(async () => {
      await result.current({ crosspost: true }, { resetForm: jest.fn() })
    })
    expect(crossposterMock).toHaveBeenCalledWith(123)
  })

  it('does NOT call crossposter on edit', async () => {
    const crossposterMock = jest.fn()
    mockCrossposter.mockReturnValueOnce(crossposterMock)
    const { result } = renderHook(() => useItemSubmit('mutation', { item: { id: 123, user: { id: 1 } } }))

    await act(async () => {
      await result.current({ crosspost: true }, { resetForm: jest.fn() })
    })
    expect(crossposterMock).not.toHaveBeenCalled()
  })
})
