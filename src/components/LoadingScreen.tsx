import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { APP_VERSION } from '../data/updatesHistory';

interface LoadingScreenProps {
  onComplete: () => void;
}

const TopDownAirplaneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    {/* Twin jet engines mounted under swept wings */}
    <rect x="20.4" y="11.1" width="4.4" height="2.2" rx="1.1" fill="#CBD5E1" />
    <rect x="20.4" y="26.7" width="4.4" height="2.2" rx="1.1" fill="#CBD5E1" />
    <rect x="23.6" y="11.35" width="1.1" height="1.7" rx="0.55" fill="#003399" />
    <rect x="23.6" y="26.95" width="1.1" height="1.7" rx="0.55" fill="#003399" />

    {/* Swept main wings */}
    <path
      d="M25.2 18.1L17.4 4.7C16.9 3.9 15.6 4.1 15.7 5.0L17.9 18.2H25.2Z"
      fill="#F1F5F9"
    />
    <path
      d="M25.2 21.9L17.4 35.3C16.9 36.1 15.6 35.9 15.7 35.0L17.9 21.8H25.2Z"
      fill="#F1F5F9"
    />
    {/* Subtle corporate wingtip accents */}
    <path d="M17.3 5.0L16.3 4.3C15.9 4.2 15.6 4.5 15.7 5.0L16.1 7.2L18.1 6.7L17.3 5.0Z" fill="#FFD700" />
    <path d="M17.3 35.0L16.3 35.7C15.9 35.8 15.6 35.5 15.7 35.0L16.1 32.8L18.1 33.3L17.3 35.0Z" fill="#FFD700" />

    {/* Horizontal tail stabilizers */}
    <path
      d="M10.8 18.7L6.3 12.6C5.9 12.1 5.0 12.3 5.1 13.0L6.8 19.1H10.8Z"
      fill="#E2E8F0"
    />
    <path
      d="M10.8 21.3L6.3 27.4C5.9 27.9 5.0 27.7 5.1 27.0L6.8 20.9H10.8Z"
      fill="#E2E8F0"
    />

    {/* Main fuselage */}
    <path
      d="M36.8 20C36.8 18.55 34.0 17.75 30.2 17.75L11.2 18.1C8.2 18.2 5.4 19.1 4.1 20C5.4 20.9 8.2 21.8 11.2 21.9L30.2 22.25C34.0 22.25 36.8 21.45 36.8 20Z"
      fill="#FFFFFF"
    />

    {/* Cockpit windshield */}
    <path
      d="M33.8 18.75C34.55 19.25 34.55 20.75 33.8 21.25L32.55 20.85C33.05 20.35 33.05 19.65 32.55 19.15L33.8 18.75Z"
      fill="#001A33"
    />

    {/* Vertical tail fin spine */}
    <rect x="5.6" y="19.35" width="5.2" height="1.3" rx="0.65" fill="#003399" />
  </svg>
);

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500); // Small delay before finishing
          return 100;
        }
        // Random increment to make it feel more real
        const inc = Math.floor(Math.random() * 10) + 5;
        return Math.min(prev + inc, 100);
      });
    }, 150);

    return () => clearInterval(timer);
  }, [onComplete]);

  const progressTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: 'easeOut' as const };

  return (
    <div className="fixed inset-0 z-[100] bg-[#001a33] flex flex-col items-center justify-center p-8 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute -left-20 -top-20 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.8 }}
        className="relative flex flex-col items-center gap-12 max-w-md w-full"
      >
        {/* Logo Placeholder - Recreating the look of the provided image */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Calendar Icon */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: prefersReducedMotion ? 0 : 0.6 }}
            className="absolute -translate-x-8 -translate-y-4 w-32 h-32 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="bg-[#003399] h-8 flex items-center justify-center">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">MES</span>
            </div>
            <div className="flex-1 p-3 grid grid-cols-4 gap-1">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="w-full h-2 bg-slate-100 rounded-sm" />
              ))}
            </div>
          </motion.div>

          {/* Payroll Icon */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: prefersReducedMotion ? 0 : 0.6 }}
            className="absolute translate-x-12 translate-y-8 w-28 h-36 bg-[#FFD700] rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
          >
            <div className="flex justify-between items-center">
              <div className="w-10 h-1.5 bg-black/20 rounded-full" />
              <div className="w-4 h-4 rounded-full border-2 border-black/20" />
            </div>
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-black/10 rounded-full" />
              <div className="w-3/4 h-1.5 bg-black/10 rounded-full" />
              <div className="w-full h-1.5 bg-black/10 rounded-full" />
            </div>
            <div className="mt-auto pt-2 border-t border-black/10">
              <div className="w-1/2 h-2 bg-black/20 rounded-full" />
            </div>
          </motion.div>
        </div>

        {/* Progress Section — Airport Runway with Top-Down Airplane */}
        <div
          className="w-full space-y-4"
          role="progressbar"
          aria-label="Cargando sistema"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="flex justify-between items-end">
            <h2 className="text-white/90 text-sm font-black uppercase tracking-[0.2em]">Cargando Sistema</h2>
            <span className="text-[#FFD700] text-2xl font-black tabular-nums">{progress}%</span>
          </div>

          <div className="relative h-10 w-full flex items-center select-none">
            {/* Runway tarmac track */}
            <div className="relative h-8 w-full rounded-xl bg-[#061325]/90 border border-white/15 shadow-[inset_0_2px_8px_rgba(0,0,0,0.65)] overflow-hidden">
              {/* Top & bottom runway edge lines */}
              <div className="pointer-events-none absolute inset-x-2 top-1 h-px bg-white/15" />
              <div className="pointer-events-none absolute inset-x-2 bottom-1 h-px bg-white/15" />

              {/* Left threshold markings (piano keys) */}
              <div className="pointer-events-none absolute left-1.5 inset-y-1.5 w-2 flex flex-col justify-between py-0.5">
                <span className="h-[2px] w-full rounded-full bg-white/45" />
                <span className="h-[2px] w-full rounded-full bg-white/45" />
                <span className="h-[2px] w-full rounded-full bg-white/45" />
              </div>

              {/* Right threshold markings (piano keys) */}
              <div className="pointer-events-none absolute right-1.5 inset-y-1.5 w-2 flex flex-col justify-between py-0.5">
                <span className="h-[2px] w-full rounded-full bg-white/45" />
                <span className="h-[2px] w-full rounded-full bg-white/45" />
                <span className="h-[2px] w-full rounded-full bg-white/45" />
              </div>

              {/* Active runway corridor between thresholds */}
              <div className="absolute inset-y-0 left-[18px] right-[18px]">
                {/* Illuminated golden runway surface behind the airplane */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: progress / 100 }}
                  transition={progressTransition}
                  className="absolute inset-0 origin-left bg-gradient-to-r from-[#FFD700]/15 via-[#FFD700]/30 to-[#FFD700]/55"
                />

                {/* Base dashed centerline ahead of the airplane */}
                <svg
                  className="pointer-events-none absolute inset-0 w-full h-full"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    stroke="rgba(255, 255, 255, 0.35)"
                    strokeWidth="2"
                    strokeDasharray="8 7"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Golden illuminated dashed centerline behind the airplane */}
                <motion.div
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                  transition={progressTransition}
                  className="pointer-events-none absolute inset-0"
                >
                  <svg
                    className="w-full h-full drop-shadow-[0_0_6px_rgba(255,215,0,0.85)]"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="50%"
                      x2="100%"
                      y2="50%"
                      stroke="#FFD700"
                      strokeWidth="2.5"
                      strokeDasharray="8 7"
                      strokeLinecap="round"
                    />
                  </svg>
                </motion.div>
              </div>
            </div>

            {/* Top-down commercial airplane gliding straight along the centerline */}
            <div className="pointer-events-none absolute inset-y-0 left-[18px] right-[18px]">
              <motion.div
                initial={{ x: '0%' }}
                animate={{ x: `${progress}%` }}
                transition={progressTransition}
                className="w-full h-full flex items-center"
              >
                <div className="-ml-[18px] w-9 h-9 flex items-center justify-center shrink-0">
                  <TopDownAirplaneIcon className="w-9 h-9 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* App Name */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-2xl font-black tracking-tighter uppercase">
            <span className="text-white">Tur</span>
            <span className="text-[#003399]" style={{ textShadow: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff' }}>Nom</span>{' '}
            <span className="text-[#FFD700]">Ramp</span>
          </h1>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Versión {APP_VERSION} • Gestión Inteligente</p>
        </motion.div>
      </motion.div>

      {/* Footer info */}
      <div className="absolute bottom-8 text-white/20 text-[10px] font-bold uppercase tracking-widest">
        © 2026 • Todos los derechos reservados
      </div>
    </div>
  );
};
