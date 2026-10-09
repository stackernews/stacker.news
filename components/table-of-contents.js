import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { Combobox, ComboboxPopup, ComboboxList, ComboboxItem } from '@/components/ui/combobox'
import { inputClasses } from '@/components/form'
import { cn } from '@/lib/cn'
import TocIcon from '@/svgs/list-unordered.svg'
import { $extractHeadingsFromRoot } from '@/lib/lexical/utils/toc'
import { AccordionCard } from './accordion-item'
import useDesktopSidebar from './use-desktop-sidebar'

export default function Toc ({ text, readerRef, containerRef }) {
  const router = useRouter()
  const desktopSidebar = useDesktopSidebar()
  const [container, setContainer] = useState(null)

  useEffect(() => {
    setContainer(desktopSidebar ? containerRef?.current ?? null : null)
  }, [desktopSidebar, containerRef])

  const toc = useMemo(() => {
    if (!readerRef || !text || text.length === 0) return []
    // access the lexical editor state and extract the headings
    return readerRef.getEditorState().read($extractHeadingsFromRoot)
  }, [readerRef, text])

  if (toc.length === 0) {
    return null
  }

  // Native anchors need this event to expand clipped post text before scrolling.
  const onHeadingClick = slug => router.events.emit('hashChangeStart', `#${slug}`, { shallow: true })

  return (
    <>
      {container && createPortal(
        <AccordionCard show header={<small className='text-muted font-bold'>table of contents</small>}>
          <nav aria-label='table of contents'>
            <ol className='m-0 list-none px-0 py-2'>
              {toc.map(h => (
                <li key={h.key} style={{ paddingLeft: `${(h.depth - 1) * 8}px` }}>
                  <a
                    href={`#${h.slug}`}
                    className={cn('block py-1 text-sm text-muted hover:text-reset wrap-break-word', h.depth === 1 && 'font-bold')}
                    onClick={() => onHeadingClick(h.slug)}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </AccordionCard>,
        container
      )}
      <Combobox.Root items={toc} value={null} itemToStringLabel={h => h.text}>
        <Combobox.Trigger aria-label='table of contents' nativeButton={false} render={<span className={cn('flex items-center', container && 'md:hidden')} />}>
          <TocIcon width={20} height={20} className='mx-2 theme' />
        </Combobox.Trigger>
        <ComboboxPopup align='end'>
          <Combobox.Input placeholder='filter' className={inputClasses({ className: 'mx-4 my-2 w-auto' })} />
          <ComboboxList>
            {h => (
              <ComboboxItem
                key={h.key} value={h} render={<a href={`#${h.slug}`} />}
                className={cn('w-auto', h.depth === 1 && 'font-bold')}
                style={{ marginLeft: `${(h.depth - 1) * 5}px` }}
                // This also fires for keyboard selection because Enter clicks the anchor.
                onClick={() => onHeadingClick(h.slug)}
              >
                {h.text}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox.Root>
    </>
  )
}
