'use client'

import { useState, useEffect } from 'react'

export function useSessionStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) {
        setValue(JSON.parse(stored))
      }
    } catch { /* ignore */ }
  }, [key])

  function set(v: T) {
    setValue(v)
    try {
      sessionStorage.setItem(key, JSON.stringify(v))
    } catch { /* ignore */ }
  }

  return [value, set]
}
