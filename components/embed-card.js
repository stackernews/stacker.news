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

// card images are imgproxy paths if imgproxy is enabled
const proxied = path => new URL(path, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()

// the box of a card, a quoted post and a plain link.
// lexical reader keeps whitespace and the embed wrapper turns off selection, we undo both here
const CARD = 'relative flex flex-col gap-2 p-3 rounded-xl leading-snug whitespace-normal wrap-anywhere select-text'

// text, media, link preview and quote of a post.
// shrink-0 avoids pictures being shrunk to fit the card
const BODY = 'flex flex-col gap-2 empty:hidden *:shrink-0'

function Picture ({ src, src2x, alt, ...props }) {
  return <img src={proxied(src)} srcSet={src2x && `${proxied(src2x)} 2x`} alt={alt ?? ''} loading='lazy' {...props} />
}

function ExternalLink ({ href, ...props }) {
  const url = sanitizeUrl(href)
  return <a href={url} {...getLinkAttributes(url)} {...props} />
}

// card for tweets and nostr events
export default function EmbedCard ({ src, provider, data, full, className }) {
  // skip the query if the embed data is saved on the item.
  // query doesn't run during ssr, because a slow relay would hold up the page
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
      <div className={classNames(styles.card, CARD, container, className)}>
        <ExternalLink href={src} className='flex items-center gap-2'>
          <Icon className={classNames(styles.icon, 'size-4.5 shrink-0')} />
          <span className='truncate'>{src}</span>
        </ExternalLink>
      </div>
    )
  }

  return (
    <div className={classNames(styles.card, CARD, container, className)}>
      <ExternalLink href={card.href} className={classNames(styles.source, 'absolute top-3 right-3')} aria-label='open original'>
        <Icon className={classNames(styles.icon, 'size-4.5 shrink-0')} />
      </ExternalLink>
      <Post {...card} full={full} expandLabel={expandLabel} />
    </div>
  )
}

// collapses the body of a long post
function Collapsible ({ label, full, children }) {
  const ref = useRef(null)
  const clipped = useClipped(ref)
  const [show, setShow] = useState(full)

  return (
    <>
      <div ref={ref} className={classNames(BODY, !show && 'max-h-(--sn-embed-contained-height) overflow-hidden', clipped && !show && styles.clipped)}>
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

function Post ({ href, author, createdAt, replyTo, title, text, truncated, poll, media, preview, quote, full, expandLabel }) {
  const body = (
    <>
      {(text.length > 0 || truncated || poll) &&
        <div className='whitespace-pre-line'>
          {text.map((segment, i) => segment.href
            ? <ExternalLink key={i} href={segment.href}>{segment.text}</ExternalLink>
            : segment.text)}
          {truncated && <>… <ExternalLink href={href}>show more on X</ExternalLink></>}
          {poll && <>{'\n\n'}<ExternalLink href={href}>see the poll on X</ExternalLink></>}
        </div>}
      {media.length > 0 &&
        <div className={classNames(styles.media, 'grid gap-0.5 overflow-hidden rounded-xl')}>
          {media.map((item, i) => <Media key={i} href={href} {...item} />)}
        </div>}
      {preview &&
        <ExternalLink href={preview.href} className={classNames(styles.preview, 'block overflow-hidden rounded-xl text-reset')}>
          {preview.image && <Picture {...preview.image} className='block w-full h-auto max-h-64 object-cover' />}
          <span className='block px-3 py-2 leading-tight'>
            <span className='block small text-muted'>{preview.domain}</span>
            <span className='block font-bold'>{preview.title}</span>
          </span>
        </ExternalLink>}
      {quote &&
        <div className={classNames(styles.card, CARD)}>
          <Post {...quote} full />
        </div>}
    </>
  )

  return (
    <>
      <ExternalLink href={author.href} className='flex items-center gap-2 me-6 text-reset'>
        {author.avatar
          ? <Picture {...author.avatar} className={classNames(styles.avatar, 'size-10 shrink-0 rounded-full object-cover')} width={40} height={40} />
          : <span className={classNames(styles.avatar, 'size-10 shrink-0 rounded-full')} />}
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
      <Collapsible label={expandLabel} full={full}>{body}</Collapsible>
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
  // with imgproxyOnly the video player is instead a link to the tweet
  if (!video || me?.privates?.imgproxyOnly) {
    return <ExternalLink href={href}>{picture}</ExternalLink>
  }

  // the player is only rendered when play is clicked, so its autoplay starts the video right away
  return (
    <div className='relative'>
      {picture}
      {playing
        ? (
          <iframe
            className='absolute inset-0 h-full w-full'
            title='video'
            srcDoc={playerDocument({ video, poster: proxied(src), loop })}
            sandbox='allow-scripts' // allow-scripts enables autoplay below
            allow='autoplay; fullscreen' // autoplay avoids requiring two clicks to play a video
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

// X rejects video requests that have a referrer from another site
// <video> cannot set a referrerpolicy, so the player is an iframe document with no-referrer tag
function playerDocument ({ video, poster, loop }) {
  return `<!doctype html>
    <meta name="referrer" content="no-referrer">
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
      video { display: block; width: 100%; height: 100%; }
    </style>
    <video src="${attribute(video)}" poster="${attribute(poster)}" controls autoplay playsinline ${loop ? 'loop' : ''}></video>`
}
