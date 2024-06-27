import React, { useState } from 'react'
import { Button } from 'react-bootstrap'
import { useQuery, gql } from '@apollo/client'
import Link from 'next/link'
import styles from '../styles/event-calendar.module.css'

const GET_EVENTS = gql`
  query GetEvents($startDate: Date!, $endDate: Date!) {
    events(startDate: $startDate, endDate: $endDate) {
      id
      title
      eventDate
      eventLocation
    }
  }
`

const EventCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

  const { loading, error, data } = useQuery(GET_EVENTS, {
    variables: { startDate, endDate }
  })

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const handleDayClick = (day) => {
    if (day !== '') {
      setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
    }
  }

  const handleMonthChange = (direction) => {
    const newMonth = currentDate.getMonth() + direction
    setCurrentDate(new Date(currentDate.getFullYear(), newMonth, 1))
    setSelectedDate(null)
  }

  const getEventsForDay = (day) => {
    if (!data || !data.events) return []
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    return data.events.filter(event => new Date(event.eventDate).toDateString() === date.toDateString())
  }

  const generateCalendar = () => {
    const daysInMonth = getDaysInMonth()
    const month = months[currentDate.getMonth()]
    const year = currentDate.getFullYear()
    const firstDay = new Date(year, currentDate.getMonth(), 1)
    const dayOfWeek = firstDay.getDay()

    const days = []
    for (let i = 0; i < dayOfWeek; i++) {
      days.push('')
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    while (days.length % 7 !== 0) {
      days.push('')
    }

    const weeks = []
    let week = []
    for (let i = 0; i < days.length; i++) {
      week.push(days[i])
      if ((i + 1) % 7 === 0) {
        weeks.push(week)
        week = []
      }
    }

    return (
      <div className={styles.calendarContainer}>
        <h2 className={styles.calendarHeader}>
          {month} {year}
        </h2>
        <div className={styles.calendarGrid}>
          {daysOfWeek.map((day, index) => (
            <div key={`header-${index}`} className={styles.calendarHeaderCell}>
              {day}
            </div>
          ))}
          {weeks.flat().map((day, index) => (
            <div
              key={`day-${index}`}
              className={`${styles.calendarCell} ${selectedDate && selectedDate.getDate() === day ? styles.selectedDay : ''} ${day === '' ? styles.emptyCell : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {day !== '' && (
                <>
                  <div className={styles.dayNumber}>{day}</div>
                  <div className={styles.eventContainer}>
                    {getEventsForDay(day).map((event, eventIndex) => (
                      <Link key={event.id} href={`/items/${event.id}`}>
                        <div className={styles.event} title={event.title}>
                          {event.title}
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className={styles.buttonContainer}>
          <Button variant='primary' onClick={() => handleMonthChange(-1)}>
            Previous
          </Button>
          <Button variant='primary' onClick={() => handleMonthChange(1)}>
            Next
          </Button>
        </div>
      </div>
    )
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return generateCalendar()
}

export default EventCalendar
