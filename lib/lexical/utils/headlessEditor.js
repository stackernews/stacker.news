import { createHeadlessEditor } from '@lexical/headless'
import snTheme from '@/lexical/theme'
import DefaultNodes from '@/lib/lexical/nodes'

// creates a headless editor with SN default options
export default function createSNHeadlessEditor (options) {
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
