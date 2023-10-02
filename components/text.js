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
import React, { useState, memo } from 'react'
import GithubSlugger from 'github-slugger'
import LinkIcon from '../svgs/link.svg'
import Thumb from '../svgs/thumb-up-fill.svg'
import { toString } from 'mdast-util-to-string'
import copy from 'clipboard-copy'
import { useImgUrlCache, IMG_CACHE_STATES, ZoomableImage, decodeOriginalUrl } from './image'
import { IMGPROXY_URL_REGEXP } from '../lib/url'

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

// this is one of the slowest components to render
export default memo(function Text ({ topLevel, noFragments, nofollow, imgproxyUrls, children, tab }) {
  // all the reactStringReplace calls are to facilitate search highlighting
  const slugger = new GithubSlugger()

  const HeadingWrapper = (props) => Heading({ topLevel, slugger, noFragments, ...props })

  const imgUrlCache = useImgUrlCache(children, { imgproxyUrls, tab })

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

            if (imgUrlCache[href] === IMG_CACHE_STATES.LOADED) {
              const url = IMGPROXY_URL_REGEXP.test(href) ? decodeOriginalUrl(href) : href
              // if `srcSet` is undefined, it means the image was not processed by worker yet
              // if `srcSet` is null, image was processed but this specific url was not detected as an image by the worker
              const srcSet = imgproxyUrls ? (imgproxyUrls[url] || null) : undefined
              return <ZoomableImage topLevel={topLevel} srcSet={srcSet} tab={tab} {...props} src={href} />
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
          img: ({ node, src, ...props }) => {
            const url = IMGPROXY_URL_REGEXP.test(src) ? decodeOriginalUrl(src) : src
            // if `srcSet` is undefined, it means the image was not processed by worker yet
            // if `srcSet` is null, image was processed but this specific url was not detected as an image by the worker
            const srcSet = imgproxyUrls ? (imgproxyUrls[url] || null) : undefined
            return <ZoomableImage topLevel={topLevel} srcSet={srcSet} tab={tab} src={src} {...props} />
          }
        }}
        remarkPlugins={[gfm, mention, sub, remarkDirective, searchHighlighter]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
