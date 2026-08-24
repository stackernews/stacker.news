import { useMemo } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { useRouter } from 'next/router'
import { popoverClasses } from '@/components/ui/popover'
import popoverStyles from '@/components/ui/popover.module.css'
import { itemClasses } from '@/components/ui/menu'
import { inputClasses } from '@/components/form'
import TocIcon from '@/svgs/list-unordered.svg'
import { $extractHeadingsFromRoot } from '@/lib/lexical/utils/toc'

export default function Toc ({ text, readerRef }) {
  const router = useRouter()

  const toc = useMemo(() => {
    if (!readerRef || !text || text.length === 0) return []
    // access the lexical editor state and extract the headings
    return readerRef.getEditorState().read($extractHeadingsFromRoot)
  }, [readerRef, text])

  if (toc.length === 0) {
    return null
  }

  return (
    <Combobox.Root items={toc} value={null} itemToStringLabel={h => h.text || h.heading}>
      <Combobox.Trigger aria-label='Table of contents' nativeButton={false} render={<span className='flex items-center mb-1' />}>
        <TocIcon width={20} height={20} className='mx-2 theme' />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align='end' sideOffset={2} className={popoverStyles.positioner}>
          <Combobox.Popup className={popoverClasses()}>
            <Combobox.Input placeholder='filter' className={inputClasses({ className: 'mx-4 my-2 w-auto' })} />
            <Combobox.List className='list-none ps-0 mb-0 text-base'>
              {h => (
                <Combobox.Item
                  key={h.slug} value={h} render={<a href={`#${h.slug}`} />}
                  className={itemClasses({ className: h.depth === 1 ? 'font-bold' : '' })}
                  style={{ marginLeft: `${(h.depth - 1) * 5}px` }}
                  // nextjs router doesn't emit hashChangeStart events;
                  // this fires for pointer and keyboard since Enter is a native
                  // listItem.click(), and onValueChange never fires for anchor
                  // items (don't add the emit there)
                  onClick={() => router.events.emit('hashChangeStart', `#${h.slug}`, { shallow: true })}
                >
                  {h.text || h.heading}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
