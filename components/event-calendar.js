import React, { useState, useEffect } from 'react'
import { Button } from 'react-bootstrap'
import { useQuery } from '@apollo/client'
import { gql } from '@apollo/client'
import Link from 'next/link'

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
      <div>
        <h2>
          {month} {year}
        </h2>
        <table className='table table-bordered'>
          <thead>
            <tr>
              {daysOfWeek.map((day, index) => (
                <th key={`header-${index}`} className='text-center' style={{ width: '40px', height: '40px' }}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={`week-${weekIndex}`}>
                {week.map((day, dayIndex) => (
                  <td
                    key={`day-${weekIndex}-${dayIndex}`}
                    className={`text-center position-relative ${selectedDate && selectedDate.getDate() === day ? 'bg-primary text-white' : ''}`}
                    style={{ width: '50px', height: '70px', cursor: 'pointer' }}
                    onClick={() => handleDayClick(day)}
                  >
                    {day !== '' && (
                      <div className='day-number position-absolute' style={{ top: '2px', left: '2px', fontSize: '0.8rem' }}>
                        {day}
                      </div>
                    )}
                    {day !== '' && getEventsForDay(day).map((event, index) => (
                      <Link key={event.id} href={`/items/${event.id}`}>
                        <div style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}>
                          {event.title}
                        </div>
                      </Link>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <div className='d-flex justify-content-between mb-3'>
            <Button variant='primary' onClick={() => handleMonthChange(-1)}>
              Previous
            </Button>
            <Button variant='primary' onClick={() => handleMonthChange(1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return <div>{generateCalendar()}</div>
}

export default EventCalendar