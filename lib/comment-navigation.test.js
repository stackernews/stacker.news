/* eslint-env jest */

import { shouldTrackNewComment } from './comment-navigation'

const item = ({ id = 2, meMute = false } = {}) => ({
  user: { id, meMute }
})

describe('shouldTrackNewComment', () => {
  it('does not track comments from muted users', () => {
    expect(shouldTrackNewComment({
      hasNavigator: true,
      viewerId: 1,
      item: item({ meMute: true })
    })).toBe(false)
  })

  it('tracks comments from other unmuted users', () => {
    expect(shouldTrackNewComment({
      hasNavigator: true,
      viewerId: 1,
      item: item()
    })).toBe(true)
  })

  it('does not track the viewer own comments', () => {
    expect(shouldTrackNewComment({
      hasNavigator: true,
      viewerId: 2,
      item: item()
    })).toBe(false)
  })

  it('does not track comments outside the navigator', () => {
    expect(shouldTrackNewComment({
      hasNavigator: false,
      viewerId: 1,
      item: item()
    })).toBe(false)
  })
})
