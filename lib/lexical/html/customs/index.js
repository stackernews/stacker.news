import { getParsedHTML } from '@/lib/dompurify'
import { applySNOutlawedCustomizations } from '@/lib/lexical/html/customs/outlawed'
import { addSrcSetToMediaAndVideoNodes } from '@/lib/lexical/html/customs/imgproxy'

export function applySNCustomizations (html, options = {}) {
  if (!html) return null
  // if no options are provided, return html as-is
  if (!options || Object.keys(options).length === 0) {
    return html
  }

  const { outlawed = false, imgproxyUrls = {}, topLevel = false } = options

  try {
    const doc = getParsedHTML(html)
    if (outlawed) {
      applySNOutlawedCustomizations(doc)
    }
    if (imgproxyUrls) {
      addSrcSetToMediaAndVideoNodes(doc, imgproxyUrls, topLevel)
    }
    return doc.body.innerHTML
  } catch (error) {
    console.error('error applying SN customizations: ', error)
    return html
  }
}
