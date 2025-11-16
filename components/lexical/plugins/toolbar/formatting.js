import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import More from '@/svgs/lexical/font-style.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { useClientShortcut } from '@/lib/lexical/extensions/core/shortcuts/keyboard'
import { ToolbarIcon, BLOCK_OPTIONS, MAIN_TOOLBAR_OPTIONS, ADDITIONAL_FORMAT_OPTIONS, ALIGN_OPTIONS } from './defs/formatting'
import ActionTooltip from '@/components/action-tooltip'
import InsertTools from './insert'
import { ToolbarDropdown, ToolbarButton } from './index'
import { SN_FORMAT_TEXT_COMMAND } from '@/lib/lexical/universal/commands/formatting/inline'

function BlockOptionsDropdown ({ editor, toolbarState }) {
  const blockOption = !toolbarState.markdownMode
    ? BLOCK_OPTIONS.find(option => option.id === toolbarState.blockType)
    : null

  return (
    <ToolbarDropdown
      icon={<ToolbarIcon id={blockOption?.id || 'paragraph'} />}
      tooltip={<>block options{!toolbarState.markdownMode && <><strong> {toolbarState.blockType}</strong></>}</>}
      options={BLOCK_OPTIONS}
      activeOptionId={toolbarState.blockType}
      editor={editor}
    />
  )
}

function MainToolbarOption ({ option, editor, toolbarState, isFloating }) {
  const shortcut = useClientShortcut(option.id)
  // block category uses toolbarState.blockType
  // other categories can use toolbarState[option.lookup]
  const isActive = option.category === 'block'
    ? toolbarState.blockType === option.id
    : option.lookup
      ? toolbarState[option.lookup]
      : false

  const tooltipText = shortcut ? `${option.name} ${shortcut}` : option.name

  return (
    <>
      <ActionTooltip
        notForm
        overlayText={tooltipText}
        placement='top'
        noWrapper
        showDelay={500}
        transition
        disable={isFloating}
      >
        <span
          title={tooltipText}
          className={classNames(styles.toolbarItem, isActive ? styles.active : '')}
          style={option.style}
          onClick={() => option.handler({ editor })}
          onPointerDown={e => e.preventDefault()}
        >
          <ToolbarIcon id={option.id} state={isActive && 'active'} />
        </span>
      </ActionTooltip>
      {option.id === 'italic' && <span className={styles.divider} />}
    </>
  )
}

function MainToolbarOptions ({ editor, toolbarState, isFloating }) {
  return MAIN_TOOLBAR_OPTIONS.map((option) => (
    <MainToolbarOption
      key={option.id}
      option={option}
      editor={editor}
      toolbarState={toolbarState}
      isFloating={isFloating}
    />
  ))
}

function AlignOptionsDropdown ({ editor, toolbarState }) {
  const alignOption = !toolbarState.markdownMode
    ? ALIGN_OPTIONS.find(option => option.id === toolbarState.elementFormat)
    : null

  return (
    <ToolbarDropdown
      icon={<ToolbarIcon id={alignOption?.id || 'left'} />}
      tooltip={<>align options{!toolbarState.markdownMode && <><strong> {toolbarState.elementFormat || 'left'}</strong></>}</>}
      options={ALIGN_OPTIONS}
      activeOptionId={toolbarState.elementFormat}
      editor={editor}
    />
  )
}

function AdditionalFormattingOptionsDropdown ({ editor, toolbarState }) {
  return (
    <ToolbarDropdown
      icon={<More />}
      tooltip='additional formatting options'
      options={ADDITIONAL_FORMAT_OPTIONS}
      getIsActive={(lookup) => toolbarState[lookup]}
      editor={editor}
    />
  )
}

export default function FormattingTools ({ isFloating, className, toolbarRef, hasOverflow }) {
  const [editor] = useLexicalComposerContext()
  const { toolbarState } = useToolbarState()

  if (isFloating) {
    return (
      <div className={styles.toolbarFormatting}>
        <MainToolbarOptions editor={editor} toolbarState={toolbarState} isFloating />
        <span className={classNames(styles.divider)} />
        <ToolbarButton id='subscript' isActive={toolbarState.isSubscript} onClick={() => editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'subscript')} tooltip='subscript' />
        <ToolbarButton id='superscript' isActive={toolbarState.isSuperscript} onClick={() => editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, 'superscript')} tooltip='superscript' />
      </div>
    )
  }

  return (
    <div
      ref={toolbarRef}
      className={classNames(styles.toolbarFormatting, hasOverflow && styles.hasOverflow, className)}
    >
      <BlockOptionsDropdown editor={editor} toolbarState={toolbarState} />
      <MainToolbarOptions editor={editor} toolbarState={toolbarState} />
      <span className={classNames(styles.divider)} />
      <AlignOptionsDropdown editor={editor} toolbarState={toolbarState} />
      <AdditionalFormattingOptionsDropdown editor={editor} toolbarState={toolbarState} />
      <span className={classNames(styles.divider)} />
      <InsertTools />
    </div>
  )
}
