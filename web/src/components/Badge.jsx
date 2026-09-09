import { md5ColorHash } from '../lib/utils'
import './Badge.css'

const TAG_OVERRIDES = {
  lucy: '#7FD858',
  matt: '#5B9DF0',
}

const TAG_PALETTE = [
  '#F0836A', '#C792EA', '#FFCB6B', '#89DDFF',
  '#F78C6C', '#C3E88D', '#F07178', '#82AAFF',
]

export function Badge({ children, tone = 'accent' }) {
  const color = tone === 'accent' ? 'var(--accent-coral)' : 'var(--text-muted)'
  return (
    <span className="badge" style={{ color, background: `${color}22` }}>
      {children}
    </span>
  )
}

export function TagBadge({ tag }) {
  const key = tag.trim().toLowerCase()
  const color = TAG_OVERRIDES[key] || md5ColorHash(key, TAG_PALETTE)
  return (
    <span className="badge tag-badge" style={{ color, background: `${color}22` }}>
      {tag}
    </span>
  )
}
