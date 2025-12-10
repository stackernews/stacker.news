import MediaOrLink, { LinkRaw } from '@/components/media-or-link'
import { useLexicalItemContext } from '@/components/editor/contexts/item'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'

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
export default function MediaComponent ({ src, alt, title, status, kind, width, height, maxWidth }) {
  const { imgproxyUrls, rel, outlawed, topLevel } = useLexicalItemContext()
  const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
  const srcSet = imgproxyUrls?.[url]

  if (outlawed) {
    return <p className='outlawed'>{url}</p>
  }

  if (status === 'error') {
    return <LinkRaw src={url} rel={rel}>{url}</LinkRaw>
  }

  return (
    <MediaOrLink
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
