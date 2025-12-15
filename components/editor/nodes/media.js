import MediaOrLink, { LinkRaw } from '@/components/media-or-link'
import { useLexicalItemContext } from '@/components/editor/contexts/item'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'
import { useState, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createLinkNode } from '@lexical/link'
import { $getNodeByKey, $createTextNode, $createParagraphNode } from 'lexical'

/**
 * wrapper component that handles media rendering with item-specific logic
 * like imgproxy, outlawed, rel (link) and top level

 * @param {string} props.src - media source url
 * @param {string} props.alt - media alt text
 * @param {string} props.title - media title
 * @param {string} props.status - media status (error, pending, etc.)
 * @param {string} props.kind - media kind (image, video)
 * @param {number} props.width - media width
 * @param {number} props.height - media height
 * @param {number} props.maxWidth - media max width
 * @returns {JSX.Element} media or link component
 */
export default function MediaComponent ({ src, alt, title, status, kind, width, height, maxWidth, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const [isLink, setIsLink] = useState(false)
  const { imgproxyUrls, rel, outlawed, topLevel } = useLexicalItemContext()
  const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
  const srcSet = imgproxyUrls?.[url]

  if (outlawed) {
    return <p className='outlawed'>{url}</p>
  }

  if (status === 'error') {
    return <LinkRaw src={url} rel={rel}>{url}</LinkRaw>
  }

  // TODO: basically an hack, Lexical could handle this via MediaCheckExtension
  // we're profiting from the fact that MediaOrLink actually does a media check
  // if the media turned out to be a link, replace the media node with a link node
  useEffect(() => {
    if (!isLink) return

    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if (!node) return

      const parent = node.getParent()
      if (!parent) return

      const linkNode = $createLinkNode(url, {
        title: url,
        rel
      }).append($createTextNode(url))

      // If parent is a paragraph, directly replace the media node with the link
      if (parent.getType() === 'paragraph') {
        node.replace(linkNode)
        return
      }

      // Otherwise, insert a new paragraph with the link after the parent and remove the media node
      parent.insertAfter($createParagraphNode().append(linkNode))
      node.remove()

      // Clean up empty parent nodes
      if (parent.getChildrenSize() === 0) {
        parent.remove()
      }
    })
  }, [isLink, editor, nodeKey, url, rel])

  return (
    <MediaOrLink
      setIsLink={setIsLink}
      src={src}
      title={title}
      alt={alt}
      srcSet={srcSet}
      rel={rel}
      kind={kind}
      linkFallback
      preTailor={{ width, height, maxWidth: maxWidth ?? 500 }}
      topLevel={topLevel}
    />
  )
}
