import { Select, useCellValue, currentBlockType$ } from '@mdxeditor/editor'

export default function BlockDropdown () {
  const currentBlockType = useCellValue(currentBlockType$)

  return (
    <Select
      value={currentBlockType}
      onChange={(blockType) => {
        console.log('blockType', blockType)
      }}
      items={[
        {
          label: 'Paragraph',
          value: 'paragraph'
        },
        {
          label: 'Heading',
          value: 'heading'
        }
      ]}
      triggerTitle='block type'
    />
  )
}
