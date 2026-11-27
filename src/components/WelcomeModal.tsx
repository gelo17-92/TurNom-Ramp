import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  Shield, 
  Info, 
  Smartphone, 
  Share, 
  PlusSquare, 
  MoreVertical, 
  Download, 
  Compass, 
  ArrowRight,
  Sparkles,
  Cloud
} from 'lucide-react';
import { cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ isOpen, onClose }: WelcomeModalProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [activeOs, setActiveOs] = useState<'ios' | 'android'>('ios');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosTip, setShowIosTip] = useState(true);
  const [showAndroidTip, setShowAndroidTip] = useState(true);

  useScrollLock(isOpen);

  useEffect(() => {
    // Detect OS to default instruction tab
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                        (navigator.userAgent.includes("Mac") && "ontouchend" in document);
    if (isIOSDevice) {
      setActiveOs('ios');
    } else {
      setActiveOs('android');
    }

    // Capture standard PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

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
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm touch-none"
            onClick={step === 2 ? onClose : undefined}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden overscroll-contain border border-slate-100/50"
          >
            {/* Header / Banner */}
            <div className="bg-azul-blue p-8 text-white relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer z-20"
                title="Cerrar bienvenida"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative z-10 space-y-1.5">
                <p className="text-azul-yellow font-black text-[10px] uppercase tracking-widest leading-none">
                  PASO {step} DE 2
                </p>
                <h2 className="text-3xl font-black uppercase tracking-tight leading-none">
                  {step === 1 ? '¡Bienvenido!' : 'Instalar App'}
                </h2>
                <div className="text-white/80 font-bold text-xs uppercase tracking-wider">
                  {step === 1 ? (
                    <span className="inline-flex">
                      <span className="text-white">Tur</span>
                      <span className="text-[#003399]" style={{ textShadow: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff' }}>Nom</span>&nbsp;
                      <span className="text-azul-yellow">Ramp</span>
                    </span>
                  ) : (
                    'Añádelo a tu pantalla de inicio'
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div className="space-y-5">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                          <Shield className="text-emerald-500" size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider">Control Individual</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Diseñado exclusivamente para el <strong>control individual</strong> de tus turnos de trabajo y el cálculo estimado de tus nóminas.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-azul-blue/5 flex items-center justify-center shrink-0 border border-azul-blue/10">
                          <Info className="text-azul-blue" size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider">Privacidad Absoluta</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Todos los datos se guardan de forma <strong>segura en tu dispositivo</strong>. No se envían a ningún servidor externo.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                          <Cloud className="text-indigo-500" size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider">Sincronización en la Nube</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Puedes guardar tus datos en la nube con tu cuenta de Google e iniciar con tu cuenta en otros dispositivos y tus datos estarán siempre actualizados.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                      <p className="text-[11px] text-slate-400 italic text-center leading-normal">
                        Recuerda que los cálculos son estimaciones basadas en el convenio colectivo y la configuración que introduzcas.
                      </p>
                    </div>

                    <button
                      onClick={() => setStep(2)}
                      className="w-full bg-azul-blue hover:bg-azul-blue/90 text-white font-black py-4 rounded-2xl shadow-lg shadow-azul-blue/20 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                      Continuar
                      <ArrowRight size={16} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                        ¿Cómo usarlo como una App nativa?
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Puedes instalar esta aplicación en tu teléfono móvil para acceder a ella con un solo toque desde tu pantalla de inicio, como cualquier otra app de la App Store o Google Play.
                      </p>
                    </div>

                    {/* OS Selector Tabs */}
                    <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-150">
                      <button
                        onClick={() => setActiveOs('ios')}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                          activeOs === 'ios'
                            ? "bg-white text-slate-800 shadow-md"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                         iOS (iPhone / iPad)
                      </button>
                      <button
                        onClick={() => setActiveOs('android')}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                          activeOs === 'android'
                            ? "bg-white text-slate-800 shadow-md"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        🤖 Android (Chrome)
                      </button>
                    </div>

                    {/* Step Instructions */}
                    <div className="space-y-4">
                      {activeOs === 'ios' ? (
                        <div className="space-y-4">
                          <div className="space-y-3.5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                            <div className="flex gap-3.5 items-start">
                              <span className="w-5 h-5 rounded-full bg-azul-blue/15 text-azul-blue text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                1
                              </span>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                Abre esta web en el navegador <strong className="text-slate-900 font-bold">Safari</strong> de tu iPhone o iPad.
                              </p>
                            </div>
                            <div className="flex gap-3.5 items-start">
                              <span className="w-5 h-5 rounded-full bg-azul-blue/15 text-azul-blue text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                2
                              </span>
                              <div className="flex-1 space-y-1">
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  Pulsa el botón de <strong className="text-slate-900 font-bold">Compartir</strong> de la barra inferior de Safari.
                                </p>
                                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 py-1.5 px-3 rounded-xl text-slate-700 text-[10px] font-bold shadow-xs">
                                  <Share size={12} className="text-azul-blue" />
                                  Icono de compartir
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-3.5 items-start">
                              <span className="w-5 h-5 rounded-full bg-azul-blue/15 text-azul-blue text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                3
                              </span>
                              <div className="flex-1 space-y-1">
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  Selecciona la opción <strong className="text-slate-900 font-bold">"Añadir a la pantalla de inicio"</strong>.
                                </p>
                                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 py-1.5 px-3 rounded-xl text-slate-700 text-[10px] font-bold shadow-xs">
                                  <PlusSquare size={12} className="text-azul-blue" />
                                  Añadir a la pantalla de inicio
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-400 text-center leading-relaxed font-medium">
                            *Nota: Debido a requisitos de seguridad de Apple (iOS/iPadOS), no se permite la instalación automática directa desde webs ni otras tiendas que no sean Safari (Compartir).
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3.5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                          <div className="flex gap-3.5 items-start">
                            <span className="w-5 h-5 rounded-full bg-azul-blue/15 text-azul-blue text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                              1
                            </span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Usa el navegador <strong className="text-slate-900 font-bold">Google Chrome</strong> en tu móvil.
                            </p>
                          </div>
                          <div className="flex gap-3.5 items-start">
                            <span className="w-5 h-5 rounded-full bg-azul-blue/15 text-azul-blue text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                              2
                            </span>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs text-slate-600 leading-relaxed">
                                Toca el botón de <strong className="text-slate-900 font-bold">tres puntos vertical (⋮)</strong> en la barra de Chrome.
                              </p>
                              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 py-1.5 px-3 rounded-xl text-slate-700 text-[10px] font-bold shadow-xs">
                                <MoreVertical size={12} className="text-azul-blue" />
                                Menú de Chrome
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3.5 items-start">
                            <span className="w-5 h-5 rounded-full bg-azul-blue/15 text-azul-blue text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                              3
                            </span>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs text-slate-600 leading-relaxed">
                                Selecciona <strong className="text-slate-900 font-bold">"Añadir a la pantalla de inicio"</strong>. Esto creará un <strong>acceso directo de Chrome</strong> en tu móvil.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3.5 items-start">
                            <span className="w-5 h-5 rounded-full bg-azul-blue/15 text-azul-blue text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                              4
                            </span>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs text-slate-600 leading-relaxed">
                                Abre la app desde ese <strong>nuevo acceso directo</strong> en Chrome, pulsa los tres puntos (⋮) y selecciona <strong className="text-slate-900 font-bold">"Instalar aplicación"</strong> para usarla de forma nativa e independiente.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={onClose}
                      className="w-full bg-azul-blue hover:bg-azul-blue/90 text-white font-black py-4 rounded-2xl shadow-lg shadow-azul-blue/20 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                      <CheckCircle2 size={16} />
                      Comenzar ahora
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
