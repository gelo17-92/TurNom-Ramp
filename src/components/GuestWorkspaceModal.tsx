import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Upload, 
  Download, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  FolderOpen,
  LogOut,
  Sparkles,
  Info,
  Copy,
  Save,
  Check,
  Sliders,
  ArrowRight,
  Bookmark,
  Trash2
} from 'lucide-react';
import { Settings, DayShift, YearlyLevels, YearlyPluses, cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export interface SavedGuestProfile {
  id: string;
  workerName: string;
  contractType: 'Completo' | 'Parcial';
  colectivo: 'rampa' | 'pasaje';
  totalShifts: number;
  updatedAt: string;
  settings: Settings;
  shifts: DayShift[];
  levels: YearlyLevels;
  pluses: YearlyPluses;
}

export interface GuestBackupPayload {
  version?: number;
  appName?: string;
  exportDate?: string;
  workerName?: string;
  settings: Settings;
  shifts: DayShift[];
  levels: YearlyLevels;
  pluses: YearlyPluses;
  meta?: {
    workerName?: string;
    totalShifts?: number;
    totalSecondCompanyShifts?: number;
    totalPayrolls?: number;
    appVersion?: string;
  };
}

interface GuestWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGuestMode: boolean;
  guestWorkerName: string;
  currentSettings: Settings;
  currentShifts: DayShift[];
  currentLevels: YearlyLevels;
  currentPluses: YearlyPluses;
  onEnterGuestModeWithFile: (payload: {
    settings: Settings;
    shifts: DayShift[];
    levels: YearlyLevels;
    pluses: YearlyPluses;
    workerName: string;
  }) => void;
  onEnterBlankGuestMode: (workerName: string, contractType: 'Completo' | 'Parcial', colectivo: 'rampa' | 'pasaje') => void;
  onEnterCopyGuestMode: (workerName: string) => void;
  onSaveGuestChanges: (newName?: string) => void;
  onApplyGuestChangesToPrimary?: () => void;
  onDownloadGuestData: () => void;
  onExitGuestMode: () => void;
  onShowToast: (toast: { type: 'success' | 'error'; title: string; desc: string }) => void;
}

export function GuestWorkspaceModal({
  isOpen,
  onClose,
  isGuestMode,
  guestWorkerName,
  currentSettings,
  currentShifts,
  currentLevels,
  currentPluses,
  onEnterGuestModeWithFile,
  onEnterBlankGuestMode,
  onEnterCopyGuestMode,
  onSaveGuestChanges,
  onApplyGuestChangesToPrimary,
  onDownloadGuestData,
  onExitGuestMode,
  onShowToast
}: GuestWorkspaceModalProps) {
  useScrollLock(isOpen);

  // Tabs: 'manage' | 'saved' | 'blank' | 'upload' | 'copy'
  const [activeTab, setActiveTab] = useState<'manage' | 'saved' | 'blank' | 'upload' | 'copy'>('blank');

  // List of saved guest profiles
  const [savedProfiles, setSavedProfiles] = useState<SavedGuestProfile[]>([]);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);

  // Form states
  const [blankWorkerName, setBlankWorkerName] = useState('Compañero 1');
  const [blankContractType, setBlankContractType] = useState<'Completo' | 'Parcial'>('Completo');
  const [blankColectivo, setBlankColectivo] = useState<'rampa' | 'pasaje'>('rampa');

  const [copyWorkerName, setCopyWorkerName] = useState('Copia Turnos Actuales');
  const [editableWorkerName, setEditableWorkerName] = useState(guestWorkerName);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<GuestBackupPayload | null>(null);
  const [customWorkerName, setCustomWorkerName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [saveSuccessTick, setSaveSuccessTick] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getStoredProfiles = (): SavedGuestProfile[] => {
    try {
      const raw = localStorage.getItem('turnom_saved_guest_profiles');
      let list: SavedGuestProfile[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];

      // Migrar claves heredadas 'guest_backup_*' si no están en el registro
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('guest_backup_')) {
          const valStr = localStorage.getItem(key);
          if (valStr) {
            try {
              const val = JSON.parse(valStr);
              const wName = val.workerName || key.replace('guest_backup_', '').trim();
              const exists = list.some(p => (p.workerName || '').toLowerCase() === wName.toLowerCase());
              if (!exists && val.settings && val.shifts) {
                list.push({
                  id: `guest_legacy_${Date.now()}_${Math.random()}`,
                  workerName: wName,
                  contractType: val.settings.contractType || 'Completo',
                  colectivo: val.settings.colectivoConvenio || 'rampa',
                  totalShifts: Array.isArray(val.shifts) ? val.shifts.length : 0,
                  updatedAt: val.savedAt || new Date().toISOString(),
                  settings: val.settings,
                  shifts: val.shifts,
                  levels: val.levels || {},
                  pluses: val.pluses || {}
                });
              }
            } catch (e) {}
          }
        }
      }
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return list;
    } catch (e) {
      return [];
    }
  };

  useEffect(() => {
    if (isOpen) {
      const profiles = getStoredProfiles();
      setSavedProfiles(profiles);
      setDeletingProfileId(null);
      setEditableWorkerName(guestWorkerName);

      if (isGuestMode) {
        setActiveTab('manage');
      } else {
        setActiveTab(profiles.length > 0 ? 'saved' : 'blank');
      }
    }
  }, [isOpen, isGuestMode, guestWorkerName]);

  if (!isOpen) return null;

  const formatProfileDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return 'Reciente';
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Reciente';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError(null);
    setSelectedFile(file);

    const cleanFileName = file.name
      .replace(/\.json$/i, '')
      .replace(/^turnom_/i, '')
      .replace(/^copia_seguridad_/i, '')
      .replace(/^cuadrante_/i, '')
      .replace(/_\d{4}-\d{2}-\d{2}.*$/, '')
      .replace(/_/g, ' ')
      .trim();

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = (event.target?.result as string) || '';
        const text = rawText.replace(/^\uFEFF/, '').trim();
        const json = JSON.parse(text);

        if (!json || typeof json !== 'object') {
          throw new Error('El archivo seleccionado no tiene un formato JSON válido.');
        }

        if (!json.shifts && !json.settings && !json.levels) {
          throw new Error('El archivo no parece ser un cuadrante o copia de seguridad válida.');
        }

        const detectedName = json.workerName || json.meta?.workerName || cleanFileName || 'Compañero';
        setCustomWorkerName(detectedName);

        setParsedData({
          version: json.version || 1,
          appName: json.appName || 'TurNom Ramp',
          exportDate: json.exportDate,
          workerName: detectedName,
          settings: json.settings || currentSettings,
          shifts: Array.isArray(json.shifts) ? json.shifts : [],
          levels: json.levels || currentLevels,
          pluses: json.pluses || currentPluses,
          meta: json.meta
        });
      } catch (err: any) {
        console.error('Error al analizar archivo JSON:', err);
        setFileError(err.message || 'Error al procesar el archivo. Asegúrate de que sea un .json válido.');
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmLoadFile = () => {
    if (!parsedData) return;
    const finalName = customWorkerName.trim() || 'Compañero';
    onEnterGuestModeWithFile({
      settings: parsedData.settings,
      shifts: parsedData.shifts,
      levels: parsedData.levels,
      pluses: parsedData.pluses,
      workerName: finalName
    });
    onShowToast({
      type: 'success',
      title: 'Modo Invitado Activado',
      desc: `Has cargado el cuadrante de "${finalName}" con ${parsedData.shifts.length} turnos.`
    });
    onClose();
  };

  const handleConfirmBlank = () => {
    const finalName = blankWorkerName.trim() || 'Compañero 1';
    onEnterBlankGuestMode(finalName, blankContractType, blankColectivo);
    onShowToast({
      type: 'success',
      title: 'Cuadrante en Blanco Creado',
      desc: `Iniciado cuadrante vacío para "${finalName}". Puedes empezar a introducir sus turnos.`
    });
    onClose();
  };

  const handleConfirmCopy = () => {
    const finalName = copyWorkerName.trim() || 'Copia Turnos Actuales';
    onEnterCopyGuestMode(finalName);
    onClose();
  };

  const handleTriggerSave = () => {
    const trimmed = editableWorkerName.trim() || guestWorkerName;
    onSaveGuestChanges(trimmed);
    setSaveSuccessTick(true);
    setTimeout(() => setSaveSuccessTick(false), 3000);
    // Refrescar lista de guardados localmente
    setSavedProfiles(getStoredProfiles());
  };

  const handleLoadSavedProfile = (profile: SavedGuestProfile) => {
    onEnterGuestModeWithFile({
      settings: profile.settings,
      shifts: profile.shifts,
      levels: profile.levels,
      pluses: profile.pluses,
      workerName: profile.workerName
    });
    onShowToast({
      type: 'success',
      title: 'Perfil de Invitado Cargado',
      desc: `Has accedido al cuadrante de "${profile.workerName}" (${profile.totalShifts} turnos).`
    });
    onClose();
  };

  const handleDownloadSavedProfileJson = (profile: SavedGuestProfile) => {
    try {
      const now = new Date();
      const cleanName = profile.workerName.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ-]/g, '').trim() || 'Companero';
      const payload = {
        version: 1,
        appName: 'TurNom Ramp',
        exportDate: now.toISOString(),
        workerName: profile.workerName,
        settings: profile.settings,
        shifts: profile.shifts,
        levels: profile.levels,
        pluses: profile.pluses,
        meta: {
          workerName: profile.workerName,
          totalShifts: profile.shifts.length,
          appVersion: '2.0'
        }
      };
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `cuadrante_${cleanName.replace(/\s+/g, '_')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      onShowToast({
        type: 'success',
        title: 'Archivo Descargado',
        desc: `Se ha descargado el cuadrante de "${profile.workerName}".`
      });
    } catch (err) {
      console.error("Error al descargar perfil guardado:", err);
    }
  };

  const handleDeleteSavedProfile = (id: string, name: string) => {
    try {
      const updated = savedProfiles.filter(p => p.id !== id);
      setSavedProfiles(updated);
      localStorage.setItem('turnom_saved_guest_profiles', JSON.stringify(updated));
      localStorage.removeItem(`guest_backup_${name}`);
      setDeletingProfileId(null);
      onShowToast({
        type: 'success',
        title: 'Perfil Eliminado',
        desc: `El perfil guardado de "${name}" ha sido eliminado correctamente.`
      });
    } catch (err) {
      console.error("Error al eliminar perfil de invitado:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
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
        className="bg-white dark:bg-slate-900 rounded-[2.25rem] p-5 sm:p-6 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 flex flex-col text-left overflow-hidden text-slate-800 dark:text-slate-100 max-h-[92vh]"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-3.5 mt-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Users size={22} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black uppercase text-xs sm:text-sm tracking-[0.08em] text-slate-900 dark:text-white leading-tight">
                Modo Invitado
              </h3>
              {isGuestMode && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                  Activo
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-tight">
              {isGuestMode 
                ? `Editando y gestionando cuadrante de "${guestWorkerName}"`
                : 'Crea, sube, clona o retoma cuadrantes guardados de forma aislada'}
            </p>
          </div>
        </div>

        {/* Security & Cloud Guarantee Notice */}
        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-2xl border border-sky-200/80 dark:border-sky-800/60 flex items-start gap-2.5 mb-3.5">
          <ShieldCheck className="w-4 h-4 text-azul-blue dark:text-sky-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-sky-900 dark:text-sky-200 font-semibold leading-relaxed">
            Tu cuadrante personal está protegido. En modo invitado la nube se pausa para que los datos editados no toquen tu cuenta.
          </p>
        </div>

        {/* Top Tab Bar: Scrollable / Grid */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-3.5 shrink-0 overflow-x-auto custom-scrollbar">
          {isGuestMode && (
            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={cn(
                "py-2 px-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0",
                activeTab === 'manage'
                  ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Sliders size={13} className="shrink-0" />
              <span>Gestionar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={cn(
              "py-2 px-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0",
              activeTab === 'saved'
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Bookmark size={13} className="shrink-0" />
            <span>Guardados</span>
            {savedProfiles.length > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[9px] font-black leading-tight",
                activeTab === 'saved'
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              )}>
                {savedProfiles.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('blank')}
            className={cn(
              "py-2 px-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0",
              activeTab === 'blank'
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <PlusCircle size={13} className="shrink-0" />
            <span>En blanco</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={cn(
              "py-2 px-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0",
              activeTab === 'upload'
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <FolderOpen size={13} className="shrink-0" />
            <span>Subir .json</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('copy')}
            className={cn(
              "py-2 px-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0",
              activeTab === 'copy'
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Copy size={13} className="shrink-0" />
            <span>Copia actuales</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto space-y-3 pr-0.5 custom-scrollbar">

          {/* TAB: GESTIONAR (Solo en Modo Invitado) */}
          {activeTab === 'manage' && isGuestMode && (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/60 rounded-2xl space-y-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                      Perfil Invitado Activo
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white truncate block">
                      👤 {guestWorkerName}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Turnos actuales:</span>
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                      {currentShifts.length} días
                    </span>
                  </div>
                </div>

                {/* Editar nombre del perfil */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                    Cambiar nombre / alias del invitado:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editableWorkerName}
                      onChange={(e) => setEditableWorkerName(e.target.value)}
                      placeholder="Nombre del compañero"
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {editableWorkerName.trim() !== guestWorkerName && (
                      <button
                        type="button"
                        onClick={handleTriggerSave}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      >
                        Actualizar
                      </button>
                    )}
                  </div>
                </div>

                {/* Acciones principales de Guardar y Descargar */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/70 dark:border-amber-800/40">
                  <button
                    type="button"
                    onClick={handleTriggerSave}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    {saveSuccessTick ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saveSuccessTick ? '¡Guardado!' : 'Guardar cambios'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onDownloadGuestData}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar .json</span>
                  </button>
                </div>

                {/* Aplicar al principal (opcional) */}
                {onApplyGuestChangesToPrimary && (
                  <div className="pt-2 border-t border-amber-200/70 dark:border-amber-800/40">
                    {!showApplyConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowApplyConfirm(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-700 dark:text-slate-200 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                        <span>Aplicar estos turnos a mi cuadrante principal</span>
                      </button>
                    ) : (
                      <div className="p-3 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2">
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 font-bold leading-snug">
                          ¿Seguro que deseas sustituir tu cuadrante principal por estos {currentShifts.length} turnos de invitado?
                        </p>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setShowApplyConfirm(false)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowApplyConfirm(false);
                              onApplyGuestChangesToPrimary();
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-black text-[10px] uppercase shadow-xs cursor-pointer"
                          >
                            Confirmar y Aplicar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Salir de modo invitado */}
              <div className="pt-1">
                {!showExitConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowExitConfirm(true)}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[11px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Salir y volver a mi cuadrante personal</span>
                  </button>
                ) : (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-2 text-left">
                    <p className="text-[11px] text-rose-900 dark:text-rose-200 font-bold">
                      ¿Seguro que deseas salir del modo invitado? Se restaurará tu cuadrante original intacto.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowExitConfirm(false)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExitConfirm(false);
                          onExitGuestMode();
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase cursor-pointer"
                      >
                        Confirmar Salida
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PERFILES GUARDADOS */}
          {activeTab === 'saved' && (
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Cuadrantes de Invitado Guardados
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    Selecciona un perfil para reanudar su edición o descargar su respaldo.
                  </p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0">
                  {savedProfiles.length} {savedProfiles.length === 1 ? 'perfil' : 'perfiles'}
                </span>
              </div>

              {savedProfiles.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                      Aún no tienes perfiles guardados
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
                      Cuando crees un cuadrante, clones turnos o subas un archivo y pulses <span className="font-bold text-amber-600 dark:text-amber-400">Guardar</span>, aparecerá aquí para que puedas volver a él en cualquier momento.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('copy')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                    >
                      Copiar turnos actuales
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('blank')}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Crear en blanco
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-0.5 custom-scrollbar">
                  {savedProfiles.map((p) => {
                    const isCurrent = isGuestMode && (guestWorkerName.toLowerCase() === p.workerName.toLowerCase());
                    const isDeleting = deletingProfileId === p.id;

                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all text-left space-y-2.5",
                          isCurrent
                            ? "bg-amber-500/10 border-amber-400/80 dark:border-amber-500/60 shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-xs shrink-0">
                              {p.workerName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                  {p.workerName}
                                </span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shrink-0">
                                    Perfil en uso
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex-wrap">
                                <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                                  {p.colectivo === 'pasaje' ? '✈️ Pasaje' : '🚜 Rampa'}
                                </span>
                                <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                                  {p.contractType}
                                </span>
                                <span className="text-amber-600 dark:text-amber-400 font-black">
                                  {p.totalShifts} {p.totalShifts === 1 ? 'turno' : 'turnos'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-slate-400 font-bold block">
                              {formatProfileDate(p.updatedAt)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {isDeleting ? (
                          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-rose-800 dark:text-rose-200">
                              ¿Eliminar este perfil guardado?
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setDeletingProfileId(null)}
                                className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[9px] font-bold"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSavedProfile(p.id, p.workerName)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDownloadSavedProfileJson(p)}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                                title="Descargar archivo .json"
                              >
                                <Download size={11} className="text-amber-500" />
                                <span>.json</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingProfileId(p.id)}
                                className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Eliminar este perfil guardado"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleLoadSavedProfile(p)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95",
                                isCurrent
                                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                  : "bg-amber-500 hover:bg-amber-600 text-white"
                              )}
                            >
                              <ArrowRight size={12} />
                              <span>{isCurrent ? 'Continuar editando' : 'Cargar y entrar'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: CREAR CUADRANTE EN BLANCO */}
          {activeTab === 'blank' && (
            <div className="space-y-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl text-left">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                  Nombre del Compañero / Cuadrante:
                </label>
                <input
                  type="text"
                  value={blankWorkerName}
                  onChange={(e) => setBlankWorkerName(e.target.value)}
                  placeholder="Ej: Carlos Rampa, Laura Pasaje..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                    Tipo de Contrato:
                  </label>
                  <select
                    value={blankContractType}
                    onChange={(e) => setBlankContractType(e.target.value as 'Completo' | 'Parcial')}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Completo">Tiempo Completo</option>
                    <option value="Parcial">Tiempo Parcial</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                    Colectivo Convenio:
                  </label>
                  <select
                    value={blankColectivo}
                    onChange={(e) => setBlankColectivo(e.target.value as 'rampa' | 'pasaje')}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="rampa">🚜 Personal de Rampa</option>
                    <option value="pasaje">✈️ Personal de Pasaje</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Se creará un cuadrante vacío con las tablas oficiales del colectivo seleccionado. Podrás introducir turnos, vacaciones y libranzas desde cero.
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmBlank}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Crear Cuadrante en Blanco</span>
              </button>
            </div>
          )}

          {/* TAB 2: SUBIR ARCHIVO .JSON */}
          {activeTab === 'upload' && (
            <div className="space-y-3.5 text-left">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
                  selectedFile
                    ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                )}
              >
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Upload size={22} />
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {selectedFile ? selectedFile.name : 'Pulsa para seleccionar archivo .json'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Formatos compatibles: respaldos TurNom Ramp, copias de seguridad de compañeros
                </p>
              </div>

              {fileError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{fileError}</span>
                </div>
              )}

              {parsedData && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                      Nombre para este Cuadrante:
                    </label>
                    <input
                      type="text"
                      value={customWorkerName}
                      onChange={(e) => setCustomWorkerName(e.target.value)}
                      placeholder="Nombre del compañero"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Turnos detectados</span>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">{parsedData.shifts.length}</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Convenio</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {parsedData.settings.colectivoConvenio === 'pasaje' ? 'Pasaje' : 'Rampa'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmLoadFile}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Cargar Cuadrante de Invitado</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COPIA DE TURNOS ACTUALES */}
          {activeTab === 'copy' && (
            <div className="space-y-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl text-left">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                  Nombre para la copia de turnos:
                </label>
                <input
                  type="text"
                  value={copyWorkerName}
                  onChange={(e) => setCopyWorkerName(e.target.value)}
                  placeholder="Ej: Copia Turnos Actuales"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Turnos</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400">{currentShifts.length}</span>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Contrato</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">{currentSettings.contractType}</span>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Pagas</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">{currentSettings.pagas}</span>
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Se clonarán todos tus turnos actuales ({currentShifts.length} turnos) y ajustes para que puedas editar y probar escenarios libremente sin que afecte a tu cuadrante personal original.
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmCopy}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                <span>Entrar con Copia de Turnos Actuales</span>
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
