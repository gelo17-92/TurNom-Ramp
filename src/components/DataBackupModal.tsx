import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Upload, 
  HardDrive, 
  FileJson, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  Calendar,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Settings, DayShift, YearlyLevels, YearlyPluses, cn } from '../types';
import { safeFormat } from '../utils';
import { useScrollLock } from '../hooks/useScrollLock';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  shifts: DayShift[];
  levels: YearlyLevels;
  pluses: YearlyPluses;
  onRestoreData: (
    restored: {
      settings?: Partial<Settings> | null;
      shifts: DayShift[];
      levels?: YearlyLevels | null;
      pluses?: YearlyPluses | null;
    },
    mode: 'replace' | 'merge'
  ) => Promise<void> | void;
  onShowToast: (toast: { type: 'success' | 'error'; title: string; desc: string }) => void;
}

interface BackupPayload {
  version: number;
  appName: string;
  exportDate: string;
  settings?: Partial<Settings> | null;
  shifts: DayShift[];
  levels?: YearlyLevels | null;
  pluses?: YearlyPluses | null;
  meta?: {
    totalShifts: number;
    totalSecondCompanyShifts?: number;
    totalPayrolls: number;
    appVersion?: string;
  };
}

export function DataBackupModal({
  isOpen,
  onClose,
  settings,
  shifts,
  levels,
  pluses,
  onRestoreData,
  onShowToast
}: DataBackupModalProps) {
  useScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<BackupPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle Export File Download
  const handleExport = () => {
    try {
      setIsExporting(true);
      const now = new Date();
      const timestamp = safeFormat(now, 'yyyy-MM-dd_HHmm');
      const secondShiftsCount = settings.secondCompanyShifts?.length || 0;
      const backupData: BackupPayload = {
        version: 1,
        appName: 'TurNom Ramp',
        exportDate: now.toISOString(),
        settings,
        shifts,
        levels,
        pluses,
        meta: {
          totalShifts: shifts.length,
          totalSecondCompanyShifts: secondShiftsCount,
          totalPayrolls: (settings.savedPayrolls?.length || 0) + (settings.uploadedPayrolls?.length || 0),
          appVersion: '2.0'
        }
      };

      const jsonContent = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', blobUrl);
      downloadAnchor.setAttribute('download', `turnom_copia_seguridad_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

      onShowToast({
        type: 'success',
        title: 'Copia descargada',
        desc: secondShiftsCount > 0
          ? `Se ha guardado el archivo con ${shifts.length} turnos (+${secondShiftsCount} de ${settings.secondCompanyName || '2ª Empresa'}) y tus configuraciones en el dispositivo.`
          : `Se ha guardado el archivo con ${shifts.length} turnos y tus configuraciones en el dispositivo.`
      });

      setTimeout(() => {
        setIsExporting(false);
      }, 600);
    } catch (err) {
      console.error('Error al exportar datos:', err);
      setIsExporting(false);
      onShowToast({
        type: 'error',
        title: 'Error al exportar',
        desc: 'No se pudo generar el archivo de copia de seguridad.'
      });
    }
  };

  // Handle File Input selection for Import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    setImportError(null);
    setParsedBackup(null);
    setImportSuccess(false);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = (event.target?.result as string) || '';
        const text = rawText.replace(/^\uFEFF/, '').trim();
        const json = JSON.parse(text);

        // Basic verification
        if (!json || typeof json !== 'object') {
          throw new Error('El archivo no tiene un formato JSON válido.');
        }

        if (!json.shifts && !json.settings && !json.levels && !json.pluses) {
          throw new Error('El archivo no parece ser una copia de seguridad de TurNom Ramp válida.');
        }

        const validBackup: BackupPayload = {
          version: json.version || 1,
          appName: json.appName || 'TurNom Ramp',
          exportDate: json.exportDate || new Date().toISOString(),
          settings: json.settings && typeof json.settings === 'object' ? json.settings : null,
          shifts: Array.isArray(json.shifts) ? json.shifts : [],
          levels: json.levels && typeof json.levels === 'object' ? json.levels : null,
          pluses: json.pluses && typeof json.pluses === 'object' ? json.pluses : null,
          meta: json.meta || {
            totalShifts: Array.isArray(json.shifts) ? json.shifts.length : 0,
            totalPayrolls: 0
          }
        };

        setParsedBackup(validBackup);
      } catch (err: any) {
        console.error('Error al leer el archivo de copia:', err);
        setImportError(err.message || 'Error al procesar el archivo. Asegúrate de que sea un archivo .json válido.');
      }
    };
    reader.onerror = () => {
      setImportError('Error al abrir el archivo desde el dispositivo.');
    };
    reader.readAsText(file);
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!parsedBackup) return;

    try {
      setIsImporting(true);

      let finalShifts = parsedBackup.shifts;
      let finalSettings = parsedBackup.settings || null;
      let finalLevels = parsedBackup.levels || null;
      let finalPluses = parsedBackup.pluses || null;

      if (importMode === 'merge') {
        // Merge shifts: keep new and overwrite duplicates by date
        const shiftMap = new Map<string, DayShift>();
        shifts.forEach((s) => shiftMap.set(s.date, s));
        parsedBackup.shifts.forEach((s) => shiftMap.set(s.date, s));
        finalShifts = Array.from(shiftMap.values());

        // Merge payrolls if any
        const existingSaved = settings.savedPayrolls || [];
        const importedSaved = parsedBackup.settings?.savedPayrolls || [];
        const mergedSaved = [...existingSaved];
        importedSaved.forEach((p) => {
          if (!mergedSaved.some((ep) => ep.id === p.id || ep.monthKey === p.monthKey)) {
            mergedSaved.push(p);
          }
        });

        // Merge second company shifts if any
        const secondShiftMap = new Map<string, DayShift>();
        (settings.secondCompanyShifts || []).forEach((s) => secondShiftMap.set(s.date, s));
        (parsedBackup.settings?.secondCompanyShifts || []).forEach((s) => secondShiftMap.set(s.date, s));
        const mergedSecondShifts = Array.from(secondShiftMap.values());

        finalSettings = {
          ...settings,
          ...(parsedBackup.settings || {}),
          savedPayrolls: mergedSaved,
          secondCompanyShifts: mergedSecondShifts
        };

        finalLevels = {
          ...levels,
          ...(parsedBackup.levels || {})
        };

        finalPluses = {
          ...pluses,
          ...(parsedBackup.pluses || {})
        };
      }

      await onRestoreData({
        settings: finalSettings,
        shifts: finalShifts,
        levels: finalLevels,
        pluses: finalPluses
      }, importMode);

      setImportSuccess(true);
      const secondRestoredCount = finalSettings?.secondCompanyShifts?.length || 0;
      onShowToast({
        type: 'success',
        title: 'Copia restaurada',
        desc: secondRestoredCount > 0
          ? `Se han importado ${finalShifts.length} turnos (+${secondRestoredCount} de ${finalSettings?.secondCompanyName || '2ª Empresa'}) y todas las configuraciones con éxito.`
          : `Se han importado ${finalShifts.length} turnos y todas las configuraciones con éxito.`
      });

      setTimeout(() => {
        setIsImporting(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error al restaurar copia:', err);
      setIsImporting(false);
      onShowToast({
        type: 'error',
        title: 'Error al restaurar',
        desc: 'Ocurrió un error al procesar la restauración.'
      });
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
            <HardDrive size={22} />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-black uppercase text-xs sm:text-sm tracking-[0.08em] text-slate-900 dark:text-white leading-tight">
              Copia de Seguridad Local
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-tight">
              Exporta o importa tus turnos y datos en el dispositivo
            </p>
          </div>
        </div>

        {/* Navigation Tabs: Exportar vs Importar */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
          <button
            onClick={() => {
              setActiveTab('export');
              setImportError(null);
            }}
            className={cn(
              "py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'export'
                ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-sky-300 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('import');
            }}
            className={cn(
              "py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'import'
                ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-sky-300 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Upload size={14} />
            <span>Importar</span>
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto space-y-4 pr-0.5 custom-scrollbar">
          {activeTab === 'export' ? (
            /* --- EXPORT TAB --- */
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Resumen de tus datos actuales</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Turnos guardados</span>
                    <span className="text-base font-black text-azul-blue dark:text-sky-400">
                      {shifts.length} <span className="text-xs font-bold text-slate-500 dark:text-slate-400">días</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Nivel & Contrato</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200">
                      Nivel {settings.selectedLevel}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Nóminas guardadas</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {(settings.savedPayrolls?.length || 0) + (settings.uploadedPayrolls?.length || 0)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Tablas y Pluses</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      Personalizados
                    </span>
                  </div>
                </div>

                {(settings.dualMode || (settings.secondCompanyShifts && settings.secondCompanyShifts.length > 0)) && (
                  <div className="p-2.5 bg-orange-500/10 dark:bg-orange-500/15 rounded-xl border border-orange-500/20 dark:border-orange-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: settings.secondCompanyColor || '#f97316' }} />
                      <span className="text-[10px] font-black uppercase text-orange-700 dark:text-orange-300 truncate">
                        2º Calendario ({settings.secondCompanyName || '2ª Empresa'})
                      </span>
                    </div>
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400 shrink-0">
                      {settings.secondCompanyShifts?.length || 0} turnos
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Genera un archivo <span className="font-bold text-slate-700 dark:text-slate-200">.json</span> seguro con todos tus turnos, configuraciones, niveles y nóminas para guardarlo en tu móvil, ordenador o enviártelo por correo/WhatsApp.
                </p>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full text-white font-black uppercase text-xs tracking-widest py-3.5 px-4 rounded-2xl bg-azul-blue hover:bg-azul-blue/90 dark:bg-sky-600 dark:hover:bg-sky-500 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Generando archivo...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Descargar Copia de Seguridad</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* --- IMPORT TAB --- */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!parsedBackup ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-azul-blue dark:hover:border-sky-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-azul-blue/5 rounded-2xl p-6 text-center transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center mx-auto mb-3 text-slate-400 group-hover:text-azul-blue dark:group-hover:text-sky-300 transition-colors">
                    <FileJson size={26} />
                  </div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1">
                    Selecciona tu archivo de copia (.json)
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pulsa aquí para buscar el archivo en tu dispositivo
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                        Archivo Válido Detectado
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setParsedBackup(null);
                        setSelectedFile(null);
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                    >
                      Cambiar archivo
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>Fecha de la copia:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {parsedBackup.exportDate ? new Date(parsedBackup.exportDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Desconocida'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>Turnos a importar:</span>
                      <span className="font-black text-azul-blue dark:text-sky-400">
                        {parsedBackup.shifts?.length || 0} turnos
                      </span>
                    </div>
                    {((parsedBackup.settings?.secondCompanyShifts && parsedBackup.settings.secondCompanyShifts.length > 0) || parsedBackup.settings?.dualMode) && (
                      <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                        <span>2º Calendario ({parsedBackup.settings?.secondCompanyName || '2ª Empresa'}):</span>
                        <span className="font-black text-orange-600 dark:text-orange-400">
                          {parsedBackup.settings?.secondCompanyShifts?.length || 0} turnos
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>Nivel registrado:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Nivel {parsedBackup.settings?.selectedLevel || 1}
                      </span>
                    </div>
                  </div>

                  {/* Mode selector: Replace vs Merge */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                      Método de Restauración:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          importMode === 'replace'
                            ? "bg-azul-blue/10 border-azul-blue dark:bg-sky-950/40 dark:border-sky-500"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase block text-slate-800 dark:text-white">
                          Reemplazar todo
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          Sustituye los datos actuales
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          importMode === 'merge'
                            ? "bg-azul-blue/10 border-azul-blue dark:bg-sky-950/40 dark:border-sky-500"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase block text-slate-800 dark:text-white">
                          Combinar datos
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          Une los turnos existentes
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting || importSuccess}
                    className="w-full mt-2 text-white font-black uppercase text-xs tracking-widest py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Restaurando datos...</span>
                      </>
                    ) : importSuccess ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>¡Restauración Completa!</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Restaurar Copia Ahora</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {importError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-snug">{importError}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
