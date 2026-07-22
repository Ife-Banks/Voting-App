'use client'

import { useEffect, useRef } from 'react'
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3'

export default function FlutterwaveCheckout({
  publicKey,
  email,
  name,
  phone_number,
  amount_naira,
  tx_ref,
  payment_options,
  onSuccess,
  onClose,
}: {
  publicKey: string
  email: string
  name: string
  phone_number: string
  amount_naira: number
  tx_ref: string
  payment_options: string
  onSuccess: (transaction_id: number) => void
  onClose: () => void
}) {
  const initialized = useRef(false)

  const config = {
    public_key: publicKey,
    tx_ref,
    amount: amount_naira,
    currency: 'NGN',
    payment_options,
    customer: {
      email,
      name,
      phone_number,
    },
    customizations: {
      title: 'NASSA Student Choice Award',
      description: 'Vote for your favourite candidate',
      logo: '',
    },
  }

  const handleFlutterPayment = useFlutterwave(config)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    handleFlutterPayment({
      callback: (response) => {
        closePaymentModal()
        if (response.status === 'successful') {
          onSuccess(response.transaction_id)
        } else {
          onClose()
        }
      },
      onClose: () => {
        onClose()
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
