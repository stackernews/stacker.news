import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import BootstrapForm from 'react-bootstrap/Form'
import { useFormikContext, useField } from 'formik'
import ReactSelect, { components as ReactSelectComponents } from 'react-select'
import ArrowDownSFill from '@/svgs/arrow-down-s-fill.svg'
import CloseIcon from '@/svgs/close-line.svg'
import CheckIcon from '@/svgs/check-line.svg'
import Info from './info'
import styles from './multi-select.module.css'
import classNames from 'classnames'

function useIsMobile () {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    setIsMobile(mql.matches)

    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}

function FormGroup ({ className, label, children }) {
  return (
    <BootstrapForm.Group className={`form-group ${className}`}>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      {children}
    </BootstrapForm.Group>
  )
}

const DropdownIndicator = (props) => {
  const { selectProps } = props
  const size = selectProps.size || 'md'
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20
  return (
    <div className={styles.dropdownIndicator}>
      <ArrowDownSFill width={iconSize} height={iconSize} className='fill-grey' />
    </div>
  )
}

const ClearIndicator = (props) => {
  const { innerProps, selectProps } = props
  const size = selectProps.size || 'md'
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16
  return (
    <div {...innerProps} className={styles.clearIndicator}>
      <CloseIcon width={iconSize} height={iconSize} className='fill-grey' />
    </div>
  )
}

const MultiValueRemove = (props) => {
  const { innerProps } = props
  return (
    <div {...innerProps} className={styles.multiValueRemove}>
      <CloseIcon width={14} height={14} className='fill-grey' />
    </div>
  )
}

// Custom indicators container to put clear button on the outer right
const IndicatorsContainer = (props) => {
  const { children, ...rest } = props
  // children is an array: [ClearIndicator, IndicatorSeparator, DropdownIndicator]
  // Reverse to put dropdown first, then clear on the outside
  const reversed = children ? [...children].reverse() : children
  return (
    <ReactSelectComponents.IndicatorsContainer {...rest}>
      {reversed}
    </ReactSelectComponents.IndicatorsContainer>
  )
}

export function MultiSelect ({ label, items, size = 'lg', info, groupClassName, onChange, noForm, overrideValue, hint, placeholder, onValueClick, ...props }) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()
  const invalid = meta.touched && meta.error
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
    }
  }, [overrideValue])

  // Convert items to react-select option format, handling grouped items
  const options = items.map(item => {
    if (item && typeof item === 'object' && item.label && item.items) {
      // Handle grouped items (e.g., muted subs)
      return {
        label: item.label,
        options: item.items.map(subItem => ({ label: subItem, value: subItem }))
      }
    }
    return { label: item, value: item }
  })

  // Flatten options to get all possible values for matching
  const flatOptions = options.flatMap(opt =>
    opt.options ? opt.options : [opt]
  )

  // Convert formik's string array to react-select's object array format for display
  const currentValue = field.value || props.value || []
  const selectValue = flatOptions.filter(option => currentValue.includes(option.value))

  const handleChange = (values) => {
    helpers?.setValue?.(values)
    if (onChange) {
      onChange(formik, values)
    }
  }

  const toggleOption = (optionValue) => {
    const newValues = currentValue.includes(optionValue)
      ? currentValue.filter(v => v !== optionValue)
      : [...currentValue, optionValue]
    handleChange(newValues)
  }

  const removeValue = (valueToRemove, e) => {
    e?.stopPropagation?.()
    handleChange(currentValue.filter(v => v !== valueToRemove))
  }

  const clearAll = (e) => {
    e?.stopPropagation?.()
    handleChange([])
  }

  const MultiValueLabel = (props) => {
    const { data } = props

    const handleMouseDown = (e) => {
      if (onValueClick) {
        e.preventDefault()
        e.stopPropagation()
        onValueClick(data.value)
      }
    }

    return (
      <div
        onMouseDown={handleMouseDown}
        className={onValueClick ? styles.multiValueLabelClickable : styles.multiValueLabelDefault}
      >
        <ReactSelectComponents.MultiValueLabel {...props} />
      </div>
    )
  }

  // Mobile bottom sheet version
  if (isMobile) {
    return (
      <FormGroup label={label} className={groupClassName}>
        <span className='d-flex align-items-center'>
          {/* Custom control that mimics react-select appearance */}
          <div
            className={classNames(styles.multiSelect, styles[size], invalid && styles.isInvalid, styles.mobileControl)}
            onClick={() => setSheetOpen(true)}
          >
            <div className={styles.mobileValueContainer}>
              {selectValue.length === 0 && (
                <span className={styles.mobilePlaceholder}>{placeholder}</span>
              )}
              {selectValue.map(opt => (
                <div key={opt.value} className={styles.mobileMultiValue}>
                  <span
                    className={onValueClick ? styles.multiValueLabelClickable : styles.multiValueLabelDefault}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onValueClick) {
                        onValueClick(opt.value)
                      } else {
                        setSheetOpen(true)
                      }
                    }}
                  >
                    {opt.label}
                  </span>
                  <div
                    className={styles.mobileMultiValueRemove}
                    onClick={(e) => removeValue(opt.value, e)}
                  >
                    <CloseIcon width={10} height={10} />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.mobileIndicators}>
              <div className={styles.dropdownIndicator}>
                <ArrowDownSFill width={20} height={20} className='fill-grey' />
              </div>
              {currentValue.length > 0 && (
                <div className={styles.mobileClearIndicator} onClick={clearAll}>
                  <CloseIcon width={16} height={16} className='fill-grey' />
                </div>
              )}
            </div>
          </div>
          {info && <Info>{info}</Info>}
        </span>

        {/* Bottom Sheet */}
        <BottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          options={options}
          currentValue={currentValue}
          onToggle={(value) => {
            toggleOption(value)
            setSheetOpen(false)
          }}
          placeholder={placeholder}
        />

        <BootstrapForm.Control.Feedback type='invalid' className={meta.touched && meta.error ? 'd-block' : ''}>
          {meta.touched && meta.error}
        </BootstrapForm.Control.Feedback>
        {hint &&
          <BootstrapForm.Text>
            {hint}
          </BootstrapForm.Text>}
      </FormGroup>
    )
  }

  // Desktop react-select version
  return (
    <FormGroup label={label} className={groupClassName}>
      <span className='d-flex align-items-center'>
        <ReactSelect
          maxMenuHeight={432}
          menuPlacement='auto'
          instanceId={field.name + '-multi-select'}
          name={field.name}
          className={classNames(styles.multiSelect, styles[size], invalid && styles.isInvalid)}
          classNamePrefix='ms'
          value={selectValue}
          placeholder={placeholder}
          defaultValue={[]}
          isMulti
          size={size}
          options={options}
          components={{ DropdownIndicator, ClearIndicator, MultiValueRemove, MultiValueLabel, IndicatorsContainer }}
          onChange={(selectedOptions) => {
            // Extract just the string values for formik
            const values = selectedOptions ? selectedOptions.map(item => item.value) : []
            handleChange(values)
          }}
          unstyled={false}
        />
        {info && <Info>{info}</Info>}
      </span>
      <BootstrapForm.Control.Feedback type='invalid' className={meta.touched && meta.error ? 'd-block' : ''}>
        {meta.touched && meta.error}
      </BootstrapForm.Control.Feedback>
      {hint &&
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>}
    </FormGroup>
  )
}

function SheetOption ({ option, isSelected, onToggle }) {
  return (
    <div
      className={classNames(styles.sheetOption, isSelected && styles.sheetOptionSelected)}
      onClick={onToggle}
    >
      <span className={styles.sheetOptionLabel}>{option.label}</span>
      {isSelected && <CheckIcon width={20} height={20} className='fill-grey' />}
    </div>
  )
}

function BottomSheet ({ isOpen, onClose, options, currentValue, onToggle, placeholder }) {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [viewportInfo, setViewportInfo] = useState(null)
  const dragStartY = useRef(0)
  const sheetRef = useRef(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle keyboard visibility using visualViewport
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return

    const updateViewport = () => {
      if (window.visualViewport) {
        // Calculate how far from the bottom of the window the visual viewport ends
        const bottomOffset = window.innerHeight - (window.visualViewport.offsetTop + window.visualViewport.height)
        setViewportInfo({
          height: window.visualViewport.height,
          bottomOffset
        })
      } else {
        setViewportInfo({ height: window.innerHeight, bottomOffset: 0 })
      }
    }

    updateViewport()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport)
      window.visualViewport.addEventListener('scroll', updateViewport)
      return () => {
        window.visualViewport.removeEventListener('resize', updateViewport)
        window.visualViewport.removeEventListener('scroll', updateViewport)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      // Lock body scroll (works better across Android/iOS)
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'
      setSearch('')
      setDragY(0)
      setViewportInfo(null)
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1)
      }
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e) => {
    if (!isDragging) return
    const currentY = e.touches[0].clientY
    const diff = currentY - dragStartY.current
    // Only allow dragging down
    if (diff > 0) {
      setDragY(diff)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    // If dragged more than 100px, close the sheet
    if (dragY > 100) {
      onClose()
    }
    setDragY(0)
  }

  // Filter options based on search
  const filterOptions = (opts) => {
    if (!search) return opts
    const searchLower = search.toLowerCase()
    return opts.map(opt => {
      if (opt.options) {
        // Grouped options
        const filteredSubs = opt.options.filter(sub =>
          sub.label.toLowerCase().includes(searchLower)
        )
        if (filteredSubs.length === 0) return null
        return { ...opt, options: filteredSubs }
      }
      // Regular option
      return opt.label.toLowerCase().includes(searchLower) ? opt : null
    }).filter(Boolean)
  }

  const filteredOptions = filterOptions(options)

  if (!mounted) return null

  return createPortal(
    <div className={classNames(styles.sheetOverlay, isOpen && styles.sheetOpen)}>
      <div className={styles.sheetBackdrop} onClick={onClose} />
      <div
        ref={sheetRef}
        className={styles.sheetContainer}
        style={{
          transform: isOpen ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 0.3s ease',
          bottom: viewportInfo?.bottomOffset ? `${viewportInfo.bottomOffset}px` : '0',
          maxHeight: viewportInfo ? `${Math.min(viewportInfo.height * 0.85, viewportInfo.height - 20)}px` : '70vh'
        }}
      >
        <div
          className={styles.sheetHeader}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.sheetHandle} />
        </div>
        <div className={styles.sheetSearch}>
          <input
            type='text'
            className={styles.sheetSearchInput}
            placeholder={placeholder || 'Search...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={(e) => {
              // Close if blur is not to something inside the sheet
              if (!e.relatedTarget || !sheetRef.current?.contains(e.relatedTarget)) {
                // Delay to allow click events to fire first (longer for Android)
                setTimeout(() => onClose(), 150)
              }
            }}
            autoFocus
          />
          {search && (
            <button
              className={styles.sheetSearchClear}
              onClick={() => setSearch('')}
              type='button'
            >
              <CloseIcon width={16} height={16} className='fill-grey' />
            </button>
          )}
        </div>
        <div className={styles.sheetContent}>
          {filteredOptions.map((opt) => {
            // Handle grouped options
            if (opt.options) {
              return (
                <div key={opt.label} className={styles.sheetGroup}>
                  <div className={styles.sheetGroupLabel}>{opt.label}</div>
                  {opt.options.map(subOpt => (
                    <SheetOption
                      key={subOpt.value}
                      option={subOpt}
                      isSelected={currentValue.includes(subOpt.value)}
                      onToggle={() => onToggle(subOpt.value)}
                    />
                  ))}
                </div>
              )
            }
            // Regular option
            return (
              <SheetOption
                key={opt.value}
                option={opt}
                isSelected={currentValue.includes(opt.value)}
                onToggle={() => onToggle(opt.value)}
              />
            )
          })}
          {filteredOptions.length === 0 && (
            <div className={styles.sheetNoResults}>No results found</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
