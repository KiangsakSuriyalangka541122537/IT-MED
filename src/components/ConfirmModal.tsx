import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'ยืนยันการลบ',
  cancelText = 'ยกเลิก'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-eggshell shadow-2xl border border-white/20"
          >
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={32} />
              </div>
              
              <h3 className="mb-2 text-xl font-bold text-gray-900">{title}</h3>
              <p className="mb-8 text-gray-600 leading-relaxed">
                {message}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="w-full rounded-2xl bg-red-600 py-3.5 font-semibold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-700 active:scale-[0.98]"
                >
                  {confirmText}
                </button>
                <button
                  onClick={onClose}
                  className="w-full rounded-2xl bg-white py-3.5 font-semibold text-gray-600 border border-gray-200 transition-all hover:bg-gray-50 active:scale-[0.98]"
                >
                  {cancelText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
