import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
/* Use `…/dist/cjs/…` if you’re not in ESM! */
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import mention from '../lib/remark-mention'
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'

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
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
                )
              : (
                <code className={className} style={atomDark} {...props}>
                  {children}
                </code>
                )
          },
          a: ({ node, ...props }) => <a target='_blank' rel={nofollow ? 'nofollow' : null} {...props} />
        }}
        remarkPlugins={[gfm, mention, remarkDirective, myRemarkPlugin]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
