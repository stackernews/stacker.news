import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import atomDark from 'react-syntax-highlighter/dist/cjs/styles/prism/atom-dark'
import mention from '../lib/remark-mention'
import sub from '../lib/remark-sub'
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'
import reactStringReplace from 'react-string-replace'
import React, { useRef, useEffect, useState, memo } from 'react'
import GithubSlugger from 'github-slugger'
import LinkIcon from '../svgs/link.svg'
import Thumb from '../svgs/thumb-up-fill.svg'
import { toString } from 'mdast-util-to-string'
import copy from 'clipboard-copy'
import { IMGPROXY_URL_REGEXP, IMG_URL_REGEXP } from '../lib/url'
import { extractUrls } from '../lib/md'
import FileMissing from '../svgs/file-warning-line.svg'

function searchHighlighter () {
  return (tree) => {
    visit(tree, (node) => {
      if (
        node.type === 'textDirective' ||
        node.type === 'leafDirective'
      ) {
        if (node.name !== 'high') return

        const data = node.data || (node.data = {})
        data.hName = 'mark'
        data.hProperties = {}
      }
    })
  }
}

function Heading ({ h, slugger, noFragments, topLevel, children, node, ...props }) {
  const [copied, setCopied] = useState(false)
  const [id] = useState(noFragments ? undefined : slugger.slug(toString(node).replace(/[^\w\-\s]+/gi, '')))

  const Icon = copied ? Thumb : LinkIcon

  return (
    <span className={styles.heading}>
      {React.createElement(h, { id, ...props }, children)}
      {!noFragments && topLevel &&
        <a className={`${styles.headingLink} ${copied ? styles.copied : ''}`} href={`#${id}`}>
          <Icon
            onClick={() => {
              const location = new URL(window.location)
              location.hash = `${id}`
              copy(location.href)
              setTimeout(() => setCopied(false), 1500)
              setCopied(true)
            }}
            width={18}
            height={18}
            className='fill-grey'
          />
        </a>}
    </span>
  )
}

const CACHE_STATES = {
  IS_LOADING: 'IS_LOADING',
  IS_LOADED: 'IS_LOADED',
  IS_ERROR: 'IS_ERROR'
}

// this is one of the slowest components to render
export default memo(function Text ({ topLevel, noFragments, nofollow, onlyImgProxy, children }) {
  // all the reactStringReplace calls are to facilitate search highlighting
  const slugger = new GithubSlugger()
  onlyImgProxy = onlyImgProxy ?? true

  const HeadingWrapper = (props) => Heading({ topLevel, slugger, noFragments, ...props })

  const imgCache = useRef({})
  const [urlCache, setUrlCache] = useState({})

  useEffect(() => {
    const imgRegexp = onlyImgProxy ? IMGPROXY_URL_REGEXP : IMG_URL_REGEXP
    const urls = extractUrls(children)

    urls.forEach((url) => {
      if (imgRegexp.test(url)) {
        setUrlCache((prev) => ({ ...prev, [url]: CACHE_STATES.IS_LOADED }))
      } else if (!onlyImgProxy) {
        const img = new window.Image()
        imgCache.current[url] = img

        setUrlCache((prev) => ({ ...prev, [url]: CACHE_STATES.IS_LOADING }))

        const callback = (state) => {
          setUrlCache((prev) => ({ ...prev, [url]: state }))
          delete imgCache.current[url]
        }
        img.onload = () => callback(CACHE_STATES.IS_LOADED)
        img.onerror = () => callback(CACHE_STATES.IS_ERROR)
        img.src = url
      }
    })

    return () => {
      Object.values(imgCache.current).forEach((img) => {
        img.onload = null
        img.onerror = null
        img.src = ''
      })
    }
  }, [children])

  return (
    <div className={styles.text}>
      <ReactMarkdown
        components={{
          h1: (props) => HeadingWrapper({ h: topLevel ? 'h1' : 'h3', ...props }),
          h2: (props) => HeadingWrapper({ h: topLevel ? 'h2' : 'h4', ...props }),
          h3: (props) => HeadingWrapper({ h: topLevel ? 'h3' : 'h5', ...props }),
          h4: (props) => HeadingWrapper({ h: topLevel ? 'h4' : 'h6', ...props }),
          h5: (props) => HeadingWrapper({ h: topLevel ? 'h5' : 'h6', ...props }),
          h6: (props) => HeadingWrapper({ h: 'h6', ...props }),
          table: ({ node, ...props }) =>
            <span className='table-responsive'>
              <table className='table table-bordered table-sm' {...props} />
            </span>,
          p: ({ children, ...props }) => <div className={styles.p} {...props}>{children}</div>,
          code ({ node, inline, className, children, style, ...props }) {
            return !inline
              ? (
                <SyntaxHighlighter showLineNumbers style={atomDark} PreTag='div' {...props}>
                  {reactStringReplace(String(children).replace(/\n$/, ''), /:high\[([^\]]+)\]/g, (match, i) => {
                    return match
                  }).join('')}
                </SyntaxHighlighter>
                )
              : (
                <code className={className} style={atomDark} {...props}>
                  {reactStringReplace(String(children), /:high\[([^\]]+)\]/g, (match, i) => {
                    return <mark key={`mark-${match}`}>{match}</mark>
                  })}
                </code>
                )
          },
          a: ({ node, href, children, ...props }) => {
            if (children?.some(e => e?.props?.node?.tagName === 'img')) {
              return <>{children}</>
            }

            if (urlCache[href] === CACHE_STATES.IS_LOADED) {
              return <ZoomableImage topLevel={topLevel} {...props} src={href} />
            }

            // map: fix any highlighted links
            children = children?.map(e =>
              typeof e === 'string'
                ? reactStringReplace(e, /:high\[([^\]]+)\]/g, (match, i) => {
                  return <mark key={`mark-${match}-${i}`}>{match}</mark>
                })
                : e)

            return (
              /*  eslint-disable-next-line */
              <a
                target='_blank' rel={nofollow ? 'nofollow' : 'noreferrer'}
                href={reactStringReplace(href, /:high%5B([^%5D]+)%5D/g, (match, i) => {
                  return match
                }).join('')} {...props}
              >
                {children}
              </a>
            )
          },
          img: ({ node, ...props }) => <ZoomableImage topLevel={topLevel} {...props} />
        }}
        remarkPlugins={[gfm, mention, sub, remarkDirective, searchHighlighter]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})

export function ZoomableImage ({ src, topLevel, ...props }) {
  const [err, setErr] = useState()
  const defaultMediaStyle = {
    maxHeight: topLevel ? '75vh' : '25vh',
    cursor: 'zoom-in'
  }

  // if image changes we need to update state
  const [mediaStyle, setMediaStyle] = useState(defaultMediaStyle)
  useEffect(() => {
    setMediaStyle(defaultMediaStyle)
    setErr(null)
  }, [src])

  if (!src) return null
  if (err) {
    return (
      <span className='d-flex align-items-baseline text-warning-emphasis fw-bold pb-1'>
        <FileMissing width={18} height={18} className='fill-warning me-1 align-self-center' />
        broken image <small className='ms-1'>stacker probably used an unreliable host</small>
      </span>
    )
  }

  return (
    <img
      className={topLevel ? styles.topLevel : undefined}
      style={mediaStyle}
      src={src}
      onClick={() => {
        if (mediaStyle.cursor === 'zoom-in') {
          setMediaStyle({
            width: '100%',
            cursor: 'zoom-out'
          })
        } else {
          setMediaStyle(defaultMediaStyle)
        }
      }}
      onError={() => setErr(true)}
      {...props}
    />
  )
}
