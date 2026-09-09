import { useState, useRef, useEffect } from 'react'
import './KebabMenu.css'

export default function KebabMenu({ children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return (
    <div className="kebab-menu" ref={ref}>
      <button
        className="kebab-trigger btn btn-ghost"
        onClick={() => setOpen(o => !o)}
        aria-label="More options"
      >
        &#8942;
      </button>
      {open && (
        <div className="kebab-dropdown" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
