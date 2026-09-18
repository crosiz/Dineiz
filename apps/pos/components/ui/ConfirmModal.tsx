import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { AlertTriangle, Info, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const btnColorClass =
    variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs' :
    variant === 'info' ? 'bg-brand hover:bg-orange-600 text-white shadow-xs' :
    'bg-slate-900 hover:bg-slate-800 text-white shadow-xs';

  const iconBg =
    variant === 'danger' ? 'bg-rose-50 text-rose-600 border-rose-100' :
    variant === 'info' ? 'bg-orange-50 text-brand border-orange-100' :
    'bg-amber-50 text-amber-600 border-amber-100';

  const renderIcon = () => {
    if (variant === 'danger') return <AlertTriangle size={20} />;
    if (variant === 'info') return <Info size={20} />;
    return <HelpCircle size={20} />;
  };

  // z-50 in the className used to sit here too — the inline style always
  // won, so it was dead and made the actual stacking (9999, deliberately
  // near the top: this can be invoked from inside any other modal) look
  // wrong to anyone reading the class list.
  return (
    <Modal isOpen={isOpen} onClose={onCancel} label={title} zIndex={9999} className="max-w-[380px]">
      <div className="p-6 overflow-y-auto">
        <div className={`w-10 min-h-11 rounded-xl border flex items-center justify-center mb-3.5 ${iconBg}`}>
          {renderIcon()}
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">{title}</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">{message}</p>

        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 min-h-11 bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 min-h-11 font-semibold text-xs rounded-xl active:scale-95 transition-all ${btnColorClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

