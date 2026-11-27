import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import type { ExtractedPayrollPayload } from '../utils/payrollValidation';

interface PayrollReviewModalProps {
  isOpen: boolean;
  monthLabel: string;
  extractedData: ExtractedPayrollPayload | null;
  isRetrying: boolean;
  formatCurrency: (val: number) => string;
  onRetry: () => void;
  onConfirmSave: () => void;
  onCancel: () => void;
}

export const PayrollReviewModal: React.FC<PayrollReviewModalProps> = ({
  isOpen,
  monthLabel,
  extractedData,
  isRetrying,
  formatCurrency,
  onRetry,
  onConfirmSave,
  onCancel,
}) => {
  useScrollLock(isOpen);

  if (!isOpen || !extractedData) return null;

  const validation = extractedData.validation;
  const discrepancies = validation?.discrepancies || [];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center sm:p-4"
        data-modal-active="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-review-title"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => {
            if (!isRetrying) onCancel();
          }}
          className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full sm:max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Mobile sheet grabber */}
          <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          {/* Header */}
          <div className="px-5 pt-4 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/35 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="payroll-review-title"
                  className="text-base font-bold text-slate-900 dark:text-white leading-snug"
                >
                  Revisar descuadre antes de guardar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {monthLabel} · {extractedData.devengos.length} devengos · {extractedData.deducciones.length} deducciones
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isRetrying}
              aria-label="Cerrar revisión"
              className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Discrepancy alerts */}
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 p-4 space-y-3">
              <p className="text-xs font-medium text-amber-900 dark:text-amber-100 leading-relaxed">
                Los totales leídos de la nómina no cuadran con la suma de las líneas detectadas. Esto suele pasar si falta alguna captura o una página del PDF.
              </p>

              <div className="divide-y divide-amber-200/70 dark:divide-amber-800/50">
                {discrepancies.map((item, idx) => (
                  <div key={`${item.field}-${idx}`} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                    <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                      {item.label}
                    </p>
                    {item.field !== 'empty' && (
                      <div className="grid grid-cols-3 gap-2 text-xs tabular-nums pt-0.5">
                        <div>
                          <span className="block text-[11px] text-amber-800/80 dark:text-amber-300/80">Calculado</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(item.expected)}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-amber-800/80 dark:text-amber-300/80">En nómina</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(item.extracted)}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] text-amber-800/80 dark:text-amber-300/80">Diferencia</span>
                          <span className="font-bold text-rose-700 dark:text-rose-300">
                            {item.diff > 0 ? '+' : ''}{formatCurrency(item.diff)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Key totals summary */}
            <div className="grid grid-cols-3 gap-2.5 text-left">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 p-3">
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Devengado</span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {formatCurrency(extractedData.totalDevengados)}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 p-3">
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Deducciones</span>
                <span className="block text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
                  {formatCurrency(extractedData.totalDeducciones)}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 p-3">
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Líquido</span>
                <span className="block text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                  {formatCurrency(extractedData.liquido)}
                </span>
              </div>
            </div>

            {/* Detected concepts preview */}
            <div className="space-y-4">
              {extractedData.devengos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span>Devengos detectados</span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      Suma: {formatCurrency(validation?.sumDevengos ?? 0)}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {extractedData.devengos.map((item, idx) => (
                      <li key={`dev-${idx}`} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-700 dark:text-slate-200 truncate">{item.concepto}</span>
                        <span className={cn(
                          'font-semibold tabular-nums shrink-0',
                          item.importe < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                        )}>
                          {formatCurrency(item.importe)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {extractedData.deducciones.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span>Deducciones detectadas</span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      Suma: {formatCurrency(validation?.sumDeducciones ?? 0)}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {extractedData.deducciones.map((item, idx) => (
                      <li key={`ded-${idx}`} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-700 dark:text-slate-200 truncate">{item.concepto}</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
                          -{formatCurrency(item.importe)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Actions (Thumb-friendly >= 44px) */}
          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 space-y-2.5 shrink-0">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-azul-blue hover:bg-azul-blue/90 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reanalizando con precisión ampliada...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Reintentar análisis
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onConfirmSave}
                disabled={isRetrying}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Guardar así
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isRetrying}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
