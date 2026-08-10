import { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default function ShiftLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
