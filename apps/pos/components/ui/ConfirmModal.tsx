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
    variant === 'danger' ? 'bg-red-600 hover:bg-red-500 text-white border-red-500' :
    variant === 'info' ? 'bg-[var(--pos-primary)] hover:bg-[var(--pos-primary-dim)] text-[var(--pos-on-primary)] border-[var(--pos-primary)]' :
    'bg-amber-600 hover:bg-amber-500 text-white border-amber-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-[400px] max-w-[90vw] bg-[#1C1410] rounded-[20px] shadow-2xl border border-[#534434] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <h2 className="text-[20px] font-bold text-[#f0e0d1] mb-2">{title}</h2>
          <p className="text-[14px] text-[#d8c3ad] leading-relaxed mb-6">{message}</p>
          
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 h-[44px] bg-[#261e15] text-[#d8c3ad] font-semibold text-[14px] rounded-xl border border-[#534434] hover:bg-[#3c3329] active:scale-95 transition-all"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
              }}
              className={`flex-1 h-[44px] font-semibold text-[14px] rounded-xl border active:scale-95 transition-all ${btnColorClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
