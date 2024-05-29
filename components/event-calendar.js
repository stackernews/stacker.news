import React, { useState } from 'react'
import {  Button } from 'react-bootstrap'

const EventCalendar = ({ ssrData }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  console.log(ssrData);
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return daysInMonth
  }

  const handleDayClick = (day) => {
    if (day !== '') {
      setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
    }
  }

  const handleMonthChange = (direction) => {
    const newMonth = currentDate.getMonth() + direction
    setCurrentDate(new Date(currentDate.getFullYear(), newMonth, 1))
    setSelectedDate(null) // Reset the selectedDate when the month changes
  }

  const generateCalendar = () => {
    const daysInMonth = getDaysInMonth()
    const month = months[currentDate.getMonth()]
    const year = currentDate.getFullYear()
    const firstDay = new Date(year, currentDate.getMonth(), 1)
    const dayOfWeek = firstDay.getDay() // Adjust the day of the week

    const days = []
    for (let i = 0; i < dayOfWeek; i++) {
      days.push('')
    }
    for (let i = 1; i <= daysInMonth ;i++) {
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
                    {/* Placeholder for event names */}
                    {day !== '' && <div>                          
                            <div style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}>Bitcoin Halving</div>
                      </div>}
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
    );
  };

  return <div>{generateCalendar()}</div>
};

export default EventCalendar
