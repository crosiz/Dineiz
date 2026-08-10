import { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default function ReceiptLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
