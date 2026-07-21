'use client'

import { useEffect, useRef } from 'react'
import { usePaystackPayment } from 'react-paystack'

export default function PaystackCheckout({
  publicKey,
  email,
  amount,
  reference,
  channels,
  onSuccess,
  onClose,
}: {
  publicKey: string
  email: string
  amount: number
  reference: string
  channels: string[]
  onSuccess: () => void
  onClose: () => void
}) {
  const initialized = useRef(false)
  const initializePayment = usePaystackPayment({ publicKey, email, amount, reference, channels })

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    initializePayment({
      onSuccess: () => onSuccess(),
      onClose: () => onClose(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}