import React from 'react'
import PropType from 'prop-types'

function eventToPosition (event) {
  return {
    x: event.clientX,
    y: event.clientY
  }
}

function distance (pointA, pointB) {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)
  )
}

export default class LongPressable extends React.PureComponent {
  static propTypes = {
    onLongPress: PropType.func.isRequired,
    onShortPress: PropType.func,
    longPressTime: PropType.number,
    primaryMouseButtonOnly: PropType.bool,
    // Maximum distance (pixels) user is allowed to drag before
    // click is canceled
    dragThreshold: PropType.number,
    children: PropType.node
  }

  static defaultProps = {
    longPressTime: 500,
    primaryMouseButtonOnly: true,
    dragThreshold: 100
  }

  isLongPressing = false
  startingPosition = { x: 0, y: 0 }

  componentWillUnmount () {
    this.clearTimeout()
  }

  clearTimeout = () => {
    if (this.timerID) {
      clearTimeout(this.timerID)
      this.timerID = null
    }
  }

  handlePointerUp = (e) => {
    if (this.timerID) {
      this.cancelLongPress()
    }

    const mousePosition = eventToPosition(e)

    if (!this.isLongPressing &&
        !this.exceedDragThreshold(mousePosition)) {
      this.props.onShortPress(e)
    } else {
      this.isLongPressing = false
    }
  }

  handlePointerDown = (e) => {
    if (this.props.primaryMouseButtonOnly) {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        return
      }
    }

    // re-initialize long press
    this.isLongPressing = false
    this.startingPosition = eventToPosition(e)

    this.timerID = setTimeout(() => {
      this.isLongPressing = true
      this.props.onLongPress(e)
    }, this.props.longPressTime)
  }

  handlePointerMove = (e) => {
    const mousePosition = eventToPosition(e)
    if (this.timerID && this.exceedDragThreshold(mousePosition)) {
      this.cancelLongPress()
    }
  }

  handlePointerLeave = () => {
    if (this.timerID) {
      this.cancelLongPress()
    }
  }

  cancelLongPress () {
    this.clearTimeout()
  }

  exceedDragThreshold (point) {
    return distance(this.startingPosition, point) > this.props.dragThreshold
  }

  render () {
    return (
      <div
        onPointerUp={this.handlePointerUp}
        onPointerDown={this.handlePointerDown}
        onPointerMove={this.handlePointerMove}
        onPointerLeave={this.handlePointerLeave}
      >
        {this.props.children}
      </div>
    )
  }
}
