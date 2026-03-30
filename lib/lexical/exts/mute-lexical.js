import { defineExtension } from 'lexical'
/**
 * DOM Translators modify the DOM via 'characterData' mutations (text nodes)
 * Lexical's MutationObserver detects these and restores the DOM to the EditorState
 * effectively preventing translations from being applied to Lexical's DOM
 *
 * we don't need to observe text mutations because we already have the final text
 * this extension replaces Lexical's observer with one that filters out text mutations
 * structural mutations (childList) still work, so decorators remain functional
 */
export const MuteLexicalExtension = defineExtension({
  name: 'MuteLexicalExtension',
  register (editor, { disabled } = {}) {
    if (disabled) return

    return editor.registerRootListener((rootElement) => {
      if (typeof window === 'undefined') return
      if (!rootElement) return

      const originalObserver = editor._observer
      if (originalObserver) {
        originalObserver.disconnect()
      }

      const filteredObserver = new window.MutationObserver((mutations) => {
        const structuralMutations = mutations.filter(
          mutation => mutation.type !== 'characterData'
        )

        if (structuralMutations.length > 0) {
          editor.update(() => {}, { discrete: true })
        }
      })

      filteredObserver.observe(rootElement, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true
      })

      editor._observer = filteredObserver

      return () => filteredObserver.disconnect()
    })
  }
})
