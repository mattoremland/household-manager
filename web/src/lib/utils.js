/**
 * Simple string hash that returns a stable index into a palette.
 * Not cryptographic — just for consistent color mapping.
 */
export function md5ColorHash(str, palette) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return palette[Math.abs(hash) % palette.length]
}

/**
 * Extract the first phone-number-shaped match from text, or null.
 */
export function extractPhone(text) {
  const match = text.match(/(?:\(\d{3}\)\s?\d{3}[-.\s]?\d{4})|(?:\d{3}[-.\s]\d{3}[-.\s]\d{4})/)
  if (!match) return null
  return match[0].replace(/\D/g, '')
}

import { useState, useEffect, useRef } from 'react'

export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)
  const timer = useRef(null)

  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer.current)
  }, [value, delayMs])

  return debounced
}
