import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger'
}) => {
  useScrollLock(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          data-modal-active="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm touch-none"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 overscroll-contain"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={cn(
                "p-4 rounded-2xl",
                variant === 'danger' ? "bg-rose-50 text-rose-500" :
                variant === 'warning' ? "bg-amber-50 text-amber-500" :
                "bg-azul-blue/10 text-azul-blue"
              )}>
                <AlertCircle size={32} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{message}</p>
              </div>

              <div className="flex gap-3 w-full pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-white transition-all active:scale-95 shadow-lg",
                    variant === 'danger' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" :
                    variant === 'warning' ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" :
                    "bg-azul-blue hover:bg-azul-blue/90 shadow-azul-blue/20"
                  )}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
