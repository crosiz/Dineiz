import React from 'react';
import { AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { Dialog, DialogButton } from './Dialog';

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

// A yes/no question. Built on the shared Dialog so it matches every other
// dialog; it stacks above all of them because it can be asked from inside any.
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

  return (
    <Dialog
      onClose={onCancel}
      z={9999}
      icon={variant === 'danger' ? AlertTriangle : variant === 'info' ? Info : HelpCircle}
      tone={variant === 'danger' ? 'danger' : variant === 'info' ? 'brand' : 'warn'}
      title={title}
      description={message}
      footer={
        <>
          <DialogButton onClick={onCancel}>{cancelText}</DialogButton>
          <DialogButton variant={variant === 'danger' ? 'danger' : variant === 'info' ? 'primary' : 'ink'} onClick={onConfirm}>
            {confirmText}
          </DialogButton>
        </>
      }
    />
  );
}
