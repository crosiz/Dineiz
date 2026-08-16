import React from 'react';

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
    variant === 'danger' ? 'bg-[#DC2626] hover:bg-[#C4362E] text-white shadow-[#DC2626]/25' :
    variant === 'info' ? 'bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 text-white shadow-[var(--pos-primary,#F59E0B)]/25' :
    'bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-[#0F172A]/20';

  const iconBg =
    variant === 'danger' ? 'bg-[#FDECEC] text-[#DC2626]' :
    variant === 'info' ? 'bg-[var(--pos-primary,#F59E0B)]/10 text-[var(--pos-primary,#F59E0B)]' :
    'bg-[#FFF8EC] text-[#B4770B]';

  const icon = variant === 'danger' ? 'warning' : variant === 'info' ? 'info' : 'help';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-[400px] max-w-[90vw] bg-white rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.25)] border border-[#E2E8F0] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-7">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconBg}`}>
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          <h2 className="text-[19px] font-bold text-[#0F172A] mb-2">{title}</h2>
          <p className="text-[14px] text-[#64748B] leading-relaxed mb-6">{message}</p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 h-[46px] bg-white text-[#475569] font-bold text-[14px] rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] active:scale-95 transition-all"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
              }}
              className={`flex-1 h-[46px] font-bold text-[14px] rounded-xl active:scale-95 transition-all shadow-lg ${btnColorClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
