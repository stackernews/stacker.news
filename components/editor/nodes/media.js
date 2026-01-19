import { IMGPROXY_URL_REGEXP, decodeProxyUrl, getLinkAttributes, MEDIA_DOMAIN_REGEXP } from '@/lib/url'
import { useState, useEffect, memo, useCallback, useMemo } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createLinkNode } from '@lexical/link'
import { $getNodeByKey, $createTextNode, $createParagraphNode } from 'lexical'
import { UNKNOWN_LINK_REL, PUBLIC_MEDIA_CHECK_URL } from '@/lib/constants'
import { useCarousel } from '@/components/carousel'
import { useMe } from '@/components/me'
import { processSrcSetInitial } from '@/lib/lexical/exts/item-context'
import FileError from '@/svgs/editor/file-error.svg'
import preserveScroll from '@/components/preserve-scroll'

function LinkRaw ({ className, children, src, rel }) {
  const isRawURL = /^https?:\/\//.test(children?.[0])
  return (
    // eslint-disable-next-line
    <a
      className={className}
      target='_blank'
      rel={rel ?? UNKNOWN_LINK_REL}
      href={src}
    >{isRawURL || !children ? src : children}
    </a>
  )
}

function MediaLoading ({ autolink = false }) {
  const style = autolink ? { width: '200px', height: '150px' } : undefined
  return <div className='sn-media__loading' style={style} />
}

function MediaError ({ className, width, height, src, rel }) {
  return (
    <LinkRaw className={className} rel={rel} src={src}>
      {width && height && (
        <div className='sn-media__error' title={src}>
          <FileError />
          <p>
            content not available
            <br />
            <span className='fw-medium'>
              {src}
            </span>
          </p>
        </div>
      )}
    </LinkRaw>
  )
}

const Media = memo(function Media ({
  src, bestResSrc, srcSet, sizes, width, alt, title,
  height, onClick, onError, video, onLoad, innerStyle
}) {
  const sized = !!(width && height && width > 0 && height > 0)
  return (
    <>
      {video
        ? (
          <video
            className={`sn-media__video${sized ? ' sn-media__video--sized' : ''}`}
            src={src}
            preload={bestResSrc !== src ? 'metadata' : undefined}
            controls
            poster={bestResSrc !== src ? bestResSrc : undefined}
            width={width}
            height={height}
            onError={onError}
            onLoadedMetadata={onLoad}
            style={innerStyle}
          />
          )
        : (
          <img
            className={`sn-media__img${sized ? ' sn-media__img--sized' : ''}`}
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
            onLoad={onLoad}
            style={innerStyle}
          />
          )}
    </>
  )
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
export default function MediaComponent ({ src, srcSet, bestResSrc, width, height, alt, title, kind: initialKind, linkFallback = true, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const [kind, setKind] = useState()
  const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src

  // TODO: basically an hack, Lexical could handle this via MediaCheckExtension
  // we're profiting from the fact that MediaOrLink actually does a media check
  // if the media turned out to be a link, replace the media node with a link node
  const $replaceWithLink = useCallback(() => {
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
  }, [url, nodeKey])

  const $confirmMedia = useCallback(() => {
    const node = $getNodeByKey(nodeKey)
    if (!node) return

    if (kind === 'image' || kind === 'video') {
      node.setKind(kind)
      node.setStatus('done')
    }
  }, [kind, nodeKey])

  useEffect(() => {
    editor.update(() => {
      if (kind === 'unknown') {
        $replaceWithLink()
      }
      if (kind === 'image' || kind === 'video') {
        $confirmMedia()
      }
    })
  }, [kind, $replaceWithLink, $confirmMedia, editor])

  return (
    <MediaOrLink
      src={src}
      srcSet={srcSet}
      bestResSrc={bestResSrc}
      width={width}
      height={height}
      alt={alt}
      title={title}
      kind={initialKind}
      linkFallback={linkFallback}
      setKind={setKind}
    />
  )
}

export function MediaOrLink ({ linkFallback = true, ...props }) {
  const media = useMediaHelper(props)
  const [isLoading, setIsLoading] = useState(true)
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
    setIsLoading(false)
  }, [setError, removeMedia, media.bestResSrc])

  const handleLoad = useCallback(() => {
    setIsLoading(false)
  }, [setIsLoading])

  if (!media.src) return null

  if (!error) {
    if (media.image || media.video) {
      // when we don't know the dimensions of the media (e.g. autolink),
      // preserveScroll helps us avoid scrolling shift when media finally loads
      const content = (
        <>
          {isLoading && <MediaLoading autolink={props.kind === 'unknown'} />}
          <Media
            {...media} onClick={handleClick} onError={handleError} onLoad={handleLoad} innerStyle={isLoading ? { width: 0, height: 0 } : undefined}
          />
        </>
      )

      // ItemEmbed doesn't create a container for us, in that case we wrap the content in the sn-media span
      return preserveScroll(() => media?.style ? <span className='sn-media' style={media.style}>{content}</span> : content)
    }
  }

  if (linkFallback) {
    if (media.image || media.video) {
      return <MediaError width={media.width} height={media.height} src={media.src} rel={UNKNOWN_LINK_REL} />
    } else {
      return <LinkRaw className='sn-media-autolink__loading' src={media.src} rel={UNKNOWN_LINK_REL} />
    }
  }

  return null
}

// determines how the media should be displayed given the params, me settings, and editor tab
export const useMediaHelper = ({ src, srcSet, srcSetIntital, bestResSrc, width, height, kind, alt, title, topLevel, setKind, tab }) => {
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
          setKind?.('video')
        } else if (data.isImage) {
          setIsImage(true)
          setKind?.('image')
        } else {
          setKind?.('unknown')
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
  }, [src, setIsImage, setIsVideo, showMedia, setKind])

  let style = null
  if (legacySrcSet?.srcSet) {
    srcSet = legacySrcSet?.srcSet
    bestResSrc = legacySrcSet?.bestResSrc
    width = legacySrcSet?.width
    height = legacySrcSet?.height
    if (width && height && width > 0 && height > 0) {
      style = {
        '--height': `${height}`,
        '--width': `${width}`
      }
    }
  }

  const sizes = useMemo(() => srcSet ? '66vw' : undefined, [srcSet])

  return {
    src,
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
