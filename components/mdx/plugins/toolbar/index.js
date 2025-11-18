import {
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  ConditionalContents,
  DiffSourceToggleWrapper,
  Separator,
  ShowSandpackInfo,
  StrikeThroughSupSubToggles
} from '@mdxeditor/editor'
import BlockDropdown from './pieces/block-dropdown'

export default function FullToolbar ({ isEdit }) {
  return (
    <DiffSourceToggleWrapper
      options={isEdit
        ? ['rich-text', 'source', 'diff']
        : ['rich-text', 'source']}
    >
      <ConditionalContents
        options={[
          {
            when: (editor) => (editor?.editorType) === 'codeblock',
            contents: () => <ChangeCodeMirrorLanguage />
          },
          {
            when: (editor) => (editor?.editorType) === 'sandpack',
            contents: () => <ShowSandpackInfo />
          },
          {
            fallback: () => (
              <>
                <BlockDropdown />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <StrikeThroughSupSubToggles />
              </>
            )
          }
        ]}
      />
    </DiffSourceToggleWrapper>
  )
}
