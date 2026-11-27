import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Share2, 
  UserPlus, 
  Trash2, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  X, 
  KeyRound, 
  LogIn, 
  CalendarCheck,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Ban
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  dbGetSharingConfig, 
  dbAddEditor, 
  dbRemoveEditor, 
  dbGenerateShareCode, 
  dbJoinSharedQuadrantByCode,
  dbGetQuadrantsSharedWithMe,
  dbToggleSharingLocked,
  dbToggleSharingHidePayroll,
  dbToggleEditorStatus,
  dbToggleAllEditorsStatus
} from '../firebase';
import { type SharingConfig, type SharedQuadrantInfo, cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

interface ShareQuadrantModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onGoogleLogin: () => void;
  activeSharedOwner: SharedQuadrantInfo | null;
  onSelectSharedQuadrant: (owner: SharedQuadrantInfo | null) => void;
  onShowToast: (toast: { type: 'success' | 'error'; title: string; desc: string }) => void;
}

export function ShareQuadrantModal({
  isOpen,
  onClose,
  user,
  onGoogleLogin,
  activeSharedOwner,
  onSelectSharedQuadrant,
  onShowToast
}: ShareQuadrantModalProps) {
  useScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<'my_editors' | 'shared_with_me'>('my_editors');
  const [sharingConfig, setSharingConfig] = useState<SharingConfig | null>(null);
  const [sharedWithMeList, setSharedWithMeList] = useState<SharedQuadrantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newEditorEmail, setNewEditorEmail] = useState('');
  const [isAddingEditor, setIsAddingEditor] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [isTogglingEditor, setIsTogglingEditor] = useState<string | null>(null);
  const [isTogglingAll, setIsTogglingAll] = useState(false);

  const handleToggleEditorStatus = async (editorEmail: string, newActive: boolean) => {
    if (!user) return;
    setIsTogglingEditor(editorEmail);
    try {
      await dbToggleEditorStatus(user.uid, editorEmail, newActive);
      setSharingConfig(prev => {
        if (!prev) return null;
        const currentDisabled = (prev.disabledEditors || []).map(e => e.toLowerCase());
        const clean = editorEmail.toLowerCase();
        const updatedDisabled = newActive
          ? currentDisabled.filter(e => e !== clean)
          : (currentDisabled.includes(clean) ? currentDisabled : [...currentDisabled, clean]);
        return {
          ...prev,
          disabledEditors: updatedDisabled
        };
      });
      onShowToast({
        type: 'success',
        title: newActive ? 'Editor Activado' : 'Editor Desactivado',
        desc: newActive 
          ? `"${editorEmail}" ahora tiene acceso a los datos de tu app.`
          : `"${editorEmail}" ha sido desactivado. No podrá acceder a tus datos hasta que lo actives.`
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'Error al cambiar estado',
        desc: err.message || 'No se pudo actualizar el acceso del editor.'
      });
    } finally {
      setIsTogglingEditor(null);
    }
  };

  const handleToggleAllEditors = async (newActive: boolean) => {
    if (!user || !sharingConfig?.editors || sharingConfig.editors.length === 0) return;
    setIsTogglingAll(true);
    try {
      await dbToggleAllEditorsStatus(user.uid, newActive);
      setSharingConfig(prev => {
        if (!prev) return null;
        return {
          ...prev,
          disabledEditors: newActive ? [] : [...(prev.editors || [])]
        };
      });
      onShowToast({
        type: 'success',
        title: newActive ? 'Todos los editores activados' : 'Todos los editores desactivados',
        desc: newActive 
          ? 'Todos tus editores autorizados tienen acceso activo a tus datos.'
          : 'Se ha suspendido el acceso a todos los editores. Ninguno podrá acceder hasta que los reactives.'
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'Error al actualizar',
        desc: err.message || 'No se pudo cambiar el estado de los editores.'
      });
    } finally {
      setIsTogglingAll(false);
    }
  };

  const handleToggleLock = async (newLocked: boolean) => {
    if (!user) return;
    setIsTogglingLock(true);
    try {
      await dbToggleSharingLocked(user.uid, newLocked);
      setSharingConfig(prev => prev ? { ...prev, isLocked: newLocked } : null);
      onShowToast({
        type: 'success',
        title: newLocked ? 'Edición bloqueada' : 'Edición permitida',
        desc: newLocked 
          ? 'Tus turnos han sido bloqueados. Los compañeros vinculados ahora solo pueden visualizarlos (modo solo lectura).'
          : 'Tus turnos han sido desbloqueados para que tus compañeros autorizados puedan editar.'
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'Error al cambiar bloqueo',
        desc: err.message || 'No se pudo actualizar el estado de bloqueo.'
      });
    } finally {
      setIsTogglingLock(false);
    }
  };

  const [isTogglingPayrollVisibility, setIsTogglingPayrollVisibility] = useState(false);

  const handleToggleHidePayroll = async (newHide: boolean) => {
    if (!user) return;
    setIsTogglingPayrollVisibility(true);
    try {
      await dbToggleSharingHidePayroll(user.uid, newHide);
      setSharingConfig(prev => prev ? { ...prev, hidePayrollAmounts: newHide } : null);
      onShowToast({
        type: 'success',
        title: newHide ? 'Importes de nómina ocultos' : 'Importes de nómina visibles',
        desc: newHide 
          ? 'Los importes (€) de tu sección nómina ahora están ocultos para los compañeros con acceso a tu cuadrante.'
          : 'Los importes (€) de tu sección nómina ahora son visibles para los compañeros con acceso a tu cuadrante.'
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'Error al cambiar visibilidad',
        desc: err.message || 'No se pudo actualizar la visibilidad de los importes de nómina.'
      });
    } finally {
      setIsTogglingPayrollVisibility(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !user) return;
    loadData();
  }, [isOpen, user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [config, sharedList] = await Promise.all([
        dbGetSharingConfig(user.uid),
        dbGetQuadrantsSharedWithMe(user.email || '', user.uid)
      ]);
      setSharingConfig(config);
      setSharedWithMeList(sharedList);
    } catch (e) {
      console.warn("Error loading sharing data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAddEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const email = newEditorEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      onShowToast({
        type: 'error',
        title: 'Email inválido',
        desc: 'Por favor introduce un correo electrónico válido.'
      });
      return;
    }

    if (email === user.email?.toLowerCase()) {
      onShowToast({
        type: 'error',
        title: 'Correo propio',
        desc: 'No puedes añadirte a ti mismo como editor colaborador.'
      });
      return;
    }

    setIsAddingEditor(true);
    try {
      const ownerName = user.displayName || user.email?.split('@')[0] || 'Titular';
      await dbAddEditor(user.uid, ownerName, user.email || '', email);
      setNewEditorEmail('');
      await loadData();
      onShowToast({
        type: 'success',
        title: 'Editor autorizado',
        desc: `"${email}" ahora tiene permiso para editar tus turnos en la nube.`
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'Error al autorizar',
        desc: err.message || 'No se pudo añadir el editor.'
      });
    } finally {
      setIsAddingEditor(false);
    }
  };

  const handleRemoveEditor = async (editorEmail: string) => {
    if (!user) return;
    try {
      await dbRemoveEditor(user.uid, editorEmail);
      await loadData();
      onShowToast({
        type: 'success',
        title: 'Permiso revocado',
        desc: `Se ha retirado el acceso a "${editorEmail}".`
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'Error al revocar',
        desc: 'No se pudo revocar el permiso.'
      });
    }
  };

  const handleGenerateCode = async () => {
    if (!user) return;
    setIsGeneratingCode(true);
    try {
      const ownerName = user.displayName || user.email?.split('@')[0] || 'Titular';
      const code = await dbGenerateShareCode(user.uid, ownerName, user.email || '');
      await loadData();
      onShowToast({
        type: 'success',
        title: 'Código generado',
        desc: `Código de vinculación: ${code}.`
      });
    } catch (e) {
      onShowToast({
        type: 'error',
        title: 'Error',
        desc: 'No se pudo generar el código.'
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    onShowToast({
      type: 'success',
      title: 'Código copiado',
      desc: `Código "${code}" copiado al portapapeles.`
    });
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const clean = joinCode.trim().toUpperCase();
    if (clean.length !== 6) {
      onShowToast({
        type: 'error',
        title: 'Código incompleto',
        desc: 'El código de vinculación debe tener 6 caracteres.'
      });
      return;
    }

    setIsJoining(true);
    try {
      const res = await dbJoinSharedQuadrantByCode(clean, user.uid, user.email || '');
      setJoinCode('');
      await loadData();
      onShowToast({
        type: 'success',
        title: '¡Vinculación completada!',
        desc: `Te has vinculado al cuadrante de "${res.ownerName}".`
      });
    } catch (err: any) {
      onShowToast({
        type: 'error',
        title: 'No se pudo vincular',
        desc: err.message || 'Código incorrecto o caducado.'
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="bg-white dark:bg-slate-900 rounded-[2.25rem] p-5 sm:p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 flex flex-col text-left overflow-hidden text-slate-800 dark:text-slate-100 max-h-[90vh]"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-azul-blue via-sky-400 to-indigo-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4 mt-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-azul-blue/10 dark:bg-azul-blue/20 flex items-center justify-center text-azul-blue dark:text-sky-400 shrink-0">
            <Share2 size={22} />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-black uppercase text-xs sm:text-sm tracking-[0.08em] text-slate-900 dark:text-white leading-tight">
              Compartir/Colab.
            </h3>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-3.5 pr-0.5 custom-scrollbar">
          
          {!user ? (
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl space-y-3 text-center">
              <div className="w-10 h-10 rounded-2xl bg-azul-blue/10 dark:bg-azul-blue/20 text-azul-blue dark:text-sky-400 mx-auto flex items-center justify-center">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Inicia sesión con Google
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Para otorgar permisos de edición en la nube es necesario conectar tu cuenta de Google.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoogleLogin();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-azul-blue hover:bg-azul-blue/90 text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <span>Conectar con Google</span>
              </button>
            </div>
          ) : (
            <>
              {/* Active Collaboration Indicator if currently editing someone else's quadrant */}
              {activeSharedOwner && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                      Editando en la nube:
                    </span>
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate block">
                      Cuadrante de {activeSharedOwner.ownerName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSharedQuadrant(null)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider shadow-xs hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    Volver al mío
                  </button>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('my_editors')}
                  className={cn(
                    "py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    activeTab === 'my_editors'
                      ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-sky-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <UserPlus size={14} />
                  <span>Autorizados</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('shared_with_me')}
                  className={cn(
                    "py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    activeTab === 'shared_with_me'
                      ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-sky-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <CalendarCheck size={14} />
                  <span>Accesos ({sharedWithMeList.length})</span>
                </button>
              </div>

              {/* TAB 1: AUTORIZADOS */}
              {activeTab === 'my_editors' && (
                <div className="space-y-3.5">
                  {/* Mi llave de acceso - Elemento principal centrado */}
                  <div className="p-4 sm:p-5 bg-gradient-to-b from-azul-blue/[0.08] via-sky-50/70 to-white dark:from-azul-blue/25 dark:via-slate-800/80 dark:to-slate-900 border-2 border-azul-blue/25 dark:border-sky-500/30 rounded-3xl shadow-sm text-center space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg leading-none" aria-hidden="true">🔑</span>
                        <span className="text-xs sm:text-sm font-black uppercase tracking-[0.12em] text-azul-blue dark:text-sky-300">
                          Mi llave de acceso
                        </span>
                      </div>
                      {user?.email && (
                        <p className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 truncate max-w-full px-2 tracking-tight">
                          {user.email}
                        </p>
                      )}
                    </div>

                    {sharingConfig?.activeCode ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-full py-3 px-4 bg-white dark:bg-slate-950/70 border border-azul-blue/20 dark:border-sky-500/30 rounded-2xl shadow-inner flex items-center justify-center">
                          <span className="font-mono text-2xl sm:text-3xl font-black tracking-[0.28em] text-azul-blue dark:text-sky-300 pl-[0.28em] select-all">
                            {sharingConfig.activeCode}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(sharingConfig.activeCode!)}
                            className="flex-1 max-w-[140px] flex items-center justify-center gap-1.5 px-3.5 py-2 bg-azul-blue hover:bg-azul-blue/90 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedCode ? "Copiado" : "Copiar"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateCode}
                            disabled={isGeneratingCode}
                            className="flex-1 max-w-[140px] flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-black uppercase tracking-wider rounded-xl text-[10px] transition-all active:scale-95 cursor-pointer"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", isGeneratingCode ? "animate-spin" : "")} />
                            <span>Regenerar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2.5">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 max-w-[240px] mx-auto">
                          Genera una llave de 6 caracteres para compartir tu cuadrante al instante.
                        </p>
                        <button
                          type="button"
                          onClick={handleGenerateCode}
                          disabled={isGeneratingCode}
                          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-azul-blue hover:bg-azul-blue/90 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-xl text-[11px] shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", isGeneratingCode ? "animate-spin" : "")} />
                          <span>Generar llave</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Contenedor en 2 columnas: Permiso de edición e Importes de nómina uno al lado del otro */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {/* Botón 1 (Izquierda): Master Lock - Permiso de edición */}
                    <button
                      type="button"
                      onClick={() => handleToggleLock(!sharingConfig?.isLocked)}
                      disabled={isTogglingLock}
                      className={cn(
                        "p-3 sm:p-4 rounded-2xl border transition-all flex flex-col items-center justify-between text-center gap-2.5 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.98] focus:outline-hidden",
                        sharingConfig?.isLocked
                          ? "bg-orange-50/70 dark:bg-orange-950/25 border-orange-200/80 dark:border-orange-800/40 hover:bg-orange-100/70 dark:hover:bg-orange-950/40"
                          : "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-800/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40"
                      )}
                      title={
                        sharingConfig?.isLocked
                          ? "Candado cerrado (Naranja): No das permiso. Pulsa para dar permiso (candado verde)."
                          : "Candado abierto (Verde): Das permiso. Pulsa para bloquear (candado naranja)."
                      }
                    >
                      {/* Icono de Candado */}
                      <div className={cn(
                        "w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border-2 flex items-center justify-center transition-all shrink-0 shadow-xs",
                        sharingConfig?.isLocked
                          ? "bg-orange-500/10 border-orange-500 text-orange-500 dark:text-orange-400 shadow-orange-500/10"
                          : "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/10"
                      )}>
                        {isTogglingLock ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : sharingConfig?.isLocked ? (
                          <Lock className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
                        ) : (
                          <Unlock className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
                        )}
                      </div>

                      {/* Nombre del botón y píldora del permiso debajo del icono */}
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <span className="text-[10.5px] sm:text-[11.5px] font-black uppercase tracking-wider text-slate-800 dark:text-white leading-tight">
                          Permiso de edición
                        </span>
                        <span className={cn(
                          "text-[8px] sm:text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border leading-none",
                          sharingConfig?.isLocked
                            ? "bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400"
                            : "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        )}>
                          {sharingConfig?.isLocked ? "Sin permiso (Bloqueado)" : "Permiso Concedido"}
                        </span>
                      </div>
                    </button>

                    {/* Botón 2 (Derecha): Permiso de Nómina - Importes de nómina */}
                    <button
                      type="button"
                      onClick={() => handleToggleHidePayroll(!sharingConfig?.hidePayrollAmounts)}
                      disabled={isTogglingPayrollVisibility}
                      className={cn(
                        "p-3 sm:p-4 rounded-2xl border transition-all flex flex-col items-center justify-between text-center gap-2.5 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.98] focus:outline-hidden",
                        sharingConfig?.hidePayrollAmounts
                          ? "bg-orange-50/70 dark:bg-orange-950/25 border-orange-200/80 dark:border-orange-800/40 hover:bg-orange-100/70 dark:hover:bg-orange-950/40"
                          : "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-800/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40"
                      )}
                      title={
                        sharingConfig?.hidePayrollAmounts
                          ? "Ojo cerrado (Naranja): No das permiso. Pulsa para dar permiso y mostrar importes (ojo verde)."
                          : "Ojo abierto (Verde): Das permiso. Pulsa para ocultar importes (ojo naranja)."
                      }
                    >
                      {/* Icono de Ojo */}
                      <div className={cn(
                        "w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border-2 flex items-center justify-center transition-all shrink-0 shadow-xs",
                        sharingConfig?.hidePayrollAmounts
                          ? "bg-orange-500/10 border-orange-500 text-orange-500 dark:text-orange-400 shadow-orange-500/10"
                          : "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/10"
                      )}>
                        {isTogglingPayrollVisibility ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : sharingConfig?.hidePayrollAmounts ? (
                          <EyeOff className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
                        ) : (
                          <Eye className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
                        )}
                      </div>

                      {/* Nombre del botón y píldora del permiso debajo del icono */}
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <span className="text-[10.5px] sm:text-[11.5px] font-black uppercase tracking-wider text-slate-800 dark:text-white leading-tight">
                          Importes de nómina
                        </span>
                        <span className={cn(
                          "text-[8px] sm:text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border leading-none",
                          sharingConfig?.hidePayrollAmounts
                            ? "bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400"
                            : "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        )}>
                          {sharingConfig?.hidePayrollAmounts ? "Sin permiso (Ocultos)" : "Permiso Concedido"}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Add Editor by Email Form */}
                  <form onSubmit={handleAddEditor} className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                      Autorizar por correo de Google:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newEditorEmail}
                        onChange={(e) => setNewEditorEmail(e.target.value)}
                        placeholder="ejemplo@gmail.com"
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-azul-blue"
                      />
                      <button
                        type="submit"
                        disabled={isAddingEditor || !newEditorEmail.trim()}
                        className="px-4 py-2 bg-azul-blue hover:bg-azul-blue/90 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {isAddingEditor ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        <span>Añadir</span>
                      </button>
                    </div>
                  </form>

                  {/* List of Authorized Editors */}
                  <div className="space-y-2">
                    {(() => {
                      const editorsList = sharingConfig?.editors || [];
                      const disabledEditorsList = (sharingConfig?.disabledEditors || []).map(e => e.toLowerCase());
                      const editorsCount = editorsList.length;
                      const activeEditorsCount = editorsList.filter(e => !disabledEditorsList.includes(e.toLowerCase())).length;

                      return (
                        <>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                Editores autorizados ({editorsCount}):
                              </span>
                              {editorsCount > 0 && (
                                <span className={cn(
                                  "text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border",
                                  activeEditorsCount > 0
                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                    : "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400"
                                )}>
                                  {activeEditorsCount} de {editorsCount} activos
                                </span>
                              )}
                            </div>

                            {/* Botón rápido para activar o desactivar a todos */}
                            {editorsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleToggleAllEditors(activeEditorsCount < editorsCount)}
                                disabled={isTogglingAll}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0 border border-slate-200/80 dark:border-slate-700/60 active:scale-95"
                                title={activeEditorsCount < editorsCount ? "Activar a todos los editores" : "Desactivar a todos los editores"}
                              >
                                {isTogglingAll ? (
                                  <RefreshCw className="w-3 h-3 animate-spin text-azul-blue" />
                                ) : activeEditorsCount < editorsCount ? (
                                  <>
                                    <CheckSquare className="w-3 h-3 text-emerald-500" />
                                    <span>Activar todos</span>
                                  </>
                                ) : (
                                  <>
                                    <Square className="w-3 h-3 text-slate-400" />
                                    <span>Desactivar todos</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {editorsCount === 0 ? (
                            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-xs">
                              Aún no tienes editores añadidos.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                              {editorsList.map((editorEmail) => {
                                const isEditorDisabled = disabledEditorsList.includes(editorEmail.toLowerCase());
                                const isEditorActive = !isEditorDisabled;
                                const isCurrentlyToggling = isTogglingEditor === editorEmail;

                                return (
                                  <div 
                                    key={editorEmail} 
                                    className={cn(
                                      "p-2.5 px-3 flex items-center justify-between gap-2.5 transition-colors",
                                      isEditorActive 
                                        ? "bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/50" 
                                        : "bg-slate-50/90 dark:bg-slate-900/40 opacity-80"
                                    )}
                                  >
                                    {/* Casilla individual interactiva */}
                                    <label 
                                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none group"
                                      title={isEditorActive ? "Acceso activo. Haz clic para desactivar a este editor." : "Acceso desactivado. Haz clic para activar a este editor."}
                                    >
                                      {/* Checkbox visual interactivo */}
                                      <div className="relative flex items-center justify-center shrink-0">
                                        <input
                                          type="checkbox"
                                          checked={isEditorActive}
                                          disabled={isCurrentlyToggling || isTogglingAll}
                                          onChange={() => handleToggleEditorStatus(editorEmail, !isEditorActive)}
                                          className="sr-only"
                                        />
                                        <div className={cn(
                                          "w-5 h-5 rounded-md border flex items-center justify-center transition-all shadow-2xs group-hover:scale-105",
                                          isCurrentlyToggling
                                            ? "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                                            : isEditorActive
                                              ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/20"
                                              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent hover:border-slate-400"
                                        )}>
                                          {isCurrentlyToggling ? (
                                            <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />
                                          ) : (
                                            <Check className={cn("w-3.5 h-3.5 stroke-[3]", isEditorActive ? "opacity-100" : "opacity-0")} />
                                          )}
                                        </div>
                                      </div>

                                      {/* Datos del editor */}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={cn(
                                            "font-bold text-xs truncate transition-colors",
                                            isEditorActive 
                                              ? "text-slate-800 dark:text-slate-100" 
                                              : "text-slate-400 dark:text-slate-500"
                                          )}>
                                            {editorEmail}
                                          </span>
                                          <span className={cn(
                                            "px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border",
                                            isEditorActive
                                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                              : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                                          )}>
                                            {isEditorActive ? "Activo" : "Desactivado"}
                                          </span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block leading-tight">
                                          {isEditorActive ? "Acceso permitido a la app" : "Acceso pausado a los datos"}
                                        </span>
                                      </div>
                                    </label>

                                    {/* Botón eliminar permanentemente */}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEditor(editorEmail)}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                                      title="Eliminar de la lista de editores"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Contenedor informativo al final de la pestaña */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                      Las personas autorizadas podrán ver tus turnos en tiempo real. Puedes bloquear la edición con el candado o proteger los importes de tu nómina con el botón del ojo. También puedes retirar el acceso definitivamente con la papelera.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPARTIDOS CONMIGO */}
              {activeTab === 'shared_with_me' && (
                <div className="space-y-3.5">
                  <form onSubmit={handleJoinByCode} className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                      Vincular mediante código:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Ej: CK89X2"
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-black text-slate-900 dark:text-white tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-azul-blue"
                      />
                      <button
                        type="submit"
                        disabled={isJoining || joinCode.trim().length !== 6}
                        className="px-4 py-2 bg-azul-blue hover:bg-azul-blue/90 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {isJoining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        <span>Vincular</span>
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                      Cuadrantes disponibles ({sharedWithMeList.length}):
                    </span>

                    {sharedWithMeList.length === 0 ? (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-xs">
                        No tienes cuadrantes compartidos todavía. Pide a tu compañero su código o que añada tu correo ({user.email}).
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sharedWithMeList.map((item) => {
                          const isActive = activeSharedOwner?.ownerUid === item.ownerUid;
                          return (
                            <div 
                              key={item.ownerUid}
                              className={cn(
                                "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3",
                                item.isDisabled
                                  ? "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80"
                                  : isActive
                                    ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={cn(
                                    "font-extrabold text-xs truncate",
                                    item.isDisabled ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white"
                                  )}>
                                    {item.ownerName}
                                  </span>
                                  {item.isDisabled ? (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-700/60 flex items-center gap-0.5">
                                      <Ban className="w-2.5 h-2.5" />
                                      Acceso Desactivado
                                    </span>
                                  ) : (
                                    <>
                                      {isActive && (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-azul-blue text-white shadow-2xs">
                                          Activo
                                        </span>
                                      )}
                                      {item.isLocked && (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-0.5">
                                          <Lock className="w-2.5 h-2.5" />
                                          Solo Lectura
                                        </span>
                                      )}
                                      {item.hidePayrollAmounts && (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700/60 flex items-center gap-0.5">
                                          <EyeOff className="w-2.5 h-2.5" />
                                          Nómina Oculta
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                                  {item.ownerEmail}
                                </span>
                                {item.isDisabled && (
                                  <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold block mt-0.5">
                                    El titular ha pausado temporalmente tu acceso a sus datos.
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={item.isDisabled}
                                onClick={() => {
                                  if (item.isDisabled) return;
                                  if (isActive) {
                                    onSelectSharedQuadrant(null);
                                  } else {
                                    onSelectSharedQuadrant(item);
                                  }
                                  onClose();
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all shadow-xs shrink-0",
                                  item.isDisabled
                                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                    : isActive
                                      ? "bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 cursor-pointer"
                                      : item.isLocked
                                        ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer"
                                        : "bg-azul-blue text-white hover:bg-azul-blue/90 cursor-pointer"
                                )}
                              >
                                {item.isDisabled 
                                  ? "Acceso Pausado" 
                                  : isActive 
                                    ? "Desconectar" 
                                    : (item.isLocked ? "Abrir (Lectura)" : "Abrir y Editar")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
