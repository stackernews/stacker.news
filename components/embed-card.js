import { useRef, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import classNames from 'classnames'
import Button from '@/components/ui/button'
import { EMBED } from '@/fragments/items'
import { getLinkAttributes, sanitizeUrl } from '@/lib/url'
import { timeSince } from '@/lib/time'
import { useMe } from './me'
import useClipped from './use-clipped'
import TwitterIcon from '@/svgs/twitter-fill.svg'
import NostrIcon from '@/svgs/nostr.svg'
import PlayIcon from '@/svgs/play-fill.svg'
import styles from './embed-card.module.css'

const PROVIDERS = {
  twitter: { Icon: TwitterIcon, container: 'sn-twitter-container', expandLabel: 'expand tweet' },
  nostr: { Icon: NostrIcon, container: 'sn-nostr-container', expandLabel: 'expand note' }
}

// card images are imgproxy paths, we add the host like we do for imgproxyUrls.
// without imgproxy (local dev) they are full urls, which new URL returns unchanged
const proxied = path => new URL(path, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()

function Picture ({ src, src2x, alt, ...props }) {
  return <img src={proxied(src)} srcSet={src2x && `${proxied(src2x)} 2x`} alt={alt ?? ''} loading='lazy' {...props} />
}

// all links in a card are external
function ExternalLink ({ href, ...props }) {
  const url = sanitizeUrl(href)
  return <a href={url} {...getLinkAttributes(url)} {...props} />
}

// card for tweets and nostr notes, profiles and articles.
// full: a long post is not collapsed, used for the url of a link post
export default function EmbedCard ({ src, provider, data, full, className }) {
  // skip the query if the embed data is saved on the item.
  // the query doesn't run during ssr, because a slow relay would hold up the page
  const query = useQuery(EMBED, { variables: { url: src }, ssr: false, skip: !!data })
  const { Icon, container, expandLabel } = PROVIDERS[provider]

  // the same skeleton is in the item html, see EmbedNode.exportDOM
  if (query.loading) {
    return (
      <div className={classNames('sn-embed-skeleton', container, className)}>
        <div className='clouds' />
        <div className='clouds' />
        <div className='clouds' />
      </div>
    )
  }

  const card = data ?? query.data?.embed
  // no embed data (not found, restricted or unreachable), show a plain link
  if (!card) {
    return (
      <div className={classNames(styles.card, container, className)}>
        <ExternalLink href={src} className='flex items-center gap-2'>
          <Icon className={styles.icon} />
          <span className='truncate'>{src}</span>
        </ExternalLink>
      </div>
    )
  }

  return (
    <div className={classNames(styles.card, container, className)}>
      <ExternalLink href={card.href} className={styles.source} aria-label='open original'>
        <Icon className={styles.icon} />
      </ExternalLink>
      <Post {...card} collapsible={!full} expandLabel={expandLabel} />
    </div>
  )
}

// collapses the body of a long post until the expand button is clicked
function Collapsible ({ label, children }) {
  const ref = useRef(null)
  const clipped = useClipped(ref)
  const [show, setShow] = useState(false)

  return (
    <>
      <div ref={ref} className={classNames(styles.body, !show && styles.contained, clipped && !show && styles.clipped)}>
        {children}
      </div>
      {clipped && !show &&
        <Button
          variant='link'
          className='self-start p-0 font-bold text-muted'
          aria-expanded='false'
          onClick={() => setShow(true)}
        >
          {label}
        </Button>}
    </>
  )
}

// only the top post is collapsible, a quoted post is part of its body
function Post ({ href, author, createdAt, replyTo, title, text, media, preview, quote, collapsible, expandLabel }) {
  const body = (
    <>
      {text.length > 0 &&
        <div className='whitespace-pre-wrap'>
          {text.map((segment, i) => segment.href
            ? <ExternalLink key={i} href={segment.href}>{segment.text}</ExternalLink>
            : segment.text)}
        </div>}
      {media.length > 0 &&
        <div className={styles.media}>
          {media.map((item, i) => <Media key={i} href={href} {...item} />)}
        </div>}
      {preview &&
        <ExternalLink href={preview.href} className={styles.preview}>
          {preview.image && <Picture {...preview.image} />}
          <span className='block px-3 py-2 leading-tight'>
            <span className='block small text-muted'>{preview.domain}</span>
            <span className='block font-bold'>{preview.title}</span>
          </span>
        </ExternalLink>}
      {quote &&
        <div className={styles.card}>
          <Post {...quote} />
        </div>}
    </>
  )

  return (
    <>
      <ExternalLink href={author.href} className={classNames(styles.author, 'flex items-center gap-2 me-6')}>
        {author.avatar
          ? <Picture {...author.avatar} className={styles.avatar} width={40} height={40} />
          : <span className={styles.avatar} />}
        <span className='min-w-0 leading-tight'>
          <span className='block truncate font-bold'>{author.name}</span>
          <span className='block truncate small text-muted'>{author.handle}</span>
        </span>
      </ExternalLink>
      {replyTo &&
        <div className='small text-muted'>
          replying to <ExternalLink href={replyTo.href}>{replyTo.text}</ExternalLink>
        </div>}
      {title && <div className='font-bold'>{title}</div>}
      {collapsible
        ? <Collapsible label={expandLabel}>{body}</Collapsible>
        : <div className={styles.body}>{body}</div>}
      {createdAt &&
        <ExternalLink href={href} className='small text-muted' title={createdAt} suppressHydrationWarning>
          {timeSince(new Date(createdAt))}
        </ExternalLink>}
    </>
  )
}

function Media ({ href, src, src2x, width, height, alt, video, loop }) {
  const { me } = useMe()
  const [playing, setPlaying] = useState(false)

  const picture = <Picture src={src} src2x={src2x} width={width} height={height} alt={alt} />

  // videos can't be proxied, they load from X only after play is clicked.
  // with imgproxyOnly there is no player, the poster links to the post like photos do
  if (!video || me?.privates?.imgproxyOnly) {
    return <ExternalLink href={href}>{picture}</ExternalLink>
  }

  // keep the picture under the player to avoid layout shift.
  // the player is only added when play is clicked, so its autoplay starts the video right away
  return (
    <div className='relative'>
      {picture}
      {playing
        ? (
          <iframe
            className='absolute inset-0 h-full w-full'
            title='video'
            srcDoc={playerDocument({ video, poster: proxied(src), loop })}
            sandbox='allow-scripts'
            allow='autoplay; fullscreen'
            allowFullScreen
          />
          )
        : (
          <button type='button' className={styles.play} onClick={() => setPlaying(true)} aria-label='play video'>
            <PlayIcon />
          </button>
          )}
    </div>
  )
}

const attribute = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

// X rejects video requests that have a referrer from another site.
// <video> has no referrerpolicy, so the player is an iframe document with a no-referrer meta tag.
// the sandbox allows scripts because an empty sandbox blocks autoplay.
// the document has no scripts, and without allow-same-origin it cannot reach our page
function playerDocument ({ video, poster, loop }) {
  return '<!doctype html><meta name="referrer" content="no-referrer">' +
    '<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}video{display:block;width:100%;height:100%}</style>' +
    `<video src="${attribute(video)}" poster="${attribute(poster)}" controls autoplay playsinline${loop ? ' loop' : ''}></video>`
}
