import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import More from '@/svgs/lexical/font-style.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import { Fragment } from 'react'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { getShortcutCombo } from '@/components/lexical/extensions/core/shortcuts/keyboard'
import { ToolbarIcon, BLOCK_OPTIONS, MAIN_TOOLBAR_OPTIONS, ADDITIONAL_FORMAT_OPTIONS, ALIGN_OPTIONS } from './defs/formatting'
import ActionTooltip from '@/components/action-tooltip'
import InsertTools from './insert'
import { ToolbarDropdown } from './index'

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

function MainToolbarOptions ({ editor, toolbarState, isFloating }) {
  return MAIN_TOOLBAR_OPTIONS.map((option) => {
    const shortcut = getShortcutCombo(option.id)
    // block category uses toolbarState.blockType
    // other categories can use toolbarState[option.lookup]
    const isActive = option.category === 'block'
      ? toolbarState.blockType === option.id
      : option.lookup
        ? toolbarState[option.lookup]
        : false

    return (
      <Fragment key={option.id}>
        <ActionTooltip
          notForm
          overlayText={`${option.name} ${shortcut}`}
          placement='top'
          noWrapper
          showDelay={500}
          transition
          disable={isFloating}
        >
          <span
            title={`${option.name} (${shortcut})`}
            className={classNames(styles.toolbarItem, isActive ? styles.active : '')}
            style={option.style}
            onClick={() => option.handler({ editor })}
            onPointerDown={e => e.preventDefault()}
          >
            <ToolbarIcon id={option.id} state={isActive && 'active'} />
          </span>
        </ActionTooltip>
        {option.id === 'italic' && <span className={styles.divider} />}
      </Fragment>
    )
  })
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
