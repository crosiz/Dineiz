import Modal from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Modal
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-[var(--pos-border-strong)] px-4 text-sm font-semibold text-[var(--pos-text-secondary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 rounded-xl px-4 text-sm font-semibold text-white ${
              danger ? 'bg-[var(--pos-red)]' : 'bg-[var(--pos-primary)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-[var(--pos-text-secondary)]">{message}</p>
    </Modal>
  )
}
