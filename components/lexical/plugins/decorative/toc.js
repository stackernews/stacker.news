import Link from 'next/link'
import { buildNestedTocStructure } from '@/lib/lexical/nodes/misc/toc'

/**
 * recursively renders table of contents items with nested structure

 * @param {Object} props.item - toc item with text, slug, and optional children
 * @param {number} props.index - item index for key generation
 * @returns {JSX.Element} list item with nested children
 */
function TocItem ({ item, index }) {
  const hasChildren = item.children && item.children.length > 0
  return (
    <li key={`${item.slug}-${index}`}>
      <Link href={`#${item.slug}`}>
        {item.text}
      </Link>
      {hasChildren && (
        <ul>
          {item.children.map((child, idx) => (
            <TocItem key={`${child.slug}-${idx}`} item={child} index={idx} />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * displays a collapsible table of contents from heading data

 * @param {Array} props.headings - array of heading objects with text, depth, and slug
 * @returns {JSX.Element} collapsible details element with toc list
 */
export function TableOfContents ({ headings }) {
  const tocItems = buildNestedTocStructure(headings)

  return (
    <details className='sn__toc'>
      <summary>table of contents</summary>
      {tocItems.length > 0
        ? (
          <ul>
            {tocItems.map((item, index) => (
              <TocItem key={`${item.slug}-${index}`} item={item} index={index} />
            ))}
          </ul>
          )
        : <div className='text-muted fst-italic'>no headings</div>}
    </details>
  )
}
