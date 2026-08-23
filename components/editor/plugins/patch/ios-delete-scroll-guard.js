import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { CAN_USE_BEFORE_INPUT, IS_IOS } from '@lexical/utils'

/**
 * Workaround for iOS Safari (and the PWA): after a native deleteContentBackward,
 * WebKit may restore focus to the editor root while syncing the DOM selection.
 * Programmatic focus() scrolls the focused element into view and WebKit ignores
 * preventScroll, so when the editor is taller than the viewport the browser jumps
 * to the top of the editor instead of keeping the caret in view.
 *
 * We snapshot the scroll offset while a native delete event is dispatched and
 * restore it right after the browser settles, unless the user scrolled themselves
 * within that window.
 */

// how long after a delete event the scroll correction stays armed
const guardWindowMs = 150

// jumps smaller than this are treated as regular caret-keeping adjustments
const minJumpPx = 40

// a single guard serves every editor on the page
let installed = false
let anchorY = null
let armedUntil = 0

function onBeforeInput (e) {
  if (!e.inputType || !e.inputType.startsWith('delete')) return
  anchorY = window.scrollY
  armedUntil = Date.now() + guardWindowMs
}

function onScroll () {
  if (anchorY === null) return
  if (Date.now() > armedUntil || Math.abs(window.scrollY - anchorY) < minJumpPx) return
  const y = anchorY
  anchorY = null
  window.scrollTo({ top: y, behavior: 'instant' })
}

function install () {
  if (installed) return
  installed = true
  // capture phase: arm before the native deletion mutates the DOM
  document.addEventListener('beforeinput', onBeforeInput, true)
  window.addEventListener('scroll', onScroll, { passive: true })
}

export function IOSDeleteScrollGuardPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!IS_IOS || !CAN_USE_BEFORE_INPUT) return // only apply on Apple webkit with native beforeinput
    install()
  }, [editor])

  return null
}
