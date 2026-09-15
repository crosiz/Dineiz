import { useEffect, useState } from 'react'
import Toggle from '../../components/Toggle'

type Restaurant = NonNullable<Awaited<ReturnType<typeof window.dineiz.restaurant.get>>>
type RoundingMethod = Restaurant['tax_rounding_method']
type UpdateCheckResult = Awaited<ReturnType<typeof window.dineiz.app.checkForUpdates>>

const UPDATE_MESSAGE: Record<UpdateCheckResult['status'], string> = {
  'not-configured': 'Automatic updates are not set up yet. Ask Dineiz for the latest installer when you need it.',
  'up-to-date': "You're running the latest version.",
  'update-available': 'A new version is available.',
  error: 'Could not check for updates.'
}

export default function Settings() {
  const [form, setForm] = useState<Restaurant | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateCheckResult | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    window.dineiz.restaurant.get().then((r) => setForm(r))
    window.dineiz.app.getVersion().then(setAppVersion)
  }, [])

  function update<K extends keyof Restaurant>(key: K, value: Restaurant[K]): void {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setSaved(false)
  }

  async function handleSave(): Promise<void> {
    if (!form) return
    setError(null)
    setSaving(true)
    try {
      await window.dineiz.restaurant.updateSettings({
        name: form.name,
        address: form.address,
        ntn: form.ntn,
        cashTaxRatePercent: form.cash_tax_rate,
        cardTaxRatePercent: form.card_tax_rate,
        cashTaxEnabled: Boolean(form.cash_tax_enabled),
        cardTaxEnabled: Boolean(form.card_tax_enabled),
        taxRoundingMethod: form.tax_rounding_method,
        voidRequiresManagerApproval: Boolean(form.void_requires_manager_approval),
        receiptHeader: form.receipt_header,
        receiptFooter: form.receipt_footer,
        rushHourMode: Boolean(form.rush_hour_mode)
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckForUpdates(): Promise<void> {
    setCheckingUpdate(true)
    try {
      setUpdateStatus(await window.dineiz.app.checkForUpdates())
    } finally {
      setCheckingUpdate(false)
    }
  }

  if (!form) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--pos-text-secondary)]">Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="clash-display mb-4 text-xl font-bold">Settings</h1>

      <div className="max-w-2xl space-y-6">
        <section className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">Restaurant</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Name</span>
              <input className="h-10 w-full px-3" value={form.name} onChange={(e) => update('name', e.target.value)} />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Address</span>
              <input
                className="h-10 w-full px-3"
                value={form.address ?? ''}
                onChange={(e) => update('address', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">NTN</span>
              <input className="h-10 w-full px-3" value={form.ntn ?? ''} onChange={(e) => update('ntn', e.target.value)} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">Tax</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Cash tax rate (%)</span>
              <input
                type="number"
                className="h-10 w-full px-3"
                value={form.cash_tax_rate}
                onChange={(e) => update('cash_tax_rate', Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">
                Card / JazzCash / EasyPaisa tax rate (%)
              </span>
              <input
                type="number"
                className="h-10 w-full px-3"
                value={form.card_tax_rate}
                onChange={(e) => update('card_tax_rate', Number(e.target.value))}
              />
            </label>
            <Toggle
              checked={Boolean(form.cash_tax_enabled)}
              onChange={(checked) => update('cash_tax_enabled', checked ? 1 : 0)}
              label="Apply tax on cash payments"
            />
            <Toggle
              checked={Boolean(form.card_tax_enabled)}
              onChange={(checked) => update('card_tax_enabled', checked ? 1 : 0)}
              label="Apply tax on card/wallet payments"
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Rounding</span>
              <select
                className="h-10 w-full px-3 text-sm"
                value={form.tax_rounding_method}
                onChange={(e) => update('tax_rounding_method', e.target.value as RoundingMethod)}
              >
                <option value="ROUND">Round to nearest rupee</option>
                <option value="FLOOR">Always round down</option>
                <option value="CEIL">Always round up</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">Operations</h2>
          <Toggle
            checked={Boolean(form.void_requires_manager_approval)}
            onChange={(checked) => update('void_requires_manager_approval', checked ? 1 : 0)}
            label="Require manager approval to void an item"
          />
        </section>

        <section className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">Rush Hour Mode</h2>
              <p className="mt-1 text-sm text-[var(--pos-text-secondary)]">
                When sending an order to the kitchen, also print an itemized order ticket (with prices) alongside the
                kitchen ticket — so the counter/runner has a priced copy to track without waiting on the kitchen.
              </p>
            </div>
            <Toggle checked={Boolean(form.rush_hour_mode)} onChange={(checked) => update('rush_hour_mode', checked ? 1 : 0)} />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">Receipt</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Header text</span>
              <input
                className="h-10 w-full px-3"
                value={form.receipt_header ?? ''}
                onChange={(e) => update('receipt_header', e.target.value)}
                placeholder="e.g. Welcome to Kababjees!"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Footer text</span>
              <input
                className="h-10 w-full px-3"
                value={form.receipt_footer ?? ''}
                onChange={(e) => update('receipt_footer', e.target.value)}
                placeholder="e.g. Thank you, visit again!"
              />
            </label>
          </div>
        </section>

        {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 rounded-xl bg-[var(--pos-primary)] px-6 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-[var(--pos-green)]">Saved.</span>}
        </div>

        <section className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">About</h2>
          <p className="text-sm text-[var(--pos-text-secondary)]">Dineiz Standalone version {appVersion}</p>
          <button
            type="button"
            onClick={handleCheckForUpdates}
            disabled={checkingUpdate}
            className="mt-3 flex h-10 items-center gap-1.5 rounded-xl border border-[var(--pos-border-strong)] px-4 text-xs font-semibold disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">update</span>
            {checkingUpdate ? 'Checking…' : 'Check for updates'}
          </button>
          {updateStatus && (
            <p className="mt-2 text-sm text-[var(--pos-text-secondary)]">
              {UPDATE_MESSAGE[updateStatus.status]}
              {updateStatus.status === 'update-available' && ` (v${updateStatus.version})`}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
