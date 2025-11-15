import { useRef, useCallback, useEffect } from 'react'
import { buildEditorFromExtensions, defineExtension } from '@lexical/extension'
import { RichTextExtension } from '@lexical/rich-text'
import { ListExtension, CheckListExtension } from '@lexical/list'
import DefaultNodes from '@/lib/lexical/nodes'
import DefaultTheme from '@/components/lexical/theme'

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
    extensions = [],
    name = 'sn-headless-bridge'
  } = opts
  const bridge = useRef(null)

  // creates or returns existing headless bridge editor
  const createBridge = useCallback(() => {
    if (bridge.current) return bridge.current
    bridge.current = buildEditorFromExtensions(
      defineExtension({
        onError: (error) => console.error('editor bridge has encountered an error:', error),
        name,
        dependencies: [
          RichTextExtension,
          ListExtension,
          CheckListExtension,
          ...extensions
        ],
        nodes,
        theme
      })
    )
    return bridge.current
  }, [nodes, theme, extensions])

  // create the bridge if it doesn't exist and dispose of it when we're done
  useEffect(() => {
    createBridge()
    return () => {
      if (bridge.current) {
        bridge.current.dispose()
        bridge.current = null
      }
    }
  }, [createBridge])

  return bridge
}
