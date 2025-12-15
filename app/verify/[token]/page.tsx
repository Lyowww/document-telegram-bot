'use client'

import { useState, FormEvent } from 'react'
import { useParams } from 'next/navigation'

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError('Неверный PIN-код. Попробуйте снова.')
        setLoading(false)
        return
      }
      window.location.href = data.fileUrl as string
    } catch {
      setError('Ошибка. Попробуйте позже.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
      margin: 0,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: '8px',
          color: '#1a1a1a',
        }}>Введите код доступа</h1>
        <p style={{
          fontSize: '14px',
          color: '#666',
          textAlign: 'center',
          marginBottom: '32px',
        }}>Введите PIN-код, указанный в PDF-файле</p>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="pin" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '8px',
              color: '#1a1a1a',
            }}>PIN-код</label>
            <input
              id="pin"
              type="text"
              inputMode="numeric"
              placeholder="Введите PIN-код"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              maxLength={6}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
            {error && <div style={{
              color: '#d32f2f',
              fontSize: '14px',
              marginTop: '8px',
            }}>{error}</div>}
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 500,
              color: 'white',
              backgroundColor: loading ? '#999' : '#0066cc',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Проверка…' : 'Подтвердить'}
          </button>
        </form>
      </div>
    </div>
  )
}


