import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { IS_ANDROID } from '@lexical/utils'
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
  'deleteHardLineBackward',
  'deleteHardLineForward',
  'deleteSoftLineBackward',
  'deleteSoftLineForward',
  'deleteWordBackward',
  'deleteWordForward',
  'insertText'
])

// Additional checks:
// If a trigger has an associated check, suppression starts only if the check passes.
const suppressionTriggersChecks = {
  insertText: (e) => e.data === ''
}

function applySoftkeyWorkaround (el) {
  let isCompositionSuppressed = false
  let isSelectionSuppressed = false

  let compositionTimeout = null
  let selectionTimeout = null

  const endSelectionSuppression = (e) => {
    if (!e) return
    isSelectionSuppressed = false

    if (selectionTimeout != null) {
      clearTimeout(selectionTimeout)
      selectionTimeout = null
    }
  }

  const beginSelectionSuppression = (e) => {
    if (!e) return
    endSelectionSuppression()

    isSelectionSuppressed = true

    selectionTimeout = setTimeout(() => {
      isSelectionSuppressed = false
      selectionTimeout = null
    }, suppressionWindow)
  }

  const beginCompositionSuppression = (e) => {
    if (!e) return
    if (!e.inputType || suppressionTriggers.has(e.inputType)) {
      const extraChecks = suppressionTriggersChecks[e.inputType]
      if (extraChecks && !extraChecks(e)) return

      isCompositionSuppressed = true

      if (compositionTimeout != null) {
        clearTimeout(compositionTimeout)
        compositionTimeout = null
      }

      compositionTimeout = setTimeout(() => {
        isCompositionSuppressed = false
        compositionTimeout = null
      }, suppressionWindow)
    }
  }

  const filterComposition = (e) => {
    if (!e) return
    if (isCompositionSuppressed) {
      // stop the event from propagating further
      try {
        e.stopPropagation()
      } catch (_) { }
    }
  }

  const filterSelection = (e) => {
    if (!e) return
    if (isSelectionSuppressed) {
      // stop the event from propagating further
      try {
        e.stopPropagation()
      } catch (_) { }
    }
  }

  el.addEventListener('beforeinput', beginCompositionSuppression, true)

  el.addEventListener('compositionstart', filterComposition, true)
  el.addEventListener('compositionupdate', filterComposition, true)
  el.addEventListener('compositionend', filterComposition, true)

  document.addEventListener('selectionchange', beginSelectionSuppression, true)
  document.addEventListener('selectionchange', filterSelection, true)
  el.addEventListener('cut', endSelectionSuppression, true)

  return () => { // cleanup
    el.removeEventListener('beforeinput', beginCompositionSuppression, true)

    el.removeEventListener('compositionstart', filterComposition, true)
    el.removeEventListener('compositionupdate', filterComposition, true)
    el.removeEventListener('compositionend', filterComposition, true)

    document.removeEventListener('selectionchange', beginSelectionSuppression, true)
    document.removeEventListener('selectionchange', filterSelection, true)
    el.removeEventListener('cut', endSelectionSuppression, true)

    if (compositionTimeout != null) {
      clearTimeout(compositionTimeout)
      compositionTimeout = null
    }

    if (selectionTimeout != null) {
      clearTimeout(selectionTimeout)
      selectionTimeout = null
    }
  }
}

export function SoftkeyUnborkerPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!IS_ANDROID) return // only apply on Android
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
