import { useEffect, useState } from 'react'
import SetupWizard from './screens/SetupWizard/SetupWizard'
import Login from './screens/Login/Login'
import ActivationScreen from './screens/Activation/ActivationScreen'
import MainShell from './MainShell'

type StaffSummary = Awaited<ReturnType<typeof window.dineiz.auth.listActiveStaff>>[number]
type Restaurant = Awaited<ReturnType<typeof window.dineiz.restaurant.get>>
type LicenseStatus = Awaited<ReturnType<typeof window.dineiz.licensing.getStatus>>
type Stage = 'checking' | 'setup' | 'login' | 'activation' | 'home' | 'no-bridge'

export default function AppShell() {
  const [stage, setStage] = useState<Stage>('checking')
  const [user, setUser] = useState<StaffSummary | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    if (typeof window.dineiz === 'undefined') {
      setStage('no-bridge')
      return
    }
    window.dineiz.setup.getStatus().then(({ isComplete }) => {
      setStage(isComplete ? 'login' : 'setup')
    })
  }, [])

  async function proceedPastLogin(loggedInUser: StaffSummary): Promise<void> {
    setUser(loggedInUser)
    window.dineiz.restaurant.get().then(setRestaurant)
    const status = await window.dineiz.licensing.getStatus()
    if (status.activated) {
      setStage('home')
    } else {
      setLicenseStatus(status)
      setStage('activation')
    }
  }

  if (stage === 'checking') {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[var(--pos-primary)]">
          progress_activity
        </span>
      </div>
    )
  }

  if (stage === 'no-bridge') {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-sm text-[var(--pos-text-secondary)]">
          No Electron bridge available — open this app via `pnpm dev`, not a plain browser tab.
        </p>
      </div>
    )
  }

  if (stage === 'setup') {
    return <SetupWizard onComplete={() => setStage('login')} />
  }

  if (stage === 'login') {
    return <Login onLoggedIn={(loggedInUser) => void proceedPastLogin(loggedInUser)} />
  }

  if (stage === 'activation') {
    if (!licenseStatus) return null
    return (
      <ActivationScreen
        status={licenseStatus}
        onActivated={() => setStage('home')}
      />
    )
  }

  if (!user) return null

  return (
    <MainShell
      user={user}
      restaurant={restaurant}
      onLogout={() => {
        setUser(null)
        setStage('login')
      }}
    />
  )
}
