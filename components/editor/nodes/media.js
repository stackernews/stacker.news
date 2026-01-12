import { IMGPROXY_URL_REGEXP, decodeProxyUrl, getLinkAttributes, MEDIA_DOMAIN_REGEXP } from '@/lib/url'
import { useState, useEffect, memo, useCallback, useMemo } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createLinkNode } from '@lexical/link'
import { $getNodeByKey, $createTextNode, $createParagraphNode } from 'lexical'
import { UNKNOWN_LINK_REL, PUBLIC_MEDIA_CHECK_URL } from '@/lib/constants'
import { useCarousel } from '@/components/carousel'
import { useMe } from '@/components/me'
import { processSrcSetInitial } from '@/lib/lexical/exts/item-context'

function LinkRaw ({ children, src, rel }) {
  const isRawURL = /^https?:\/\//.test(children?.[0])
  return (
    // eslint-disable-next-line
    <a
      target='_blank'
      rel={rel ?? UNKNOWN_LINK_REL}
      href={src}
    >{isRawURL || !children ? src : children}
    </a>
  )
}

const Media = memo(function Media ({
  src, bestResSrc, srcSet, sizes, width, alt, title,
  height, onClick, onError, video, style
}) {
  const content = (
    video
      ? (
        <video
          className='sn-media__video'
          src={src}
          preload={bestResSrc !== src ? 'metadata' : undefined}
          controls
          poster={bestResSrc !== src ? bestResSrc : undefined}
          width={width}
          height={height}
          onError={onError}
        />
        )
      : (
        <img
          className='sn-media__img'
          src={src}
          alt={alt}
          title={title}
          srcSet={srcSet}
          sizes={sizes}
          width={width}
          height={height}
          loading='lazy'
          decoding='async'
          onClick={onClick}
          onError={onError}
        />
        )
  )

  return style ? <div style={style}>{content}</div> : content
})

/**
 * wrapper component that handles media rendering

 * @param {string} props.src - media source url
 * @param {string} props.srcSet - media source set string from imgproxy and ItemContextExtension
 * @param {string} props.bestResSrc - media best resolution source url from imgproxy and ItemContextExtension
 * @param {number} props.width - media width
 * @param {number} props.height - media height
 * @param {string} props.alt - media alt text
 * @param {string} props.title - media title
 * @param {string} props.status - media status (error, pending, etc.)
 * @param {string} props.kind - media kind (image, video)
 * @param {number} props.maxWidth - media max width
 * @returns {JSX.Element} media or link component
 */
export default function MediaComponent ({ src, srcSet, bestResSrc, width, height, alt, title, kind, linkFallback = true, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const [isLink, setIsLink] = useState(false)
  const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src

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

      const { target, rel } = getLinkAttributes(url)
      const linkNode = $createLinkNode(url, {
        title: url,
        target,
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
  }, [isLink, editor, nodeKey, url])

  const media = useMediaHelper({ src, srcSet, bestResSrc, width, height, alt, title, kind, setIsLink })
  const [error, setError] = useState(false)
  const { showCarousel, addMedia, confirmMedia, removeMedia } = useCarousel()

  // register placeholder immediately on mount if we have a src
  useEffect(() => {
    if (!media.bestResSrc) return
    addMedia({ src: media.bestResSrc, originalSrc: media.originalSrc, rel: UNKNOWN_LINK_REL })
  }, [addMedia, media.bestResSrc, media.originalSrc])

  // confirm media for carousel based on image detection
  useEffect(() => {
    if (!media.image) return
    confirmMedia(media.bestResSrc)
  }, [confirmMedia, media.image, media.bestResSrc])

  const handleClick = useCallback(() => showCarousel({ src: media.bestResSrc }),
    [showCarousel, media.bestResSrc])

  const handleError = useCallback((err) => {
    console.error('Error loading media', err)
    removeMedia(media.bestResSrc)
    setError(true)
  }, [setError, removeMedia, media.bestResSrc])

  if (!media.src) return null

  if (!error) {
    if (media.image || media.video) {
      return (
        <Media
          {...media} onClick={handleClick} onError={handleError}
        />
      )
    }
  }

  if (linkFallback) {
    return <LinkRaw rel={UNKNOWN_LINK_REL} src={src} />
  }

  return null
}

// determines how the media should be displayed given the params, me settings, and editor tab
export const useMediaHelper = ({ src, srcSet, srcSetIntital, bestResSrc, width, height, kind, alt, title, topLevel, setIsLink, tab }) => {
  const { me } = useMe()
  const trusted = useMemo(() => !!(srcSet || srcSetIntital) || IMGPROXY_URL_REGEXP.test(src) || MEDIA_DOMAIN_REGEXP.test(src), [srcSet, srcSetIntital, src])
  // backwards compatibility: legacy srcSet handling
  const legacySrcSet = useMemo(() => processSrcSetInitial(srcSetIntital, src), [srcSetIntital, src])
  const [isImage, setIsImage] = useState((kind === 'image' || legacySrcSet?.video === false) && trusted)
  const [isVideo, setIsVideo] = useState(kind === 'video' || legacySrcSet?.video)
  const showMedia = useMemo(() => tab === 'preview' || me?.privates?.showImagesAndVideos !== false, [me?.privates?.showImagesAndVideos, tab])

  useEffect(() => {
    // don't load the video at all if user doesn't want these
    if (!showMedia || isVideo || isImage) return

    const controller = new AbortController()

    const checkMedia = async () => {
      try {
        const res = await fetch(`${PUBLIC_MEDIA_CHECK_URL}/${encodeURIComponent(src)}`, { signal: controller.signal })
        if (!res.ok) return

        const data = await res.json()

        if (data.isVideo) {
          setIsVideo(true)
          setIsImage(false)
        } else if (data.isImage) {
          setIsImage(true)
        } else {
          setIsLink?.(true)
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('cannot check media type', error)
      }
    }
    checkMedia()

    return () => {
      // abort the fetch
      try { controller.abort() } catch {}
    }
  }, [src, setIsImage, setIsVideo, showMedia, setIsLink])

  let style = null
  if (legacySrcSet?.srcSet) {
    srcSet = legacySrcSet?.srcSet
    bestResSrc = legacySrcSet?.bestResSrc
    width = legacySrcSet?.width
    height = legacySrcSet?.height
    if (width && height && width > 0 && height > 0) {
      style = {
        '--height': `${height}px`,
        '--width': `${width}px`
      }
    }
  }

  const sizes = useMemo(() => srcSet ? '66vw' : undefined, [srcSet])

  // avoid canonical fetch if we have a srcset and thus bestResSrc
  const displaySrc = useMemo(() => (srcSet && bestResSrc) ? bestResSrc : src, [src, srcSet, bestResSrc])

  return {
    src: displaySrc,
    srcSet,
    alt,
    title,
    originalSrc: IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src,
    sizes,
    bestResSrc,
    style,
    width,
    height,
    image: (!me?.privates?.imgproxyOnly || trusted) && showMedia && isImage && !isVideo,
    video: !me?.privates?.imgproxyOnly && showMedia && isVideo
  }
}
