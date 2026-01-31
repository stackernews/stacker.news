import { useRef, useEffect } from 'react'
import { buildEditorFromExtensions, defineExtension } from '@lexical/extension'
import { RichTextExtension } from '@lexical/rich-text'
import { ListExtension, CheckListExtension } from '@lexical/list'
import DefaultNodes from '@/lib/lexical/nodes'
import DefaultTheme from '@/lib/lexical/theme'
import { LinkExtension } from '@lexical/link'

const DEFAULT_EXTENSIONS = []
const DEFAULT_NAME = 'sn-headless-bridge'

/**
 * shared hook that creates and manages a headless bridge editor
 * @param {Object} [opts] - optional configuration for the bridge editor
 * @param {Array} [opts.nodes] - custom nodes to use (defaults to DefaultNodes)
 * @param {Object} [opts.theme] - theme configuration (defaults to DefaultTheme)
 * @param {Array} [opts.extensions] - additional extensions to use (defaults to [])
 * @param {string} [opts.name] - name of the bridge editor (defaults to 'sn-headless-bridge')
 * @returns {React.RefObject} ref to the bridge editor instance
 */
export default function useHeadlessBridge (opts = {}) {
  const {
    nodes = DefaultNodes,
    theme = DefaultTheme,
    extensions = DEFAULT_EXTENSIONS,
    name = DEFAULT_NAME
  } = opts
  const bridge = useRef(null)

  // create the bridge once on mount and dispose of it on unmount
  useEffect(() => {
    if (!bridge.current) {
      bridge.current = buildEditorFromExtensions(
        defineExtension({
          onError: (error) => console.error('editor bridge has encountered an error:', error),
          name,
          dependencies: [
            RichTextExtension,
            ListExtension,
            CheckListExtension,
            LinkExtension,
            ...extensions
          ],
          nodes,
          theme
        })
      )
    }
    return () => {
      if (bridge.current) {
        bridge.current.dispose()
        bridge.current = null
      }
    }
  }, [])

  return bridge
}
