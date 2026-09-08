import { useState, type ReactNode } from 'react'
import DineizLogo from '../../components/DineizLogo'

type SetupInput = Parameters<typeof window.dineiz.setup.complete>[0]

interface SetupWizardProps {
  onComplete: () => void
}

type Step = 'restaurant' | 'tax' | 'owner'
const STEPS: Step[] = ['restaurant', 'tax', 'owner']

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

  const stepIndex = STEPS.indexOf(step)

  function update<K extends keyof SetupInput>(key: K, value: SetupInput[K]): void {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleFinish(): Promise<void> {
    setError(null)
    setSubmitting(true)
    try {
      await window.dineiz.setup.complete(form)
      onComplete()
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

        {error && <p className="mt-4 text-sm text-[var(--pos-red)]">{error}</p>}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStep(STEPS[stepIndex - 1])}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-[var(--pos-text-secondary)] disabled:opacity-0"
          >
            Back
          </button>
          {step !== 'owner' ? (
            <button
              type="button"
              onClick={() => setStep(STEPS[stepIndex + 1])}
              disabled={step === 'restaurant' && !form.restaurantName.trim()}
              className="h-11 rounded-xl bg-[var(--pos-primary)] px-6 text-sm font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting || !form.ownerName.trim() || form.ownerPassword.length < 6}
              className="h-11 rounded-xl bg-[var(--pos-primary)] px-6 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? 'Setting up…' : 'Finish setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
