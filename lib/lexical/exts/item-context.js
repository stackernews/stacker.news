import { defineExtension, $createTextNode } from 'lexical'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { mergeRegister } from '@lexical/utils'
import { MediaNode } from '@/lib/lexical/nodes/content/media'
import { EmbedNode } from '@/lib/lexical/nodes/content/embed'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import { $replaceNodeWithLink } from '@/lib/lexical/nodes/utils'

const replaceWithText = (node, text) => node.replace($createTextNode(text))

/**
 * computes srcSet, bestResSrc, width, height, media type from the srcSet object (imgproxyUrls[url])
 * @param {Object} srcSetInitial - srcSet object from imgproxyUrls[url]
 * @param {string} src - original source URL
 * @returns {Object} { srcSet, bestResSrc, width, height, video (boolean) }
 */
export const processSrcSetInitial = (srcSetInitial, src) => {
  if (!srcSetInitial) {
    return { srcSet: null, bestResSrc: src, width: null, height: null }
  }

  const { dimensions, video, format, ...srcSetObj } = srcSetInitial
  const hasUrls = Object.keys(srcSetObj).length > 0

  // absolute imgproxy url
  const toAbsoluteUrl = (url) => {
    if (url.startsWith('http')) return url
    return new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
  }

  // srcSet from wDescriptor (width descriptors like '1280w')
  const srcSet = hasUrls
    ? Object.entries(srcSetObj)
      .map(([wDescriptor, url]) => `${toAbsoluteUrl(url)} ${wDescriptor}`)
      .join(', ')
    : null

  // best resolution source
  const bestResSrc = hasUrls
    ? Object.entries(srcSetObj)
      .reduce((best, [wDescriptor, url]) => {
        const width = Number(wDescriptor.replace(/w$/, ''))
        return width > best.width
          ? { width, url: toAbsoluteUrl(url) }
          : best
      }, { width: 0, url: src })
      .url
    : src

  return {
    srcSet,
    bestResSrc,
    width: dimensions?.width,
    height: dimensions?.height,
    video
  }
}

/**
 * extension that handles item context (imgproxy urls, outlawed content, etc.)
 *
 * this is best used with prepareLexicalState to ensure
 * the editor state is updated with the latest item context.
 *
 * it's not recommended to use this extension in user-facing editors and readers,
 *
 * as these values are gathered from the resolvers, they cannot be gathered from a live editor.
 *
 * manipulates the editor state to update
 * - media nodes with srcSet, bestResSrc, width, height, and kind
 * - auto links and links with rel
 * - embeds with src
 * - outlawed content
 *
 * @param {Editor} editor - the editor instance
 * @param {Object} [params] - optional parameters
 * @param {Object} [params.imgproxyUrls] - imgproxy urls object
 * @param {boolean} [params.outlawed] - whether content is outlawed
 * @param {string} [params.rel] - link rel attribute
 */
export const ItemContextExtension = defineExtension({
  name: 'item-context',
  register: (editor, { imgproxyUrls, outlawed, rel, showImagesAndVideos } = {}) => {
    // handle filters and outlawed content
    const unregisterFilters = mergeRegister(
      editor.registerNodeTransform(AutoLinkNode, (node) => {
        if (outlawed) replaceWithText(node, node.getURL())
      }),
      editor.registerNodeTransform(LinkNode, (node) => {
        // handle rel
        if ((rel || UNKNOWN_LINK_REL) !== node.getRel()) {
          node.setRel(rel || UNKNOWN_LINK_REL)
        }
        if (outlawed) replaceWithText(node, node.getURL())
      }),
      editor.registerNodeTransform(MediaNode, (node) => {
        if (outlawed) replaceWithText(node, node.getSrc())
        // replace media node with link if user has disabled images and videos
        if (showImagesAndVideos === false) $replaceNodeWithLink(node, node.getSrc())
      }),
      // autolink replacement already takes care of this,
      // as embeds are parsed from autolinks and replaced with embed nodes
      // TODO: but architecture can change, so we're leaving this here for now
      editor.registerNodeTransform(EmbedNode, (node) => {
        const src = node.getSrc() || node.getMeta()?.href
        if (!src) {
          node.remove()
          return
        }
        if (outlawed) {
          replaceWithText(node, src)
          return
        }
        if (showImagesAndVideos === false) {
          $replaceNodeWithLink(node, src)
        }
      })
    )

    // handle imgproxy urls
    const unregisterImgproxyUrls = editor.registerNodeTransform(MediaNode, (node) => {
      if (imgproxyUrls) {
        const src = node.getSrc()
        if (!src) return

        const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
        const srcSetInitial = imgproxyUrls?.[url]
        const { srcSet, bestResSrc, width, height, video } = processSrcSetInitial(srcSetInitial, src)
        // updating a node state marks it as dirty, so we only update if the value has changed
        // otherwise, we'll trigger an infinite loop of updates
        if (srcSet !== node.getSrcSet()) {
          node.setSrcSet(srcSet)
        }
        if (bestResSrc !== node.getBestResSrc()) {
          node.setBestResSrc(bestResSrc)
        }
        if (width || height) {
          const { width: currentWidth, height: currentHeight } = node.getWidthAndHeight()
          if (width !== currentWidth || height !== currentHeight) {
            node.setWidthAndHeight(width, height)
          }
        }
        const newKind = video ? 'video' : video === false ? 'image' : 'unknown'
        if (newKind !== node.getKind()) {
          node.setKind(newKind)
        }
      }
    })

    return () => {
      unregisterFilters()
      unregisterImgproxyUrls()
    }
  }
})
