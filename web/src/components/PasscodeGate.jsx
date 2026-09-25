import { useState } from 'react'
import { verifyAndSavePasscode } from '../lib/passcode'
import './PasscodeGate.css'

export default function PasscodeGate({ onUnlocked }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code) return
    setChecking(true)
    setError(null)
    try {
      if (await verifyAndSavePasscode(code)) {
        onUnlocked()
      } else {
        setError('That passcode is not right.')
        setCode('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="passcode-screen">
      <form className="card passcode-card" onSubmit={handleSubmit}>
        <h1 className="passcode-title">Household Manager</h1>
        <p className="muted-text">Enter the household passcode. This phone will remember it.</p>
        <label className="form-label">
          Passcode
          <input
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-full" disabled={checking || !code}>
          {checking ? 'Checking...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
