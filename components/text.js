import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
/* Use `…/dist/cjs/…` if you’re not in ESM! */
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import mention from '../lib/remark-mention'
import sub from '../lib/remark-sub'
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'
import reactStringReplace from 'react-string-replace'

function myRemarkPlugin () {
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

export default function Text ({ nofollow, children }) {
  // all the reactStringReplace calls are to facilitate search highlighting
  return (
    <div className={styles.text}>
      <ReactMarkdown
        components={{
          h1: 'h6',
          h2: 'h6',
          h3: 'h6',
          h4: 'h6',
          h5: 'h6',
          h6: 'h6',
          table: ({ node, ...props }) =>
            <div className='table-responsive'>
              <table className='table table-bordered table-sm' {...props} />
            </div>,
          code ({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline
              ? (
                <SyntaxHighlighter showLineNumbers style={atomDark} language={match && match[1]} PreTag='div' {...props}>
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
            children = children?.map(e => typeof e === 'string'
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
          }
        }}
        remarkPlugins={[gfm, mention, sub, remarkDirective, myRemarkPlugin]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
