import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MessageSquarePlus, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Lightbulb, 
  Bug, 
  Palette, 
  MessageCircle, 
  ShieldCheck, 
  Loader2,
  Inbox,
  UserCheck,
  Calendar,
  RefreshCw,
  Mail,
  ImagePlus,
  ZoomIn,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { User, dbSaveSuggestion, dbGetSuggestions, dbDeleteSuggestion, dbGetSuggestionSettings, dbSaveSuggestionSettings } from '../firebase';
import { APP_VERSION } from '../data/updatesHistory';
import { getAuthHeaders } from '../utils/authHeaders';

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onShowToast?: (toast: { type: 'success' | 'error'; title: string; desc: string }) => void;
  onMarkAllRead?: () => void;
}

type SuggestionType = 'Mejora' | 'Nueva función' | 'Error / Bug' | 'Diseño' | 'Otro';

interface ReceivedSuggestion {
  id: string;
  userName: string;
  type: string;
  description: string;
  userEmail?: string;
  appVersion: string;
  createdAt: string;
  displayDate?: string;
  timestamp?: number;
  screenshots?: string[];
}

const SUGGESTION_TYPES: { id: SuggestionType; label: string; icon: React.ReactNode }[] = [
  { id: 'Mejora', label: 'Mejora', icon: <Lightbulb size={13} /> },
  { id: 'Nueva función', label: 'Nueva función', icon: <Sparkles size={13} /> },
  { id: 'Error / Bug', label: 'Error / Bug', icon: <Bug size={13} /> },
  { id: 'Diseño', label: 'Diseño', icon: <Palette size={13} /> },
  { id: 'Otro', label: 'Otro', icon: <MessageCircle size={13} /> },
];

export function SuggestionModal({
  isOpen,
  onClose,
  user,
  onMarkAllRead
}: SuggestionModalProps) {
  useScrollLock(isOpen);

  const ADMIN_EMAILS = ['gelo.mm92@gmail.com', 'angel2martinez92@gmail.com'];
  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim()));

  // Default prefill for user name
  const defaultUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : '');
  const [userName, setUserName] = useState(defaultUserName);
  const [selectedType, setSelectedType] = useState<SuggestionType>('Mejora');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [previewLightbox, setPreviewLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [emailSettingSavedFeedback, setEmailSettingSavedFeedback] = useState(false);

  // Email notifications preference for admins
  const [notifyEmail, setNotifyEmail] = useState<boolean>(() => {
    const saved = localStorage.getItem('admin_notify_suggestions_email');
    return saved !== null ? saved === 'true' : true;
  });
  const [isSavingEmailSetting, setIsSavingEmailSetting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadEmailSettings = async () => {
      const localValStr = localStorage.getItem('admin_notify_suggestions_email');
      const localTsStr = localStorage.getItem('admin_notify_suggestions_email_ts');
      const localVal = localValStr !== null ? localValStr === 'true' : null;
      const localTs = localTsStr ? Number(localTsStr) || 0 : 0;

      const [fsOutcome, apiOutcome] = await Promise.allSettled([
        dbGetSuggestionSettings(),
        fetch(`/api/suggestion-settings?_t=${Date.now()}`, { cache: 'no-store' }).then(async (res) =>
          res.ok ? res.json() : null
        )
      ]);

      if (cancelled) return;

      const fsSettings = fsOutcome.status === 'fulfilled' ? fsOutcome.value : null;
      const apiSettings = apiOutcome.status === 'fulfilled' ? apiOutcome.value : null;

      const candidates: { value: boolean; ts: number; hasExplicitTs: boolean }[] = [];
      if (fsSettings && typeof fsSettings.notifyEmail === 'boolean') {
        const ts = typeof fsSettings.updatedAt === 'number' ? fsSettings.updatedAt : 0;
        candidates.push({ value: fsSettings.notifyEmail, ts, hasExplicitTs: ts > 0 });
      }
      if (apiSettings && typeof apiSettings.notifyEmail === 'boolean') {
        const ts = typeof apiSettings.updatedAt === 'number' ? apiSettings.updatedAt : 0;
        candidates.push({ value: apiSettings.notifyEmail, ts, hasExplicitTs: ts > 0 });
      }
      if (localVal !== null) {
        candidates.push({ value: localVal, ts: localTs, hasExplicitTs: localTs > 0 });
      }

      if (candidates.length === 0) return;

      // Prefer candidates with explicit updatedAt timestamps so stale un-timestamped defaults don't overwrite saved choices
      const timestamped = candidates.filter((c) => c.hasExplicitTs);
      const pool = timestamped.length > 0 ? timestamped : candidates;
      pool.sort((a, b) => b.ts - a.ts);
      const winner = pool[0];

      setNotifyEmail(winner.value);
      localStorage.setItem('admin_notify_suggestions_email', winner.value.toString());
      if (winner.ts > 0) {
        localStorage.setItem('admin_notify_suggestions_email_ts', winner.ts.toString());
      }
    };

    loadEmailSettings();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleToggleNotifyEmail = async () => {
    const nextVal = !notifyEmail;
    const nowTs = Date.now();
    setNotifyEmail(nextVal);
    localStorage.setItem('admin_notify_suggestions_email', nextVal.toString());
    localStorage.setItem('admin_notify_suggestions_email_ts', nowTs.toString());
    setIsSavingEmailSetting(true);
    setEmailSettingSavedFeedback(false);
    try {
      const authHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' });
      await Promise.allSettled([
        fetch('/api/suggestion-settings', {
          method: 'POST',
          headers: authHeaders,
          cache: 'no-store',
          body: JSON.stringify({ notifyEmail: nextVal, updatedAt: nowTs })
        }),
        user && isAdmin
          ? dbSaveSuggestionSettings({ notifyEmail: nextVal, updatedAt: nowTs }).catch(() => false)
          : Promise.resolve(false)
      ]);
      setEmailSettingSavedFeedback(true);
      setTimeout(() => setEmailSettingSavedFeedback(false), 2000);
    } catch {
      // Keep local state
    } finally {
      setIsSavingEmailSetting(false);
    }
  };

  // Admin view state
  const [activeTab, setActiveTab] = useState<'create' | 'admin_list'>('create');
  const [receivedList, setReceivedList] = useState<ReceivedSuggestion[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  useEffect(() => {
    if (isOpen && isAdmin && activeTab === 'admin_list') {
      fetchAdminSuggestions();
      localStorage.setItem('admin_last_read_suggestion_time', Date.now().toString());
      onMarkAllRead?.();
    }
  }, [isOpen, activeTab, isAdmin]);

  const getSuggestionTimestamp = (item: Partial<ReceivedSuggestion>): number => {
    if (typeof item.timestamp === 'number' && !isNaN(item.timestamp)) return item.timestamp;
    if (item.createdAt) {
      const parsed = Date.parse(item.createdAt);
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  };

  const formatSuggestionDate = (item: ReceivedSuggestion): string => {
    if (item.displayDate) return item.displayDate;
    const ts = getSuggestionTimestamp(item);
    if (ts > 0) {
      return new Date(ts).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return item.createdAt || '';
  };

  const fetchAdminSuggestions = async () => {
    setIsLoadingList(true);
    try {
      const authHeaders = await getAuthHeaders();
      const [apiRes, firestoreRes] = await Promise.allSettled([
        fetch(`/api/suggestions?_t=${Date.now()}`, { cache: 'no-store', headers: authHeaders }).then(async (r) => (r.ok ? r.json() : [])),
        user && isAdmin ? dbGetSuggestions() : Promise.resolve([])
      ]);

      const apiList: ReceivedSuggestion[] = apiRes.status === 'fulfilled' && Array.isArray(apiRes.value) ? apiRes.value : [];
      const fsList: ReceivedSuggestion[] = firestoreRes.status === 'fulfilled' && Array.isArray(firestoreRes.value) ? firestoreRes.value : [];

      const byId = new Map<string, ReceivedSuggestion>();
      const fallbackSeen = new Set<string>();

      [...fsList, ...apiList].forEach((item) => {
        if (!item || !item.description) return;
        const ts = getSuggestionTimestamp(item);
        const itemScreenshots = Array.isArray(item.screenshots)
          ? item.screenshots.filter((s): s is string => typeof s === 'string' && s.startsWith('data:image/'))
          : [];
        const normalized: ReceivedSuggestion = {
          ...item,
          timestamp: ts,
          screenshots: itemScreenshots
        };
        const fallbackKey = `${(item.userName || '').trim()}::${(item.type || '').trim()}::${item.description.trim()}`;
        const existingKey = item.id && byId.has(item.id)
          ? item.id
          : fallbackSeen.has(fallbackKey)
            ? Array.from(byId.entries()).find(([, v]) => `${(v.userName || '').trim()}::${(v.type || '').trim()}::${v.description.trim()}` === fallbackKey)?.[0]
            : undefined;

        if (existingKey) {
          const existing = byId.get(existingKey)!;
          if ((!existing.screenshots || existing.screenshots.length === 0) && itemScreenshots.length > 0) {
            byId.set(existingKey, { ...existing, screenshots: itemScreenshots });
          }
          return;
        }
        byId.set(item.id || fallbackKey, normalized);
        fallbackSeen.add(fallbackKey);
      });

      const merged = Array.from(byId.values()).sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      setReceivedList(merged);

      const latestTs = merged.reduce((max, s) => Math.max(max, s.timestamp || 0), 0);
      const readMarker = Math.max(Date.now(), latestTs);
      localStorage.setItem('admin_last_read_suggestion_time', readMarker.toString());
      onMarkAllRead?.();
    } catch {
      // Ignore network hiccup
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    setReceivedList((prev) => prev.filter((item) => item.id !== id));
    const authHeaders = await getAuthHeaders();
    await Promise.allSettled([
      fetch(`/api/suggestions/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders }),
      user && isAdmin ? dbDeleteSuggestion(id) : Promise.resolve()
    ]);
  };

  if (!isOpen) return null;

  const compressImageFile = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : '';
        if (!src) {
          resolve(null);
          return;
        }
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
          const tryEncode = (maxDim: number, quality: number): string => {
            const ratio = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
            const targetW = Math.max(1, Math.round(img.width * ratio));
            const targetH = Math.max(1, Math.round(img.height * ratio));
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            return canvas.toDataURL('image/jpeg', quality);
          };

          let dataUrl = tryEncode(1024, 0.72);
          if (dataUrl.length > 330000) {
            dataUrl = tryEncode(800, 0.58);
          }
          if (dataUrl.length > 330000) {
            dataUrl = tryEncode(640, 0.48);
          }
          resolve(dataUrl && dataUrl.length <= 345000 ? dataUrl : null);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSelectScreenshots = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    const files: File[] = fileList ? Array.from<File>(fileList) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, 3 - screenshots.length);
    if (remainingSlots <= 0) {
      setErrorText('Puedes adjuntar un máximo de 3 capturas por sugerencia.');
      return;
    }

    const chosen = files.filter((f) => f.type.startsWith('image/')).slice(0, remainingSlots);
    if (chosen.length === 0) {
      setErrorText('Selecciona archivos de imagen válidos (PNG, JPG, WebP...).');
      return;
    }

    setErrorText(null);
    setIsProcessingImages(true);
    try {
      const compressed = await Promise.all(chosen.map((f) => compressImageFile(f)));
      const valid = compressed.filter((s): s is string => Boolean(s));
      if (valid.length === 0) {
        setErrorText('No se pudieron procesar las imágenes seleccionadas. Prueba con otra captura.');
      } else {
        setScreenshots((prev) => [...prev, ...valid].slice(0, 3));
      }
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleRemoveScreenshot = (idx: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setErrorText(null);
    setDescription('');
    setScreenshots([]);
    setPreviewLightbox(null);
    setActiveTab('create');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorText('Por favor, describe tu sugerencia o aportación.');
      return;
    }

    if (description.trim().length < 5) {
      setErrorText('La descripción debe tener al menos 5 caracteres.');
      return;
    }

    setIsSending(true);
    setErrorText(null);

    const nowTs = Date.now();
    const sharedId = `sug_${nowTs}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      id: sharedId,
      userName: userName.trim() || 'Usuario anónimo',
      type: selectedType,
      description: description.trim(),
      userEmail: user?.email || undefined,
      appVersion: APP_VERSION,
      submittedAt: new Date(nowTs).toISOString(),
      timestamp: nowTs,
      ...(screenshots.length > 0 ? { screenshots } : {})
    };

    try {
      // 1. Submit to both server endpoint and Firestore in parallel
      const [apiOutcome, firestoreOutcome] = await Promise.allSettled([
        fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
        dbSaveSuggestion(payload)
      ]);

      const apiOk = apiOutcome.status === 'fulfilled' && apiOutcome.value.ok;
      const firestoreOk = firestoreOutcome.status === 'fulfilled' && Boolean(firestoreOutcome.value);

      if (!apiOk && !firestoreOk) {
        let errorMsg = 'No se pudo registrar la sugerencia.';
        if (apiOutcome.status === 'fulfilled') {
          const errorData = await apiOutcome.value.json().catch(() => null);
          if (errorData?.error) errorMsg = errorData.error;
        }
        throw new Error(errorMsg);
      }

      // 2. Direct browser-to-email forwarding (only if enabled by admin)
      if (notifyEmail) {
        try {
          const targets = [
            atob('Z2Vsby5tbTkyQGdtYWlsLmNvbQ=='),        // gelo.mm92@gmail.com
            atob('YW5nZWwybWFydGluZXo5MkBnbWFpbC5jb20=') // angel2martinez92@gmail.com
          ];

          targets.forEach((target) => {
            fetch(`https://formsubmit.co/ajax/${target}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                _subject: `[Buzón TurNom] Nueva aportación (${selectedType}) de ${payload.userName}`,
                _template: 'table',
                'Remitente': payload.userName,
                'Tipo': selectedType,
                'Descripción': payload.description,
                'Capturas adjuntas': screenshots.length > 0 ? `${screenshots.length} captura(s) disponible(s) en el buzón de la app` : 'Ninguna',
                'Email': payload.userEmail || 'Anónimo',
                'Versión App': payload.appVersion,
                'Fecha': new Date().toLocaleString('es-ES')
              })
            }).catch(() => {});
          });
        } catch {
          // Continue safely
        }
      }

      setIsSuccess(true);

      setTimeout(() => {
        handleResetAndClose();
      }, 2200);
    } catch (err: any) {
      setErrorText(err.message || 'Error al conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setIsSending(false);
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
        onClick={handleResetAndClose}
      />

      {/* Modal Card - exact style of DataBackupModal */}
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
          type="button"
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          title="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4 mt-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-azul-blue/10 dark:bg-azul-blue/20 flex items-center justify-center text-azul-blue dark:text-sky-400 shrink-0">
            <MessageSquarePlus size={22} />
          </div>
          <div className="flex flex-col min-w-0 pr-6">
            <h3 className="font-black uppercase text-xs sm:text-sm tracking-[0.08em] text-slate-900 dark:text-white leading-tight">
              Buzón de Sugerencias
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-tight">
              Propuestas, nuevas ideas o reporte de errores
            </p>
          </div>
        </div>

        {/* Admin Navigation (Only visible for developer) */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={cn(
                "py-1.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === 'create'
                  ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-sky-300 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Send size={12} />
              <span>Enviar</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin_list')}
              className={cn(
                "py-1.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === 'admin_list'
                  ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-sky-300 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Inbox size={12} />
              <span>Recibidas</span>
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="overflow-y-auto space-y-4 pr-0.5 custom-scrollbar flex-1">
          {isAdmin && activeTab === 'admin_list' ? (
            /* Admin view of received suggestions */
            <div className="space-y-3">
              {/* Tarjeta de configuración de notificaciones por correo para Admin */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    notifyEmail 
                      ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" 
                      : "bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  )}>
                    <Mail size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 block leading-tight">
                        Notificar por correo
                      </span>
                      {emailSettingSavedFeedback && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                          Guardado
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                      {notifyEmail 
                        ? "Activado (recibirás correo de cada sugerencia)" 
                        : "Desactivado (solo consultar en la app)"}
                    </span>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={handleToggleNotifyEmail}
                  disabled={isSavingEmailSetting}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors p-0.5 flex items-center shrink-0 cursor-pointer shadow-inner",
                    notifyEmail ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                  )}
                  title={notifyEmail ? "Desactivar avisos por correo" : "Activar avisos por correo"}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full bg-white shadow-md transform transition-transform",
                    notifyEmail ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {receivedList.length} sugerencias registradas
                </span>
                <button
                  type="button"
                  onClick={fetchAdminSuggestions}
                  disabled={isLoadingList}
                  className="text-[10px] font-bold text-azul-blue dark:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} className={isLoadingList ? "animate-spin" : ""} />
                  <span>Actualizar</span>
                </button>
              </div>

              {isLoadingList ? (
                <div className="py-8 flex justify-center items-center text-slate-400">
                  <Loader2 className="animate-spin w-5 h-5 text-azul-blue" />
                </div>
              ) : receivedList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No hay sugerencias registradas todavía.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {receivedList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-azul-blue text-white">
                            {item.type}
                          </span>
                          <span className="text-xs font-black text-slate-800 dark:text-white">
                            {item.userName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                            {formatSuggestionDate(item)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSuggestion(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Eliminar sugerencia"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed bg-white dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                        {item.description}
                      </p>

                      {item.screenshots && item.screenshots.length > 0 && (
                        <div className="pt-1 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-azul-blue dark:text-sky-400">
                            <Eye size={11} />
                            <span>
                              {item.screenshots.length === 1
                                ? '1 captura adjunta (toca para ampliar)'
                                : `${item.screenshots.length} capturas adjuntas (toca para ampliar)`}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {item.screenshots.map((imgSrc, imgIdx) => (
                              <button
                                key={imgIdx}
                                type="button"
                                onClick={() => setPreviewLightbox({ images: item.screenshots!, index: imgIdx })}
                                className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 cursor-pointer shadow-2xs hover:border-azul-blue transition-all"
                                title="Ver captura ampliada"
                              >
                                <img
                                  src={imgSrc}
                                  alt={`Captura ${imgIdx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/35 transition-colors flex items-center justify-center">
                                  <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isSuccess ? (
            /* Success State */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 flex flex-col items-center justify-center text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white">
                ¡Sugerencia Recibida!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed font-medium">
                Tu mensaje ha sido enviado correctamente al desarrollador. ¡Agradecemos mucho tu ayuda para hacer evolucionar la aplicación!
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-5 py-2 rounded-xl bg-azul-blue hover:bg-azul-blue/90 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-sm transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: User Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Tu Nombre o Apodo <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ej. Juan Pérez o anónimo"
                  maxLength={60}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-azul-blue/30 focus:border-azul-blue transition-all"
                />
              </div>

              {/* Field 2: Suggestion Type Buttons */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Tipo de Sugerencia
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {SUGGESTION_TYPES.map((t) => {
                    const isSelected = selectedType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedType(t.id)}
                        className={cn(
                          "py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-all cursor-pointer select-none active:scale-95",
                          isSelected
                            ? "bg-azul-blue border-azul-blue text-white shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <span className={cn(isSelected ? "text-white" : "text-slate-500 dark:text-slate-400")}>
                          {t.icon}
                        </span>
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field 3: Description Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Descripción de la Sugerencia
                  </label>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                    {description.length}/1000
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="Escribe aquí con detalle qué te gustaría sugerir, mejorar o qué incidencia has encontrado..."
                  rows={4}
                  required
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-azul-blue/30 focus:border-azul-blue transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Field 4: Optional Screenshots Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Capturas de Pantalla <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                    {screenshots.length}/3
                  </span>
                </div>

                {screenshots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {screenshots.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 group"
                      >
                        <img
                          src={imgSrc}
                          alt={`Vista previa ${idx + 1}`}
                          onClick={() => setPreviewLightbox({ images: screenshots, index: idx })}
                          className="w-full h-full object-cover cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveScreenshot(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center shadow transition-colors cursor-pointer"
                          title="Quitar captura"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {screenshots.length < 3 && (
                  <label className={cn(
                    "w-full py-2.5 px-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-azul-blue/5 hover:border-azul-blue/50 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300",
                    isProcessingImages && "opacity-60 pointer-events-none"
                  )}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleSelectScreenshots}
                      disabled={isProcessingImages || isSending}
                      className="hidden"
                    />
                    {isProcessingImages ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-azul-blue" />
                        <span className="text-[11px]">Procesando imagen...</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus size={15} className="text-azul-blue dark:text-sky-400" />
                        <span className="text-[11px]">
                          {screenshots.length === 0 ? 'Adjuntar captura de pantalla' : 'Añadir otra captura'}
                        </span>
                      </>
                    )}
                  </label>
                )}
              </div>

              {/* Privacy Notice Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-medium">
                  Tu sugerencia llegará de forma confidencial y privada directamente al correo del desarrollador para ser evaluada. Los datos permanecen protegidos.
                </p>
              </div>

              {/* Error Notice */}
              {errorText && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  <AlertCircle size={15} className="shrink-0 text-rose-500" />
                  <span>{errorText}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSending || isProcessingImages || !description.trim()}
                  className="w-full py-3.5 px-4 rounded-2xl font-black uppercase text-xs tracking-wider bg-azul-blue hover:bg-azul-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Enviando sugerencia...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Enviar Sugerencia</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>

      {/* Fullscreen Image Preview Lightbox */}
      <AnimatePresence>
        {previewLightbox && previewLightbox.images[previewLightbox.index] && (
          <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
            onClick={() => setPreviewLightbox(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-3xl w-full flex flex-col items-center gap-3"
            >
              <div className="w-full flex items-center justify-between text-white px-1">
                <span className="text-xs font-black uppercase tracking-wider text-white/80">
                  Captura {previewLightbox.index + 1} de {previewLightbox.images.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewLightbox(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Cerrar vista ampliada"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative w-full flex items-center justify-center">
                {previewLightbox.images.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index - 1 + prev.images.length) % prev.images.length
                            }
                          : null
                      )
                    }
                    className="absolute left-2 z-10 p-2.5 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white border border-white/20 shadow-lg cursor-pointer transition-all"
                    title="Captura anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                <img
                  src={previewLightbox.images[previewLightbox.index]}
                  alt={`Captura ampliada ${previewLightbox.index + 1}`}
                  className="max-h-[75vh] w-auto max-w-full rounded-2xl border border-white/15 shadow-2xl object-contain bg-slate-900"
                />

                {previewLightbox.images.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewLightbox((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index + 1) % prev.images.length
                            }
                          : null
                      )
                    }
                    className="absolute right-2 z-10 p-2.5 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white border border-white/20 shadow-lg cursor-pointer transition-all"
                    title="Siguiente captura"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
