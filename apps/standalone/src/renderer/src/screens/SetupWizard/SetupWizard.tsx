import { useState, type ReactNode } from 'react'
import DineizLogo from '../../components/DineizLogo'

type SetupInput = Parameters<typeof window.dineiz.setup.complete>[0]

interface SetupWizardProps {
  onComplete: () => void
}

type Step = 'restaurant' | 'tax' | 'owner' | 'recovery'
const STEPS: Step[] = ['restaurant', 'tax', 'owner', 'recovery']

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">{label}</span>
      {children}
    </label>
  )
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('restaurant')
  const [form, setForm] = useState<SetupInput>({
    restaurantName: '',
    address: '',
    ntn: '',
    cashTaxRatePercent: 5,
    cardTaxRatePercent: 17,
    ownerName: '',
    ownerEmail: '',
    ownerPassword: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [recoverySaved, setRecoverySaved] = useState(false)

  const stepIndex = STEPS.indexOf(step)

  function update<K extends keyof SetupInput>(key: K, value: SetupInput[K]): void {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleFinish(): Promise<void> {
    setError(null)
    setSubmitting(true)
    try {
      const result = await window.dineiz.setup.complete(form)
      setRecoveryCode(result.ownerRecoveryCode)
      setStep('recovery')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--pos-bg-base)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-8 shadow-sm">
        <DineizLogo height={26} className="mb-4" />
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <h1 className="clash-display mt-1 text-2xl font-bold">
          {step === 'restaurant' && 'Your restaurant'}
          {step === 'tax' && 'Tax rates'}
          {step === 'owner' && 'Owner account'}
          {step === 'recovery' && 'Save your recovery code'}
        </h1>

        {step === 'restaurant' && (
          <div className="mt-6 space-y-3">
            <Field label="Restaurant name">
              <input
                className="h-11 w-full px-3"
                value={form.restaurantName}
                onChange={(e) => update('restaurantName', e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Address (optional)">
              <input
                className="h-11 w-full px-3"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
              />
            </Field>
            <Field label="NTN (optional)">
              <input className="h-11 w-full px-3" value={form.ntn} onChange={(e) => update('ntn', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 'tax' && (
          <div className="mt-6 space-y-3">
            <Field label="Cash tax rate (%)">
              <input
                type="number"
                className="h-11 w-full px-3"
                value={form.cashTaxRatePercent}
                onChange={(e) => update('cashTaxRatePercent', Number(e.target.value))}
              />
            </Field>
            <Field label="Card / JazzCash / EasyPaisa tax rate (%)">
              <input
                type="number"
                className="h-11 w-full px-3"
                value={form.cardTaxRatePercent}
                onChange={(e) => update('cardTaxRatePercent', Number(e.target.value))}
              />
            </Field>
          </div>
        )}

        {step === 'owner' && (
          <div className="mt-6 space-y-3">
            <Field label="Your name">
              <input
                className="h-11 w-full px-3"
                value={form.ownerName}
                onChange={(e) => update('ownerName', e.target.value)}
              />
            </Field>
            <Field label="Email (optional)">
              <input
                className="h-11 w-full px-3"
                value={form.ownerEmail}
                onChange={(e) => update('ownerEmail', e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className="h-11 w-full px-3"
                value={form.ownerPassword}
                onChange={(e) => update('ownerPassword', e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 'recovery' && recoveryCode && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-[var(--pos-text-secondary)]">
              This is the <strong>only</strong> way back in if the owner password is ever forgotten — there&apos;s no
              email or online reset, since this app works fully offline. It won&apos;t be shown again.
            </p>
            <div className="rounded-xl bg-[var(--pos-bg-elevated)] p-4 text-center">
              <p className="select-all break-all font-mono text-lg font-bold tracking-wide">{recoveryCode}</p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={recoverySaved}
                onChange={(e) => setRecoverySaved(e.target.checked)}
                className="mt-0.5"
              />
              <span>I&apos;ve written this down or saved it somewhere safe, separate from this computer.</span>
            </label>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-[var(--pos-red)]">{error}</p>}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            disabled={stepIndex === 0 || step === 'recovery'}
            onClick={() => setStep(STEPS[stepIndex - 1])}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-[var(--pos-text-secondary)] disabled:opacity-0"
          >
            Back
          </button>
          {step === 'restaurant' || step === 'tax' ? (
            <button
              type="button"
              onClick={() => setStep(STEPS[stepIndex + 1])}
              disabled={step === 'restaurant' && !form.restaurantName.trim()}
              className="h-11 rounded-xl bg-[var(--pos-primary)] px-6 text-sm font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          ) : step === 'owner' ? (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting || !form.ownerName.trim() || form.ownerPassword.length < 6}
              className="h-11 rounded-xl bg-[var(--pos-primary)] px-6 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? 'Setting up…' : 'Finish setup'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              disabled={!recoverySaved}
              className="h-11 rounded-xl bg-[var(--pos-primary)] px-6 text-sm font-semibold text-white disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
