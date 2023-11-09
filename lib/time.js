export function timeSince (timeStamp) {
  const now = new Date()
  const secondsPast = (now.getTime() - timeStamp) / 1000
  if (secondsPast < 60) {
    return parseInt(secondsPast) + 's'
  }
  if (secondsPast < 3600) {
    return parseInt(secondsPast / 60) + 'm'
  }
  if (secondsPast <= 86400) {
    return parseInt(secondsPast / 3600) + 'h'
  }
  if (secondsPast > 86400) {
    const day = timeStamp.getDate()
    const month = timeStamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(' ', '')
    const year = timeStamp.getFullYear() === now.getFullYear() ? '' : ' ' + timeStamp.getFullYear()
    return day + ' ' + month + year
  }

  return 'now'
}

export function datePivot (date,
  { years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0 }) {
  return new Date(
    date.getFullYear() + years,
    date.getMonth() + months,
    date.getDate() + days,
    date.getHours() + hours,
    date.getMinutes() + minutes,
    date.getSeconds() + seconds,
    date.getMilliseconds() + milliseconds
  )
}

export const dayMonthYear = when => new Date(when).toISOString().slice(0, 10)
export const dayMonthYearToDate = when => {
  const [year, month, day] = when.split('-')
  return new Date(+year, month - 1, day)
}

export function timeLeft (timeStamp) {
  const now = new Date()
  const secondsPast = (timeStamp - now.getTime()) / 1000

  if (secondsPast < 0) {
    return false
  }

  if (secondsPast < 60) {
    return parseInt(secondsPast) + 's'
  }
  if (secondsPast < 3600) {
    return parseInt(secondsPast / 60) + 'm'
  }
  if (secondsPast <= 86400) {
    return parseInt(secondsPast / 3600) + 'h'
  }
  if (secondsPast > 86400) {
    return parseInt(secondsPast / (3600 * 24)) + ' days'
  }
}

export function timeUnitForRange ([from, to]) {
  const date1 = new Date(from)
  const date2 = new Date(to)
  const diffTime = Math.abs(date2 - date1)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 7) {
    return 'hour'
  }

  if (diffDays < 90) {
    return 'day'
  }

  if (diffDays < 180) {
    return 'week'
  }

  return 'month'
}

export const whenToFrom = (when) => {
  switch (when) {
    case 'day':
      return dayMonthYear(new Date(), { hours: -24 })
    case 'week':
      return dayMonthYear(datePivot(new Date(), { days: -7 }))
    case 'month':
      return dayMonthYear(datePivot(new Date(), { days: -30 }))
    case 'year':
      return dayMonthYear(datePivot(new Date(), { days: -365 }))
    default:
      return dayMonthYear(new Date('2021-05-01'))
  }
}

export const sleep = (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms))
