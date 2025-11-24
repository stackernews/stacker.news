import mentions, { micromark, fromMarkdown } from './plugins/mentions'
import links from './plugins/links'
import formatting from './plugins/formatting'
import structure from './plugins/structure'
import misc from './plugins/misc'

// micromark/mdast extensions
export const MENTION_EXTENSIONS = { micromark, fromMarkdown }

// every transformer
export default [
  ...mentions,
  ...links,
  ...formatting,
  ...structure,
  ...misc
].sort((a, b) => (b.priority || 0) - (a.priority || 0))
