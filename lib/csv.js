/**
 * Convert an array of objects into a CSV string.
 * Each object key becomes a column header.
 *
 * @param {Object[]} rows - Array of flat objects
 * @param {string[]} [columns] - Optional ordered list of column keys. If omitted, uses all keys from the first row.
 * @returns {string} CSV-formatted string
 */
export function toCSV (rows, columns) {
  if (!rows || rows.length === 0) return ''

  const cols = columns || Object.keys(rows[0]).filter(k => k !== '__typename')

  const escape = (val) => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    // wrap in quotes if the value contains a comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = cols.map(escape).join(',')
  const body = rows.map(row =>
    cols.map(col => escape(row[col])).join(',')
  ).join('\n')

  return header + '\n' + body
}

/**
 * Trigger a browser download of a CSV string.
 *
 * @param {string} csvString - The CSV content
 * @param {string} filename - The download filename (should end in .csv)
 */
export function downloadCSV (csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert chart growth data (the shape returned by GraphQL growth queries)
 * into a flat array suitable for CSV export.
 *
 * The input shape is: [{ time, data: [{ name, value }] }]
 * The output shape is: [{ time, name1: value1, name2: value2, ... }]
 *
 * @param {Object[]} data - Raw growth data from GraphQL
 * @param {Function} [nameTransform] - Optional function to transform data point names
 * @returns {Object[]} Flat array of objects
 */
export function flattenGrowthData (data, nameTransform) {
  if (!data || data.length === 0) return []

  return data.map(entry => {
    const obj = { time: entry.time }
    entry.data.forEach(d => {
      const key = nameTransform ? nameTransform(d.name) : d.name
      obj[key] = d.value
    })
    return obj
  })
}

/**
 * Merge multiple named growth datasets into a single array of rows
 * keyed by time. Each dataset's columns are prefixed with the dataset label
 * to avoid collisions (e.g. "stacked: zaps", "spent: posts").
 *
 * @param {Array<{label: string, data: Object[]}>} datasets - Named datasets with raw GraphQL growth data
 * @param {Function} [nameTransform] - Optional function to transform data point names
 * @returns {Object[]} Merged flat array of objects with time + prefixed columns
 */
export function mergeGrowthDatasets (datasets, nameTransform) {
  // build a map of time -> merged row
  const timeMap = new Map()

  for (const { label, data } of datasets) {
    if (!data || data.length === 0) continue

    for (const entry of data) {
      if (!timeMap.has(entry.time)) {
        timeMap.set(entry.time, { time: entry.time })
      }
      const row = timeMap.get(entry.time)
      for (const d of entry.data) {
        const baseName = nameTransform ? nameTransform(d.name) : d.name
        const key = `${label}: ${baseName}`
        row[key] = d.value
      }
    }
  }

  // sort by time and return
  return Array.from(timeMap.values()).sort((a, b) =>
    new Date(a.time) - new Date(b.time)
  )
}
