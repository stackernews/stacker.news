/**
 * replaces media (img, video, iframe, embed) with plain text
 * @param {Document} doc - document object
 */
function replaceMedia (doc) {
  const body = doc.body
  body.querySelectorAll('span.sn__mediaContainer').forEach(mediaContainer => {
    const media = mediaContainer.querySelector('img,video,iframe,embed')
    const src = media?.getAttribute('src') || ''
    const p = doc.createElement('p')
    p.className = 'sn__paragraph outlawed'
    p.textContent = src

    // replace the mediaContainer with the new paragraph
    const parentParagraph = mediaContainer.closest('.sn__paragraph')
    if (parentParagraph) {
      parentParagraph.replaceWith(p)
    } else {
      mediaContainer.replaceWith(p)
    }
  })
}

/**
 * replaces embeds with plain text
 * @param {Document} doc - document object
 */
function replaceEmbeds (doc) {
  const body = doc.body
  body.querySelectorAll('div.sn__embedWrapper__explainer').forEach(embed => {
    const src = embed.getAttribute('data-lexical-embed-src') || ''
    const p = doc.createElement('p')
    p.className = 'sn__paragraph outlawed'
    p.textContent = src
    const parentParagraph = embed.closest('.sn__paragraph')
    if (parentParagraph) {
      parentParagraph.replaceWith(p)
    } else {
      embed.replaceWith(p)
    }
  })
}

/**
 * replaces links with plain text
 * @param {Document} doc - document object
 */
function replaceLinks (doc) {
  const body = doc.body
  body.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href') || ''
    link.replaceWith(doc.createTextNode(href))
  })
}

/**
 * applies all 'outlawed' transformations to document
 * @param {Document} doc - document object to transform
 */
export function applySNOutlawedCustomizations (doc) {
  replaceMedia(doc)
  replaceEmbeds(doc)
  replaceLinks(doc)
}
