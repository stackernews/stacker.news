import { createHeadlessEditor } from '@lexical/headless'
import DefaultTheme from '@/lib/lexical/theme'
import DefaultNodes from '@/lib/lexical/nodes'

/** creates a headless editor with SN default options
 * @param {Object} options - editor options
 * @param {string} options.namespace - editor namespace
 * @param {Object} options.theme - editor theme
 * @param {Array} options.nodes - editor nodes
 * @param {Function} options.onError - error handler
 * @returns {Object} headless editor instance
 */
export function createSNHeadlessEditor (options = {}) {
  const {
    namespace = 'snSSR',
    theme = DefaultTheme,
    nodes = DefaultNodes,
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
