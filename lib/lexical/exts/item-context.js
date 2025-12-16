import { defineExtension, $createTextNode } from 'lexical'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { mergeRegister } from '@lexical/utils'
import { MediaNode } from '@/lib/lexical/nodes/content/media'
import { EmbedNode } from '@/lib/lexical/nodes/content/embed'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'
import { UNKNOWN_LINK_REL } from '@/lib/constants'

const replaceWithText = (node, text) => node.replace($createTextNode(text))

/**
 * Processes srcSetInitial object to generate srcSet string, bestResSrc, and dimensions
 * @param {Object} srcSetInitial - Object with shape { dimensions: {width, height}, video: boolean, format: string, [widthDescriptor]: url, ... }
 * @param {string} src - Original source URL
 * @returns {Object} Object with srcSet, bestResSrc, width, height properties
 */
const processSrcSetInitial = (srcSetInitial, src) => {
  if (!srcSetInitial) {
    return { srcSet: null, bestResSrc: null, width: 0, height: 0 }
  }

  const { dimensions, video, ...srcSetObj } = srcSetInitial

  // srcSet
  let srcSet
  if (Object.keys(srcSetObj).length === 0) {
    srcSet = null
  } else {
    srcSet = Object.entries(srcSetObj).reduce((acc, [wDescriptor, url], i, arr) => {
      // backwards compatibility: we used to replace image urls with imgproxy urls rather just storing paths
      if (!url.startsWith('http')) {
        url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
      }
      return acc + `${url} ${wDescriptor}` + (i < arr.length - 1 ? ', ' : '')
    }, '')
  }

  // bestResSrc
  let bestResSrc
  if (Object.keys(srcSetObj).length === 0) {
    bestResSrc = src
  } else {
    bestResSrc = Object.entries(srcSetObj).reduce((acc, [wDescriptor, url]) => {
      if (!url.startsWith('http')) {
        url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
      }
      const w = Number(wDescriptor.replace(/w$/, ''))
      return w > acc.w ? { w, url } : acc
    }, { w: 0, url: undefined }).url
  }

  // dimensions
  const width = dimensions?.width || 0
  const height = dimensions?.height || 0

  return { srcSet, bestResSrc, width, height, video }
}

export const ItemContextExtension = defineExtension({
  name: 'item-context',
  register: (editor, { imgproxyUrls, outlawed, rel } = {}) => {
    // handle outlawed content
    const unregisterOutlawed = mergeRegister(
      editor.registerNodeTransform(AutoLinkNode, (node) => {
        if (outlawed) replaceWithText(node, node.getURL())
      }),
      editor.registerNodeTransform(LinkNode, (node) => {
        if (outlawed) replaceWithText(node, node.getURL())
        node.setRel(rel || UNKNOWN_LINK_REL)
      }),
      editor.registerNodeTransform(MediaNode, (node) => {
        if (outlawed) replaceWithText(node, node.getSrc())
      }),
      // autolink replacement already takes care of this,
      // as embeds are parsed from autolinks and replaced with embed nodes
      // TODO: but architecture can change, so we're leaving this here for now
      editor.registerNodeTransform(EmbedNode, (node) => {
        if (outlawed) {
          const src = node.getSrc() || node.getMeta()?.href
          if (src) {
            replaceWithText(node, src)
          } else {
            node.remove()
          }
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
        const { width: currentWidth, height: currentHeight } = node.getWidthAndHeight()
        if (width !== currentWidth || height !== currentHeight) {
          node.setWidthAndHeight(width, height)
        }
        const newKind = video ? 'video' : video === false ? 'image' : 'unknown'
        if (newKind !== node.getKind()) {
          node.setKind(newKind)
        }
      }
    })

    return () => {
      unregisterOutlawed()
      unregisterImgproxyUrls()
    }
  }
})
