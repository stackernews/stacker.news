import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

/**
 * Workaround for what appears to be an unresolved race condition in some Android IME
 * stacks: a composition event containing the word is emitted immediately after
 * the deletion event that should have removed it. As a result, the word resurrects.
 *
 * This workaround suppresses all composition events for a short time window after we
 * detect events that should not trigger them.
 */

// how long the composition events will be suppressed
const suppressionWindow = 80 // ms (tweak as necessary)

// events that will trigger the suppression window
const suppressionTriggers = new Set([
  'deleteContentBackward',
  'deleteContentForward',
  'deleteByCut',
  'historyUndo',
  'historyRedo',
  'deleteHardLineBackward',
  'deleteHardLineForward',
  'deleteSoftLineBackward',
  'deleteSoftLineForward',
  'deleteWordBackward',
  'deleteWordForward',
  'deleteByCut',
  'deleteByDrag',
  'deleteByComposition'
])

function applySoftkeyWorkaround (el) {
  let isSuppressed = false
  let suppressionTimeout = null

  const beginSuppression = (e) => {
    if (!e) return
    if (suppressionTriggers.has(e.inputType)) {
      isSuppressed = true

      if (suppressionTimeout != null) {
        clearTimeout(suppressionTimeout)
        suppressionTimeout = null
      }

      suppressionTimeout = setTimeout(() => {
        isSuppressed = false
        suppressionTimeout = null
      }, suppressionWindow)
    }
  }

  const filterSuppressedEvents = (e) => {
    if (!e) return
    if (isSuppressed) {
      // stop the event from propagating further
      try {
        e.stopPropagation()
      } catch (_) { }
    }
  }

  el.addEventListener('beforeinput', beginSuppression, true)

  el.addEventListener('compositionstart', filterSuppressedEvents, true)
  el.addEventListener('compositionupdate', filterSuppressedEvents, true)
  el.addEventListener('compositionend', filterSuppressedEvents, true)

  return () => { // cleanup
    el.removeEventListener('beforeinput', beginSuppression, true)

    el.removeEventListener('compositionstart', filterSuppressedEvents, true)
    el.removeEventListener('compositionupdate', filterSuppressedEvents, true)
    el.removeEventListener('compositionend', filterSuppressedEvents, true)

    if (suppressionTimeout != null) {
      clearTimeout(suppressionTimeout)
      suppressionTimeout = null
    }
  }
}

export function SoftkeyUnborkerPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let disposeWorkaround = null
    let disposeListener = null
    disposeListener = editor.registerRootListener((root, prevRoot) => {
      disposeWorkaround?.()
      if (root) {
        disposeWorkaround = applySoftkeyWorkaround(root)
      }
    })
    return () => {
      disposeWorkaround?.()
      disposeListener?.()
    }
  }, [editor])

  return null
}
