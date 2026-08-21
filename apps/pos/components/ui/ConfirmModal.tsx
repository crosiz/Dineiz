import React from 'react';
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
    variant === 'info' ? 'bg-[#FF5722] hover:bg-orange-600 text-white shadow-xs' :
    'bg-slate-900 hover:bg-slate-800 text-white shadow-xs';

  const iconBg =
    variant === 'danger' ? 'bg-rose-50 text-rose-600 border-rose-100' :
    variant === 'info' ? 'bg-orange-50 text-[#FF5722] border-orange-100' :
    'bg-amber-50 text-amber-600 border-amber-100';

  const renderIcon = () => {
    if (variant === 'danger') return <AlertTriangle size={20} />;
    if (variant === 'info') return <Info size={20} />;
    return <HelpCircle size={20} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-[360px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3.5 ${iconBg}`}>
          {renderIcon()}
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">{title}</h2>
        <p className="text-xs text-slate-500 leading-relaxed mb-6">{message}</p>

        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 h-10 bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-10 font-semibold text-xs rounded-xl active:scale-95 transition-all ${btnColorClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

