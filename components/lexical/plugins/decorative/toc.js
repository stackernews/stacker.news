import Link from 'next/link'
import { buildNestedTocStructure } from '@/lib/lexical/nodes/misc/toc'

// recursively renders TOC items with nested structure
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

// receives {text, depth, slug} array from lexical
export function TableOfContents ({ headings }) {
  const tocItems = buildNestedTocStructure(headings)

  if (!tocItems || tocItems.length === 0) {
    return (
      <details className='sn__toc'>
        <summary>table of contents</summary>
        <div className='text-muted fst-italic'>no headings</div>
      </details>
    )
  }

  return (
    <details className='sn__toc'>
      <summary>table of contents</summary>
      <ul>
        {tocItems.map((item, index) => (
          <TocItem key={`${item.slug}-${index}`} item={item} index={index} />
        ))}
      </ul>
    </details>
  )
}
