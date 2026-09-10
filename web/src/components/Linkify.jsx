/**
 * Linkify: auto-links URLs, phone numbers, and addresses in text.
 * Supports bulleted/numbered lists. Addresses with ZIP codes link to Apple Maps.
 * Port of the Python style.linkify() function.
 */

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"]+/gi
const PHONE_RE = /(?:\(\d{3}\)\s?\d{3}[-.\s]?\d{4})|(?:\d{3}[-.\s]\d{3}[-.\s]\d{4})/g
const PHONE_FULL_RE = /^(?:\(\d{3}\)\s?\d{3}[-.\s]?\d{4})|(?:\d{3}[-.\s]\d{3}[-.\s]\d{4})$/
const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/
const STREET_RE = /\d+\s+\w+\s+(?:st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|way|pl|place|cir|circle)\b/i
const US_STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC'
const CITY_STATE_RE = new RegExp(`\\b[A-Z][a-z]+(?:\\s[A-Z][a-z]+)*,?\\s+(?:${US_STATES})\\b`)
const BULLET_RE = /^[-*•]\s+(.*)/
const NUMBERED_RE = /^\d+[.)]\s+(.*)/

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkifyBlock(text) {
  const escaped = escapeHtml(text)
  const withBreaks = escaped.replace(/\n/g, '<br>')

  if (ZIP_RE.test(text) && (STREET_RE.test(text) || CITY_STATE_RE.test(text))) {
    const query = encodeURIComponent(text.split(/\s+/).join(' '))
    const href = `http://maps.apple.com/?daddr=${query}`
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${withBreaks}</a>`
  }

  let result = withBreaks.replace(URL_RE, (url) => {
    const href = url.toLowerCase().startsWith('http') ? url : `https://${url}`
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })

  result = result.replace(PHONE_RE, (phone) => {
    const digits = phone.replace(/\D/g, '')
    return `<a href="tel:${digits}">${phone}</a>`
  })

  return result
}

export default function Linkify({ text }) {
  if (!text) return null

  const lines = text.split('\n')
  const rendered = []
  let block = []
  let listItems = []
  let listTag = null

  function flushBlock() {
    if (block.length > 0) {
      rendered.push(linkifyBlock(block.join('\n')))
      block = []
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      const items = listItems.map(item => `<li>${linkifyBlock(item)}</li>`).join('')
      rendered.push(`<${listTag} style="margin:0.3em 0;padding-left:1.4em;">${items}</${listTag}>`)
      listItems = []
    }
    listTag = null
  }

  for (const line of lines) {
    const stripped = line.trim()
    const bulletMatch = stripped.match(BULLET_RE)
    const numberedMatch = stripped.match(NUMBERED_RE)

    if (PHONE_FULL_RE.test(stripped)) {
      flushBlock()
      flushList()
      const digits = stripped.replace(/\D/g, '')
      rendered.push(`<a href="tel:${digits}">${escapeHtml(stripped)}</a>`)
    } else if (bulletMatch) {
      flushBlock()
      if (listTag !== 'ul') {
        flushList()
        listTag = 'ul'
      }
      listItems.push(bulletMatch[1])
    } else if (numberedMatch) {
      flushBlock()
      if (listTag !== 'ol') {
        flushList()
        listTag = 'ol'
      }
      listItems.push(numberedMatch[1])
    } else {
      flushList()
      block.push(line)
    }
  }
  flushBlock()
  flushList()

  const html = rendered.join('<br>')
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
