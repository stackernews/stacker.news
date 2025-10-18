import { createHeadlessEditor } from '@lexical/headless'
import snTheme from '@/components/lexical/theme'
import DefaultNodes from '@/lib/lexical/nodes'
import { createLinkeDOM } from '@/lib/dompurify'

// wraps a function with a fake DOM environment for SSR
// manages global DOM variables and cleans up after execution
// if! a DOM already exists (nested calls), reuses it to avoid creating multiple DOMs
export function withDOM (fn) {
  const prevWindow = global.window

  // if window already exists, we're in a nested call and we'll reuse the existing DOM
  if (prevWindow) {
    return fn(prevWindow)
  }

  // save previous global state
  const prevComputedStyle = global.getComputedStyle
  const prevDOMParser = global.DOMParser
  const prevMutationObserver = global.MutationObserver
  const prevDocument = global.document

  // create new DOM environment
  const { newWindow, newDocument } = createLinkeDOM()
  global.window = newWindow
  global.document = newDocument
  global.getComputedStyle = newWindow.getComputedStyle
  global.DOMParser = newWindow.DOMParser
  global.MutationObserver = newWindow.MutationObserver

  try {
    return fn(newWindow)
  } finally {
    // restore previous state and clean up
    global.window = prevWindow
    global.document = prevDocument
    global.getComputedStyle = prevComputedStyle
    global.DOMParser = prevDOMParser
    global.MutationObserver = prevMutationObserver
    newWindow.close()
  }
}

// creates a headless editor with SN default options
export default function $createSNHeadlessEditor (options = {}) {
  // default values
  const {
    namespace = 'snSSR',
    theme = snTheme,
    nodes = [...DefaultNodes],
    onError = (error) => {
      console.error(error)
    }
  } = options

  return createHeadlessEditor({
    namespace,
    nodes,
    theme,
    onError
  })
}
