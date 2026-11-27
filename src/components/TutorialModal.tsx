import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export interface TutorialStep {
  title: string;
  description: string | React.ReactNode;
  icon: React.ReactNode;
  badge?: string;
  color?: string; // Text / icon hover color, e.g. text-azul-blue
  bg?: string; // Icon containerbg, e.g. bg-azul-blue/10
}

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  steps: TutorialStep[];
  initialStep?: number;
}

export const TutorialModal = ({ isOpen, onClose, title, subtitle, steps, initialStep = 0 }: TutorialModalProps) => {
  const [currentPage, setCurrentPage] = useState(initialStep);

  // Reset page when reopened
  useEffect(() => {
    if (isOpen) {
      const safeIndex = initialStep >= 0 && initialStep < steps.length ? initialStep : 0;
      setCurrentPage(safeIndex);
    }
  }, [isOpen, initialStep, steps.length]);

  useScrollLock(isOpen);

  const handleNext = () => {
    if (currentPage < steps.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const currentStep = steps[currentPage];

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain select-none"
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        data-modal-active="true"
      >
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm touch-none"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col min-h-[480px] justify-between border border-slate-100"
        >
          {/* Header with Close */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-azul-blue p-6 pb-8 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-28 h-28 bg-white/5 rounded-full blur-xl" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1 pr-6">
                <span className="text-[10px] text-azul-yellow font-black uppercase tracking-widest block">
                  {subtitle}
                </span>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-white font-sans">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body Content - Carousel Step */}
          <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center relative min-h-[220px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="space-y-5"
              >
                {/* Icon Container */}
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                    currentStep.bg || "bg-azul-blue/10"
                  )}>
                    <div className={cn("text-azul-blue", currentStep.color)}>
                      {currentStep.icon}
                    </div>
                  </div>
                  {currentStep.badge && (
                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200/60">
                      {currentStep.badge}
                    </span>
                  )}
                </div>

                {/* Text Content */}
                <div className="space-y-2">
                  <h4 className="text-base font-black text-slate-800 uppercase tracking-tight font-sans">
                    {currentPage + 1}. {currentStep.title}
                  </h4>
                  <div className="text-sm text-slate-500 leading-relaxed font-sans font-medium">
                    {currentStep.description}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer - Progress & Controls */}
          <div id="tutorial-modal-footer" className="p-6 sm:p-8 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-azul-blue border-t border-white/10 relative overflow-hidden">
            {/* Dots Pagination indicators */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    currentPage === idx 
                      ? "w-6 bg-azul-yellow" 
                      : "w-2 bg-white/30 hover:bg-white/50"
                  )}
                  aria-label={`Ir al paso ${idx + 1}`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {currentPage > 0 && (
                <button
                  onClick={handlePrev}
                  className="bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl px-3 py-2.5 transition-all active:scale-95 text-xs font-black uppercase tracking-wider flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  <span>Atrás</span>
                </button>
              )}

              <button
                onClick={handleNext}
                className={cn(
                  "py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5 shadow-md",
                  currentPage === steps.length - 1
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10"
                    : "bg-white hover:bg-slate-100 text-slate-950 shadow-white/10"
                )}
              >
                <span>{currentPage === steps.length - 1 ? "Entendido" : "Siguiente"}</span>
                {currentPage === steps.length - 1 ? (
                  <Check size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
