import { getParsedHTML } from '@/lib/dompurify'
import { applySNOutlawedCustomizations } from '@/lib/lexical/sn/customs/outlawed'

export function applySNCustomizations (html, options = {}) {
  if (!html) return null
  // if no options are provided, return html as-is
  if (!options || Object.keys(options).length === 0) {
    return html
  }

  const { outlawed = false } = options

  try {
    const doc = getParsedHTML(html)
    if (outlawed) {
      applySNOutlawedCustomizations(doc)
    }
    return doc.body.innerHTML
  } catch (error) {
    console.error('error applying SN customizations: ', error)
    return html
  }
}
