import { gql, useQuery, useLazyQuery } from '@apollo/client'
import { useState, useRef, useEffect } from 'react'
import styles from './ai-summary.module.css'
import Overlay from 'react-bootstrap/Overlay'
import Popover from 'react-bootstrap/Popover'
import Button from 'react-bootstrap/Button'

const ITEM_SUMMARY = gql`
  query ItemSummary($id: ID!) {
    item(id: $id) {
      id
      aiSummary {
        id
        text
        sources
      }
    }
  }
`

const GET_CLARIFICATION = gql`
  query GetClarification($itemId: ID!, $term: String!) {
    getClarification(itemId: $itemId, term: $term) {
      id
      term
      text
    }
  }
`

export default function AiSummary({ itemId }) {
    const { data, loading, error } = useQuery(ITEM_SUMMARY, {
        variables: { id: itemId }
    })
    const [getClarification, { data: clarificationData, loading: clarificationLoading }] = useLazyQuery(GET_CLARIFICATION)

    const [selectedText, setSelectedText] = useState(null)
    const [selectionRange, setSelectionRange] = useState(null)
    const [showPopover, setShowPopover] = useState(false)
    const [popoverTarget, setPopoverTarget] = useState(null)
    const containerRef = useRef(null)

    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection()
            if (selection && selection.toString().length > 0 && containerRef.current && containerRef.current.contains(selection.anchorNode)) {
                const range = selection.getRangeAt(0)
                const rect = range.getBoundingClientRect()

                // Adjust rect relative to container or viewport as needed
                // For simplicity, we'll use a virtual element for the overlay target
                setPopoverTarget({
                    getBoundingClientRect: () => rect,
                    contextElement: containerRef.current
                })
                setSelectedText(selection.toString())
                setShowPopover(true)
            } else {
                setShowPopover(false)
            }
        }

        document.addEventListener('mouseup', handleSelection)
        return () => document.removeEventListener('mouseup', handleSelection)
    }, [])

    const handleClarify = () => {
        if (selectedText) {
            getClarification({ variables: { itemId, term: selectedText } })
        }
    }

    if (loading) return <div>Loading AI summary...</div>
    if (error) return <div>Error loading summary</div>
    if (!data?.item?.aiSummary) return <div>No summary available</div>

    const { text } = data.item.aiSummary

    return (
        <div className={styles.container} ref={containerRef}>
            <h3>AI Summary</h3>
            <div className={styles.summaryText}>
                {text}
            </div>

            <Overlay
                show={showPopover}
                target={popoverTarget}
                placement="top"
                container={containerRef}
                rootClose
                onHide={() => setShowPopover(false)}
            >
                <Popover id="popover-basic">
                    <Popover.Header as="h3">Actions</Popover.Header>
                    <Popover.Body>
                        <Button size="sm" onClick={handleClarify} disabled={clarificationLoading}>
                            {clarificationLoading ? 'Asking AI...' : 'Ask AI for Clarification'}
                        </Button>
                        {clarificationData && (
                            <div className="mt-2">
                                <strong>{clarificationData.getClarification.term}:</strong>
                                <p>{clarificationData.getClarification.text}</p>
                            </div>
                        )}
                    </Popover.Body>
                </Popover>
            </Overlay>
        </div>
    )
}
