import styles from './text.module.css'
// import ReactMarkdown from 'react-markdown'
// import gfm from 'remark-gfm'
import React, { useState, useRef, useCallback } from 'react'
// import MediaOrLink from './media-or-link'
// import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'
import reactStringReplace from 'react-string-replace'
import { Button } from 'react-bootstrap'
// import Link from 'next/link'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
// import SubPopover from './sub-popover'
// import UserPopover from './user-popover'
// import ItemPopover from './item-popover'
import classNames from 'classnames'
// import { CarouselProvider, useCarousel } from './carousel'
// import rehypeSN from '@/lib/rehype-sn'
// import remarkUnicode from '@/lib/remark-unicode'
// import Embed from './embed'
// import remarkMath from 'remark-math'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { TRANSFORMERS, $convertFromMarkdownString } from '@lexical/markdown'
import theme from './lexical/theme'
import { $getRoot } from 'lexical'
import CodeShikiPlugin from './lexical/plugins/codeshiki'

/* const rehypeSNStyled = () => rehypeSN({
  stylers: [{
    startTag: '<sup>',
    endTag: '</sup>',
    className: styles.superscript
  }, {
    startTag: '<sub>',
    endTag: '</sub>',
    className: styles.subscript
  }]
}) */

export function SearchText ({ text }) {
  return (
    <div className={styles.text}>
      <p className={styles.p}>
        {reactStringReplace(text, /\*\*\*([^*]+)\*\*\*/g, (match, i) => {
          return <mark key={`strong-${match}-${i}`}>{match}</mark>
        })}
      </p>
    </div>
  )
}

// this is one of the slowest components to render
export default function Text ({ rel = UNKNOWN_LINK_REL, imgproxyUrls, children, tab, itemId, outlawed, topLevel }) {
  // TODO: there's a slight render delay on full refresh because the editor state is converted from markdown to json
  // so probably legacy markdown content will have a slight render delay
  // or we convert them ahead of time to json

  // TODO: add support for imgproxyUrls
  // TODO: disable links if outlawed
  // TODO: what about MathJax?
  // TODO: handle overflowing
  // TODO: carousel
  const containerRef = useRef(null)
  const [show, setShow] = useState(false)
  const [overflowing] = useState(false)
  const showOverflow = useCallback(() => setShow(true), [setShow])

  const initial = {
    namespace: 'snEditor',
    editable: false,
    theme,
    editorState: () => { // WIP: this is a hack to set the theme for the code nodes
      const editorState = $convertFromMarkdownString(children, TRANSFORMERS)

      // Set theme for CodeNodes after conversion
      const root = $getRoot()
      root.getChildren().forEach(node => {
        if (node.getType() === 'code') {
          node.setTheme('github-dark-default')
        }
      })

      return editorState
    },
    onError: (error) => {
      console.error(error)
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode,
      HorizontalRuleNode
    ]
  }

  return (
    <>
      <LexicalComposer initialConfig={initial}>
        <RichTextPlugin
          contentEditable={
            <div className={styles.editorInput} ref={containerRef}>
              <ContentEditable className={classNames(
                styles.text,
                topLevel && styles.topLevel,
                show ? styles.textUncontained : overflowing && styles.textContained)}
              />
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <CodeShikiPlugin />
      </LexicalComposer>
      {overflowing && !show && (
        <Button
          size='lg'
          variant='info'
          className={styles.textShowFull}
          onClick={showOverflow}
        >
          show full text
        </Button>
      )}
    </>
  )

  /* const components = useMemo(() => ({
    h1: ({ node, id, ...props }) => <h1 id={topLevel ? id : undefined} {...props} />,
    h2: ({ node, id, ...props }) => <h2 id={topLevel ? id : undefined} {...props} />,
    h3: ({ node, id, ...props }) => <h3 id={topLevel ? id : undefined} {...props} />,
    h4: ({ node, id, ...props }) => <h4 id={topLevel ? id : undefined} {...props} />,
    h5: ({ node, id, ...props }) => <h5 id={topLevel ? id : undefined} {...props} />,
    h6: ({ node, id, ...props }) => <h6 id={topLevel ? id : undefined} {...props} />,
    table: Table,
    p: P,
    code: Code,
    mention: Mention,
    sub: Sub,
    item: Item,
    footnote: Footnote,
    headlink: ({ node, href, ...props }) => <Link href={href} {...props} />,
    autolink: ({ href, ...props }) => <TextMediaOrLink src={href} {...props} />,
    a: ({ node, href, children, ...props }) => {
      // if outlawed, render the link as text
      if (outlawed) {
        return href
      }
      const isHashLink = href.startsWith('#')
      // eslint-disable-next-line
      return <Link id={props.id} target={isHashLink ? undefined : '_blank'} rel={rel} href={href}>{children}</Link>
    },
    img: TextMediaOrLink,
    embed: (props) => <Embed {...props} topLevel={topLevel} />
  }), [outlawed, rel, TextMediaOrLink, topLevel])

  const carousel = useCarousel()

  const markdownContent = useMemo(() => (
    <ReactMarkdown
      components={components}
      remarkPlugins={remarkPlugins}
      rehypePlugins={[rehypeSNStyled, mathJaxPlugin].filter(Boolean)}
      remarkRehypeOptions={{ clobberPrefix: `itemfn-${itemId}-` }}
    >
      {children}
    </ReactMarkdown>
  ), [components, remarkPlugins, mathJaxPlugin, children, itemId])

  // const showOverflow = useCallback(() => setShow(true), [setShow])

  return (
    <div
      className={classNames(
        styles.text,
        topLevel && styles.topLevel,
        show ? styles.textUncontained : overflowing && styles.textContained
      )}
      ref={containerRef}
    >
      {
        carousel && tab !== 'preview'
          ? markdownContent
          : <CarouselProvider>{markdownContent}</CarouselProvider>
      }
      {overflowing && !show && (
        <Button
          size='lg'
          variant='info'
          className={styles.textShowFull}
          onClick={showOverflow}
        >
          show full text
        </Button>
      )}
    </div>
  ) */
}

/*
function Mention ({ children, node, href, name, id }) {
  return (
    <UserPopover name={name}>
      <Link
        id={id}
        href={href}
      >
        {children}
      </Link>
    </UserPopover>
  )
}

function Sub ({ children, node, href, name, ...props }) {
  return (
    <SubPopover sub={name}>
      <Link href={href}>{children}</Link>
    </SubPopover>
  )
}

function Item ({ children, node, href, id }) {
  return (
    <ItemPopover id={id}>
      <Link href={href}>{children}</Link>
    </ItemPopover>
  )
}

function Footnote ({ children, node, ...props }) {
  return (
    <Link {...props}>{children}</Link>
  )
}

function MediaLink ({
  node, src, outlawed, imgproxyUrls, rel = UNKNOWN_LINK_REL, ...props
}) {
  const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
  // if outlawed, render the media link as text
  if (outlawed) {
    return url
  }

  const srcSet = imgproxyUrls?.[url]

  return <MediaOrLink srcSet={srcSet} src={src} rel={rel} {...props} />
}

function Table ({ node, ...props }) {
  return (
    <div className='table-responsive'>
      <table className='table table-bordered table-sm' {...props} />
    </div>
  )
}

// prevent layout shifting when the code block is loading
function CodeSkeleton ({ className, children, ...props }) {
  return (
    <div className='rounded' style={{ padding: '0.5em' }}>
      <code className={`${className}`} {...props}>
        {children}
      </code>
    </div>
  )
}

function Code ({ node, inline, className, children, style, ...props }) {
  const [ReactSyntaxHighlighter, setReactSyntaxHighlighter] = useState(null)
  const [syntaxTheme, setSyntaxTheme] = useState(null)
  const language = className?.match(/language-(\w+)/)?.[1] || 'text'

/*   const loadHighlighter = useCallback(() =>
    Promise.all([
      dynamic(() => import('react-syntax-highlighter').then(mod => mod.LightAsync), {
        ssr: false,
        loading: () => <CodeSkeleton className={className} {...props}>{children}</CodeSkeleton>
      }),
      import('react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark').then(mod => mod.default)
    ]), []
  )

  useEffect(() => {
    if (!inline && language !== 'math') { // MathJax should handle math
      // loading the syntax highlighter and theme only when needed
      loadHighlighter().then(([highlighter, theme]) => {
        setReactSyntaxHighlighter(() => highlighter)
        setSyntaxTheme(() => theme)
      })
    }
  }, [inline])

  if (inline || !ReactSyntaxHighlighter) { // inline code doesn't have a border radius
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  return (
    <>
      {ReactSyntaxHighlighter && syntaxTheme && (
        <ReactSyntaxHighlighter style={syntaxTheme} language={language} PreTag='div' customStyle={{ borderRadius: '0.3rem' }} {...props}>
          {children}
        </ReactSyntaxHighlighter>
      )}
    </>
  )
}

function P ({ children, node, onlyImages, somethingBefore, somethingAfter, ...props }) {
  return (
    <div
      className={classNames(styles.p, onlyImages && styles.onlyImages,
        somethingBefore && styles.somethingBefore, somethingAfter && styles.somethingAfter)} {...props}
    >
      {children}
    </div>
  )
}
*/
