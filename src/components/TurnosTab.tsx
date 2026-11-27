import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  ArrowLeftRight, 
  Plus, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Wrench,
  Calendar, 
  Copy,
  Check,
  ClipboardPaste,
  CheckSquare,
  Square,
  TrendingUp,
  FileJson,
  ImagePlus,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  Zap,
  Coffee,
  Car,
  Sun,
  HelpCircle,
  Share2,
  Users,
  UserCheck,
  Briefcase,
  Edit2,
  Building2,
  CalendarDays,
  Search,
  FileText,
  SlidersHorizontal,
  Lock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  isSunday, 
  parseISO, 
  isValid, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks, 
  isSameWeek, 
  differenceInCalendarDays 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { DayShift, Settings, ShiftType, ShiftEntry, ShiftTemplate, SharedMonthData, cn, YearlyPluses, YearlyLevels, SharedQuadrantInfo, SwapNotification, SwapRequest } from '../types';
import { getShiftDuration, getStatsForShifts, getNightHours, isMadrugue, checkManutencion, checkManutencionWithRanges, safeFormat, isFixedHoliday, compressImageFile, isDayPartiallyCompensated, isDayPartiallySindical, getEffectiveShiftsForDay, getCompensatedHoursForDay, getSindicalHoursForDay, getAusenciaHoursForDay, isDayPartiallyAusencia, getRestBetweenDays, hasEffectiveWorkHours, checkDayShiftsOverlap, ShiftOverlapResult, formatHoursWithDecimals, isRotationFreeDay, getRotationForMonth, getCounterConfigForDate } from '../utils';

import {
  dbShareMonthShifts,
  dbGetSharedMonthShifts,
  dbGetQuadrantsSharedWithMe,
  dbGetShifts,
  dbGetSettings,
  dbGetSharingConfig,
  dbCheckMutualAuthorization,
  dbSaveShiftsBatch,
  dbSendSwapNotification,
  dbCreateSwapRequest,
  dbUpdateSwapRequestStatus,
  dbDeleteSwapRequest,
  isEditorAuthorizedInSharing,
  type User
} from '../firebase';
import { LocalInput } from './LocalInput';
import { ConfirmModal } from './ConfirmModal';
import { MonthPickerModal } from './MonthPickerModal';
import { extractShiftsFromImages } from '../services/ocrService';
import { PayrollSection } from './PayrollSection';
import { TutorialModal, TutorialStep } from './TutorialModal';
import { CalendarSettingsModal } from './CalendarSettingsModal';
import { useScrollLock, forceUnlockScroll } from '../hooks/useScrollLock';

interface TurnosTabProps {
  shifts: DayShift[];
  settings: Settings;
  updateSettings: (s: Settings) => void;
  updateShift: (s: DayShift) => void;
  updateShifts: (s: DayShift[]) => void;
  deleteShift: (date: string) => void;
  deleteShifts: (dates: string[]) => void;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  formatNumber: (num: number, decimals?: number) => string;
  pluses: YearlyPluses;
  levels: YearlyLevels;
  viewMode: 'calendar' | 'list';
  setViewMode: (mode: 'calendar' | 'list') => void;
  activeSharedOwner?: SharedQuadrantInfo | null;
  user?: User | null;
  onShowToast?: (toast: { type: 'success' | 'error'; title: string; desc: string }) => void;
  unreadSwapCount?: number;
  swapNotifications?: SwapNotification[];
  sentSwapRequests?: SwapRequest[];
  receivedSwapRequests?: SwapRequest[];
  respondingSwapReqId?: string | null;
  onMarkSwapNotificationsRead?: () => void;
  onMarkSingleSwapNotificationRead?: (notificationId: string) => void;
  onDeleteSwapNotification?: (notificationId: string) => void;
  onRespondSwapRequest?: (requestId: string, decision: 'accepted' | 'rejected') => Promise<void> | void;
  onDeleteSwapRequest?: (requestId: string) => Promise<void> | void;
}

export const TurnosTab: React.FC<TurnosTabProps> = ({
  shifts,
  settings,
  updateSettings,
  updateShift,
  updateShifts,
  deleteShift,
  deleteShifts,
  currentMonth,
  setCurrentMonth,
  formatNumber,
  pluses,
  levels,
  viewMode,
  setViewMode,
  activeSharedOwner,
  user,
  onShowToast,
  unreadSwapCount = 0,
  swapNotifications = [],
  sentSwapRequests = [],
  receivedSwapRequests = [],
  respondingSwapReqId = null,
  onMarkSwapNotificationsRead,
  onMarkSingleSwapNotificationRead,
  onDeleteSwapNotification,
  onRespondSwapRequest,
  onDeleteSwapRequest
}) => {
  const isLocked = !!activeSharedOwner?.isLocked;
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [draftDayData, setDraftDayData] = useState<DayShift | null>(null);
  const [draftIsHoliday, setDraftIsHoliday] = useState<boolean | null>(null);
  const [draftSecondDayData, setDraftSecondDayData] = useState<DayShift | null>(null);
  const [isNextShiftExpanded, setIsNextShiftExpanded] = useState(false);
  const [isNextShiftSecondExpanded, setIsNextShiftSecondExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Actualización en tiempo real cada 30 segundos sin tener que recargar la página
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMultiDays, setSelectedMultiDays] = useState<string[]>([]);
  const [isMultiDeleteConfirmOpen, setIsMultiDeleteConfirmOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [copiedShift, setCopiedShift] = useState<DayShift | null>(null);
  const [isEditingDay, setIsEditingDay] = useState(false);
  const [activeShiftEntryTab, setActiveShiftEntryTab] = useState<'ordinario' | 'extra'>('ordinario');
  const [justCopied, setJustCopied] = useState(false);

  // States for 2º Calendario (Empresa alternativa) - Persistente entre pestañas
  const [activeCompany, setActiveCompanyState] = useState<'main' | 'second'>(() => {
    try {
      const saved = localStorage.getItem('azul_active_company_calendar');
      if (saved === 'second' || saved === 'main') return saved;
    } catch {
      // ignore
    }
    return 'main';
  });

  const setActiveCompany = (compOrUpdater: 'main' | 'second' | ((prev: 'main' | 'second') => 'main' | 'second')) => {
    setActiveCompanyState(prev => {
      const next = typeof compOrUpdater === 'function' ? compOrUpdater(prev) : compOrUpdater;
      try {
        localStorage.setItem('azul_active_company_calendar', next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    if (!settings.dualMode && activeCompany === 'second') {
      setActiveCompany('main');
    }
  }, [settings.dualMode, activeCompany]);

  const [isRenameCompanyModalOpen, setIsRenameCompanyModalOpen] = useState(false);
  const [isOverlapsModalOpen, setIsOverlapsModalOpen] = useState(false);
  const [tempCompanyName, setTempCompanyName] = useState('');

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrStep, setOcrStep] = useState<'reading' | 'analyzing' | 'idle'>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedPreviews, setStagedPreviews] = useState<string[]>([]);
  const [ocrError, setOcrError] = useState<string | null>(null);


  // Smooth dynamic progress estimation during OCR processing
  useEffect(() => {
    if (!isOcrLoading) {
      setOcrProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setOcrProgress((prev) => {
        if (ocrStep === 'reading') {
          if (prev < 25) {
            return prev + 2.5;
          }
          return prev;
        } else if (ocrStep === 'analyzing') {
          if (prev < 25) return 28;
          if (prev < 92) {
            const increment = Math.max(0.4, (92 - prev) * 0.06);
            return Math.min(92, prev + increment);
          }
          if (prev < 96) {
            return prev + 0.15;
          }
          return prev;
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOcrLoading, ocrStep]);

  // Safely generate and revoke ObjectURLs to prevent browser memory & cache bloat
  useEffect(() => {
    const urls = stagedFiles.map(file => URL.createObjectURL(file));
    setStagedPreviews(urls);
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [stagedFiles]);
  const [isDragging, setIsDragging] = useState(false);
  const [showOcrSuccess, setShowOcrSuccess] = useState(false);
  const [isDayDeleteConfirmOpen, setIsDayDeleteConfirmOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<number | null>(null);
  const [extraShiftToDelete, setExtraShiftToDelete] = useState<number | null>(null);
  const [listSubMode, setListSubMode] = useState<'month' | 'week'>('month');
  const [currentWeek, setCurrentWeek] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showTutorial, setShowTutorial] = useState(false);
  const [isRestAlertsExpanded, setIsRestAlertsExpanded] = useState(false);
  const [isMoreDayTypesOpen, setIsMoreDayTypesOpen] = useState(false);
  const [isQuickTemplatesOpen, setIsQuickTemplatesOpen] = useState(false);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplShifts, setNewTplShifts] = useState<ShiftEntry[]>([{ start: '06:00', end: '14:00' }]);

  // States for Sharing Month Shifts & Swapping Shifts with Coworkers
  const [isShareMonthModalOpen, setIsShareMonthModalOpen] = useState(false);
  const [shareOwnerName, setShareOwnerName] = useState<string>(() => localStorage.getItem('share_owner_name') || '');
  const [sharedMonthCode, setSharedMonthCode] = useState<string>('');
  const [isGeneratingShareCode, setIsGeneratingShareCode] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [justCopiedShareCode, setJustCopiedShareCode] = useState(false);
  const [justCopiedShareLink, setJustCopiedShareLink] = useState(false);

  const [isSwappingDay, setIsSwappingDay] = useState(false);
  const [coworkerCodeInput, setCoworkerCodeInput] = useState<string>('');
  const [isLoadingCoworker, setIsLoadingCoworker] = useState(false);
  const [coworkerLoadError, setCoworkerLoadError] = useState<string | null>(null);
  const [coworkerMonthData, setCoworkerMonthData] = useState<SharedMonthData | null>(() => {
    try {
      const saved = localStorage.getItem('cached_coworker_month');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [swapFilterMode, setSwapFilterMode] = useState<'best' | 'all' | 'manual'>('best');
  const [manualSwapName, setManualSwapName] = useState('');
  const [manualSwapDate, setManualSwapDate] = useState('');
  const [manualSwapStart, setManualSwapStart] = useState('06:00');
  const [manualSwapEnd, setManualSwapEnd] = useState('14:00');

  // States for Compartir/Colab. collaborator shift swapping
  const [collabUsers, setCollabUsers] = useState<SharedQuadrantInfo[]>([]);
  const [mutualCollabUids, setMutualCollabUids] = useState<Record<string, boolean>>({});
  const [mySharingDisplayName, setMySharingDisplayName] = useState<string>('');
  const [isLoadingCollabUsers, setIsLoadingCollabUsers] = useState(false);
  const [loadingCollabUid, setLoadingCollabUid] = useState<string | null>(null);
  const [selectedCollabUid, setSelectedCollabUid] = useState<string | null>(null);
  const [collabDataCache, setCollabDataCache] = useState<Record<string, { shifts: DayShift[]; vacations: string[] }>>({});

  useEffect(() => {
    if (!user || (!isSwappingDay && !isCalendarSettingsOpen)) return;
    let isMounted = true;
    setIsLoadingCollabUsers(true);
    Promise.all([
      dbGetQuadrantsSharedWithMe(user.email || '', user.uid),
      dbGetSharingConfig(user.uid)
    ])
      .then(([list, mySharing]) => {
        if (!isMounted) return;
        const active = list.filter(item => !item.isDisabled);
        setCollabUsers(active);
        setMySharingDisplayName(mySharing?.ownerName || user.displayName || user.email?.split('@')[0] || 'Compañero');
        const mutualMap: Record<string, boolean> = {};
        active.forEach((c) => {
          mutualMap[c.ownerUid] = isEditorAuthorizedInSharing(mySharing, c.ownerUid, c.ownerEmail);
        });
        setMutualCollabUids(mutualMap);
      })
      .catch((err) => {
        console.error('Error loading Compartir/Colab collaborators:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingCollabUsers(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.email, isSwappingDay, isCalendarSettingsOpen]);

  const loadCollabData = async (collab: SharedQuadrantInfo): Promise<{ shifts: DayShift[]; vacations: string[] }> => {
    if (collabDataCache[collab.ownerUid]) {
      return collabDataCache[collab.ownerUid];
    }
    const [remoteShifts, remoteSettings] = await Promise.all([
      dbGetShifts(collab.ownerUid),
      dbGetSettings(collab.ownerUid)
    ]);
    const result = {
      shifts: remoteShifts || [],
      vacations: Array.isArray(remoteSettings?.vacations) ? remoteSettings!.vacations : []
    };
    setCollabDataCache(prev => ({ ...prev, [collab.ownerUid]: result }));
    return result;
  };

  const handleSelectCollabForSwap = async (collab: SharedQuadrantInfo) => {
    setCoworkerLoadError(null);
    setSelectedCollabUid(collab.ownerUid);
    setLoadingCollabUid(collab.ownerUid);
    try {
      const data = await loadCollabData(collab);
      const monthKeyStr = safeFormat(selectedDay || currentMonth, 'yyyy-MM');
      setCoworkerMonthData({
        code: 'COLAB',
        monthKey: monthKeyStr,
        ownerName: collab.ownerName || collab.ownerEmail || 'Compañero',
        updatedAt: new Date().toISOString(),
        shifts: data.shifts,
        vacations: data.vacations
      });
    } catch (err) {
      console.error('Error loading collaborator shifts for swap:', err);
      setCoworkerLoadError(`No se pudieron cargar los turnos de ${collab.ownerName || 'este usuario'}.`);
    } finally {
      setLoadingCollabUid(null);
    }
  };

  useEffect(() => {
    if (!isSwappingDay || collabUsers.length === 0 || coworkerMonthData || loadingCollabUid) return;
    const preferred = selectedCollabUid
      ? collabUsers.find(c => c.ownerUid === selectedCollabUid) || collabUsers[0]
      : collabUsers[0];
    if (preferred) {
      handleSelectCollabForSwap(preferred);
    }
  }, [isSwappingDay, collabUsers, coworkerMonthData, selectedCollabUid, loadingCollabUid]);

  const shiftTemplates: ShiftTemplate[] = useMemo(() => {
    if (Array.isArray(settings.shiftTemplates)) {
      return settings.shiftTemplates.filter(t => !['tpl-manana', 'tpl-tarde', 'tpl-madrugue', 'tpl-cierre'].includes(t.id));
    }
    return [];
  }, [settings.shiftTemplates]);

  const updateShiftTemplates = (newTemplates: ShiftTemplate[]) => {
    updateSettings({
      ...settings,
      shiftTemplates: newTemplates
    });
  };

  const isAnyModalActive = !!(selectedDay || isClearModalOpen || isMonthPickerOpen || isMultiDeleteConfirmOpen || isPayrollModalOpen || isOcrModalOpen || isOcrLoading || isDayDeleteConfirmOpen || showTutorial || isShareMonthModalOpen || shiftToDelete !== null || extraShiftToDelete !== null || isRenameCompanyModalOpen || isOverlapsModalOpen);
  useScrollLock(isAnyModalActive);


  const tutorialSteps: TutorialStep[] = [
    {
      title: "Registro Diario de Jornadas",
      badge: "Calendario",
      icon: <Calendar size={22} />,
      color: "text-azul-blue",
      bg: "bg-azul-blue/10",
      description: "Selecciona cualquier día de la cuadrícula del calendario o de la lista semanal/mensual. Al seleccionarlo, se desplegará el editor de turnos en la parte inferior de tu pantalla."
    },
    {
      title: "Configurador de Jornada",
      badge: "Turnos",
      icon: <Clock size={22} />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      description: "Indica si el día es Laboral, Libre, Vacaciones, Festivo, etc. Inserta los intervalos horarios (por ejemplo, entrada a salida, soporta turnos fraccionados con múltiples registros). Las horas nocturnas se calculan solas."
    },
    {
      title: "Captura / Escanear Turnos",
      badge: "OCR Inteligente",
      icon: <ImagePlus size={22} />,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      description: "Pulsa en 'Capturas' si deseas convertir una foto de tus turnos directamente en registros del calendario. El sistema leerá el texto digitalmente y cargará tu cuadrante laboral de forma automática."
    },
    {
      title: "Copiar y Pegar Múltiple",
      badge: "Productividad",
      icon: <Copy size={22} />,
      color: "text-sky-500",
      bg: "bg-sky-500/10",
      description: "Para asignar un mismo turno a varios días a la vez, activa el modo de selección 'Múltiple', marca los días en el calendario, copia un turno y pégalo de manera masiva."
    },
    {
      title: "Compartir e Intercambiar Turnos del Mes",
      badge: "Compañeros",
      icon: <Share2 size={22} />,
      color: "text-slate-700",
      bg: "bg-slate-200",
      description: "Pulsa el botón 'Compartir turnos del mes' situado debajo del calendario para generar un código alfanumérico de 4 dígitos (o copiar un enlace corto). Al compartirlo con un compañero, podréis usar el icono de intercambio (⇄) dentro del 'Detalle del día' para comprobar qué turnos encajan en horas, verificar si se cumplen las 12h de descanso legal y registrar el cambio en el calendario."
    },
    {
      title: "Horas Extras y Plus de Presencia",
      badge: "Salarial",
      icon: <TrendingUp size={22} />,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      description: "Añade cómodamente las horas perentorias o complementarias realizadas, y marca pluses específicos. Verás el cuadro de 'Previsualización de Nómina' actualizarse al instante."
    },
    {
      title: "Archivar tu Nómina Mensual",
      badge: "Archivo",
      icon: <Wrench size={22} />,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      description: "Cuando el mes esté completo, despliega el panel de precálculo, pulsa en 'Ver Nómina y Guardar', revísala y fíjalo como registro oficial e inmutable en tu pestaña 'Historial / Resumen'."
    },
    {
      title: "Segundo Calendario de Turnos",
      badge: "2º Empresa",
      icon: <Building2 size={22} />,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      description: "Gestiona en paralelo los turnos de una segunda empresa. Puedes alternar la visualización del calendario entre las empresas, registrar jornadas en las dos empresas y disponer de un auditor automático de solapes que calcula en tiempo real cualquier coincidencia horaria entre ambas jornadas."
    }
  ];

  useEffect(() => {
    if (listSubMode === 'week' && !isSameMonth(currentWeek, currentMonth)) {
      setCurrentWeek(startOfWeek(currentMonth, { weekStartsOn: 1 }));
    }
  }, [currentMonth, listSubMode]);

  useEffect(() => {
    if (showOcrSuccess) {
      const timer = setTimeout(() => {
        setShowOcrSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showOcrSuccess]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleOcrUpload = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = stagedFiles.length > 0 ? stagedFiles : (e?.target.files ? Array.from(e.target.files) : []);
    if (filesToUpload.length === 0) return;

    setIsOcrLoading(true);
    setOcrStep('reading');
    setOcrError(null);
    setIsOcrModalOpen(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const base64Images = await Promise.all(filesToUpload.map(file => compressImageFile(file)));
      
      const monthName = safeFormat(currentMonth, 'MMMM yyyy', { locale: es });
      
      if (controller.signal.aborted) return;

      setOcrStep('analyzing');
      const extracted = await extractShiftsFromImages(base64Images, monthName, controller.signal);

      if (controller.signal.aborted) return;

      // Group extracted shifts by date to handle split shifts (jornada partida)
      const grouped = extracted.reduce((acc: Record<string, DayShift>, ext) => {
        const date = ext.date;
        const isLibre = ext.isLibre || (!ext.startTime && !ext.endTime);
        const shiftPart = isLibre ? [] : [{ start: ext.startTime, end: ext.endTime }];

        if (acc[date]) {
          // If already exists and new part is a real shift, clean empty shift placeholders and append
          if (!isLibre && shiftPart.length > 0) {
            const cleanExisting = acc[date].shifts.filter(s => s.start || s.end);
            acc[date].shifts = [...cleanExisting, ...shiftPart];
          }
        } else {
          acc[date] = {
            date,
            type: 'Laboral' as ShiftType,
            shifts: isLibre || shiftPart.length === 0 ? [{ start: '', end: '' }] : shiftPart,
            perentorias: { day: 0, night: 0 },
            complementarias: { day: 0, night: 0 },
            extraShifts: []
          };
        }
        return acc;
      }, {});

      const newShifts = Object.values(grouped);

      if (newShifts.length > 0) {
        updateShifts(newShifts);
        setShowOcrSuccess(true);
      } else {
        setOcrError("No se encontraron turnos legibles en las capturas enviadas.");
      }
      setStagedFiles([]);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        console.log("OCR cancelled by user");
        return;
      }
      console.error("Error al procesar capturas:", err);
      setOcrError(err.message || "No se pudieron procesar las capturas. Asegúrate de que sean legibles.");
    } finally {
      setIsOcrLoading(false);
      setOcrStep('idle');
      abortControllerRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isAnyModalOpen = useMemo(() => 
    !!selectedDay || isClearModalOpen || isMonthPickerOpen || isOcrLoading || isOcrModalOpen || showOcrSuccess || isMultiDeleteConfirmOpen || isDayDeleteConfirmOpen || isPayrollModalOpen || isShareMonthModalOpen || shiftToDelete !== null || extraShiftToDelete !== null || isRenameCompanyModalOpen || isOverlapsModalOpen,
  [selectedDay, isClearModalOpen, isMonthPickerOpen, isOcrLoading, isOcrModalOpen, showOcrSuccess, isMultiDeleteConfirmOpen, isDayDeleteConfirmOpen, isPayrollModalOpen, isShareMonthModalOpen, shiftToDelete, extraShiftToDelete, isRenameCompanyModalOpen, isOverlapsModalOpen]);


  useEffect(() => {
    if (!isAnyModalOpen) {
      forceUnlockScroll();
    }
  }, [isAnyModalOpen]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const listDays = useMemo(() => {
    if (viewMode === 'calendar' || listSubMode === 'month') return days;
    
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(day => isSameMonth(day, currentMonth));
  }, [viewMode, listSubMode, days, currentWeek, currentMonth]);

  const getDayData = (date: Date): DayShift => {
    const iso = safeFormat(date, 'yyyy-MM-dd');
    return shifts.find(s => s.date === iso) || {
      date: iso,
      type: 'Laboral' as ShiftType,
      shifts: [{ start: '', end: '' }],
      perentorias: { day: 0, night: 0 },
      complementarias: { day: 0, night: 0 },
      extraShifts: []
    };
  };

  const saveDayData = (data: DayShift) => {
    updateShift(data);

    // Sync vacations with settings
    if (data.type === 'Vacaciones') {
      if (!settings.vacations.includes(data.date)) {
        updateSettings({ ...settings, vacations: [...settings.vacations, data.date].sort() });
      }
    } else {
      if (settings.vacations.includes(data.date)) {
        updateSettings({ ...settings, vacations: settings.vacations.filter(v => v !== data.date) });
      }
    }
  };

  const getSecondDayData = (date: Date): DayShift => {
    const iso = safeFormat(date, 'yyyy-MM-dd');
    const secondShifts = settings.secondCompanyShifts || [];
    const found = secondShifts.find(s => s.date === iso);
    if (found) {
      return {
        ...found,
        shifts: (found.shifts && found.shifts.length > 0) ? found.shifts : [{ start: '', end: '' }]
      };
    }
    return {
      date: iso,
      type: 'Laboral' as ShiftType,
      shifts: [{ start: '', end: '' }],
      perentorias: { day: 0, night: 0 },
      complementarias: { day: 0, night: 0 },
      extraShifts: []
    };
  };

  const saveSecondDayData = (data: DayShift) => {
    const iso = data.date;
    const currentList = settings.secondCompanyShifts || [];
    const filtered = currentList.filter(s => s.date !== iso);
    // Keep shift in secondCompanyShifts whenever there is any input text or multiple shift slots
    const hasAnyContent = (data.shifts || []).some(s => (s.start && s.start.trim() !== '') || (s.end && s.end.trim() !== '')) || (data.shifts && data.shifts.length > 1);
    const updated = hasAnyContent ? [...filtered, data] : filtered;
    updateSettings({
      ...settings,
      secondCompanyShifts: updated
    });
  };

  const deleteSecondShift = (dateIso: string) => {
    const currentList = settings.secondCompanyShifts || [];
    updateSettings({
      ...settings,
      secondCompanyShifts: currentList.filter(s => s.date !== dateIso)
    });
  };


  const isHoliday = (date: Date) => {
    if (isFixedHoliday(date)) return true;
    return settings.holidays.includes(safeFormat(date, 'yyyy-MM-dd'));
  };

  const getModalDayData = (date: Date): DayShift => {
    if (selectedDay && draftDayData && safeFormat(date, 'yyyy-MM-dd') === safeFormat(selectedDay, 'yyyy-MM-dd')) {
      return draftDayData;
    }
    return getDayData(date);
  };

  const updateModalDayData = (data: DayShift) => {
    setDraftDayData(data);
  };

  const getModalSecondDayData = (date: Date): DayShift => {
    if (selectedDay && draftSecondDayData && safeFormat(date, 'yyyy-MM-dd') === safeFormat(selectedDay, 'yyyy-MM-dd')) {
      return draftSecondDayData;
    }
    return getSecondDayData(date);
  };

  const updateModalSecondDayData = (data: DayShift) => {
    setDraftSecondDayData(data);
  };

  const isModalHoliday = (date: Date): boolean => {
    if (isFixedHoliday(date)) return true;
    if (selectedDay && draftIsHoliday !== null && safeFormat(date, 'yyyy-MM-dd') === safeFormat(selectedDay, 'yyyy-MM-dd')) {
      return draftIsHoliday;
    }
    return settings.holidays.includes(safeFormat(date, 'yyyy-MM-dd'));
  };

  const openDayModal = (day: Date) => {
    const iso = safeFormat(day, 'yyyy-MM-dd');
    const data = getDayData(day);
    const secData = getSecondDayData(day);
    setDraftDayData(JSON.parse(JSON.stringify(data)));
    setDraftIsHoliday(settings.holidays.includes(iso));
    setDraftSecondDayData(JSON.parse(JSON.stringify(secData)));

    if (activeCompany === 'second') {
      setSelectedDay(day);
      setIsEditingDay(false);
      setIsSwappingDay(false);
      return;
    }

    const hasOrd = data.shifts.some(s => s.start && s.end);
    const hasExt = !!(data.extraShifts && data.extraShifts.some(s => s.start && s.end));
    const hasContent = data.type !== 'Laboral' || hasOrd || hasExt;
    setSelectedDay(day);
    setIsEditingDay(isLocked ? false : !hasContent);
    setIsSwappingDay(false);
    setIsMoreDayTypesOpen(data.type === 'A Compensar' || data.type === 'Baja IT' || data.type === 'Ausencia Justificada' || data.type === 'Cambio de función');
    setManualSwapDate(iso);
    setIsQuickTemplatesOpen(false);
    setIsCreatingTemplate(false);
    setIsManagingTemplates(false);
    setActiveShiftEntryTab(hasExt && !hasOrd ? 'extra' : 'ordinario');
  };

  const closeDayModal = () => {
    setSelectedDay(null);
    setDraftDayData(null);
    setDraftIsHoliday(null);
    setDraftSecondDayData(null);
    setIsEditingDay(false);
    setIsSwappingDay(false);
  };

  const commitMainDayChanges = () => {
    if (!selectedDay) return;
    const iso = safeFormat(selectedDay, 'yyyy-MM-dd');
    const rawDataToSave = draftDayData || getDayData(selectedDay);
    const dataToSave: DayShift = { ...rawDataToSave };
    if (
      dataToSave.swapInfo?.cededToCoworker &&
      !dataToSave.swapInfo?.coveringCoworker &&
      dataToSave.swapInfo?.status === 'accepted' &&
      (dataToSave.shifts || []).some(s => s.start && s.end)
    ) {
      delete dataToSave.swapInfo;
    }

    updateShift(dataToSave);

    let nextVacations = settings.vacations;
    let settingsChanged = false;
    if (dataToSave.type === 'Vacaciones') {
      if (!nextVacations.includes(dataToSave.date)) {
        nextVacations = [...nextVacations, dataToSave.date].sort();
        settingsChanged = true;
      }
    } else if (nextVacations.includes(dataToSave.date)) {
      nextVacations = nextVacations.filter(v => v !== dataToSave.date);
      settingsChanged = true;
    }

    let nextHolidays = settings.holidays;
    if (draftIsHoliday !== null) {
      const currentlyHoliday = nextHolidays.includes(iso);
      if (draftIsHoliday && !currentlyHoliday) {
        nextHolidays = [...nextHolidays, iso].sort();
        settingsChanged = true;
      } else if (!draftIsHoliday && currentlyHoliday) {
        nextHolidays = nextHolidays.filter(h => h !== iso);
        settingsChanged = true;
      }
    }

    if (settingsChanged) {
      updateSettings({
        ...settings,
        vacations: nextVacations,
        holidays: nextHolidays
      });
    }

    setIsEditingDay(false);
    const hasContent = dataToSave.type !== 'Laboral' || dataToSave.shifts.some(s => s.start && s.end) || (dataToSave.extraShifts && dataToSave.extraShifts.some(s => s.start && s.end));
    if (!hasContent) {
      closeDayModal();
    }
  };

  const commitSecondDayChanges = () => {
    if (!selectedDay) {
      closeDayModal();
      return;
    }
    const secToSave = draftSecondDayData || getSecondDayData(selectedDay);
    saveSecondDayData(secToSave);
    closeDayModal();
  };

  const getDayRestViolation = (date: Date) => {
    const prevDate = addDays(date, -1);
    const prevData = getDayData(prevDate);
    const currData = getDayData(date);
    return getRestBetweenDays(prevData, currData, settings.vacations);
  };

  const monthlyRestViolations = useMemo(() => {
    return days
      .map(d => {
        const check = getDayRestViolation(d);
        return check && check.hasViolation ? { day: d, check } : null;
      })
      .filter((item): item is { day: Date; check: NonNullable<ReturnType<typeof getDayRestViolation>> } => item !== null);
  }, [days, shifts, settings.vacations]);

  const formatRestHours = (hours: number) => {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Encode/decode compact share link as fallback or direct URL sharing
  const encodeShareLinkPayload = (monthKey: string, ownerName: string, monthShifts: DayShift[], code?: string) => {
    try {
      const compact = {
        c: code || '',
        m: monthKey,
        n: (ownerName || 'Compañero').slice(0, 30),
        s: monthShifts
          .filter(d => d.type !== 'Laboral' || (d.shifts || []).some(sh => sh.start && sh.end))
          .map(d => [
            d.date.slice(8, 10),
            d.type === 'Vacaciones' ? 'V' : d.type === 'A Compensar' ? 'C' : d.type === 'Baja IT' ? 'B' : d.type === 'Ausencia Justificada' ? 'A' : d.type === 'Horas Sindicales' ? 'S' : d.type === 'Cambio de función' ? 'F' : 'L',
            (d.shifts || []).filter(sh => sh.start && sh.end).map(sh => `${sh.start}-${sh.end}`)
          ])
      };
      const jsonStr = JSON.stringify(compact);
      const b64 = btoa(encodeURIComponent(jsonStr));
      return `${window.location.origin}${window.location.pathname}?turnos=${b64}`;
    } catch {
      return window.location.href;
    }
  };

  const decodeShareLinkPayload = (rawInput: string): SharedMonthData | null => {
    try {
      let token = rawInput.trim();
      if (token.includes('?turnos=')) {
        token = token.split('?turnos=')[1].split('&')[0];
      }
      const jsonStr = decodeURIComponent(atob(token));
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !parsed.m || !Array.isArray(parsed.s)) return null;
      const reconstructedShifts: DayShift[] = parsed.s.map((item: any) => {
        const dayStr = String(item[0]).padStart(2, '0');
        const typeCode = item[1];
        const shiftStrs: string[] = Array.isArray(item[2]) ? item[2] : [];
        return {
          date: `${parsed.m}-${dayStr}`,
          type: typeCode === 'V' ? 'Vacaciones' : typeCode === 'C' ? 'A Compensar' : typeCode === 'B' ? 'Baja IT' : typeCode === 'A' ? 'Ausencia Justificada' : typeCode === 'S' ? 'Horas Sindicales' : typeCode === 'F' ? 'Cambio de función' : 'Laboral',
          shifts: shiftStrs.map(st => {
            const [start, end] = st.split('-');
            return { start: start || '', end: end || '' };
          }),
          perentorias: { day: 0, night: 0 },
          complementarias: { day: 0, night: 0 },
          extraShifts: []
        };
      });
      return {
        code: parsed.c || 'LINK',
        monthKey: parsed.m,
        ownerName: parsed.n || 'Compañero',
        updatedAt: new Date().toISOString(),
        shifts: reconstructedShifts,
        vacations: reconstructedShifts.filter(s => s.type === 'Vacaciones').map(s => s.date)
      };
    } catch {
      return null;
    }
  };

  // Automatically check if URL contains ?turnos=... on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const turnosParam = params.get('turnos');
    if (turnosParam) {
      const decoded = decodeShareLinkPayload(turnosParam);
      if (decoded) {
        setCoworkerMonthData(decoded);
        if (decoded.code && decoded.code !== 'LINK') {
          setCoworkerCodeInput(decoded.code);
          localStorage.setItem('last_coworker_code', decoded.code);
        }
        localStorage.setItem('cached_coworker_month', JSON.stringify(decoded));
      }
    }
  }, []);

  const handleOpenShareMonthModal = async () => {
    const monthKey = safeFormat(currentMonth, 'yyyy-MM');
    const savedCodesMap = JSON.parse(localStorage.getItem('my_shared_month_codes') || '{}');
    const existingCode = savedCodesMap[monthKey] || '';
    setSharedMonthCode(existingCode);
    setShareError(null);
    setIsShareMonthModalOpen(true);

    // Automatically generate or sync the 4-char code in Firestore
    setIsGeneratingShareCode(true);
    try {
      const start = addDays(startOfMonth(currentMonth), -1);
      const end = addDays(endOfMonth(currentMonth), 1);
      const startIso = safeFormat(start, 'yyyy-MM-dd');
      const endIso = safeFormat(end, 'yyyy-MM-dd');
      const monthShiftsToShare = shifts.filter(s => s.date >= startIso && s.date <= endIso);
      const code = await dbShareMonthShifts(
        monthKey,
        shareOwnerName.trim() || 'Compañero',
        monthShiftsToShare,
        settings.vacations,
        existingCode || undefined
      );
      setSharedMonthCode(code);
      savedCodesMap[monthKey] = code;
      localStorage.setItem('my_shared_month_codes', JSON.stringify(savedCodesMap));
    } catch (err) {
      console.warn('Error sharing month shifts to cloud, generating local 4-char code:', err);
      if (!existingCode) {
        const fallbackChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let fallbackCode = '';
        for (let i = 0; i < 4; i++) {
          fallbackCode += fallbackChars.charAt(Math.floor(Math.random() * fallbackChars.length));
        }
        setSharedMonthCode(fallbackCode);
      }
      setShareError('Código generado. Si tienes problemas de red, también puedes copiar el enlace corto.');
    } finally {
      setIsGeneratingShareCode(false);
    }
  };

  const handleLoadCoworkerShifts = async (rawCode?: string) => {
    const input = (rawCode ?? coworkerCodeInput).trim();
    if (!input) return;
    setCoworkerLoadError(null);

    // Check if user pasted a share link or token
    if (input.length > 6 || input.includes('turnos=')) {
      const decoded = decodeShareLinkPayload(input);
      if (decoded) {
        setCoworkerMonthData(decoded);
        localStorage.setItem('cached_coworker_month', JSON.stringify(decoded));
        return;
      }
    }

    const cleanCode = input.toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(cleanCode)) {
      setCoworkerLoadError('Introduce un código alfanumérico válido de 4 dígitos (ej. A7K2) o pega el enlace compartido.');
      return;
    }

    setCoworkerCodeInput('');
    setSelectedCollabUid(null);
    setIsLoadingCoworker(true);
    try {
      const data = await dbGetSharedMonthShifts(cleanCode);
      if (!data) {
        setCoworkerLoadError(`No se encontró ningún cuadrante con el código "${cleanCode}". Verifica el código con tu compañero.`);
      } else {
        setCoworkerMonthData(data);
        localStorage.setItem('last_coworker_code', cleanCode);
        localStorage.setItem('cached_coworker_month', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error loading coworker shifts:', err);
      setCoworkerLoadError('No se pudo conectar para consultar el código. Comprueba tu conexión.');
    } finally {
      setIsLoadingCoworker(false);
    }
  };

  const handleExecuteShiftSwap = async (
    myDateIso: string,
    targetDateIso: string,
    coworkerShiftsOnTarget: ShiftEntry[],
    coworkerNameStr: string,
    coworkerCodeStr?: string,
    coworkerUidOverride?: string
  ): Promise<{ mutualSynced: boolean }> => {
    const myDayObj = getDayData(parseISO(myDateIso));
    const validCoworkerShifts = coworkerShiftsOnTarget.filter(s => s.start && s.end);
    if (validCoworkerShifts.length === 0) return { mutualSynced: false };

    const myOriginalValidShifts = (myDayObj.swapInfo?.originalShifts || myDayObj.shifts || []).filter(s => s && s.start && s.end);
    const resolvedCollabUid = coworkerCodeStr === 'COLAB' ? (coworkerUidOverride || selectedCollabUid || undefined) : undefined;
    const resolvedCollab = resolvedCollabUid ? collabUsers.find(c => c.ownerUid === resolvedCollabUid) : undefined;

    // If swapping with a Compartir/Colab. user, create a pending approval request first
    let createdRequestId: string | undefined;
    let isApprovalRequest = false;

    if (user && !activeSharedOwner && resolvedCollab) {
      const senderDisplayName =
        mySharingDisplayName ||
        user.displayName ||
        user.email?.split('@')[0] ||
        'Compañero';

      const createdReq = await dbCreateSwapRequest({
        senderUid: user.uid,
        senderName: senderDisplayName,
        senderEmail: user.email || '',
        recipientUid: resolvedCollab.ownerUid,
        recipientName: resolvedCollab.ownerName || coworkerNameStr || resolvedCollab.ownerEmail || 'Compañero',
        recipientEmail: resolvedCollab.ownerEmail || '',
        senderDate: myDateIso,
        senderShifts: JSON.parse(JSON.stringify(myOriginalValidShifts)),
        recipientDate: targetDateIso,
        recipientShifts: JSON.parse(JSON.stringify(validCoworkerShifts))
      });

      if (createdReq) {
        createdRequestId = createdReq.id;
        isApprovalRequest = true;

        // Send pending swap request notification to the recipient (does NOT change recipient's calendar yet)
        await dbSendSwapNotification(resolvedCollab.ownerUid, {
          type: 'shift_swap_request',
          recipientUid: resolvedCollab.ownerUid,
          senderUid: user.uid,
          senderName: senderDisplayName,
          senderEmail: user.email || '',
          myOriginalDate: targetDateIso,
          myOriginalShifts: JSON.parse(JSON.stringify(validCoworkerShifts)),
          coveredDate: myDateIso,
          coveredShifts: JSON.parse(JSON.stringify(myOriginalValidShifts)),
          appliedToCalendar: false,
          requestId: createdReq.id,
          status: 'pending'
        });
      }
    }

    const swapMetaExtras = {
      ...(resolvedCollab?.ownerUid ? { coworkerUid: resolvedCollab.ownerUid } : {}),
      ...(isApprovalRequest && createdRequestId ? { status: 'pending' as const, requestId: createdRequestId } : {})
    };

    if (myDateIso === targetDateIso) {
      // Same-day shift swap: my original shift is ceded to coworker, and I cover coworker's shift on this same day
      const backupOriginal = myDayObj.swapInfo?.originalShifts || JSON.parse(JSON.stringify(myDayObj.shifts));
      const updatedSameDay: DayShift = {
        ...myDayObj,
        type: 'Laboral',
        shifts: JSON.parse(JSON.stringify(validCoworkerShifts)),
        swapInfo: {
          cededToCoworker: true,
          coveringCoworker: true,
          coveringShifts: JSON.parse(JSON.stringify(validCoworkerShifts)),
          originalShifts: backupOriginal,
          coworkerName: coworkerNameStr || 'Compañero',
          coworkerCode: coworkerCodeStr,
          ...swapMetaExtras,
          linkedDate: targetDateIso
        }
      };
      saveDayData(updatedSameDay);
      if (selectedDay && safeFormat(selectedDay, 'yyyy-MM-dd') === myDateIso) {
        setDraftDayData(JSON.parse(JSON.stringify(updatedSameDay)));
      }
    } else {
      // Different-day shift swap:
      // 1. On myDateIso: mark my shift as cededToCoworker (the other worker does it, not me)
      const backupMyOriginal = myDayObj.swapInfo?.originalShifts || JSON.parse(JSON.stringify(myDayObj.shifts));
      const updatedMyDay: DayShift = {
        ...myDayObj,
        ...(isApprovalRequest ? {} : { shifts: [{ start: '', end: '' }] }),
        swapInfo: {
          ...(myDayObj.swapInfo || {}),
          cededToCoworker: true,
          originalShifts: backupMyOriginal,
          coworkerName: coworkerNameStr || 'Compañero',
          coworkerCode: coworkerCodeStr,
          ...swapMetaExtras,
          linkedDate: targetDateIso
        }
      };

      // 2. On targetDateIso: show coworker's shift on sender's calendar (with pending status icon if approval request)
      const targetDayObj = getDayData(parseISO(targetDateIso));
      const backupTargetOriginal = targetDayObj.swapInfo?.originalShifts || JSON.parse(JSON.stringify(targetDayObj.shifts));
      const updatedTargetDay: DayShift = {
        ...targetDayObj,
        type: 'Laboral',
        shifts: JSON.parse(JSON.stringify(validCoworkerShifts)),
        swapInfo: {
          ...(targetDayObj.swapInfo || {}),
          coveringCoworker: true,
          coveringShifts: JSON.parse(JSON.stringify(validCoworkerShifts)),
          originalShifts: backupTargetOriginal,
          coworkerName: coworkerNameStr || 'Compañero',
          coworkerCode: coworkerCodeStr,
          ...swapMetaExtras,
          linkedDate: myDateIso
        }
      };

      updateShifts([updatedMyDay, updatedTargetDay]);
      if (selectedDay && safeFormat(selectedDay, 'yyyy-MM-dd') === myDateIso) {
        setDraftDayData(JSON.parse(JSON.stringify(updatedMyDay)));
      }
    }

    setIsSwappingDay(false);
    setIsEditingDay(false);

    onShowToast?.({
      type: 'success',
      title: isApprovalRequest ? 'Solicitud de cambio enviada' : 'Cambio de turno guardado',
      desc: isApprovalRequest
        ? `Se ha enviado la solicitud a ${coworkerNameStr || 'tu compañero'}. Queda pendiente hasta que la acepte o rechace.`
        : `Se ha guardado el intercambio de turno con ${coworkerNameStr || 'tu compañero'} en tu calendario.`
    });

    return { mutualSynced: isApprovalRequest };
  };

  const handleUndoShiftSwap = async (dayIso: string): Promise<{ mutualSynced: boolean }> => {
    const dayObj = getDayData(parseISO(dayIso));
    const swap = dayObj.swapInfo;
    if (!swap) return { mutualSynced: false };

    const updates: DayShift[] = [];

    const restoreDay = (d: DayShift): DayShift => {
      const restoredShifts = Array.isArray(d.swapInfo?.originalShifts) && d.swapInfo!.originalShifts!.length > 0
        ? d.swapInfo!.originalShifts!
        : (d.swapInfo?.coveringCoworker && !d.swapInfo?.cededToCoworker ? [{ start: '', end: '' }] : d.shifts);
      const clone: DayShift = {
        ...d,
        shifts: JSON.parse(JSON.stringify(restoredShifts)),
      };
      delete clone.swapInfo;
      return clone;
    };

    const restoredMain = restoreDay(dayObj);
    updates.push(restoredMain);

    if (swap.linkedDate && swap.linkedDate !== dayIso) {
      const linkedObj = shifts.find(s => s.date === swap.linkedDate);
      if (linkedObj && linkedObj.swapInfo) {
        updates.push(restoreDay(linkedObj));
      }
    }

    updateShifts(updates);
    if (selectedDay && safeFormat(selectedDay, 'yyyy-MM-dd') === dayIso) {
      setDraftDayData(JSON.parse(JSON.stringify(restoredMain)));
    }

    // If this was a pending request, delete it from Firestore so recipient no longer sees it pending
    if (swap.requestId && swap.status === 'pending') {
      try {
        await dbDeleteSwapRequest(swap.requestId);
      } catch {}
      onShowToast?.({
        type: 'success',
        title: 'Solicitud cancelada',
        desc: 'Se ha cancelado la solicitud pendiente y restaurado tu turno original.'
      });
      return { mutualSynced: false };
    }

    // If it was rejected, simply restore sender's local calendar without touching coworker
    if (swap.status === 'rejected') {
      onShowToast?.({
        type: 'success',
        title: 'Turno original restaurado',
        desc: 'Se ha limpiado el cambio rechazado y restaurado tu turno original.'
      });
      return { mutualSynced: false };
    }

    // Resolve linked SwapRequest ID and mark it as 'undone' so both Enviadas & Recibidas update from Aceptada -> Deshecho
    const fallbackMatchedReq = !swap.requestId
      ? [...sentSwapRequests, ...receivedSwapRequests].find((r) => {
          if (r.status !== 'accepted') return false;
          const linked = swap.linkedDate || dayIso;
          return (
            (r.senderDate === dayIso && r.recipientDate === linked) ||
            (r.recipientDate === dayIso && r.senderDate === linked)
          );
        })
      : undefined;
    const reqIdToUndo = swap.requestId || fallbackMatchedReq?.id;

    let requestMarkedUndone = false;
    if (reqIdToUndo && user && !activeSharedOwner) {
      try {
        await dbUpdateSwapRequestStatus(reqIdToUndo, 'undone');
        requestMarkedUndone = true;
      } catch (err) {
        console.warn('Could not update swap request status to undone:', err);
      }
    }

    let mutualSynced = false;
    if (swap.coworkerUid && user && !activeSharedOwner) {
      try {
        const authCheck = await dbCheckMutualAuthorization(user.uid, user.email, swap.coworkerUid);
        const remoteRestores: DayShift[] = [];

        if (authCheck.isMutual) {
          const remoteShifts = await dbGetShifts(swap.coworkerUid);
          const targetDates = Array.from(new Set([dayIso, ...(swap.linkedDate ? [swap.linkedDate] : [])]));

          targetDates.forEach((dt) => {
            const remoteDay = remoteShifts.find(s => s.date === dt);
            if (remoteDay && remoteDay.swapInfo) {
              remoteRestores.push(restoreDay(remoteDay));
            }
          });

          if (remoteRestores.length > 0) {
            await dbSaveShiftsBatch(swap.coworkerUid, remoteRestores);
            setCollabDataCache(prev => {
              const existing = prev[swap.coworkerUid!];
              if (!existing) return prev;
              const map = new Map<string, DayShift>(existing.shifts.map(s => [s.date, s]));
              remoteRestores.forEach(r => map.set(r.date, r));
              return {
                ...prev,
                [swap.coworkerUid!]: {
                  ...existing,
                  shifts: Array.from(map.values())
                }
              };
            });
          }
        }

        if (authCheck.isMutual || reqIdToUndo) {
          const senderDisplayName =
            mySharingDisplayName ||
            user.displayName ||
            user.email?.split('@')[0] ||
            'Compañero';

          await dbSendSwapNotification(swap.coworkerUid, {
            type: 'shift_swap_undo',
            recipientUid: swap.coworkerUid,
            senderUid: user.uid,
            senderName: senderDisplayName,
            senderEmail: user.email || '',
            myOriginalDate: swap.linkedDate || dayIso,
            myOriginalShifts: [],
            coveredDate: dayIso,
            coveredShifts: [],
            appliedToCalendar: remoteRestores.length > 0 || requestMarkedUndone,
            ...(reqIdToUndo ? { requestId: reqIdToUndo, status: 'undone' as const } : {})
          });
          mutualSynced = remoteRestores.length > 0 || requestMarkedUndone;
        }
      } catch (err) {
        console.warn('Could not undo swap on coworker calendar:', err);
      }
    }

    onShowToast?.({
      type: 'success',
      title: mutualSynced ? 'Cambio deshecho en ambos calendarios' : 'Cambio de turno deshecho',
      desc: mutualSynced
        ? `Se ha restaurado el turno original en ambos calendarios y avisado a ${swap.coworkerName || 'tu compañero'}.`
        : `Se ha restaurado tu turno original.`
    });

    return { mutualSynced };
  };

  const handleApplyTemplateToMultiDays = (tpl: ShiftTemplate) => {
    if (selectedMultiDays.length === 0) return;
    const newShifts: DayShift[] = [];
    let newVacations = [...settings.vacations];
    let vacationsChanged = false;

    selectedMultiDays.forEach(dateStr => {
      const data = getDayData(parseISO(dateStr));
      const isVacationDay = data.type === 'Vacaciones' || settings.vacations.includes(data.date);
      const updatedDay: DayShift = {
        ...data,
        type: isVacationDay ? 'Vacaciones' : 'Laboral',
        shifts: JSON.parse(JSON.stringify(tpl.shifts)),
      };
      newShifts.push(updatedDay);
      if (updatedDay.type === 'Vacaciones') {
        if (!newVacations.includes(updatedDay.date)) {
          newVacations.push(updatedDay.date);
          vacationsChanged = true;
        }
      } else {
        if (newVacations.includes(updatedDay.date)) {
          newVacations = newVacations.filter(v => v !== updatedDay.date);
          vacationsChanged = true;
        }
      }
    });

    updateShifts(newShifts);
    if (vacationsChanged) {
      updateSettings({ ...settings, vacations: newVacations.sort() });
    }
    setSelectedMultiDays([]);
    setIsMultiSelectMode(false);
  };

  const handleMultiPaste = () => {
    if (!copiedShift || selectedMultiDays.length === 0) return;

    if (activeCompany === 'second') {
      const secondShifts = settings.secondCompanyShifts || [];
      const remaining = secondShifts.filter(s => !selectedMultiDays.includes(s.date));
      const pasted = selectedMultiDays.map(dateStr => ({
        date: dateStr,
        type: 'Laboral' as ShiftType,
        shifts: JSON.parse(JSON.stringify(copiedShift.shifts)),
        perentorias: { day: 0, night: 0 },
        complementarias: { day: 0, night: 0 },
        extraShifts: []
      }));
      updateSettings({
        ...settings,
        secondCompanyShifts: [...remaining, ...pasted]
      });
      setSelectedMultiDays([]);
      setIsMultiSelectMode(false);
      return;
    }

    const newShifts: DayShift[] = [];
    let newVacations = [...settings.vacations];
    let vacationsChanged = false;

    selectedMultiDays.forEach(dateStr => {
      const data = getDayData(parseISO(dateStr));
      const isVacationDay = data.type === 'Vacaciones' || settings.vacations.includes(data.date);
      const updatedDay: DayShift = {
        ...data,
        type: isVacationDay ? 'Vacaciones' : copiedShift.type,
        shifts: JSON.parse(JSON.stringify(copiedShift.shifts)),
        perentorias: { ...copiedShift.perentorias },
        complementarias: { ...copiedShift.complementarias },
        extraShifts: JSON.parse(JSON.stringify(copiedShift.extraShifts)),
        compensatedMode: copiedShift.compensatedMode,
        compensatedRange: copiedShift.compensatedRange ? { ...copiedShift.compensatedRange } : undefined,
        compensatedHoursQty: copiedShift.compensatedHoursQty,
        sindicalMode: copiedShift.sindicalMode,
        sindicalRange: copiedShift.sindicalRange ? { ...copiedShift.sindicalRange } : undefined,
        sindicalHoursQty: copiedShift.sindicalHoursQty
      };
      newShifts.push(updatedDay);

      // Sync vacations
      if (updatedDay.type === 'Vacaciones') {
        if (!newVacations.includes(updatedDay.date)) {
          newVacations.push(updatedDay.date);
          vacationsChanged = true;
        }
      } else {
        if (newVacations.includes(updatedDay.date)) {
          newVacations = newVacations.filter(v => v !== updatedDay.date);
          vacationsChanged = true;
        }
      }
    });

    updateShifts(newShifts);
    if (vacationsChanged) {
      updateSettings({ ...settings, vacations: newVacations.sort() });
    }

    setSelectedMultiDays([]);
    setIsMultiSelectMode(false);
  };

  const handleMultiDelete = () => {
    if (selectedMultiDays.length === 0) return;

    if (activeCompany === 'second') {
      const secondShifts = settings.secondCompanyShifts || [];
      updateSettings({
        ...settings,
        secondCompanyShifts: secondShifts.filter(s => !selectedMultiDays.includes(s.date))
      });
      setSelectedMultiDays([]);
      setIsMultiSelectMode(false);
      setIsMultiDeleteConfirmOpen(false);
      return;
    }
    
    const newVacations = settings.vacations.filter(v => !selectedMultiDays.includes(v));
    
    selectedMultiDays.forEach(date => {
      deleteShift(date);
    });

    if (newVacations.length !== settings.vacations.length) {
      updateSettings({ ...settings, vacations: newVacations });
    }

    setSelectedMultiDays([]);
    setIsMultiSelectMode(false);
    setIsMultiDeleteConfirmOpen(false);
  };

  const toggleDaySelection = (date: Date) => {
    const iso = safeFormat(date, 'yyyy-MM-dd');
    setSelectedMultiDays(prev => 
      prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]
    );
  };

  const handleClearMonth = () => {
    const monthStartStr = safeFormat(monthStart, 'yyyy-MM-dd');
    const monthEndStr = safeFormat(monthEnd, 'yyyy-MM-dd');

    if (activeCompany === 'second') {
      const secondShifts = settings.secondCompanyShifts || [];
      const remaining = secondShifts.filter(s => s.date < monthStartStr || s.date > monthEndStr);
      updateSettings({
        ...settings,
        secondCompanyShifts: remaining
      });
      setIsClearModalOpen(false);
      return;
    }
    
    const shiftsToDelete = shifts.filter(s => s.date >= monthStartStr && s.date <= monthEndStr);
    if (shiftsToDelete.length === 0) return;

    // Update vacations in settings
    const datesToDelete = shiftsToDelete.map(s => s.date);
    const newVacations = settings.vacations.filter(v => !datesToDelete.includes(v));
    if (newVacations.length !== settings.vacations.length) {
      updateSettings({ ...settings, vacations: newVacations });
    }
    
    deleteShifts(datesToDelete);
  };

  // Cálculo de horas mensuales para la 2ª empresa
  const secondCompanyMonthlyHours = useMemo(() => {
    const secondShifts = settings.secondCompanyShifts || [];
    return secondShifts
      .filter(s => isSameMonth(parseISO(s.date), currentMonth))
      .reduce((total, day) => {
        const dayHours = (day.shifts || []).reduce((acc, sh) => {
          if (!sh.start || !sh.end) return acc;
          return acc + getShiftDuration(sh.start, sh.end);
        }, 0);
        return total + dayHours;
      }, 0);
  }, [settings.secondCompanyShifts, currentMonth]);

  // Detección de solapes de turno con la empresa principal
  const monthOverlaps = useMemo(() => {
    const secondShifts = settings.secondCompanyShifts || [];
    const overlaps: {
      date: Date;
      iso: string;
      check: ShiftOverlapResult;
    }[] = [];

    days.forEach(d => {
      const iso = safeFormat(d, 'yyyy-MM-dd');
      const mainDay = shifts.find(s => s.date === iso);
      const secDay = secondShifts.find(s => s.date === iso);
      if (mainDay && secDay) {
        const isVacInSettings = settings.vacations.includes(iso);
        const chk = checkDayShiftsOverlap(mainDay, secDay, { isMainVacationInSettings: isVacInSettings });
        if (chk.hasHourlyOverlap) {
          overlaps.push({ date: d, iso, check: chk });
        }
      }
    });

    return overlaps;
  }, [days, shifts, settings.secondCompanyShifts, settings.vacations]);


  const currentMonthShifts = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const dayBefore = addDays(start, -1);
    const dayBeforeStr = safeFormat(dayBefore, 'yyyy-MM-dd');
    
    return shifts.filter(s => 
      isSameMonth(parseISO(s.date), currentMonth) || s.date === dayBeforeStr
    );
  }, [shifts, currentMonth]);
  
  const stats = useMemo(() => {
    const monthCounterCfg = getCounterConfigForDate(settings, currentMonth);
    const currentYear = settings.isSubrogado ? monthCounterCfg.counterYear : currentMonth.getFullYear();
    const currentYearPluses = pluses[currentYear] || Object.values(pluses)[0];
    const nightPlus = currentYearPluses['Nocturnas'];
    const nightTarget = monthCounterCfg.targets['Nocturnas'] || 0;
    const madruguePlus = currentYearPluses['Madrugue'];
    const madrugueTarget = monthCounterCfg.targets['Madrugue'] || 0;

    return getStatsForShifts(
      currentMonthShifts, 
      settings.holidays, 
      settings.vacations, 
      settings.contractType,
      false,
      shifts,
      monthCounterCfg.period,
      nightTarget,
      nightPlus,
      madrugueTarget,
      madruguePlus,
      currentMonth,
      settings.isSubrogado,
      monthCounterCfg.targets,
      pluses[currentYear] || pluses[Object.keys(pluses).map(Number).sort((a,b)=>b-a)[0]]
    );
  }, [currentMonthShifts, settings.holidays, settings.vacations, settings.contractType, shifts, settings.counterPeriod, settings.counterTargets, settings.yearlyCounterTargets, settings.yearlyCounterPeriods, pluses, currentMonth, settings.isSubrogado]);
  
  const dayStats = useMemo(() => {
    if (!selectedDay) return null;
    const data = getModalDayData(selectedDay);
    const iso = safeFormat(selectedDay, 'yyyy-MM-dd');
    const modalHolidays = draftIsHoliday === null
      ? settings.holidays
      : draftIsHoliday
        ? (settings.holidays.includes(iso) ? settings.holidays : [...settings.holidays, iso])
        : settings.holidays.filter(h => h !== iso);
    const modalVacations = data.type === 'Vacaciones'
      ? (settings.vacations.includes(iso) ? settings.vacations : [...settings.vacations, iso])
      : settings.vacations.filter(v => v !== iso);
    
    const dayCounterCfg = getCounterConfigForDate(settings, selectedDay);
    const currentYear = settings.isSubrogado ? dayCounterCfg.counterYear : selectedDay.getFullYear();
    const currentPluses = pluses[currentYear] || pluses[Object.keys(pluses).map(Number).sort((a,b)=>b-a)[0]];

    return getStatsForShifts(
      [data],
      modalHolidays,
      modalVacations,
      settings.contractType,
      false,
      shifts,
      dayCounterCfg.period,
      dayCounterCfg.targets['Nocturnas'] || 0,
      currentPluses['Nocturnas'],
      dayCounterCfg.targets['Madrugue'] || 0,
      currentPluses['Madrugue'],
      selectedDay,
      settings.isSubrogado,
      dayCounterCfg.targets,
      currentPluses
    );
  }, [selectedDay, draftDayData, draftIsHoliday, shifts, settings, pluses]);

  const handleDayHold = (day: Date) => {
    if (isLocked) return;
    const data = getDayData(day);
    const hasWork = data.shifts.some(s => s.start && s.end) || (data.extraShifts && data.extraShifts.some(s => s.start && s.end));
    
    if (hasWork || data.type !== 'Laboral') {
      setCopiedShift(data);
      setIsMultiSelectMode(true);
    }
  };

  const onTouchStart = (day: Date) => {
    holdTimerRef.current = setTimeout(() => {
      handleDayHold(day);
    }, 600);
  };

  const onTouchMove = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
  };

  const onTouchEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
  };

  const onMouseDown = (day: Date) => {
    holdTimerRef.current = setTimeout(() => {
      handleDayHold(day);
    }, 600);
  };

  const onMouseUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
  };

  const handleDayClick = (day: Date) => {
    if (isMultiSelectMode) {
      if (isLocked) return;
      toggleDaySelection(day);
    } else {
      openDayModal(day);
    }
  };

  const handleOpenDayInCalendar = (date: Date) => {
    if (!isSameMonth(currentMonth, date)) {
      setCurrentMonth(startOfMonth(date));
    }
    handleDayClick(date);
  };

  // Cálculo dinámico del próximo turno programado para la tarjeta destacada / widget interactivo
  const nextShiftInfo = useMemo(() => {
    const now = currentTime;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const parseShiftMinutes = (start: string, end: string) => {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const startM = (sH || 0) * 60 + (sM || 0);
      let endM = (eH || 0) * 60 + (eM || 0);
      if (endM <= startM) {
        endM += 24 * 60;
      }
      return { startM, endM };
    };

    // Comprobar desde hoy hasta los próximos 60 días
    for (let offset = 0; offset <= 60; offset++) {
      const targetDate = addDays(now, offset);
      const dKey = safeFormat(targetDate, 'yyyy-MM-dd');
      const dayData = getDayData(targetDate);

      // Excluir días que no son horas efectivas de trabajo
      const isVac = settings.vacations.includes(dKey) || dayData.type === 'Vacaciones';
      if (isVac || dayData.type === 'Baja IT' || dayData.type === 'Ausencia Justificada') {
        continue;
      }

      // Turno cedido a un compañero
      const isCededOnly = !!(dayData.swapInfo?.cededToCoworker && !dayData.swapInfo?.coveringCoworker);
      if (isCededOnly) {
        continue;
      }

      // Obtener turnos ordinarios efectivos (excluye horas a compensar o sindicales completas o tramos)
      const effectiveOrd = dayData.swapInfo?.coveringCoworker && Array.isArray(dayData.swapInfo.coveringShifts) && dayData.swapInfo.coveringShifts.length > 0
        ? dayData.swapInfo.coveringShifts.filter(s => s && s.start && s.end)
        : getEffectiveShiftsForDay(dayData);

      const validExtra = (dayData.extraShifts || []).filter(s => s && s.start && s.end);
      const allShifts = [...effectiveOrd, ...validExtra];

      if (allShifts.length === 0) continue;

      // Ordenar por hora de entrada
      allShifts.sort((a, b) => a.start.localeCompare(b.start));
      effectiveOrd.sort((a, b) => a.start.localeCompare(b.start));

      const firstStart = allShifts[0].start;
      const lastEnd = allShifts[allShifts.length - 1].end;

      const totDuration = allShifts.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);

      // Comprobación de Plus Madrugue con la configuración del año correspondiente
      let isMadrug = false;
      const currentYear = targetDate.getFullYear();
      const currentPluses = pluses[currentYear] || Object.values(pluses)[0] || {};
      const madrugueConfig = currentPluses['Madrugue'];
      if (madrugueConfig) {
        isMadrug = allShifts.some(s => 
          isMadrugue(
            s.start, 
            s.end, 
            madrugueConfig.startHour || "02:00", 
            madrugueConfig.endHour || "06:55", 
            madrugueConfig.minEndHour || "00:00", 
            !!madrugueConfig.minEndHourEnabled
          )
        );
      } else {
        isMadrug = (parseInt(firstStart.split(':')[0], 10) || 0) < 6;
      }

      // Comprobación de Manutención
      let hasManutencion = false;
      if (settings.isSubrogado) {
        const subConfig = currentPluses['Manutención/Comida SUB'];
        const mStart1 = subConfig?.startHour || '14:00';
        const mEnd1 = subConfig?.endHour || '16:00';
        const mStart2 = subConfig?.startHour2 || '21:00';
        const mEnd2 = subConfig?.endHour2 || '23:00';
        hasManutencion = checkManutencionWithRanges(effectiveOrd, mStart1, mEnd1, mStart2, mEnd2);
      } else {
        hasManutencion = checkManutencion(effectiveOrd);
      }

      const isFraccionada = effectiveOrd.length >= 2;
      const hasExtra = validExtra.length > 0;

      const shiftsList = (effectiveOrd.length >= 2 ? effectiveOrd : allShifts).map(s => ({
        start: s.start,
        end: s.end
      }));

      // Calcular estadísticas y desgloses de conceptos exactos del día
      const dayCounterCfg = getCounterConfigForDate(settings, targetDate);
      const shiftDayStats = getStatsForShifts(
        [dayData],
        settings.holidays,
        settings.vacations,
        settings.contractType,
        false,
        shifts,
        dayCounterCfg.period,
        dayCounterCfg.targets['Nocturnas'] || 0,
        currentPluses['Nocturnas'],
        dayCounterCfg.targets['Madrugue'] || 0,
        currentPluses['Madrugue'],
        targetDate,
        settings.isSubrogado,
        dayCounterCfg.targets,
        currentPluses
      );

      const nightHours = (shiftDayStats.nightHours || 0) + (shiftDayStats.nightHoursSub || 0);
      const isNight = nightHours > 0;
      const madruguesCount = (shiftDayStats.madrugues || 0) + (shiftDayStats.madruguesSub || 0) || (isMadrug ? 1 : 0);
      const sundaysHours = (shiftDayStats.sundays || 0) + (shiftDayStats.sundaysSub || 0);
      const festivosHours = (shiftDayStats.festivos || 0) + (shiftDayStats.festivosSub || 0);
      const manutencionCount = (shiftDayStats.manutencion || 0) + (shiftDayStats.manutencionSub || 0) || (hasManutencion ? 1 : 0);
      const transportCount = (shiftDayStats.transport || 0) + (shiftDayStats.transportSub || 0);
      const perentHours = (shiftDayStats.perentDay || 0) + (shiftDayStats.perentNight || 0);
      const complHours = (shiftDayStats.complDay || 0) + (shiftDayStats.complNight || 0);
      const compensated = shiftDayStats.compensatedHours || 0;
      const sindical = shiftDayStats.sindicalHours || 0;

      // Desglose de conceptos (sin etiqueta "aplica", mostrando valores reales)
      const concepts: { icon: string; label: string; value: string }[] = [];

      concepts.push({
        icon: '⏱️',
        label: 'Total Horas',
        value: formatHoursWithDecimals(totDuration)
      });

      const ordDuration = effectiveOrd.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
      if (validExtra.length > 0 || perentHours > 0 || complHours > 0) {
        concepts.push({
          icon: '💼',
          label: 'H. Ordinarias',
          value: formatHoursWithDecimals(ordDuration)
        });
      }

      if (perentHours > 0) {
        concepts.push({
          icon: '⚡',
          label: 'H. Perentorias',
          value: formatHoursWithDecimals(perentHours)
        });
      } else if (complHours > 0) {
        concepts.push({
          icon: '⚡',
          label: 'H. Complementarias',
          value: formatHoursWithDecimals(complHours)
        });
      } else if (validExtra.length > 0) {
        const extraHours = validExtra.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
        concepts.push({
          icon: '⚡',
          label: 'Horas Extras',
          value: formatHoursWithDecimals(extraHours)
        });
      }

      if (nightHours > 0) {
        concepts.push({
          icon: '🌙',
          label: 'Nocturnidad',
          value: formatHoursWithDecimals(nightHours)
        });
      }

      if (madruguesCount > 0) {
        concepts.push({
          icon: '🌅',
          label: 'Plus Madrugue',
          value: `${madruguesCount} serv.`
        });
      }

      if (manutencionCount > 0) {
        concepts.push({
          icon: '🍽️',
          label: 'Manutención',
          value: `${manutencionCount} plus`
        });
      }

      if (transportCount > 0) {
        concepts.push({
          icon: '🚗',
          label: 'Transporte',
          value: `${transportCount} plus`
        });
      }

      if (transportCount > 0 && currentPluses['Jornada Irregular Diaria']?.enabled) {
        concepts.push({
          icon: '📅',
          label: 'J. Irreg. Diaria',
          value: `${transportCount} plus`
        });
      }

      if (sundaysHours > 0) {
        concepts.push({
          icon: '🔴',
          label: 'Domingo',
          value: formatHoursWithDecimals(sundaysHours)
        });
      }

      if (festivosHours > 0) {
        concepts.push({
          icon: '🎉',
          label: 'Festivo',
          value: formatHoursWithDecimals(festivosHours)
        });
      }

      if (isFraccionada) {
        const breakDuration = effectiveOrd.length >= 2 ? getShiftDuration(effectiveOrd[0].end, effectiveOrd[1].start) : 0;
        concepts.push({
          icon: '✂️',
          label: 'J. Partida',
          value: breakDuration > 0
            ? `${effectiveOrd.length} tramos (${formatHoursWithDecimals(breakDuration)} parón)`
            : `${effectiveOrd.length} tramos`
        });
      }

      if (compensated > 0) {
        concepts.push({
          icon: '⏱️',
          label: 'A Compensar',
          value: formatHoursWithDecimals(compensated)
        });
      }

      if (sindical > 0) {
        concepts.push({
          icon: '🏛️',
          label: 'H. Sindicales',
          value: formatHoursWithDecimals(sindical)
        });
      }

      if (offset === 0) {
        // HOY: Comprobar turnos en orden cronológico
        let activeShiftIndex = -1;
        let upcomingShiftIndex = -1;

        for (let i = 0; i < allShifts.length; i++) {
          const { startM, endM } = parseShiftMinutes(allShifts[i].start, allShifts[i].end);
          let effNow = nowMinutes;
          if (nowMinutes < startM && endM > 24 * 60 && nowMinutes + 24 * 60 <= endM) {
            effNow += 24 * 60;
          }

          if (effNow >= startM && effNow < endM) {
            activeShiftIndex = i;
            break;
          } else if (effNow < startM && upcomingShiftIndex === -1) {
            upcomingShiftIndex = i;
          }
        }

        if (activeShiftIndex !== -1) {
          const currentS = allShifts[activeShiftIndex];
          const { startM, endM } = parseShiftMinutes(currentS.start, currentS.end);
          let effNow = nowMinutes;
          if (nowMinutes < startM && endM > 24 * 60) effNow += 24 * 60;
          const minsLeft = Math.max(0, endM - effNow);
          const hLeft = Math.floor(minsLeft / 60);
          const mLeft = minsLeft % 60;
          const shiftNumText = isFraccionada ? `${activeShiftIndex + 1}º ` : '';

          const totalMins = Math.max(1, endM - startM);
          const elapsedMins = Math.max(0, effNow - startM);
          const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMins / totalMins) * 100)));

          return {
            date: targetDate,
            dKey,
            status: 'ongoing' as const,
            statusLabel: isFraccionada ? `${shiftNumText}Turno en curso` : 'En curso',
            timeRemainingText: `Quedan ${hLeft > 0 ? `${hLeft}h ` : ''}${mLeft}m`,
            fullCountdownText: `Termina en ${hLeft > 0 ? `${hLeft} horas y ` : ''}${mLeft} minutos`,
            start: firstStart,
            end: lastEnd,
            currentShiftStart: currentS.start,
            currentShiftEnd: currentS.end,
            duration: totDuration,
            nightHours,
            isNight,
            isMadrugue: isMadrug,
            hasManutencion,
            isFraccionada,
            hasExtra,
            shiftsCount: allShifts.length,
            shiftsList,
            activeShiftIndex,
            progressPercent,
            concepts
          };
        } else if (upcomingShiftIndex !== -1) {
          const nextS = allShifts[upcomingShiftIndex];
          const { startM } = parseShiftMinutes(nextS.start, nextS.end);
          const minsUntil = Math.max(0, startM - nowMinutes);
          const hUntil = Math.floor(minsUntil / 60);
          const mUntil = minsUntil % 60;
          const shiftNumText = isFraccionada && upcomingShiftIndex > 0 ? `${upcomingShiftIndex + 1}º ` : '';

          return {
            date: targetDate,
            dKey,
            status: 'today' as const,
            statusLabel: isFraccionada && upcomingShiftIndex > 0 ? `${shiftNumText}Turno hoy` : 'Turno hoy',
            timeRemainingText: `Empieza en ${hUntil > 0 ? `${hUntil}h ` : ''}${mUntil}m`,
            fullCountdownText: `Empieza en ${hUntil > 0 ? `${hUntil} horas y ` : ''}${mUntil} minutos`,
            start: firstStart,
            end: lastEnd,
            currentShiftStart: nextS.start,
            currentShiftEnd: nextS.end,
            duration: totDuration,
            nightHours,
            isNight,
            isMadrugue: isMadrug,
            hasManutencion,
            isFraccionada,
            hasExtra,
            shiftsCount: allShifts.length,
            shiftsList,
            activeShiftIndex: -1,
            progressPercent: 0,
            concepts
          };
        }
        // Si todos los turnos de hoy ya terminaron, avanzar a los siguientes días
        continue;
      }

      // Días futuros (offset > 0)
      const isTomorrowDay = offset === 1;
      return {
        date: targetDate,
        dKey,
        status: isTomorrowDay ? ('tomorrow' as const) : ('upcoming' as const),
        statusLabel: isTomorrowDay ? 'Mañana' : 'Próximo Turno',
        timeRemainingText: isTomorrowDay ? 'Mañana' : `En ${offset} días`,
        fullCountdownText: isTomorrowDay ? 'Mañana' : `Programado en ${offset} días`,
        start: firstStart,
        end: lastEnd,
        currentShiftStart: firstStart,
        currentShiftEnd: lastEnd,
        duration: totDuration,
        nightHours,
        isNight,
        isMadrugue: isMadrug,
        hasManutencion,
        isFraccionada,
        hasExtra,
        shiftsCount: allShifts.length,
        shiftsList,
        activeShiftIndex: -1,
        progressPercent: 0,
        concepts
      };
    }

    return {
      date: null,
      dKey: '',
      status: 'resting' as const,
      statusLabel: 'Descanso',
      timeRemainingText: 'Día libre',
      fullCountdownText: 'Sin turnos programados',
      start: '',
      end: '',
      currentShiftStart: '',
      currentShiftEnd: '',
      duration: 0,
      nightHours: 0,
      isNight: false,
      isMadrugue: false,
      hasManutencion: false,
      isFraccionada: false,
      hasExtra: false,
      shiftsCount: 0,
      shiftsList: [],
      activeShiftIndex: -1,
      progressPercent: 0,
      concepts: []
    };
  }, [shifts, currentMonth, settings, pluses, currentTime]);

  // Cálculo del próximo turno para la 2ª empresa
  const nextShiftInfoSecond = useMemo(() => {
    const now = currentTime;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const secondShifts = settings.secondCompanyShifts || [];

    const parseShiftMinutes = (start: string, end: string) => {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const startM = (sH || 0) * 60 + (sM || 0);
      let endM = (eH || 0) * 60 + (eM || 0);
      if (endM <= startM) {
        endM += 24 * 60;
      }
      return { startM, endM };
    };

    for (let offset = 0; offset <= 60; offset++) {
      const targetDate = addDays(now, offset);
      const dKey = safeFormat(targetDate, 'yyyy-MM-dd');
      const dayData = secondShifts.find(s => s.date === dKey);
      if (!dayData) continue;

      const validShifts = (dayData.shifts || []).filter(s => s && s.start && s.end);
      if (validShifts.length === 0) continue;

      validShifts.sort((a, b) => a.start.localeCompare(b.start));
      const firstStart = validShifts[0].start;
      const lastEnd = validShifts[validShifts.length - 1].end;
      const totDuration = validShifts.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);

      if (offset === 0) {
        let activeIndex = -1;
        let upcomingIndex = -1;

        for (let i = 0; i < validShifts.length; i++) {
          const { startM, endM } = parseShiftMinutes(validShifts[i].start, validShifts[i].end);
          if (nowMinutes >= startM && nowMinutes < endM) {
            activeIndex = i;
            break;
          } else if (nowMinutes < startM && upcomingIndex === -1) {
            upcomingIndex = i;
          }
        }

        if (activeIndex !== -1) {
          const activeS = validShifts[activeIndex];
          const { startM, endM } = parseShiftMinutes(activeS.start, activeS.end);
          const totalMins = Math.max(1, endM - startM);
          const elapsedMins = Math.max(0, nowMinutes - startM);
          const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMins / totalMins) * 100)));
          const minsLeft = Math.max(0, endM - nowMinutes);
          const hLeft = Math.floor(minsLeft / 60);
          const mLeft = minsLeft % 60;

          return {
            date: targetDate,
            dKey,
            status: 'ongoing' as const,
            statusLabel: 'En curso',
            timeRemainingText: `${hLeft > 0 ? `${hLeft}h ` : ''}${mLeft}m`,
            start: firstStart,
            end: lastEnd,
            duration: totDuration,
            shiftsList: validShifts,
            progressPercent,
            currentShiftStart: activeS.start,
            currentShiftEnd: activeS.end
          };
        } else if (upcomingIndex !== -1) {
          const nextS = validShifts[upcomingIndex];
          const { startM } = parseShiftMinutes(nextS.start, nextS.end);
          const minsUntil = Math.max(0, startM - nowMinutes);
          const hUntil = Math.floor(minsUntil / 60);
          const mUntil = minsUntil % 60;

          return {
            date: targetDate,
            dKey,
            status: 'today' as const,
            statusLabel: 'Turno hoy',
            timeRemainingText: `Empieza en ${hUntil > 0 ? `${hUntil}h ` : ''}${mUntil}m`,
            start: firstStart,
            end: lastEnd,
            duration: totDuration,
            shiftsList: validShifts,
            progressPercent: 0,
            currentShiftStart: nextS.start,
            currentShiftEnd: nextS.end
          };
        }
        continue;
      }

      const isTomorrowDay = offset === 1;
      return {
        date: targetDate,
        dKey,
        status: isTomorrowDay ? ('tomorrow' as const) : ('upcoming' as const),
        statusLabel: isTomorrowDay ? 'Mañana' : 'Próximo Turno',
        timeRemainingText: isTomorrowDay ? 'Mañana' : `En ${offset} días`,
        start: firstStart,
        end: lastEnd,
        duration: totDuration,
        shiftsList: validShifts,
        progressPercent: 0,
        currentShiftStart: firstStart,
        currentShiftEnd: lastEnd
      };
    }

    return {
      date: null,
      dKey: '',
      status: 'resting' as const,
      statusLabel: 'Descanso',
      timeRemainingText: 'Sin turnos',
      start: '',
      end: '',
      duration: 0,
      progressPercent: 0,
      currentShiftStart: '',
      currentShiftEnd: '',
      shiftsList: []
    };
  }, [currentTime, settings.secondCompanyShifts]);

  const [isScrolled, setIsScrolled] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Find the scrollable container (the motion.div in App.tsx)
    const scrollableParent = containerRef.current?.parentElement;
    if (!scrollableParent) return;

    const handleScroll = () => {
      setIsScrolled(scrollableParent.scrollTop > 20);
    };

    scrollableParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollableParent.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMonthSwipe = (offset: number) => {
    if (offset < -100) {
      setCurrentMonth(addMonths(currentMonth, 1));
    } else if (offset > 100) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => handleMonthSwipe(info.offset.x)}
      className="space-y-6 pb-24 touch-pan-y max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto w-full px-1 sm:px-2 md:px-4"
    >
      {/* 1. Selector de Mes (Relative, No Sticky) */}
      <div className={cn(
        "relative z-[20] px-1 min-[360px]:px-1.5 sm:px-3 py-2 sm:py-3 pointer-events-none transition-all duration-300",
        isAnyModalOpen ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
      )}>
        <div className="flex justify-center max-w-4xl lg:max-w-5xl mx-auto items-center gap-2">
          <div 
            id="selector-mes-container"
            className="pointer-events-auto flex items-center bg-azul-blue shadow-2xl shadow-azul-blue/30 rounded-full p-0.5 sm:p-1 border border-white/20 w-full max-w-[280px] sm:max-w-[320px] justify-between transition-all duration-300 py-1 sm:py-1.5"
          >
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 sm:p-3 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
              <ChevronLeft size={22} />
            </button>
            <button 
              onClick={() => setIsMonthPickerOpen(true)}
              className="px-2 sm:px-4 py-1 hover:bg-white/10 rounded-full transition-all active:scale-95 flex flex-col items-center flex-1 min-w-0"
            >
              <span className="font-black text-white uppercase tracking-tight leading-none text-sm sm:text-lg mb-0.5 truncate w-full text-center">
                {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <span className="text-[8px] sm:text-[10px] font-black text-azul-yellow/80 uppercase tracking-widest whitespace-nowrap">
                Cambiar Mes
              </span>
            </button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 sm:p-3 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
              <ChevronRight size={22} />
            </button>
          </div>

          <AnimatePresence>
            {!isSameMonth(currentMonth, new Date()) && (
              <motion.button
                id="volver-hoy-btn"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                className="pointer-events-auto flex flex-col items-center justify-center bg-azul-yellow text-[10px] uppercase text-azul-blue shadow-2xl shadow-azul-yellow/30 rounded-full border border-white/20 transition-all hover:bg-azul-yellow/90 active:scale-95 shrink-0 select-none font-black leading-none w-11 h-11 sm:w-12 sm:h-12"
                title="Volver al mes actual"
              >
                <span className="leading-none text-[16px] sm:text-[18px]">📅</span>
                <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-tighter leading-none mt-0.5">HOY</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-1 min-[360px]:px-1.5 sm:px-3 space-y-6 sm:space-y-8">
        {/* Layout en 2 columnas para PC / Pantallas de Escritorio (lg:grid lg:grid-cols-12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Columna Izquierda: Horas del Mes y % Jornada, Próximo Turno, Cabecera de Botones, Calendario/Lista, Botón Compartir Turnos */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4 sm:space-y-6">
            {/* 2. Resumen de Estadísticas (Smaller) */}
      {activeCompany === 'second' ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Horas del Mes (2ª Empresa) */}
          <div
            id="horas-totales-box-second"
            className={cn(
              "p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg flex flex-col items-center justify-center text-center touch-pan-y text-white transition-all",
              "bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/20",
              "dark:!bg-none dark:!bg-black dark:text-orange-500 dark:border-2 dark:border-orange-500 dark:shadow-orange-950/40"
            )}
          >
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5 text-white/80 dark:text-orange-400/90">
              Horas del Mes
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl sm:text-2xl font-black text-white dark:text-orange-400">{formatNumber(secondCompanyMonthlyHours, 2)}</span>
              <span className="text-xs sm:text-sm font-bold text-white/80 dark:text-orange-400/80">h</span>
            </div>
            <div className="mt-1 flex items-center gap-1 bg-white/20 dark:bg-orange-950/60 dark:border dark:border-orange-500/40 px-2 py-0.5 rounded-full">
              <span className="text-[8px] sm:text-[9px] font-bold text-white dark:text-orange-300 uppercase tracking-wider truncate max-w-[140px]">
                {settings.secondCompanyName || '2ª Empresa'}
              </span>
            </div>
          </div>

          {/* Alerta de Solapes en lugar de % de Jornada */}
          <button
            id="alerta-solapes-box"
            type="button"
            onClick={() => setIsOverlapsModalOpen(true)}
            className={cn(
              "p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg flex flex-col items-center justify-center text-center transition-all cursor-pointer group active:scale-95 hover:brightness-105",
              monthOverlaps.length > 0
                ? "bg-red-600 text-white shadow-red-600/30 dark:bg-black dark:text-red-500 dark:border-2 dark:border-red-600 dark:shadow-red-950/40"
                : "bg-emerald-600 text-white shadow-emerald-600/20 dark:bg-black dark:text-emerald-400 dark:border-2 dark:border-emerald-500 dark:shadow-emerald-950/40"
            )}
            title="Pulsar para ver el listado de días y turnos con solape"
          >
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-0.5 opacity-90 group-hover:opacity-100 flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" />
              <span>Alerta Solapes</span>
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl sm:text-2xl font-black">{monthOverlaps.length}</span>
              <span className="text-xs sm:text-sm font-bold opacity-80">{monthOverlaps.length === 1 ? 'día' : 'días'}</span>
            </div>
            <div className={cn(
              "mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider",
              monthOverlaps.length > 0
                ? "bg-white/20 dark:bg-red-950/60 dark:text-red-400 dark:border dark:border-red-600/50"
                : "bg-white/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-500/40"
            )}>
              {monthOverlaps.length > 0 ? (
                <span>⚠️ Solape horario</span>
              ) : (
                <span>✓ Sin solapes</span>
              )}
            </div>
            <span className="text-[7.5px] uppercase tracking-wider font-extrabold opacity-80 mt-1 underline">
              Ver listado →
            </span>
          </button>
        </div>
      ) : (
        <div className={cn("grid gap-3", settings.contractType === 'Completo' ? "grid-cols-1" : "grid-cols-2")}>
          <div id="horas-totales-box" className="bg-gradient-to-br from-azul-blue to-azul-blue/80 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg shadow-azul-blue/10 flex flex-col items-center justify-center text-center touch-pan-y">
            <span className="text-[8px] sm:text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">Horas del Mes</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl sm:text-2xl font-black text-white">{formatNumber(stats.monthlyHours, 2)}</span>
              <span className="text-xs sm:text-sm font-bold text-white/70">h</span>
            </div>
            {(stats.vacationHours > 0 || (stats.monthlyCompensatedHours ?? 0) > 0 || stats.compensatedHours > 0 || (stats.monthlySindicalHours ?? 0) > 0 || stats.sindicalHours > 0 || (stats.ausenciaHours ?? 0) > 0) && (
              <div className="mt-1 flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
                <span className="text-[8px] sm:text-[9px] font-bold text-white/75 uppercase tracking-wider">Efectivas:</span>
                <span className="text-[8px] sm:text-[9px] font-black text-white">{formatNumber(stats.totalHours, 2)}h</span>
              </div>
            )}
          </div>
          {settings.contractType !== 'Completo' && (
            <div id="porcentaje-jornada-box" className="bg-gradient-to-br from-emerald-400 to-teal-600 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg shadow-emerald-200/30 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] sm:text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">% Jornada</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl sm:text-2xl font-black text-white">{formatNumber(stats.effectivePercentage, 2)}</span>
                <span className="text-xs sm:text-sm font-bold text-white/70">%</span>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Widget Interactivo de Próximo Turno */}
      <div id="proximo-turno-container" className="w-full">
        {activeCompany === 'second' ? (
          <motion.div
            layout
            id="proximo-turno-second-card"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "relative overflow-hidden p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all select-none text-white touch-pan-y",
              "bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-amber-300 shadow-lg shadow-orange-500/20",
              "dark:!bg-none dark:!bg-black dark:text-orange-400 dark:border-2 dark:border-orange-500 dark:shadow-orange-950/40"
            )}
          >
            <div 
              onClick={() => {
                if (nextShiftInfoSecond.status === 'ongoing' || nextShiftInfoSecond.status === 'today') {
                  setIsNextShiftSecondExpanded(prev => !prev);
                }
              }}
              className={cn(
                "flex items-center justify-between gap-2",
                (nextShiftInfoSecond.status === 'ongoing' || nextShiftInfoSecond.status === 'today') && "cursor-pointer"
              )}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0 shadow-xs bg-white/20 dark:bg-orange-950/70 dark:border dark:border-orange-500/40 text-white dark:text-orange-300">
                  <Clock size={11} className="stroke-[2.5]" />
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider">
                    {nextShiftInfoSecond.statusLabel} ({settings.secondCompanyName || '2ª Empresa'})
                  </span>
                </div>
                {nextShiftInfoSecond.date ? (
                  <span className="text-[11px] sm:text-xs font-black text-white/95 dark:text-orange-200 uppercase tracking-wider capitalize truncate">
                    {safeFormat(nextShiftInfoSecond.date, "EEEE, d 'de' MMM", { locale: es })}
                  </span>
                ) : (
                  <span className="text-[11px] sm:text-xs font-black text-white/95 dark:text-orange-200 uppercase tracking-wider">
                    Descanso
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <div className="flex items-center gap-1 bg-white/20 dark:bg-orange-950/70 dark:border dark:border-orange-500/40 px-2 py-0.5 rounded-full">
                  <span className="text-[8px] sm:text-[9px] font-bold text-white/90 dark:text-orange-200/90 uppercase tracking-wider hidden xs:inline">
                    {nextShiftInfoSecond.status === 'ongoing' ? 'Restante:' : nextShiftInfoSecond.status === 'today' ? 'Empieza:' : 'Siguiente:'}
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-black text-white dark:text-orange-300 uppercase tracking-wider">
                    {nextShiftInfoSecond.timeRemainingText}
                  </span>
                </div>

                {(nextShiftInfoSecond.status === 'ongoing' || nextShiftInfoSecond.status === 'today') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsNextShiftSecondExpanded(prev => !prev);
                    }}
                    aria-label={isNextShiftSecondExpanded ? "Plegar barra de progreso" : "Desplegar barra de progreso"}
                    className="p-1 rounded-full hover:bg-white/15 dark:hover:bg-orange-950/80 active:scale-95 transition-all text-white/80 dark:text-orange-300 hover:text-white"
                  >
                    <ChevronDown
                      size={18}
                      className={cn(
                        "transition-transform duration-300",
                        isNextShiftSecondExpanded && "rotate-180"
                      )}
                    />
                  </button>
                )}
              </div>
            </div>

            {nextShiftInfoSecond.status !== 'resting' ? (
              <div className="mt-1.5 flex items-baseline justify-center gap-1 text-center w-full">
                <span className="text-xl sm:text-2xl font-black text-white dark:text-orange-400">{nextShiftInfoSecond.start}</span>
                <span className="text-xs sm:text-sm font-bold text-white/80 dark:text-orange-400/80">→</span>
                <span className="text-xl sm:text-2xl font-black text-white dark:text-orange-400">{nextShiftInfoSecond.end}</span>
                <span className="text-xs sm:text-sm font-bold text-white/80 dark:text-orange-400/80 ml-1">
                  ({formatHoursWithDecimals(nextShiftInfoSecond.duration)})
                </span>
              </div>
            ) : (
              <div className="mt-1.5 flex items-baseline justify-center gap-1.5 text-center w-full">
                <span className="text-xl sm:text-2xl font-black text-white dark:text-orange-400">Día de descanso</span>
                <span className="text-xs sm:text-sm font-bold text-white/80 dark:text-orange-400/80">• Sin turnos programados</span>
              </div>
            )}

            {/* Barra de progreso en la tarjeta próximo turno de la segunda empresa (Desplegable, por defecto recogida) */}
            <AnimatePresence>
              {isNextShiftSecondExpanded && (nextShiftInfoSecond.status === 'ongoing' || nextShiftInfoSecond.status === 'today') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden space-y-1.5 pt-2 border-t border-white/20 dark:border-orange-500/30 mt-2"
                >
                  <div className="flex justify-between items-center text-xs sm:text-sm font-black text-white dark:text-orange-300 tracking-tight">
                    <span className="flex items-center gap-1.5">
                      <span className={cn(
                        "w-2 h-2 rounded-full shadow-xs",
                        nextShiftInfoSecond.status === 'ongoing' ? "bg-white dark:bg-orange-400 animate-pulse" : "bg-white/60 dark:bg-orange-400/60"
                      )} />
                      <span>{nextShiftInfoSecond.currentShiftStart}</span>
                    </span>
                    <div className="flex items-center gap-1.5 bg-white/20 dark:bg-orange-950/70 px-2.5 py-0.5 rounded-full border border-white/20 dark:border-orange-500/40">
                      <span className="text-[10px] sm:text-xs font-bold text-white/80 dark:text-orange-200/80 uppercase tracking-wider">
                        {nextShiftInfoSecond.status === 'ongoing' ? 'Progreso:' : 'Turno hoy:'}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-white dark:text-orange-300">
                        {nextShiftInfoSecond.progressPercent}%
                      </span>
                    </div>
                    <span>{nextShiftInfoSecond.currentShiftEnd}</span>
                  </div>
                  <div className="proximo-turno-progress-track-second w-full bg-black/25 dark:bg-orange-950/80 rounded-full h-3.5 sm:h-4 overflow-hidden p-0.5 border border-white/25 dark:border-orange-500/50">
                    <motion.div
                      className="proximo-turno-progress-bar-second h-full bg-white dark:bg-orange-500 rounded-full shadow-xs shadow-orange-500/40"
                      initial={false}
                      animate={{ width: `${nextShiftInfoSecond.progressPercent}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          nextShiftInfo && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative overflow-hidden p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all select-none text-white touch-pan-y",

              nextShiftInfo.status === 'ongoing' || nextShiftInfo.status === 'today'
                ? "widget-shift-card-emerald bg-gradient-to-br from-emerald-400 to-teal-600 border-2 border-emerald-300 dark:border-emerald-400 shadow-lg shadow-emerald-200/30"
                : "widget-shift-card-blue bg-gradient-to-br from-azul-blue to-azul-blue/80 border-2 border-blue-300 dark:border-sky-400 shadow-lg shadow-azul-blue/10"
            )}
          >
            {/* Cabecera Compacta (Clicable para plegar/desplegar) */}
            <div 
              onClick={() => setIsNextShiftExpanded(prev => !prev)}
              className="flex items-center justify-between gap-2 cursor-pointer"
            >
              {/* Izquierda: Etiqueta de estado + Fecha/Contexto */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0 shadow-xs",
                  nextShiftInfo.status === 'ongoing'
                    ? "bg-white/20 dark:bg-emerald-600 text-white animate-pulse"
                    : nextShiftInfo.status === 'today'
                    ? "bg-white/15 dark:bg-emerald-600 text-white"
                    : nextShiftInfo.status === 'tomorrow' || nextShiftInfo.status === 'upcoming'
                    ? "bg-white/15 dark:bg-azul-blue text-white"
                    : "bg-white/15 dark:bg-slate-700 text-white"
                )}>
                  {nextShiftInfo.status === 'ongoing' ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                    </span>
                  ) : nextShiftInfo.status === 'today' ? (
                    <Clock size={11} className="stroke-[2.5] text-white" />
                  ) : nextShiftInfo.status === 'resting' ? (
                    <Coffee size={11} className="text-white" />
                  ) : (
                    <Calendar size={11} className="text-white" />
                  )}
                  <span className="text-[8px] sm:text-[9px] font-black text-white uppercase tracking-wider">
                    {nextShiftInfo.statusLabel}
                  </span>
                </div>

                {nextShiftInfo.date ? (
                  <span className="text-[11px] sm:text-xs font-black text-white/90 uppercase tracking-wider capitalize truncate">
                    {safeFormat(nextShiftInfo.date, "EEEE, d 'de' MMM", { locale: es })}
                  </span>
                ) : (
                  <span className="text-[11px] sm:text-xs font-black text-white/90 uppercase tracking-wider">
                    Descanso
                  </span>
                )}
              </div>

              {/* Derecha: Contador + Flecha para plegar/desplegar */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
                  <span className="text-[8px] sm:text-[9px] font-bold text-white/75 uppercase tracking-wider hidden xs:inline">
                    {nextShiftInfo.status === 'ongoing' ? 'Restante:' : nextShiftInfo.status === 'today' ? 'Empieza:' : 'Siguiente:'}
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-black text-white uppercase tracking-wider">
                    {nextShiftInfo.timeRemainingText}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsNextShiftExpanded(prev => !prev);
                  }}
                  aria-label={isNextShiftExpanded ? "Plegar detalles" : "Desplegar detalles"}
                  className="p-1 rounded-full hover:bg-white/15 active:scale-95 transition-all text-white/80 hover:text-white"
                >
                  <ChevronDown
                    size={18}
                    className={cn(
                      "transition-transform duration-300",
                      isNextShiftExpanded && "rotate-180"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Fila principal con diseño de letra de Horas del Mes / % Jornada */}
            {nextShiftInfo.status !== 'resting' ? (
              <div className="mt-1.5 flex flex-col items-center justify-center text-center relative w-full">
                {nextShiftInfo.isFraccionada && nextShiftInfo.shiftsList && nextShiftInfo.shiftsList.length >= 2 ? (
                  <div className="flex flex-wrap items-baseline justify-center gap-1 sm:gap-2">
                    {nextShiftInfo.shiftsList.map((s, idx) => {
                      const isActive = nextShiftInfo.activeShiftIndex === idx;
                      return (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-xs sm:text-sm font-bold text-white/60 select-none">/</span>}
                          <span className={cn(
                            "inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-lg transition-all",
                            isActive ? "bg-white/20 text-white font-black" : "text-white"
                          )}>
                            <span className="text-lg sm:text-2xl font-black text-white">{s.start}</span>
                            <span className="text-xs sm:text-sm font-bold text-white/70">→</span>
                            <span className="text-lg sm:text-2xl font-black text-white">{s.end}</span>
                          </span>
                        </React.Fragment>
                      );
                    })}
                    <span className="text-xs sm:text-sm font-bold text-white/70 ml-0.5">
                      ({formatHoursWithDecimals(nextShiftInfo.duration)})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-xl sm:text-2xl font-black text-white">{nextShiftInfo.start}</span>
                    <span className="text-xs sm:text-sm font-bold text-white/70">→</span>
                    <span className="text-xl sm:text-2xl font-black text-white">{nextShiftInfo.end}</span>
                    <span className="text-xs sm:text-sm font-bold text-white/70 ml-1">
                      ({formatHoursWithDecimals(nextShiftInfo.duration)})
                    </span>
                  </div>
                )}

                {nextShiftInfo.status === 'today' && (
                  <div className="hidden sm:flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full absolute right-0">
                    <span className="text-[8px] sm:text-[9px] font-bold text-white/75 uppercase tracking-wider">Hoy:</span>
                    <span className="text-[8px] sm:text-[9px] font-black text-white">{nextShiftInfo.fullCountdownText}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1.5 flex items-baseline justify-center gap-1.5 text-center w-full">
                <span className="text-xl sm:text-2xl font-black text-white">Día de descanso</span>
                <span className="text-xs sm:text-sm font-bold text-white/70">• Sin turnos programados</span>
              </div>
            )}

            {/* Detalles desplegables (al tocar la flecha / expandir) */}
            <AnimatePresence>
              {isNextShiftExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden border-t border-white/15 pt-3 mt-2.5 space-y-3"
                >
                  {/* Barra de Progreso en Tiempo Real (% completado) SOLO visible al desplegar */}
                  {nextShiftInfo.status === 'ongoing' && (
                    <div className="space-y-2 py-0.5">
                      <div className="flex justify-between items-center text-xs sm:text-sm font-black text-white tracking-tight">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-white dark:bg-emerald-400 animate-pulse shadow-xs" />
                          <span>{nextShiftInfo.currentShiftStart}</span>
                        </span>
                        <div className="flex items-center gap-1.5 bg-white/15 dark:bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-white/20 dark:border-emerald-500/40">
                          <span className="text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-wider">Progreso:</span>
                          <span className="text-xs sm:text-sm font-black text-white dark:text-emerald-300">{nextShiftInfo.progressPercent}%</span>
                        </div>
                        <span>{nextShiftInfo.currentShiftEnd}</span>
                      </div>
                      <div className="proximo-turno-progress-track w-full bg-black/25 dark:bg-emerald-950/80 rounded-full h-3.5 sm:h-4 overflow-hidden p-0.5 border border-white/25 dark:border-emerald-500/50">
                        <motion.div
                          className="proximo-turno-progress-bar h-full bg-white dark:bg-emerald-500 rounded-full shadow-xs shadow-emerald-500/40"
                          initial={false}
                          animate={{ width: `${nextShiftInfo.progressPercent}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}

                  {nextShiftInfo.date ? (
                    <>
                      {/* Desglose de conceptos (sin etiqueta aplica) */}
                      <div className="space-y-1.5">
                        <span className="text-[8px] sm:text-[9px] font-black text-white/60 uppercase tracking-widest">
                          Desglose de conceptos
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {nextShiftInfo.concepts && nextShiftInfo.concepts.length > 0 ? (
                            nextShiftInfo.concepts.map((c, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15 shadow-2xs"
                              >
                                <span className="text-xs leading-none select-none">{c.icon}</span>
                                <span className="text-[8px] sm:text-[9px] font-bold text-white/75 uppercase tracking-wider">
                                  {c.label}:
                                </span>
                                <span className="text-[8px] sm:text-[9px] font-black text-white">
                                  {c.value}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center gap-1 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                              <span className="text-[8px] sm:text-[9px] font-bold text-white/75 uppercase tracking-wider">Total:</span>
                              <span className="text-[8px] sm:text-[9px] font-black text-white">{formatHoursWithDecimals(nextShiftInfo.duration)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botón de acceso rápido para ver o editar ese día en el calendario */}
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDayInCalendar(nextShiftInfo.date!);
                          }}
                          className="w-full py-2 px-3 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-[0.99] transition-all text-white text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border border-white/20 shadow-xs cursor-pointer"
                        >
                          <Calendar size={13} />
                          <span>Ver / Editar día en el calendario</span>
                          <ChevronRight size={13} className="opacity-75" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-1 text-xs font-bold text-white/70">
                      No hay turnos programados en los próximos días.
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>


      {/* 3. Botones de Acción (Single Row - Compact) */}
      <div className="flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => {
            if (isLocked) return;
            setIsMultiSelectMode(!isMultiSelectMode);
            if (!isMultiSelectMode) setSelectedMultiDays([]);
          }}
          disabled={isLocked}
          className={cn(
            "flex-1 min-w-0 p-1 min-[360px]:p-1.5 sm:p-2 rounded-xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1",
            isLocked
              ? "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-50 dark:bg-slate-900/40 dark:border-slate-800/50 dark:text-slate-600"
              : isMultiSelectMode 
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/25" 
                : "bg-amber-50 border border-amber-100/60 text-amber-600 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-400 opacity-90 hover:opacity-100"
          )}
          title={isLocked ? "Permiso de edición bloqueado por el titular" : "Selección múltiple de días"}
        >
          {isMultiSelectMode ? <CheckSquare size={13} className="sm:w-4 sm:h-4" /> : <Square size={13} className="sm:w-4 sm:h-4" />}
          <span className="text-[7px] min-[360px]:text-[7.5px] sm:text-[8px] font-black uppercase tracking-tighter truncate w-full text-center">Múltiple</span>
        </button>

        <button 
          onClick={() => {
            if (activeCompany === 'second' || isLocked) return;
            setIsOcrModalOpen(true);
          }}
          disabled={isOcrLoading || activeCompany === 'second' || isLocked}
          className={cn(
            "flex-1 min-w-0 p-1 min-[360px]:p-1.5 sm:p-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1",
            activeCompany === 'second' || isLocked
              ? "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-50 dark:bg-slate-900/40 dark:border-slate-800/50 dark:text-slate-600"
              : isOcrLoading
                ? "bg-slate-50 text-slate-300 border border-slate-200 opacity-90"
                : "bg-indigo-50 border border-indigo-100/60 text-indigo-600 hover:bg-indigo-100/80 active:scale-95 opacity-90 hover:opacity-100 dark:bg-indigo-950/40 dark:border-indigo-800/50 dark:text-indigo-400"
          )}
          title={isLocked ? "Permiso de edición bloqueado por el titular" : activeCompany === 'second' ? 'Capturas APP solo disponible para la empresa principal' : 'Escanear turnos con IA'}
        >
          {isOcrLoading ? <Loader2 size={13} className="animate-spin sm:w-4 sm:h-4" /> : <ImagePlus size={13} className="sm:w-4 sm:h-4" />}
          <span className="text-[7px] min-[360px]:text-[7.5px] sm:text-[8px] font-black uppercase tracking-tighter truncate w-full text-center">Capturas APP</span>
        </button>


        {/* Botón Ajustes del calendario de color verde */}
        <button
          id="ajustes-calendario-btn"
          onClick={() => {
            setIsCalendarSettingsOpen(true);
          }}
          className={cn(
            "flex-1 min-w-0 p-1 min-[360px]:p-1.5 sm:p-2 rounded-xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1 opacity-90 hover:opacity-100 relative overflow-hidden cursor-pointer",
            "bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300"
          )}
          title="Ajustes del calendario (Visualizar libranzas, 2º calendario, autocompletar y cambiar turno)"
        >
          {unreadSwapCount > 0 && (
            <span
              className="absolute top-1 right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center pointer-events-none z-10"
              title={`${unreadSwapCount} ${unreadSwapCount === 1 ? 'solicitud de cambio de turno recibida' : 'solicitudes de cambio de turno recibidas'}`}
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />
              <span className="relative inline-flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-tr from-azul-blue via-sky-500 to-amber-400 text-white border border-white/90 dark:border-slate-900 shadow-xs animate-pulse">
                <ArrowLeftRight size={8} className="stroke-[2.75] sm:w-[9px] sm:h-[9px]" />
              </span>
            </span>
          )}
          <SlidersHorizontal size={13} className="sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[7px] min-[360px]:text-[7.5px] sm:text-[8px] font-black uppercase tracking-tighter truncate w-full text-center">Ajustes</span>
        </button>

        <button 
          onClick={() => {
            if (isLocked) return;
            setIsClearModalOpen(true);
          }}
          disabled={isLocked}
          className={cn(
            "flex-1 min-w-0 p-1 min-[360px]:p-1.5 sm:p-2 rounded-xl active:scale-95 transition-all flex flex-col items-center justify-center gap-1",
            isLocked
              ? "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-50 dark:bg-slate-900/40 dark:border-slate-800/50 dark:text-slate-600"
              : "bg-rose-50 border border-rose-100/60 text-rose-600 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:border-rose-800/50 dark:text-rose-400"
          )}
          title={isLocked ? "Permiso de edición bloqueado por el titular" : "Borrar turnos del mes"}
        >
          <Trash2 size={13} className="sm:w-4 sm:h-4" />
          <span className="text-[7.5px] min-[360px]:text-[7.5px] sm:text-[8px] font-black uppercase tracking-tighter truncate w-full text-center">Borrar</span>
        </button>

        <input 
          type="file" 
          ref={fileInputRef}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              setStagedFiles(prev => [...prev, ...Array.from(files)]);
            }
          }}
          multiple
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* Selector de Empresas: dos botones ('Azul H.' y '2ª empresa') debajo de la cabecera cuando 2º calen está activo */}
      <AnimatePresence>
        {settings.dualMode && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            className="flex items-center gap-2 pt-1"
          >
            {/* Botón Empresa Principal 'Azul H.' */}
            <button
              type="button"
              id="btn-empresa-azul-h"
              onClick={() => setActiveCompany('main')}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95",
                activeCompany === 'main'
                  ? "bg-azul-blue text-azul-yellow ring-2 ring-azul-yellow/70 shadow-azul-blue/30 dark:bg-gradient-to-br dark:from-[#002266] dark:to-[#00143d] dark:border-2 dark:border-blue-500 dark:text-azul-yellow dark:shadow-[0_4px_20px_rgba(0,51,153,0.35)]"
                  : "bg-azul-blue/20 text-azul-blue hover:bg-azul-blue/30 dark:bg-slate-800/80 dark:border dark:border-slate-700 dark:text-slate-400 opacity-70 hover:opacity-100"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-azul-yellow inline-block shrink-0" />
              <span className="truncate">Azul H.</span>
              {activeCompany === 'main' && <span className="text-[9px] ml-0.5">●</span>}
            </button>

            {/* Botón 2ª Empresa con color anaranjado y botón para editar el nombre */}
            <div
              className={cn(
                "flex-1 flex items-center justify-between rounded-2xl transition-all shadow-sm active:scale-95",
                activeCompany === 'second'
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white ring-2 ring-white/60 dark:ring-orange-400 shadow-orange-500/30"
                  : "bg-orange-500/20 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:border dark:border-orange-800/40 opacity-75 hover:opacity-100"
              )}
            >
              <button
                type="button"
                onClick={() => setActiveCompany('second')}
                className="flex-1 py-2.5 pl-3 pr-1 text-left font-black text-xs uppercase tracking-wider flex items-center gap-1.5 truncate"
              >
                <span className="w-2 h-2 rounded-full bg-amber-300 inline-block shrink-0" />
                <span className="truncate">{settings.secondCompanyName || '2ª Empresa'}</span>
                {activeCompany === 'second' && <span className="text-[9px] ml-0.5">●</span>}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTempCompanyName(settings.secondCompanyName || '2ª Empresa');
                  setIsRenameCompanyModalOpen(true);
                }}
                className={cn(
                  "p-2 mr-1 rounded-xl transition-colors hover:bg-black/15 active:scale-90",
                  activeCompany === 'second' ? "text-white/90 hover:text-white" : "text-orange-700 dark:text-orange-300"
                )}
                title="Editar nombre de la 2ª empresa"
              >
                <Edit2 size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para renombrar la 2ª empresa */}
      <AnimatePresence>
        {isRenameCompanyModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-modal-active="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Building2 size={18} />
                  <h4 className="text-sm font-black uppercase tracking-wider">Nombre 2ª Empresa</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRenameCompanyModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Introduce el nombre de la empresa secundaria:
                </label>
                <input
                  type="text"
                  value={tempCompanyName}
                  onChange={(e) => setTempCompanyName(e.target.value)}
                  placeholder="Ej: Iberia, Swissport, Groundforce..."
                  maxLength={30}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameCompanyModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const finalName = tempCompanyName.trim() || '2ª Empresa';
                    updateSettings({
                      ...settings,
                      secondCompanyName: finalName
                    });
                    setIsRenameCompanyModalOpen(false);
                  }}
                  className="py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-md shadow-orange-500/20 active:scale-95 transition-all"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Listado de Solapes de Turnos */}
      <AnimatePresence>
        {isOverlapsModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-modal-active="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Cabecera del modal */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Solapes de Turnos
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })} • Azul H. vs {settings.secondCompanyName || '2ª Empresa'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOverlapsModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Contenido con la lista de días solapados */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
                {monthOverlaps.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                      <Check size={28} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                        ¡Sin solapes de turnos este mes!
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                        No hay ninguna coincidencia de horarios entre Azul Handling y {settings.secondCompanyName || 'la 2ª empresa'} en {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Barra resumen de solapes */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
                      <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-slate-600 dark:text-slate-300">
                        <span>Total días con solape horario:</span>
                        <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[9px]">
                          {monthOverlaps.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {monthOverlaps.length} {monthOverlaps.length === 1 ? 'día con coincidencia horaria' : 'días con coincidencia horaria'}
                        </span>
                      </div>
                    </div>

                    {/* Tarjetas de cada día con solape */}
                    <div className="space-y-3">
                      {monthOverlaps.map(({ date, iso, check }) => {
                        const isHourly = check.hasHourlyOverlap;
                        return (
                          <div
                            key={iso}
                            className={cn(
                              "p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 shadow-2xs",
                              isHourly
                                ? "bg-red-50/50 dark:bg-red-950/25 border-red-200 dark:border-red-900/50"
                                : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-xs shrink-0",
                                  isHourly
                                    ? "bg-red-600 text-white"
                                    : "bg-amber-500 text-white"
                                )}>
                                  {safeFormat(date, 'd')}
                                </span>
                                <div>
                                  <span className="block text-xs sm:text-sm font-black text-slate-900 dark:text-white capitalize leading-tight">
                                    {safeFormat(date, 'EEEE, d MMMM', { locale: es })}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    {safeFormat(date, 'yyyy')}
                                  </span>
                                </div>
                              </div>

                              {isHourly ? (
                                <span className="text-[9px] font-black bg-red-600 text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs animate-pulse">
                                  {check.overlapMinutes > 0
                                    ? `Solape ${(check.overlapMinutes / 60).toFixed(2).replace('.', ',')}h`
                                    : `Solape a las ${check.boundaryTimeText || 'salida/entrada'}`}
                                </span>
                              ) : (
                                <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Mismo día
                                </span>
                              )}
                            </div>

                            {/* Detalle de turnos comparados */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {/* Turno en Azul Handling */}
                              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-azul-blue mb-1">
                                  <Building2 size={12} />
                                  <span>Azul Handling</span>
                                </div>
                                <p className="text-xs font-black text-slate-800 dark:text-slate-100 font-mono">
                                  {check.mainTimesText || '--:--'}
                                </p>
                              </div>

                              {/* Turno en 2ª Empresa */}
                              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-orange-100 dark:border-orange-900/30">
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-1">
                                  <Clock size={12} />
                                  <span className="truncate">{settings.secondCompanyName || '2ª Empresa'}</span>
                                </div>
                                <p className="text-xs font-black text-orange-600 dark:text-orange-400 font-mono">
                                  {check.secondTimesText || '--:--'}
                                </p>
                              </div>
                            </div>

                            {/* Explicación y botón para ir al día */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 gap-2">
                              <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400">
                                {isHourly
                                  ? (check.overlapMinutes > 0
                                      ? `⚠️ Coinciden en horario durante ${(check.overlapMinutes / 60).toFixed(2).replace('.', ',')}h.`
                                      : `⚠️ Solape directo: finalización e inicio coinciden a las ${check.boundaryTimeText || 'la misma hora'}.`)
                                  : 'Turnos compatibles en distintas franjas horarias.'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOverlapsModalOpen(false);
                                  openDayModal(date);
                                }}
                                className="text-[9.5px] font-black text-orange-600 dark:text-orange-400 hover:text-orange-700 uppercase tracking-wider flex items-center gap-1 cursor-pointer bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800/60 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors shadow-2xs shrink-0"
                              >
                                <span>Ver día</span>
                                <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Pie del modal */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOverlapsModalOpen(false)}
                  className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OCR Upload Modal (Custom Aesthetic) */}
      <AnimatePresence>
        {isOcrModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-modal-active="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOcrModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center"
            >
              <div className="space-y-2 mb-6">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight uppercase">Capturas APP Azul</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase leading-snug px-1">
                  HAZ CAPTURAS DE PANTALLA DE TUS TURNOS DE LA APP AZUL HANDLING Y AÑÁDELOS AQUÍ
                </p>
              </div>

              <div 
                className={cn(
                  "w-full aspect-square bg-azul-blue/5 rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 relative group cursor-pointer overflow-hidden",
                  isDragging ? "border-azul-blue bg-azul-blue/10 scale-105" : "border-azul-blue/10 hover:border-azul-blue/30"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    setStagedFiles(prev => [...prev, ...Array.from(files)]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {stagedFiles.length > 0 ? (
                  <div className="w-full h-full p-4 overflow-y-auto no-scrollbar bg-white/50 backdrop-blur-sm animate-in fade-in zoom-in">
                    <div className="grid grid-cols-2 gap-3">
                      {stagedFiles.map((file, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-md group/item">
                          <img 
                            src={stagedPreviews[idx] || ''} 
                            alt={`Preview ${idx}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStagedFiles(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="absolute top-1.5 right-1.5 p-2 bg-rose-500/90 text-white rounded-xl shadow-lg transition-transform active:scale-95 z-10"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                      <div className="aspect-square rounded-2xl border-2 border-dashed border-azul-blue/20 flex items-center justify-center text-azul-blue/40 hover:border-azul-blue/40 hover:text-azul-blue/60 transition-colors">
                        <Plus size={24} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center text-azul-blue transition-transform group-hover:scale-110">
                      <ImagePlus size={40} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-4">Haz click aquí para buscar las capturas</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 w-full space-y-4">
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex gap-3 shadow-sm mb-4">
                  <AlertCircle size={18} className="text-amber-500 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-900 leading-tight text-left uppercase">
                    La extracción por IA puede no ser exacta o dar error al subir el archivo. Revisa siempre los datos extraídos.
                  </p>
                </div>
                {stagedFiles.length > 0 && (
                  <p className="text-[10px] font-black text-slate-400 leading-relaxed px-4 uppercase">
                    Has seleccionado {stagedFiles.length} captura{stagedFiles.length > 1 ? 's' : ''}.
                  </p>
                )}
                <button
                  onClick={() => {
                    if (stagedFiles.length > 0) {
                      handleOcrUpload();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className={cn(
                    "w-full rounded-2xl py-4 font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-azul-blue/20",
                    stagedFiles.length > 0 ? "bg-azul-blue text-white hover:bg-azul-blue/90" : "bg-azul-blue/10 text-azul-blue"
                  )}
                >
                  {stagedFiles.length > 0 ? 'Subir Capturas' : 'Seleccionar Fotos'}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsOcrModalOpen(false);
                  setStagedFiles([]);
                }}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Ajustes del Calendario (Vista, 2º Calendario, Rotación Libranzas, Autocompletar, Cambiar Turno) */}
      <CalendarSettingsModal
        isOpen={isCalendarSettingsOpen}
        onClose={() => setIsCalendarSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
        currentMonth={currentMonth}
        shifts={shifts}
        onApplyAutoShifts={(newShifts) => updateShifts(newShifts)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeCompany={activeCompany}
        isLocked={isLocked}
        user={user}
        collabUsers={collabUsers}
        mutualCollabUids={mutualCollabUids}
        isLoadingCollabUsers={isLoadingCollabUsers}
        onLoadCollabData={loadCollabData}
        onExecuteShiftSwap={handleExecuteShiftSwap}
        onUndoShiftSwap={handleUndoShiftSwap}
        onShowToast={onShowToast}
        unreadSwapCount={unreadSwapCount}
        swapNotifications={swapNotifications}
        sentSwapRequests={sentSwapRequests}
        receivedSwapRequests={receivedSwapRequests}
        respondingSwapReqId={respondingSwapReqId}
        onMarkSwapNotificationsRead={onMarkSwapNotificationsRead}
        onMarkSingleSwapNotificationRead={onMarkSingleSwapNotificationRead}
        onDeleteSwapNotification={onDeleteSwapNotification}
        onRespondSwapRequest={onRespondSwapRequest}
        onDeleteSwapRequest={onDeleteSwapRequest}
        onJumpToDate={(dateIso) => {
          const parsed = parseISO(dateIso);
          if (isValid(parsed)) {
            setCurrentMonth(startOfMonth(parsed));
          }
          setIsCalendarSettingsOpen(false);
        }}
      />

      <ConfirmModal 
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={() => {
          handleClearMonth();
        }}
        title="Borrar Turnos del Mes"
        message={`¿ESTÁS SEGURO DE QUE QUIERES BORRAR TODOS LOS TURNOS DE ${safeFormat(currentMonth, 'MMMM yyyy', { locale: es }).toUpperCase()}? ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Borrar Todo"
        cancelLabel="Cancelar"
        variant="danger"
      />

      <ConfirmModal 
        isOpen={isDayDeleteConfirmOpen}
        onClose={() => setIsDayDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (selectedDay) {
            const iso = safeFormat(selectedDay, 'yyyy-MM-dd');
            deleteShift(iso);
            if (settings.vacations.includes(iso)) {
              updateSettings({ ...settings, vacations: settings.vacations.filter(v => v !== iso) });
            }
            closeDayModal();
          }
          setIsDayDeleteConfirmOpen(false);
          forceUnlockScroll();
        }}
        title="Borrar Turno del Día"
        message={`¿ESTÁS SEGURO DE QUE QUIERES BORRAR EL TURNO DEL DÍA ${selectedDay ? safeFormat(selectedDay, 'd MMMM', { locale: es }).toUpperCase() : ''}? ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={shiftToDelete !== null}
        onClose={() => setShiftToDelete(null)}
        onConfirm={() => {
          if (shiftToDelete !== null && selectedDay) {
            const data = getModalDayData(selectedDay);
            const newShifts = [...data.shifts];
            if (newShifts.length > 1) {
              newShifts.splice(shiftToDelete, 1);
            } else {
              newShifts[0] = { start: '', end: '' };
            }
            updateModalDayData({ ...data, shifts: newShifts });
          }
          setShiftToDelete(null);
        }}
        title="¿Borrar Turno?"
        message="¿Estás seguro de que quieres eliminar este tramo horario?"
      />

      <ConfirmModal
        isOpen={extraShiftToDelete !== null}
        onClose={() => setExtraShiftToDelete(null)}
        onConfirm={() => {
          if (extraShiftToDelete !== null && selectedDay) {
            const data = getModalDayData(selectedDay);
            const newExtra = [...(data.extraShifts || [])];
            newExtra.splice(extraShiftToDelete, 1);
            updateModalDayData({ ...data, extraShifts: newExtra });
          }
          setExtraShiftToDelete(null);
        }}
        title="¿Borrar Pase Extra?"
        message="¿Estás seguro de que quieres eliminar este tramo de horas extra/perentorias?"
      />

      {/* OCR Error Toast/Message */}
      {ocrError && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 shadow-lg">
            <AlertCircle className="text-rose-500 shrink-0" size={20} />
            <p className="text-sm font-bold text-rose-600">{ocrError}</p>
            <button onClick={() => setOcrError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* OCR Loading Overlay */}
      {isOcrLoading && (
        <div className="fixed inset-0 z-[200] bg-white/85 dark:bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center" data-modal-active="true">
          <div className="w-16 h-16 bg-azul-blue/10 dark:bg-azul-blue/20 rounded-3xl flex items-center justify-center text-azul-blue dark:text-sky-400 mb-4">
            <Loader2 size={32} className="animate-spin" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
            {ocrStep === 'reading' ? 'Cargando Imágenes' : 'Procesando Turnos'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs mb-6 text-sm">
            {ocrStep === 'reading' 
              ? 'Estamos preparando tus capturas para el análisis...' 
              : 'Estamos extrayendo los turnos de tus capturas con IA. Tardará solo unos segundos...'}
          </p>
          <button
            onClick={() => {
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
              }
              setIsOcrLoading(false);
              setOcrStep('idle');
              setOcrProgress(0);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <X size={18} />
            Cancelar
          </button>

          {/* Barra de progreso dinámica debajo del botón de cancelar */}
          <div className="w-full max-w-xs sm:max-w-sm mt-6 space-y-2 select-none animate-fade-in">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-azul-blue dark:bg-sky-400 animate-pulse inline-block" />
                {ocrStep === 'reading' ? 'Extrayendo capturas...' : 'Analizando turnos con IA...'}
              </span>
              <span className="font-mono text-[11px] font-black text-azul-blue dark:text-sky-400">
                {Math.round(ocrProgress)}%
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
              <div 
                className="h-full bg-linear-to-r from-azul-blue via-sky-500 to-indigo-600 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                style={{ width: `${Math.max(5, Math.min(100, ocrProgress))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[pulse_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Calendario o Lista de Turnos */}
      {viewMode === 'calendar' ? (
        <div className="space-y-4">
          <div 
            id="modo-calendario"
            className="modo-calendario bg-white dark:bg-slate-900 border border-solid border-slate-200 dark:border-slate-800 rounded-none overflow-hidden touch-pan-y shadow-xs"
            style={{ borderRadius: '0px', borderWidth: '1px', borderStyle: 'solid' }}
          >
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
              <div key={d} className="text-center py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-[3/4] border-r border-b border-slate-50 bg-slate-50/20" />
            ))}
            {days.map(day => {
              const isoDay = safeFormat(day, 'yyyy-MM-dd');
              const mainDay = shifts.find(s => s.date === isoDay);
              const secondDay = (settings.secondCompanyShifts || []).find(s => s.date === isoDay);
              const overlapCheck = checkDayShiftsOverlap(mainDay, secondDay, { isMainVacationInSettings: settings.vacations.includes(isoDay) });
              const hasDayOverlap = settings.dualMode && overlapCheck.hasHourlyOverlap;

              const data = activeCompany === 'second' ? getSecondDayData(day) : getDayData(day);
              const isFest = activeCompany === 'second' ? false : isHoliday(day);
              const isSun = isSunday(day);
              const isTodayDay = isToday(day);
              const hasRegularWork = (data.shifts || []).some(s => s.start && s.end);
              const hasExtraWork = activeCompany === 'second' ? false : (data.extraShifts && data.extraShifts.some(s => s.start && s.end));
              const hasWork = hasRegularWork || hasExtraWork;
              const onlyExtra = hasExtraWork && !hasRegularWork;
              const hasPerentorias = activeCompany === 'second' ? false : ((data.perentorias?.day || 0) > 0 || (data.perentorias?.night || 0) > 0);
              const isPerentoriaDay = onlyExtra || hasPerentorias;
              const isVac = activeCompany === 'second' ? false : (settings.vacations.includes(isoDay) || data.type === 'Vacaciones');
              const isComp = activeCompany === 'second' ? false : data.type === 'A Compensar';
              const isPermisoRetribuido = activeCompany === 'second' ? false : data.type === 'Permiso Retribuido';
              const isSindical = activeCompany === 'second' ? false : data.type === 'Horas Sindicales';
              const isBajaIT = activeCompany === 'second' ? false : data.type === 'Baja IT';
              const isAusencia = activeCompany === 'second' ? false : data.type === 'Ausencia Justificada';
              const isCambioFuncion = activeCompany === 'second' ? false : data.type === 'Cambio de función';
              const restViolation = activeCompany === 'second' ? null : getDayRestViolation(day);
              const hasRestAlert = !!restViolation?.hasViolation;
              const isCededToCoworker = activeCompany === 'second' ? false : !!data.swapInfo?.cededToCoworker;
              const isCoveringCoworker = activeCompany === 'second' ? false : !!data.swapInfo?.coveringCoworker;
              const swapStatus = activeCompany === 'second' ? undefined : data.swapInfo?.status;

              // Determine subtle background tint for special days
              let dayBg = "bg-white";
              if (activeCompany === 'second') {
                if (hasWork) {
                  dayBg = "bg-amber-500/10 dark:bg-amber-950/20";
                }
              } else if (isVac) {
                dayBg = "bg-azul-yellow/10";
              } else if (isPermisoRetribuido) {
                dayBg = "day-cell-permiso-retribuido bg-[#800020]/15 dark:bg-[#800020]/25";
              } else if (isSindical) {
                dayBg = "bg-[#002266]/10 dark:bg-[#002266]/25";
              } else if (isBajaIT) {
                dayBg = "day-cell-baja-it bg-neutral-900/12";
              } else if (isAusencia) {
                dayBg = "day-cell-ausencia bg-orange-500/15";
              } else if (isCambioFuncion) {
                dayBg = "day-cell-cambio-funcion bg-[#ff007f]/15";
              } else if (isComp) {
                dayBg = "bg-sky-500/10";
              } else if (isFest) {
                dayBg = "bg-emerald-500/10";
              } else if (isPerentoriaDay) {
                dayBg = "bg-purple-500/10";
              }
              
              // Determine active shifts to render
              const activeWorkShifts = hasRegularWork 
                ? data.shifts.filter(s => s.start && s.end) 
                : (onlyExtra ? (data.extraShifts || []).filter(s => s.start && s.end) : []);
              const isSingleShift = activeWorkShifts.length === 1;
              const showSwapCellBadge =
                (isCoveringCoworker && !!swapStatus) ||
                (isCededToCoworker && !(swapStatus === 'accepted' && !isCoveringCoworker) && (isCoveringCoworker || hasRegularWork));
              const hasOtherHeaderBadge = isFest || isVac || isSindical || isComp || isPermisoRetribuido || isBajaIT || isAusencia || isCambioFuncion || isTodayDay || isMultiSelectMode || showSwapCellBadge;
              const canShowRestBadgeInHeader = hasRestAlert && !hasOtherHeaderBadge && isSingleShift;
              const showRestDotOnShift = hasRestAlert && !canShowRestBadgeInHeader;
              const firstValidRegularIdx = data.shifts.findIndex(s => s.start && s.end);
              const firstValidExtraIdx = (data.extraShifts || []).findIndex(s => s.start && s.end);


              return (
                <button
                  key={day.toString()}
                  onClick={() => handleDayClick(day)}
                  onMouseDown={() => onMouseDown(day)}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onTouchStart={() => onTouchStart(day)}
                  onTouchEnd={onTouchEnd}
                  onTouchMove={onTouchMove}
                  className={cn(
                    "aspect-[2/3] sm:aspect-[3/4] border-r border-b border-slate-100 flex flex-col relative transition-all active:scale-95 group overflow-hidden touch-pan-y min-h-[75px] sm:min-h-[95px] lg:min-h-[125px]",
                    dayBg,
                    isTodayDay ? "day-cell-today bg-azul-blue/5 dark:bg-azul-yellow/15 ring-1 ring-inset ring-azul-blue/30 dark:ring-azul-yellow/60 animate-pulse" : "",
                    !isSameMonth(day, currentMonth) ? "opacity-20" : "",
                    isMultiSelectMode && selectedMultiDays.includes(safeFormat(day, 'yyyy-MM-dd')) && "ring-2 ring-inset ring-azul-blue bg-azul-blue/10",
                    copiedShift && isValid(parseISO(copiedShift.date)) && safeFormat(parseISO(copiedShift.date), 'yyyy-MM-dd') === safeFormat(day, 'yyyy-MM-dd') && "ring-2 ring-inset ring-azul-yellow/50 bg-azul-yellow/5"
                  )}
                >
                  {activeCompany === 'main' && isRotationFreeDay(day, settings) && (() => {
                    const rot = getRotationForMonth(day, settings);
                    const pos = rot?.linePosition || 'top';
                    if (pos === 'bottom') {
                      return (
                        <>
                          {/* Difuminado vertical ascendente amplio desde la línea inferior */}
                          <div 
                            className="absolute bottom-0 left-0 right-0 h-8 sm:h-10 bg-gradient-to-t from-emerald-500/40 via-emerald-500/15 via-45% to-transparent z-10 pointer-events-none" 
                          />
                          {/* Fina línea verde inferior */}
                          <div 
                            className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-emerald-500 z-20 pointer-events-none shadow-xs" 
                            title="Día libre de la rotación (inferior)" 
                          />
                        </>
                      );
                    }
                    return (
                      <>
                        {/* Difuminado vertical descendente amplio desde la línea superior */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-8 sm:h-10 bg-gradient-to-b from-emerald-500/40 via-emerald-500/15 via-45% to-transparent z-10 pointer-events-none" 
                        />
                        {/* Fina línea verde superior */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-[2.5px] bg-emerald-500 z-20 pointer-events-none shadow-xs" 
                          title="Día libre de la rotación (superior)" 
                        />
                      </>
                    );
                  })()}
                  <div className="p-0.5 sm:p-1 flex flex-col h-full w-full justify-between">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1">
                        {hasDayOverlap ? (
                          <div 
                            className="flex items-center justify-center w-6 h-6 rounded-full bg-red-600 border-2 border-yellow-400 shadow-xs transition-all shrink-0"
                            title={
                              overlapCheck.overlapMinutes > 0
                                ? `Solape horario entre empresas (${(overlapCheck.overlapMinutes / 60).toFixed(2).replace('.', ',')}h coincidencia)`
                                : `Solape horario entre empresas (salida y entrada coinciden a las ${overlapCheck.boundaryTimeText || 'la misma hora'})`
                            }
                          >
                            <span className="text-[9px] font-black text-white leading-none">{safeFormat(day, 'd')}</span>
                          </div>
                        ) : isTodayDay ? (
                          <div className="mini-hoy-badge flex items-center justify-center px-1.5 py-0.5 rounded-md bg-azul-blue dark:bg-azul-yellow shadow-md shadow-azul-blue/30 dark:shadow-none animate-pulse">
                            <span className="text-[8px] font-black uppercase tracking-wider text-yellow-300 dark:text-azul-blue">HOY</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-6 h-6 rounded-full transition-all">
                            <span className={cn(
                              "text-[9px] font-black",
                              isFest ? "text-emerald-600" : isSun ? "text-rose-500" : "text-slate-400"
                            )}>{safeFormat(day, 'd')}</span>
                          </div>
                        )}
                        {hasDayOverlap && isTodayDay && (
                          <div className="mini-hoy-badge flex items-center justify-center px-1 py-0.5 rounded-md bg-azul-blue dark:bg-azul-yellow shadow-xs animate-pulse">
                            <span className="text-[6.5px] font-black uppercase tracking-wider text-yellow-300 dark:text-azul-blue">HOY</span>
                          </div>
                        )}
                        {isFest && (
                          <span className="text-[7px] font-black bg-emerald-500 text-white px-1 py-0.5 rounded-sm leading-none">FEST</span>
                        )}
                        {isVac && (
                          <span className="vac-badge text-[7px] font-black bg-azul-yellow text-[#003399] px-1 py-0.5 rounded-sm leading-none">VAC</span>
                        )}
                        {isSindical && (
                          <span className="text-[7px] font-black bg-[#002266] text-azul-yellow border border-[#003399]/40 px-1 py-0.5 rounded-sm leading-none">HH.SS.</span>
                        )}
                        {isComp && (
                          <span className="text-[7px] font-black bg-sky-500 text-white px-1 py-0.5 rounded-sm leading-none">COMP</span>
                        )}
                        {isPermisoRetribuido && (
                          <span className="shift-pill-permiso-retribuido text-[6.5px] font-black bg-[#800020] text-white px-1 py-0.5 rounded-sm leading-none">P.R.</span>
                        )}
                        {isBajaIT && (
                          <span className="shift-pill-baja-it text-[6.5px] font-black bg-neutral-950 text-white px-1 py-0.5 rounded-sm leading-none">BAJA</span>
                        )}
                        {isAusencia && (
                          <span className="shift-pill-ausencia text-[6.5px] font-black bg-orange-400 text-black px-1 py-0.5 rounded-sm leading-none">AUS</span>
                        )}
                        {isCambioFuncion && (
                          <span className="shift-pill-cambio-funcion text-[6.5px] font-black bg-[#ff007f] text-white px-1 py-0.5 rounded-sm leading-none">C.F.</span>
                        )}
                        {showSwapCellBadge && (
                          swapStatus === 'pending' ? (
                            <span
                              className="inline-flex items-center justify-center bg-amber-100 text-amber-700 border border-amber-300 px-1 py-0.5 rounded-sm leading-none shrink-0"
                              title={`Cambio de turno pendiente con ${data.swapInfo?.coworkerName || 'otro trabajador'}`}
                            >
                              <Clock size={8.5} className="text-amber-600" />
                            </span>
                          ) : swapStatus === 'accepted' ? (
                            <span
                              className="inline-flex items-center justify-center bg-emerald-100 text-emerald-700 border border-emerald-300 px-1 py-0.5 rounded-sm leading-none shrink-0"
                              title={`Cambio de turno aceptado con ${data.swapInfo?.coworkerName || 'otro trabajador'}`}
                            >
                              <CheckCircle2 size={8.5} className="text-emerald-600" />
                            </span>
                          ) : swapStatus === 'rejected' ? (
                            <span
                              className="inline-flex items-center justify-center bg-rose-100 text-rose-700 border border-rose-300 px-1 py-0.5 rounded-sm leading-none shrink-0"
                              title={`Cambio de turno rechazado por ${data.swapInfo?.coworkerName || 'otro trabajador'}`}
                            >
                              <XCircle size={8.5} className="text-rose-600" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center bg-slate-200 text-slate-700 border border-slate-300 px-1 py-0.5 rounded-sm leading-none shrink-0"
                              title={`Turno cedido: lo realiza ${data.swapInfo?.coworkerName || 'otro trabajador'}`}
                            >
                              <Users size={8.5} className="text-slate-600" />
                            </span>
                          )
                        )}
                        {canShowRestBadgeInHeader && restViolation && (
                          <span 
                            className="text-[6.5px] font-black bg-rose-500 text-white px-1 py-0.5 rounded-sm leading-none flex items-center gap-0.5 shadow-2xs shrink-0"
                            title={`Descanso legal insuficiente: ${formatRestHours(restViolation.restHours)} (Salida ant. ${restViolation.prevEnd} → Entrada ${restViolation.currStart})`}
                          >
                            &lt;12h
                          </span>
                        )}
                      </div>
                      {isMultiSelectMode && (
                        <div className={cn(
                          "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                          selectedMultiDays.includes(safeFormat(day, 'yyyy-MM-dd')) ? "bg-azul-blue border-azul-blue text-white" : "bg-white border-slate-200"
                        )}>
                          {selectedMultiDays.includes(safeFormat(day, 'yyyy-MM-dd')) && <CheckSquare size={10} />}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-0.5 lg:gap-1 justify-center items-center py-0.5 lg:py-1 px-0.5 w-full">
                      {hasRegularWork && data.shifts.map((s, sIdx) => {
                        if (!s.start || !s.end) return null;
                        const hasExtraAttached = data.extraShifts?.some(es => es.start === s.end || es.end === s.start);
                        const isPartiallyComp = isDayPartiallyCompensated(data);
                        const isPartiallySind = isDayPartiallySindical(data);
                        const hasCompDot = isPartiallyComp;
                        const hasSindDot = isPartiallySind;
                        const hasRestDotHere = showRestDotOnShift && sIdx === firstValidRegularIdx;
                        
                        return (
                          <div key={sIdx} className={cn(
                            "rounded-lg lg:rounded-xl flex flex-col items-center justify-center w-full relative transition-all border",
                            isSingleShift 
                              ? "px-1.5 py-1.5 max-w-[54px] shadow-sm lg:w-[96%] lg:max-w-none lg:py-3 lg:min-h-[66px]" 
                              : "px-0.5 py-0.5 max-w-[42px] lg:w-[96%] lg:max-w-none lg:py-1 lg:min-h-[32px]",
                            activeCompany === 'second'
                              ? "bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 text-white shadow-xs"
                              : isBajaIT
                              ? "shift-pill-baja-it bg-neutral-950 border-neutral-800"
                              : isAusencia
                                ? "shift-pill-ausencia bg-orange-400 border-orange-500"
                                : isCambioFuncion
                                  ? "shift-pill-cambio-funcion bg-[#ff007f] border-[#ff007f]"
                                  : isCoveringCoworker
                                    ? (
                                        swapStatus === 'pending'
                                          ? "bg-amber-50 border-amber-300 border-dashed"
                                          : swapStatus === 'rejected'
                                            ? "bg-rose-50 border-rose-300"
                                            : swapStatus === 'accepted'
                                              ? "bg-slate-200 border-emerald-400"
                                              : "bg-slate-200 border-slate-300"
                                      )
                                    : isFest
                                      ? "bg-emerald-500 border-emerald-400"
                                      : isVac 
                                        ? "shift-pill-vacaciones bg-azul-yellow border-azul-yellow/50" 
                                        : isSindical
                                          ? (isPartiallySind ? "bg-white dark:bg-slate-800 border-[#003399] shadow-sm" : "bg-[#002266] border-[#003399]")
                                          : isPermisoRetribuido
                                            ? "shift-pill-permiso-retribuido bg-[#800020] border-[#800020]"
                                            : isComp 
                                              ? (isPartiallyComp ? "bg-white border-sky-300 shadow-sm" : "bg-sky-500 border-sky-400") 
                                              : "bg-white border-slate-100"
                          )}>
                            {hasSindDot && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#002266] border border-azul-yellow shadow-sm z-10" title="Tramo de horas sindicales" />
                            )}
                            {hasCompDot && (
                              <div className={cn(
                                "absolute -top-1 w-2 h-2 rounded-full bg-sky-500 border border-white shadow-sm z-10",
                                hasSindDot ? "-left-1" : "-right-1"
                              )} title="Tramo a compensar" />
                            )}
                            {hasExtraAttached && (
                              <div className={cn(
                                "absolute -top-1 w-2 h-2 rounded-full bg-purple-500 border border-white shadow-sm z-10",
                                hasCompDot || hasSindDot ? "-left-1" : "-right-1"
                              )} title="Horas perentorias" />
                            )}
                            {hasRestDotHere && restViolation && (
                              <div className={cn(
                                "absolute w-2 h-2 rounded-full bg-rose-500 border border-white shadow-sm z-10",
                                !hasCompDot && !hasExtraAttached && !hasSindDot
                                  ? "-top-1 -right-1"
                                  : "-bottom-1 -right-1"
                              )} title={`Descanso < 12h (${formatRestHours(restViolation.restHours)})`} />
                            )}
                            <span className={cn(
                              "font-black leading-none", 
                              isSingleShift ? "text-[9px] lg:text-[13px] lg:tracking-tight" : "text-[6.5px] lg:text-[9px]",
                              activeCompany === 'second'
                                ? "text-white"
                                : isBajaIT
                                ? "text-white"
                                : isAusencia
                                  ? "text-black"
                                  : isCambioFuncion
                                    ? "text-white"
                                    : isCoveringCoworker
                                      ? "text-black"
                                      : isFest
                                        ? "text-white"
                                        : isVac 
                                          ? "vac-time-start text-[#003399]" 
                                          : isSindical
                                            ? (isPartiallySind ? "text-[#002266] dark:text-amber-300" : "text-azul-yellow")
                                            : isPermisoRetribuido
                                              ? "text-white"
                                              : isComp 
                                                ? (isPartiallyComp ? "text-azul-blue" : "text-white") 
                                                : "text-azul-blue"
                            )}>{s.start}</span>
                            <span className={cn(
                              "font-black leading-none mt-0.5 lg:mt-1", 
                              isSingleShift ? "text-[9px] lg:text-[13px] lg:tracking-tight" : "text-[6.5px] lg:text-[9px]",
                              activeCompany === 'second'
                                ? "text-amber-100"
                                : isBajaIT
                                ? "text-neutral-300"
                                : isAusencia
                                  ? "text-black"
                                  : isCambioFuncion
                                    ? "text-white"
                                    : isCoveringCoworker
                                      ? "text-black"
                                      : isFest
                                        ? "text-emerald-100"
                                        : isVac 
                                          ? "vac-time-end text-[#003399]" 
                                          : isSindical
                                            ? (isPartiallySind ? "text-slate-400 dark:text-slate-300" : "text-amber-200")
                                            : isPermisoRetribuido
                                              ? "text-rose-100"
                                              : isComp 
                                                ? (isPartiallyComp ? "text-slate-400" : "text-sky-100") 
                                                : "text-slate-400"
                            )}>{s.end}</span>
                          </div>
                        );
                      })}

                      {onlyExtra && data.extraShifts && data.extraShifts.map((s, sIdx) => s.start && s.end && (
                        <div key={sIdx} className={cn(
                          "rounded-lg lg:rounded-xl flex flex-col items-center justify-center w-full relative transition-all border",
                          isSingleShift 
                            ? "px-1.5 py-1.5 max-w-[54px] shadow-sm lg:w-[96%] lg:max-w-none lg:py-3 lg:min-h-[66px]" 
                            : "px-0.5 py-0.5 max-w-[42px] lg:w-[96%] lg:max-w-none lg:py-1 lg:min-h-[32px]",
                          isBajaIT
                            ? "shift-pill-baja-it bg-neutral-950 border-neutral-800"
                            : isAusencia
                              ? "shift-pill-ausencia bg-orange-400 border-orange-500"
                              : isCambioFuncion
                                ? "shift-pill-cambio-funcion bg-[#ff007f] border-[#ff007f]"
                                : isFest
                                  ? "bg-emerald-500 border-emerald-400"
                                  : isVac 
                                    ? "shift-pill-vacaciones bg-azul-yellow border-azul-yellow/50" 
                                    : isSindical
                                      ? "bg-[#002266] border-[#003399]"
                                      : isPermisoRetribuido
                                        ? "shift-pill-permiso-retribuido bg-[#800020] border-[#800020]"
                                        : isComp 
                                          ? "bg-sky-500 border-sky-400" 
                                          : "bg-purple-600 border border-purple-400"
                        )}>
                          {showRestDotOnShift && sIdx === firstValidExtraIdx && restViolation && (
                            <div
                              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 border border-white shadow-sm z-10"
                              title={`Descanso < 12h (${formatRestHours(restViolation.restHours)})`}
                            />
                          )}
                          <span className={cn(
                            "font-black leading-none", 
                            isSingleShift ? "text-[9px] lg:text-[13px] lg:tracking-tight" : "text-[6.5px] lg:text-[9px]",
                            isBajaIT
                              ? "text-white"
                              : isAusencia
                                ? "text-black"
                                : isCambioFuncion
                                  ? "text-white"
                                  : isFest
                                    ? "text-white"
                                    : isVac 
                                      ? "vac-time-start text-[#003399]" 
                                      : isSindical
                                        ? "text-azul-yellow"
                                        : isPermisoRetribuido
                                          ? "text-white"
                                          : isComp 
                                            ? "text-white" 
                                            : "text-white"
                          )}>{s.start}</span>
                          <span className={cn(
                            "font-black leading-none mt-0.5 lg:mt-1", 
                            isSingleShift ? "text-[9px] lg:text-[13px] lg:tracking-tight" : "text-[6.5px] lg:text-[9px]",
                            isBajaIT
                              ? "text-neutral-300"
                              : isAusencia
                                ? "text-black"
                                : isCambioFuncion
                                  ? "text-white"
                                  : isFest
                                    ? "text-emerald-100"
                                    : isVac 
                                      ? "vac-time-end text-[#003399]" 
                                      : isSindical
                                        ? "text-amber-200"
                                        : isPermisoRetribuido
                                          ? "text-rose-100"
                                          : isComp 
                                            ? "text-white" 
                                            : "text-purple-200"
                          )}>{s.end}</span>
                        </div>
                      ))}

                      {isSindical && !hasWork && (
                        <div className="bg-[#002266] border border-[#003399] shadow-sm rounded-lg px-2 py-1 lg:w-[96%] lg:py-4 lg:rounded-xl flex items-center justify-center">
                          <span className="text-[7px] lg:text-xs font-black text-azul-yellow uppercase">HH.SS.</span>
                        </div>
                      )}
                      {isComp && !hasWork && (
                        <div className="bg-sky-500 border border-sky-400 shadow-sm rounded-lg px-2 py-1 lg:w-[96%] lg:py-4 lg:rounded-xl flex items-center justify-center">
                          <span className="text-[7px] lg:text-xs font-black text-white uppercase">COMP</span>
                        </div>
                      )}
                      {isBajaIT && !hasWork && (
                        <div className="shift-pill-baja-it bg-neutral-950 border border-neutral-800 shadow-sm rounded-lg px-1.5 py-1 lg:w-[96%] lg:py-4 lg:rounded-xl flex items-center justify-center">
                          <span className="text-[6.5px] lg:text-xs font-black text-white uppercase">BAJA IT</span>
                        </div>
                      )}
                      {isAusencia && !hasWork && (
                        <div className="shift-pill-ausencia bg-orange-400 border border-orange-500 shadow-sm rounded-lg px-1.5 py-1 lg:w-[96%] lg:py-4 lg:rounded-xl flex items-center justify-center">
                          <span className="text-[6.5px] lg:text-xs font-black text-black uppercase">AUS.</span>
                        </div>
                      )}
                      {isCambioFuncion && !hasWork && (
                        <div className="shift-pill-cambio-funcion bg-[#ff007f] border border-[#ff007f] shadow-sm rounded-lg px-1.5 py-1 lg:w-[96%] lg:py-4 lg:rounded-xl flex items-center justify-center">
                          <span className="text-[6.5px] lg:text-xs font-black text-white uppercase">C. FUNC.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    ) : (
        <div className="space-y-4">
          {/* List View Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/60 p-3 rounded-[2rem] border border-slate-100 backdrop-blur-sm">
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
              <button
                onClick={() => setListSubMode('month')}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  listSubMode === 'month' ? "bg-white text-azul-blue shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Mes Completo
              </button>
              <button
                onClick={() => {
                  setListSubMode('week');
                  // If switching to week, ensure currentWeek is within the currentMonth if possible, or just use current date
                  if (!isSameMonth(currentWeek, currentMonth)) {
                    setCurrentWeek(startOfWeek(currentMonth, { weekStartsOn: 1 }));
                  }
                }}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  listSubMode === 'week' ? "bg-white text-azul-blue shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Semana
              </button>
            </div>

            {listSubMode === 'week' && (
              <div className="flex items-center gap-2 bg-white/80 p-1 rounded-2xl shadow-sm border border-slate-50 w-full sm:w-auto justify-between sm:justify-start">
                <button 
                  onClick={() => {
                    const prevWeek = subWeeks(currentWeek, 1);
                    if (isSameMonth(endOfWeek(prevWeek, { weekStartsOn: 1 }), currentMonth)) {
                      setCurrentWeek(prevWeek);
                    }
                  }}
                  disabled={!isSameMonth(endOfWeek(subWeeks(currentWeek, 1), { weekStartsOn: 1 }), currentMonth)}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    !isSameMonth(endOfWeek(subWeeks(currentWeek, 1), { weekStartsOn: 1 }), currentMonth) 
                      ? "text-slate-200 cursor-not-allowed" 
                      : "text-slate-400 hover:bg-slate-50"
                  )}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight px-2">
                  {safeFormat(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'd MMM', { locale: es })} - {safeFormat(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'd MMM', { locale: es })}
                </span>
                <button 
                  onClick={() => {
                    const nextWeek = addWeeks(currentWeek, 1);
                    if (isSameMonth(startOfWeek(nextWeek, { weekStartsOn: 1 }), currentMonth)) {
                      setCurrentWeek(nextWeek);
                    }
                  }}
                  disabled={!isSameMonth(startOfWeek(addWeeks(currentWeek, 1), { weekStartsOn: 1 }), currentMonth)}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    !isSameMonth(startOfWeek(addWeeks(currentWeek, 1), { weekStartsOn: 1 }), currentMonth) 
                      ? "text-slate-200 cursor-not-allowed" 
                      : "text-slate-400 hover:bg-slate-50"
                  )}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {listDays.map(day => {
              const isoDay = safeFormat(day, 'yyyy-MM-dd');
              const mainDay = shifts.find(s => s.date === isoDay);
              const secondDay = (settings.secondCompanyShifts || []).find(s => s.date === isoDay);
              const overlapCheck = checkDayShiftsOverlap(mainDay, secondDay, { isMainVacationInSettings: settings.vacations.includes(isoDay) });

              const data = activeCompany === 'second' ? getSecondDayData(day) : getDayData(day);
              const isFest = activeCompany === 'second' ? false : isHoliday(day);
              const isSun = isSunday(day);
              const isTodayDay = isToday(day);
              const hasRegularWork = (data.shifts || []).some(s => s.start && s.end);
              const hasExtraWork = activeCompany === 'second' ? false : (data.extraShifts && data.extraShifts.some(s => s.start && s.end));
              const hasWork = hasRegularWork || hasExtraWork;
              const onlyExtra = hasExtraWork && !hasRegularWork;
              const isVac = activeCompany === 'second' ? false : (settings.vacations.includes(isoDay) || data.type === 'Vacaciones');
              const isSindical = activeCompany === 'second' ? false : data.type === 'Horas Sindicales';
              const isComp = activeCompany === 'second' ? false : data.type === 'A Compensar';
              const isAusencia = activeCompany === 'second' ? false : data.type === 'Ausencia Justificada';
              const isCambioFuncion = activeCompany === 'second' ? false : data.type === 'Cambio de función';
              const restViolation = activeCompany === 'second' ? null : getDayRestViolation(day);
              const hasRestAlert = !!restViolation?.hasViolation;

              let listBg = "bg-white";
              let listBorder = "border-slate-100";
              let iconBg = "bg-slate-100 text-slate-600";
              
              if (activeCompany === 'second') {
                if (hasRegularWork) {
                  listBg = "bg-orange-50/30 dark:bg-orange-950/20";
                  listBorder = "border-orange-200 dark:border-orange-800/40";
                  iconBg = "bg-gradient-to-br from-amber-500 to-orange-500 text-white";
                } else {
                  listBg = "bg-white dark:bg-slate-900";
                  listBorder = "border-slate-100 dark:border-slate-800";
                  iconBg = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
                }
              } else if (isFest) {
                listBg = "bg-emerald-50/30";
                listBorder = "border-emerald-100";
                iconBg = "bg-emerald-100 text-emerald-600";
              } else if (onlyExtra) {
                listBg = "bg-purple-600";
                listBorder = "border-purple-700";
                iconBg = "bg-white text-purple-600";
              } else if (isVac) {
                listBg = "bg-azul-yellow/5";
                listBorder = "border-azul-yellow/20";
                iconBg = "bg-azul-yellow text-azul-blue";
              } else if (isSindical) {
                listBg = "bg-[#002266]/5";
                listBorder = "border-[#003399]/20";
                iconBg = "bg-[#002266] text-azul-yellow";
              } else if (isAusencia) {
                listBg = "bg-orange-50/40";
                listBorder = "border-orange-200";
                iconBg = "bg-orange-400 text-black";
              } else if (isCambioFuncion) {
                listBg = "bg-pink-50/40";
                listBorder = "border-pink-200";
                iconBg = "bg-[#ff007f] text-white";
              } else if (isComp) {
                listBg = "bg-sky-50/30";
                listBorder = "border-sky-100";
                iconBg = "bg-sky-100 text-sky-600";
              } else if (hasRegularWork) {
                listBg = "bg-orange-50/30";
                listBorder = "border-orange-50";
                iconBg = "bg-orange-50 text-orange-400";
              } else if (isSun) {
                listBg = "bg-rose-50/30";
                listBorder = "border-rose-100";
                iconBg = "bg-rose-100 text-rose-600";
              } else {
                listBg = "bg-white";
                listBorder = "border-slate-100";
                iconBg = "bg-slate-100 text-slate-600";
              }

              return (
                <button
                  key={day.toString()}
                  onClick={() => handleDayClick(day)}
                  onMouseDown={() => onMouseDown(day)}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onTouchStart={() => onTouchStart(day)}
                  onTouchEnd={onTouchEnd}
                  onTouchMove={onTouchMove}
                  className={cn(
                    "w-full p-4 rounded-3xl border flex items-center justify-between transition-all active:scale-[0.98] group touch-pan-y",
                    isTodayDay ? "day-cell-today bg-azul-blue/5 dark:bg-azul-yellow/15 border-azul-blue/20 dark:border-azul-yellow/40 ring-1 ring-azul-blue dark:ring-azul-yellow/60 animate-pulse" : `${listBg} ${listBorder} shadow-sm`,
                    onlyExtra && "text-white",
                    isMultiSelectMode && selectedMultiDays.includes(safeFormat(day, 'yyyy-MM-dd')) && "ring-2 ring-azul-blue bg-azul-blue/10",
                    copiedShift && isValid(parseISO(copiedShift.date)) && safeFormat(parseISO(copiedShift.date), 'yyyy-MM-dd') === safeFormat(day, 'yyyy-MM-dd') && "ring-2 ring-azul-yellow/50 bg-azul-yellow/5"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {isMultiSelectMode && (
                      <div className={cn(
                        "w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                        selectedMultiDays.includes(safeFormat(day, 'yyyy-MM-dd')) ? "bg-azul-blue border-azul-blue text-white" : "bg-white border-slate-200"
                      )}>
                        {selectedMultiDays.includes(safeFormat(day, 'yyyy-MM-dd')) && <CheckSquare size={14} />}
                      </div>
                    )}
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex flex-col items-center justify-center",
                      iconBg
                    )}>
                      <span className="text-[10px] font-black uppercase tracking-tighter">{safeFormat(day, 'EEE', { locale: es })}</span>
                      <span className={cn("text-lg font-black leading-none", isSun && !isTodayDay && "text-rose-500")}>{safeFormat(day, 'd')}</span>
                    </div>
                    <div className="text-left">
                      {onlyExtra ? (
                        <>
                          <span className={cn(
                            "block text-[10px] font-black uppercase tracking-[0.2em] mb-1",
                            onlyExtra && !isVac && !isComp && !isSindical ? "text-purple-200" : "text-purple-500"
                          )}>
                            {settings.contractType === 'Completo' ? 'Perentorias' : 'Complementarias'}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {data.extraShifts?.map((s, i) => s.start && (
                              <span key={i} className={cn(
                                "text-xs px-2.5 py-1 rounded-xl font-black shadow-sm border",
                                isVac 
                                  ? "bg-azul-yellow text-azul-blue border-azul-yellow/50" 
                                  : isSindical
                                    ? "bg-[#002266] text-azul-yellow border-[#003399]"
                                    : isComp 
                                      ? "bg-sky-500 text-white border-sky-400" 
                                      : "bg-white/20 border-white/30 text-white"
                              )}>
                                {s.start} - {s.end}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : hasRegularWork ? (
                        <>
                          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                            {activeCompany === 'second' ? (settings.secondCompanyName || '2ª Empresa') : data.type}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {data.shifts.map((s, i) => s.start && (
                              <span key={i} className={cn(
                                "text-xs px-2.5 py-1 rounded-xl font-black shadow-sm border",
                                activeCompany === 'second'
                                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400/50 shadow-orange-500/20"
                                  : isVac 
                                    ? "bg-azul-yellow text-azul-blue border-azul-yellow/50" 
                                    : isSindical
                                      ? "bg-[#002266] text-azul-yellow border-[#003399]"
                                      : isComp 
                                        ? "bg-sky-500 text-white border-sky-400" 
                                        : isAusencia
                                          ? "bg-orange-400 text-black border-orange-500"
                                          : isCambioFuncion
                                            ? "bg-[#ff007f] text-white border-[#ff007f]"
                                            : "bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                              )}>
                                {s.start} - {s.end}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : isVac ? (
                        <>
                          <span className="block text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">Vacaciones</span>
                          <span className="text-sm font-bold text-amber-800">Día de descanso</span>
                        </>
                      ) : isSindical ? (
                        <>
                          <span className="block text-[10px] font-black text-[#003399] dark:text-azul-yellow uppercase tracking-[0.2em] mb-1">Horas Sindicales</span>
                          <span className="text-sm font-bold text-[#002266] dark:text-azul-yellow">
                            {data.sindicalHoursQty !== undefined ? `${data.sindicalHoursQty}h sindicales` : "Día completo sindical"}
                          </span>
                        </>
                      ) : isComp ? (
                        <>
                          <span className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mb-1">A Compensar</span>
                          <span className="text-sm font-bold text-sky-800">
                            {data.compensatedHoursQty !== undefined ? `${data.compensatedHoursQty}h a compensar` : "Día completo a compensar"}
                          </span>
                        </>
                      ) : (
                        <>
                          {data.type !== 'Laboral' && <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{data.type}</span>}
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-sm text-emerald-600 font-black uppercase tracking-wider">Libre</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {hasWork && (
                      <span className={cn(
                        "text-xs font-black px-2 py-1 rounded-lg border",
                        activeCompany === 'second'
                          ? "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
                          : onlyExtra && !isVac && !isComp 
                            ? "bg-white/20 border-white/30 text-white" 
                            : "bg-azul-blue/5 border-azul-blue/10 text-azul-blue dark:text-sky-300"
                      )}>
                        {formatNumber(
                          (hasRegularWork ? data.shifts.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0) : 0) +
                          (hasExtraWork ? (data.extraShifts || []).reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0) : 0)
                        )}h
                      </span>
                    )}
                    {hasRegularWork && hasExtraWork && (
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-purple-500 uppercase tracking-tighter leading-none">
                          {settings.contractType === 'Completo' ? '+ Perent.' : '+ Compl.'}
                        </span>
                        <span className="text-[10px] font-black text-purple-600">
                          {formatNumber((data.extraShifts || []).reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0))}h
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-1">
                      {settings.dualMode && overlapCheck.hasHourlyOverlap && (
                        <span className="text-[9px] font-black text-white bg-red-600 px-2 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                          <AlertCircle size={10} />
                          {overlapCheck.overlapMinutes > 0
                            ? `Solape ${(overlapCheck.overlapMinutes / 60).toFixed(2).replace('.', ',')}h`
                            : `Solape ${overlapCheck.boundaryTimeText || ''}`.trim()}
                        </span>
                      )}
                      {hasRestAlert && (
                        <span className="text-[9px] font-black text-white bg-rose-500 px-2 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                          <AlertCircle size={10} />
                          {formatRestHours(restViolation.restHours)} desc.
                        </span>
                      )}
                      {isTodayDay && <span className="mini-hoy-badge text-[9px] font-black text-yellow-300 dark:text-azul-blue bg-azul-blue dark:bg-azul-yellow px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-azul-blue/20 dark:shadow-none animate-pulse">HOY</span>}
                      {isFest && <span className="text-[9px] font-black text-white bg-emerald-500 px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-200">Festivo</span>}
                      {isVac && <span className="text-[9px] font-black text-azul-blue bg-azul-yellow px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-azul-yellow/20">Vacaciones</span>}
                      {isComp && <span className="text-[9px] font-black text-white bg-sky-500 px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-sky-200">COMP</span>}
                      {isAusencia && <span className="shift-pill-ausencia text-[9px] font-black text-black bg-orange-400 px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-orange-200">Ausencia Just.</span>}
                      {isCambioFuncion && <span className="shift-pill-cambio-funcion text-[9px] font-black text-white bg-[#ff007f] px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-pink-200">Cambio Función</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

        {/* Botón compartir turnos del mes al final de la columna izquierda */}
        {activeCompany !== 'second' && (
          <button
            id="btn-compartir-turnos-mes"
            type="button"
            onClick={() => handleOpenShareMonthModal()}
            className="btn-compartir-turnos-mes w-full py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm border flex items-center justify-center gap-2 transition-all bg-slate-200 hover:bg-slate-300 active:scale-[0.99] text-black dark:text-white border-slate-300/80 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
            title="Compartir turnos del mes"
          >
            <Share2 size={16} className="text-black dark:text-white" />
            <span>Compartir turnos del mes</span>
          </button>
        )}
      </div>
      {/* Fin de la Columna Izquierda */}

      {/* Columna Derecha: Tarjetas de los pluses generados (en la misma fila pero alineado a la derecha) */}
      <div className={cn(
        "lg:col-span-5 xl:col-span-4 space-y-4 sm:space-y-6 lg:sticky lg:top-4",
        viewMode === 'list' && "hidden lg:block"
      )}>
        {activeCompany === 'main' ? (
          <div className="space-y-4">
            {/* Cabecera / Título de Pluses Generados para PC / Escritorio */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-azul-blue dark:bg-azul-yellow" />
                <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Pluses Generados del Mes
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest capitalize">
                {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
            </div>

            <div id="resumen-pluses-grid" className="grid grid-cols-2 gap-3 sm:gap-3.5">
              {(() => {
                const monthCounterCfg = getCounterConfigForDate(settings, currentMonth);
                const currentYear = settings.isSubrogado ? monthCounterCfg.counterYear : currentMonth.getFullYear();
                const yearPluses = pluses[currentYear] || pluses[Object.keys(pluses).map(Number).sort((a,b)=>b-a)[0]] || {};

                const customItems = Object.entries(yearPluses)
                  .filter(([pName, pCfg]: [string, any]) => {
                    if (!pCfg || !pCfg.enabled) return false;
                    return !!pCfg.showInMonthTags;
                  })
                  .map(([pName, pCfg]: [string, any]) => {
                    const customCount = (stats as any)?.customCounts?.[pName];
                    const isHourly = pCfg.calculationType === 'nocturnas' || pCfg.baseType === 'nocturnas' || pCfg.calculationType === 'festivo' || pCfg.baseType === 'festivo' || pCfg.calculationType === 'domingo' || pCfg.baseType === 'domingo';
                    const isMadrugue = pCfg.calculationType === 'madrugue' || pCfg.baseType === 'madrugue';
                    const isTransport = pCfg.calculationType === 'transporte' || pCfg.baseType === 'transporte' || pCfg.calculationType === 'dias_trabajados';
                    const isMeal = pCfg.calculationType === 'manutencion' || pCfg.baseType === 'manutencion';
                    const isProportional = pCfg.calculationType === 'proporcional_jornada' || pCfg.baseType === 'proporcional_jornada';
                    const isFixed = pCfg.calculationType === 'fijo' || pCfg.baseType === 'fijo';

                    let val = 0;
                    let unit: string | undefined = isHourly ? 'h' : '';
                    let decimals = isHourly ? 2 : 0;

                    if (customCount !== undefined) {
                      val = customCount;
                    } else if (isTransport) {
                      val = stats.transport + stats.transportSub;
                    } else if (isProportional) {
                      val = settings.contractType === 'Completo' ? 1 : Math.round(((stats.effectivePct || 100) / 100) * 100) / 100;
                      decimals = 2;
                    } else if (isFixed) {
                      val = 1;
                      unit = ' mes';
                    } else {
                      val = 1;
                    }

                    return {
                      label: pName,
                      value: val,
                      color: isMadrugue ? 'text-amber-600' : isHourly ? 'text-indigo-600' : isMeal ? 'text-teal-600' : isTransport ? 'text-cyan-600' : 'text-purple-600',
                      bg: isMadrugue ? 'bg-amber-50' : isHourly ? 'bg-indigo-50/70' : isMeal ? 'bg-teal-50/70' : isTransport ? 'bg-cyan-50/70' : 'bg-purple-50/70',
                      unit,
                      decimals,
                      key: pName,
                      plusType: 'custom',
                      isCustom: true
                    };
                  });

                return [
                  { label: 'Nocturnas', value: stats.nightHours + stats.nightHoursSub, subValue: stats.nightHoursSub, color: 'text-azul-blue', bg: 'bg-azul-blue/5', key: 'Nocturnas', plusType: 'nocturnas' },
                  { label: 'Madrugues', value: stats.madrugues + stats.madruguesSub, subValue: stats.madruguesSub, color: 'text-amber-600', bg: 'bg-amber-50', unit: '', decimals: 0, key: 'Madrugue', plusType: 'madrugues' },
                  { label: 'Domingos', value: stats.sundays + stats.sundaysSub, subValue: stats.sundaysSub, color: 'text-rose-600', bg: 'bg-rose-50', key: 'Domingo', plusType: 'domingos' },
                  { label: 'Festivos', value: stats.festivos + stats.festivosSub, subValue: stats.festivosSub, color: 'text-emerald-600', bg: 'bg-emerald-50', key: 'Festivo', plusType: 'festivos' },
                  { label: 'Fraccionadas', value: stats.splitLess4 + stats.split4to7 + stats.splitPlus7 + stats.splitLess4Sub + stats.split4to7Sub + stats.splitPlus7Sub, subValue: stats.splitLess4Sub + stats.split4to7Sub + stats.splitPlus7Sub, color: 'text-slate-900', bg: 'bg-slate-100', unit: '', decimals: 0, border: 'border-none', key: 'Jornada Fraccionada < 4h', plusType: 'fraccionadas' },
                  { label: 'Transporte', value: stats.transport + stats.transportSub, subValue: stats.transportSub, color: 'text-azul-blue', bg: 'bg-azul-blue/5', unit: '', decimals: 0, key: 'Transporte', plusType: 'transporte' },
                  { label: 'J. Irreg. Diaria', value: stats.transport + stats.transportSub, color: 'text-purple-600', bg: 'bg-purple-50', unit: '', decimals: 0, key: 'Jornada Irregular Diaria', plusType: 'jornada-irregular-diaria' },
                  { label: 'Manutención', value: stats.manutencion + stats.manutencionSub, subValue: stats.manutencionSub, color: 'text-orange-600', bg: 'bg-orange-50', unit: '', decimals: 0, key: 'Manutención', plusType: 'manutencion' },
                  ...(settings.contractType === 'Completo' 
                    ? [{ label: 'Turnicidad', value: stats.uniqueShiftsCount, color: 'text-slate-900', bg: 'bg-slate-100', unit: '', decimals: 0, key: 'Turnicidad 2', plusType: 'turnicidad' }]
                    : [{ label: 'Horas Mes', value: stats.monthlyHours, color: 'text-slate-900', bg: 'bg-slate-100', key: 'Salario Base', plusType: 'horasmes' }]
                  ),
                  { label: 'A Compensar', value: stats.compensatedHours, color: 'text-sky-700', bg: 'bg-sky-50', key: 'Compensar', isCompensar: true, plusType: 'compensar' },
                  { label: 'Ausencia Just.', value: stats.ausenciaHours || 0, color: 'text-orange-700', bg: 'bg-orange-50', key: 'Ausencia', isAusencia: true, plusType: 'ausencia' },
                  { label: 'Vacaciones', value: stats.vacationHours, color: 'text-amber-700', bg: 'bg-amber-50', key: 'Vacaciones', isVacaciones: true, plusType: 'vacaciones' },
                  { label: 'Cambio Función', value: stats.cambioFuncionHours || 0, color: 'text-[#ff007f]', bg: 'bg-[#ff007f]/10', key: 'Cambio de función', isCambioFuncion: true, plusType: 'cambio-funcion' },
                  ...customItems
                ].filter((stat: any) => {
                  if (stat.isCustom) return stat.value > 0;
                  if (stat.label === 'A Compensar' && stat.value <= 0) return false;
                  if (stat.label === 'Ausencia Just.' && stat.value <= 0) return false;
                  if (stat.label === 'Vacaciones' && stat.value <= 0) return false;
                  if (stat.label === 'Cambio Función') return stat.value > 0;
                  if (stat.label !== 'Horas Mes' && stat.label !== 'Total Horas' && stat.value <= 0) return false;
                  if (stat.key === 'Salario Base') return true;
                  
                  if (stat.key === 'Jornada Fraccionada < 4h') {
                    return (settings.contractType === 'Parcial') && (
                           yearPluses['Jornada Fraccionada < 4h']?.enabled || 
                           yearPluses['Jornada Fraccionada >= 4h']?.enabled || 
                           yearPluses['Jornada Fraccionada >= 7h']?.enabled
                    );
                  }
                  if (stat.key === 'Turnicidad 2') {
                    return yearPluses['Turnicidad 2']?.enabled || 
                           yearPluses['Turnicidad 3']?.enabled || 
                           yearPluses['Turnicidad 4']?.enabled || 
                           yearPluses['Turnicidad 5+']?.enabled;
                  }
                  return yearPluses[stat.key]?.enabled !== false;
                }).map((stat: any, i) => {
                  const formatCardMetric = (rawVal: number) => {
                    const resolvedUnit = stat.unit !== undefined ? stat.unit : 'h';
                    if (resolvedUnit === 'h') {
                      const rounded = Math.round((rawVal || 0) * 100) / 100;
                      return `${formatNumber(rounded, rounded % 1 === 0 ? 0 : 2)}h`;
                    }
                    return `${formatNumber(rawVal, stat.decimals ?? 2)}${resolvedUnit}`;
                  };
                  const hasSubSplit = !!(settings.isSubrogado && stat.subValue !== undefined && stat.subValue > 0);

                  return (
                    <div key={i} className={cn("plus-card-item", `plus-type-${stat.plusType}`, "p-2.5 sm:p-3 rounded-2xl border shadow-sm transition-transform hover:scale-105 touch-pan-y relative overflow-hidden flex flex-col justify-between", stat.bg, stat.border || "border-slate-100")}>
                      <span className="plus-card-title block text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">{stat.label}</span>
                      
                      <div className="flex items-center justify-between gap-1 mt-auto">
                        <span className={cn("plus-card-value font-black leading-none shrink-0", hasSubSplit ? "text-sm sm:text-base" : "text-base", stat.color)}>
                          {stat.isCompensar || stat.isVacaciones || stat.isCambioFuncion ? (
                            (() => {
                              const totalMinutes = Math.round(stat.value * 60);
                              const h = Math.floor(totalMinutes / 60);
                              const m = totalMinutes % 60;
                              return m > 0 ? `${h}h ${m}min` : `${h}h`;
                            })()
                          ) : (
                            <>{formatCardMetric(stat.value)}</>
                          )}
                        </span>

                        {hasSubSplit && (
                          <div className="flex flex-row flex-wrap items-center justify-end gap-1 min-w-0">
                            {(stat.value - stat.subValue) > 0 && (
                              <div className="flex items-center gap-0.5 sm:gap-1 bg-azul-blue px-1.5 py-0.5 rounded-md border border-azul-blue shadow-sm shrink-0">
                                <span className="text-[7px] sm:text-[8px] font-black text-white uppercase tracking-tighter">CON</span>
                                <span className="text-[9.5px] sm:text-[10.5px] font-black text-white leading-none tabular-nums">
                                  {formatCardMetric(stat.value - stat.subValue)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-0.5 sm:gap-1 bg-amber-400/10 px-1.5 py-0.5 rounded-md border border-amber-400/20 shrink-0">
                              <span className="text-[7px] sm:text-[8px] font-black text-amber-600 uppercase tracking-tighter">SUB</span>
                              <span className="text-[9.5px] sm:text-[10.5px] font-black text-amber-600 leading-none tabular-nums">
                                {formatCardMetric(stat.subValue)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Extra Hours Section at the bottom */}
            <div id="extra-hours-grid" className="grid grid-cols-2 gap-3 sm:gap-3.5">
              {(settings.contractType === 'Completo' 
                ? [
                    { label: 'Perentorias', value: stats.perentDay, color: 'text-purple-600', bg: 'bg-purple-50', plusType: 'perentorias' },
                    { label: 'Perentorias Noc.', value: stats.perentNight, color: 'text-purple-600', bg: 'bg-purple-50', plusType: 'perentorias' }
                  ]
                : [
                    { label: 'Complementarias', value: stats.complDay, color: 'text-purple-600', bg: 'bg-purple-50', plusType: 'complementarias' },
                    { label: 'Complementarias Noc.', value: stats.complNight, color: 'text-purple-600', bg: 'bg-purple-50', plusType: 'complementarias' }
                  ]
              ).filter(stat => stat.value > 0).map((stat: any, i) => {
                const roundedExtra = Math.round((stat.value || 0) * 100) / 100;
                return (
                  <div key={i} className={cn("plus-card-item plus-type-extra p-2 sm:p-3 rounded-2xl border shadow-lg transition-transform hover:scale-105 flex flex-col items-center justify-center text-center touch-pan-y", stat.bg, "border-purple-100 shadow-purple-100/20")}>
                    <span className="plus-card-title block text-[8px] sm:text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">{stat.label}</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("plus-card-value text-lg sm:text-xl font-black", stat.color)}>
                        {formatNumber(roundedExtra, roundedExtra % 1 === 0 ? 0 : 2)}
                      </span>
                      <span className={cn("plus-card-unit text-xs font-bold opacity-70", stat.color)}>h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/40 text-center space-y-2">
            <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              2º Calendario: {settings.secondCompanyName || '2ª Empresa'}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Este calendario gestiona exclusivamente los turnos y horas ordinarias de la segunda empresa para detectar solapes. Los pluses y el cálculo de nómina corresponden a la empresa principal (Azul Handling).
            </p>
          </div>
        )}
      </div>
    </div>
    {/* Fin del Grid de 2 columnas para PC / Escritorio */}

      {/* Payroll Section Integrated */}
      {activeCompany === 'main' && (
        <div className="space-y-6">
          <PayrollSection 
            settings={settings}
            shifts={shifts}
            levels={levels}
            pluses={pluses}
            currentMonth={currentMonth}
            updateSettings={updateSettings}
            onModalStateChange={setIsPayrollModalOpen}
            hideAmounts={!!activeSharedOwner?.hidePayrollAmounts}
          />
        </div>
      )}

      {/* Tutorial Trigger Button (Al final de la pestaña) */}
      <div className="flex justify-center pt-4 pb-2">
        <button
          onClick={() => setShowTutorial(!showTutorial)}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer"
          )}
        >
          <HelpCircle size={15} className={showTutorial ? "animate-bounce" : ""} />
          <span>Guía de Turnos y Nóminas</span>
        </button>
      </div>

      {/* Tutorial Modal Overlay */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        title="Turnos y Nóminas"
        subtitle="Guía de uso"
        steps={tutorialSteps}
      />

      {isMultiSelectMode && !isLocked && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 space-y-3 animate-in slide-in-from-bottom-4 duration-300">
            {selectedMultiDays.length > 0 && shiftTemplates.length > 0 && (
              <div className="space-y-1.5 pb-2.5 border-b border-slate-100">
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Aplicar Plantilla Rápida a {selectedMultiDays.length} día{selectedMultiDays.length > 1 ? 's' : ''}:
                </span>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {shiftTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handleApplyTemplateToMultiDays(tpl)}
                      className="shrink-0 px-2.5 py-1.5 rounded-xl bg-azul-blue/5 hover:bg-azul-blue hover:text-white text-azul-blue border border-azul-blue/15 transition-all active:scale-95 flex flex-col items-start"
                    >
                      {tpl.name && (
                        <span className="text-[8px] font-black uppercase tracking-wider opacity-75 leading-none mb-0.5">
                          {tpl.name}
                        </span>
                      )}
                      <span className="text-[10px] font-black leading-none whitespace-nowrap">
                        {tpl.shifts.map(s => `${s.start}-${s.end}`).join(' / ')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-azul-blue/5 text-azul-blue rounded-2xl flex items-center justify-center">
                  <CheckSquare size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{selectedMultiDays.length} días seleccionados</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selección múltiple</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedMultiDays.length > 0 && (
                  <button 
                    onClick={() => setIsMultiDeleteConfirmOpen(true)}
                    className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all active:scale-95"
                    title="Eliminar seleccionados"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                {copiedShift && selectedMultiDays.length > 0 && (
                  <button 
                    onClick={handleMultiPaste}
                    className="px-4 py-2 bg-azul-blue text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-azul-blue/20 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <ClipboardPaste size={16} />
                    Pegar
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedMultiDays([]);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OCR Success Modal */}
      <AnimatePresence>
        {showOcrSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-modal-active="true">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOcrSuccess(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center relative overflow-hidden z-10"
            >
              {/* Sparkles decoration */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6 mx-auto relative z-10 shadow-lg shadow-emerald-100/50">
                <Check size={32} strokeWidth={3} />
              </div>
              
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">¡Sincronizado!</h3>
              <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-6 uppercase">
                Hemos leído tus capturas y actualizado tu cuadrante de turnos para este mes correctamente.
              </p>
              
              <button 
                onClick={() => setShowOcrSuccess(false)}
                className="w-full py-4 bg-azul-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-azul-blue/20 hover:bg-azul-blue/90 transition-all active:scale-95"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Multi-Delete Confirmation Modal */}
      <AnimatePresence>
        {isMultiDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-modal-active="true">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 text-center mb-2 uppercase">¿Eliminar Turnos?</h3>
              <p className="text-slate-500 text-center mb-8 leading-relaxed">
                Estás a punto de eliminar <span className="font-bold text-slate-700">{selectedMultiDays.length} turnos</span> seleccionados. 
                Esta acción no se puede deshacer.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsMultiDeleteConfirmOpen(false)}
                  className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleMultiDelete}
                  className="py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            data-modal-active="true"
          >
            <motion.div 
              id="detalles-dia-modal"
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] sm:max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100/80 flex justify-between items-start bg-slate-50/55 backdrop-blur-md shrink-0">
                <div className="space-y-1">
                  <p className={cn(
                    "text-[10px] font-black tracking-widest uppercase",
                    activeCompany === 'second' ? "text-orange-600 dark:text-orange-400" : "text-azul-blue"
                  )}>
                    {activeCompany === 'second' ? (settings.secondCompanyName || '2ª Empresa') : 'Detalle del Día'}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight first-letter:uppercase">
                    {safeFormat(selectedDay, 'EEEE, d MMMM', { locale: es })}
                  </h3>
                  {activeCompany === 'second' ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-orange-50 border border-orange-200 text-orange-700 uppercase tracking-wider">
                        Turno Ordinario
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {isModalHoliday(selectedDay) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 border border-emerald-100 text-emerald-600 uppercase tracking-wider">
                          🎉 Día Festivo
                        </span>
                      )}
                      {getModalDayData(selectedDay).type === 'A Compensar' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-sky-50 border border-sky-200 text-sky-700 uppercase tracking-wider">
                          <ArrowLeftRight size={10} />
                          {isDayPartiallyCompensated(getModalDayData(selectedDay)) ? 'A Compensar (Parcial)' : 'A Compensar'}
                        </span>
                      )}
                      {getModalDayData(selectedDay).type === 'Permiso Retribuido' && (
                        <span className="shift-pill-permiso-retribuido inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-[#800020] border border-[#800020] text-white uppercase tracking-wider shadow-2xs">
                          <FileText size={10} />
                          Permiso Retribuido
                        </span>
                      )}
                      {getModalDayData(selectedDay).type === 'Vacaciones' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-700 uppercase tracking-wider">
                          ☀️ Vacaciones
                        </span>
                      )}
                      {getModalDayData(selectedDay).type === 'Baja IT' && (
                        <span className="shift-pill-baja-it inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-neutral-950 border border-neutral-800 text-white uppercase tracking-wider">
                          🏥 Baja IT
                        </span>
                      )}
                      {getModalDayData(selectedDay).type === 'Ausencia Justificada' && (
                        <span className="shift-pill-ausencia inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-orange-400 border border-orange-500 text-black uppercase tracking-wider">
                          📋 {isDayPartiallyAusencia(getModalDayData(selectedDay)) ? 'Ausencia Justificada (Parcial)' : 'Ausencia Justificada'}
                        </span>
                      )}
                      {getModalDayData(selectedDay).type === 'Cambio de función' && (
                        <span className="shift-pill-cambio-funcion inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-[#ff007f] border border-[#ff007f] text-white uppercase tracking-wider">
                          💼 Cambio de función
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {activeCompany === 'second' ? (
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {isLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                        <Lock size={11} /> Solo Lectura
                      </span>
                    )}
                    {copiedShift && !isLocked && (
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          const iso = safeFormat(selectedDay, 'yyyy-MM-dd');
                          updateModalSecondDayData({
                            date: iso,
                            type: 'Laboral',
                            shifts: JSON.parse(JSON.stringify(copiedShift.shifts)),
                            perentorias: { day: 0, night: 0 },
                            complementarias: { day: 0, night: 0 },
                            extraShifts: []
                          });
                        }}
                        className="p-2 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-slate-600 transition-colors"
                        title="Pegar turno guardado"
                      >
                        <ClipboardPaste size={18} />
                      </motion.button>
                    )}
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        const secData = getModalSecondDayData(selectedDay);
                        setCopiedShift({
                          date: safeFormat(selectedDay, 'yyyy-MM-dd'),
                          type: 'Laboral',
                          shifts: JSON.parse(JSON.stringify(secData.shifts)),
                          perentorias: { day: 0, night: 0 },
                          complementarias: { day: 0, night: 0 },
                          extraShifts: []
                        });
                        setJustCopied(true);
                        setTimeout(() => setJustCopied(false), 2000);
                      }}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        justCopied ? "bg-emerald-500 text-white" : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                      )}
                      title="Copiar horas del turno"
                    >
                      {justCopied ? <Check size={18} /> : <Copy size={18} />}
                    </motion.button>
                    {!isLocked && (
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const iso = safeFormat(selectedDay, 'yyyy-MM-dd');
                          deleteSecondShift(iso);
                          closeDayModal();
                        }}
                        className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors"
                        title="Borrar turno de la 2ª empresa"
                      >
                        <Trash2 size={18} />
                      </motion.button>
                    )}
                    <div className="w-px h-6 bg-slate-200/60 mx-1" />
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={closeDayModal} 
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                    >
                      <X size={18} />
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {isLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                        <Lock size={11} /> Solo Lectura
                      </span>
                    )}
                    {copiedShift && !isLocked && (
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          const data = getModalDayData(selectedDay);
                          const isVacationDay = data.type === 'Vacaciones' || settings.vacations.includes(data.date);
                          updateModalDayData({
                            ...data,
                            type: isVacationDay ? 'Vacaciones' : copiedShift.type,
                            shifts: JSON.parse(JSON.stringify(copiedShift.shifts)),
                            perentorias: { ...copiedShift.perentorias },
                            complementarias: { ...copiedShift.complementarias },
                            extraShifts: JSON.parse(JSON.stringify(copiedShift.extraShifts))
                          });
                          setIsEditingDay(true);
                          setIsSwappingDay(false);
                        }}
                        className="p-2 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-slate-600 transition-colors"
                        title="Pegar turno guardado"
                      >
                        <ClipboardPaste size={18} />
                      </motion.button>
                    )}
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setCopiedShift({
                          date: safeFormat(selectedDay, 'yyyy-MM-dd'),
                          type: 'Laboral', // Force Laboral type to only paste hours
                          shifts: JSON.parse(JSON.stringify(getModalDayData(selectedDay).shifts)),
                          perentorias: { day: 0, night: 0 },
                          complementarias: { day: 0, night: 0 },
                          extraShifts: []
                        });
                        setJustCopied(true);
                        setTimeout(() => setJustCopied(false), 2000);
                      }}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        justCopied ? "bg-emerald-500 text-white" : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                      )}
                      title="Copiar horas del turno"
                    >
                      {justCopied ? <Check size={18} /> : <Copy size={18} />}
                    </motion.button>
                    {!isLocked && (
                      <>
                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            const nextSwap = !isSwappingDay;
                            setIsSwappingDay(nextSwap);
                            if (nextSwap) setIsEditingDay(false);
                          }}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            isSwappingDay ? "bg-azul-blue text-white shadow-md shadow-azul-blue/25" : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                          )}
                          title="Intercambiar turno con compañero"
                        >
                          <ArrowLeftRight size={18} />
                        </motion.button>
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setIsDayDeleteConfirmOpen(true);
                          }}
                          className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors"
                          title="Borrar datos del día"
                        >
                          <Trash2 size={18} />
                        </motion.button>
                      </>
                    )}
                    <div className="w-px h-6 bg-slate-200/60 mx-1" />
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={closeDayModal} 
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                    >
                      <X size={18} />
                    </motion.button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {isLocked && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-200 text-xs font-semibold shadow-2xs">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                      <Lock size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-100 text-xs uppercase tracking-tight">Permiso de edición bloqueado</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                        {activeSharedOwner?.ownerName || 'El titular'} ha bloqueado los permisos de edición para este cuadrante compartido. Los datos están en modo solo lectura.
                      </p>
                    </div>
                  </div>
                )}
                {activeCompany === 'second' ? (
                  (() => {
                    const secData = getModalSecondDayData(selectedDay);
                    const mainDayData = getModalDayData(selectedDay);
                    const overlap = checkDayShiftsOverlap(mainDayData, secData, { isMainVacationInSettings: settings.vacations.includes(safeFormat(selectedDay, 'yyyy-MM-dd')) });
                    const validMain = (mainDayData.shifts || []).filter(s => s && s.start && s.end);
                    const validExtraMain = (mainDayData.extraShifts || []).filter(s => s && s.start && s.end);
                    const allMain = [...validMain, ...validExtraMain];
                    const hasMainWork = allMain.length > 0;
                    const mainTimes = allMain.map(s => `${s.start}-${s.end}`).join(', ');
                    const hasSecondWork = (secData.shifts || []).some(s => s && s.start && s.end);
                    const totalSecHours = (secData.shifts || []).reduce((acc, s) => {
                      if (!s.start || !s.end) return acc;
                      return acc + getShiftDuration(s.start, s.end);
                    }, 0);

                    const quickPresets = [
                      { label: '06:00 - 14:00', start: '06:00', end: '14:00' },
                      { label: '08:00 - 16:00', start: '08:00', end: '16:00' },
                      { label: '09:00 - 17:00', start: '09:00', end: '17:00' },
                      { label: '14:00 - 22:00', start: '14:00', end: '22:00' },
                      { label: '22:00 - 06:00', start: '22:00', end: '06:00' },
                    ];

                    return (
                      <div className="space-y-4">
                        {/* Tarjeta Informativa de Comparación / Solape con Azul Handling */}
                        <div className={cn(
                          "p-4 rounded-2xl border space-y-2.5 transition-all shadow-xs",
                          overlap.hasHourlyOverlap
                            ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
                            : (hasMainWork && hasSecondWork)
                              ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200"
                              : hasMainWork
                                ? "bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-200"
                                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        )}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                              {overlap.hasHourlyOverlap ? (
                                <AlertCircle size={15} className="text-red-600 animate-pulse shrink-0" />
                              ) : (hasMainWork && hasSecondWork) ? (
                                <Check size={15} className="text-emerald-600 shrink-0" />
                              ) : hasMainWork ? (
                                <Building2 size={15} className="text-azul-blue shrink-0" />
                              ) : (
                                <Check size={15} className="text-emerald-600 shrink-0" />
                              )}
                              <span>Turno Empresa Principal (Azul H.)</span>
                            </span>
                            {overlap.hasHourlyOverlap ? (
                              <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                                Solape Horario
                              </span>
                            ) : (hasMainWork && hasSecondWork) ? (
                              <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                Sin Solape
                              </span>
                            ) : hasMainWork ? (
                              <span className="text-[9px] font-black bg-azul-blue text-azul-yellow px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                Programado
                              </span>
                            ) : (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                Libre
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-bold space-y-1">
                            {hasMainWork ? (
                              <>
                                <p className="leading-snug">
                                  Horario en Azul H.: <span className="font-black underline">{mainTimes}</span>
                                  {mainDayData.type && mainDayData.type !== 'Laboral' && (
                                    <span className="ml-1.5 text-[9px] font-black bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                      {mainDayData.type}
                                    </span>
                                  )}
                                </p>
                                {overlap.hasHourlyOverlap ? (
                                  <p className="text-[11px] font-extrabold text-red-600 dark:text-red-400">
                                    {overlap.overlapMinutes > 0
                                      ? `⚠️ ¡Atención! Hay coincidencia de ${(overlap.overlapMinutes / 60).toFixed(2).replace('.', ',')}h entre los turnos de ambas empresas.`
                                      : `⚠️ ¡Atención! Hay solape entre empresas: un turno finaliza a las ${overlap.boundaryTimeText || '13:00'} y el de la otra inicia a esa misma hora.`}
                                  </p>
                                ) : hasSecondWork ? (
                                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                    ✓ Trabajas en ambas empresas este día, pero no se solapan los horarios (compatibles).
                                  </p>
                                ) : (
                                  <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                                    Introduce abajo el horario de la 2ª empresa para comprobar posibles solapes con Azul Handling.
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="leading-snug text-slate-600 dark:text-slate-400">
                                No tienes turnos programados en Azul Handling este día (Libre).
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Editor de Tramos Horarios Ordinarios */}
                        <div className={cn(
                          "bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3.5",
                          isLocked && "pointer-events-none opacity-60 select-none"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Horario Ordinario ({settings.secondCompanyName || '2ª Empresa'})
                            </span>
                            <span className="text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800/40">
                              {formatNumber(totalSecHours)}h total
                            </span>
                          </div>

                          {/* Botones de selección rápida / plantillas predefinidas */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                              Horarios habituales:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {quickPresets.map(qp => (
                                <button
                                  key={qp.label}
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => {
                                    if (isLocked) return;
                                    updateModalSecondDayData({
                                      ...secData,
                                      shifts: [{ start: qp.start, end: qp.end }]
                                    });
                                  }}
                                  className="text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-orange-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  {qp.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Listado de tramos */}
                          <div className="space-y-2.5 pt-1">
                            {(secData.shifts || []).map((sh, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                                <span className="text-[9px] font-black text-slate-400 uppercase w-4 text-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="flex-1">
                                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Entrada</label>
                                  <LocalInput
                                    type="time"
                                    value={sh.start}
                                    disabled={isLocked}
                                    onChange={(newVal) => {
                                      if (isLocked) return;
                                      const updatedShifts = (secData.shifts || []).map((s, i) => i === idx ? { ...s, start: newVal } : s);
                                      updateModalSecondDayData({
                                        ...secData,
                                        shifts: updatedShifts
                                      });
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-slate-900 dark:text-white"
                                  />
                                </div>
                                <span className="text-slate-400 font-bold shrink-0 self-end pb-2">→</span>
                                <div className="flex-1">
                                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Salida</label>
                                  <LocalInput
                                    type="time"
                                    value={sh.end}
                                    disabled={isLocked}
                                    onChange={(newVal) => {
                                      if (isLocked) return;
                                      const updatedShifts = (secData.shifts || []).map((s, i) => i === idx ? { ...s, end: newVal } : s);
                                      updateModalSecondDayData({
                                        ...secData,
                                        shifts: updatedShifts
                                      });
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div className="shrink-0 self-end pb-1 flex items-center gap-1">
                                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-md shrink-0">
                                    {sh.start && sh.end ? `${formatNumber(getShiftDuration(sh.start, sh.end))}h` : '--'}
                                  </span>
                                  {!isLocked && secData.shifts.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filteredShifts = secData.shifts.filter((_, i) => i !== idx);
                                        updateModalSecondDayData({
                                          ...secData,
                                          shifts: filteredShifts.length > 0 ? filteredShifts : [{ start: '', end: '' }]
                                        });
                                      }}
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="Eliminar tramo"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Botón para añadir turno partido / fraccionado */}
                          {!isLocked && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  updateModalSecondDayData({
                                    ...secData,
                                    shifts: [...(secData.shifts || []), { start: '', end: '' }]
                                  });
                                }}
                                className="w-full py-2 px-3 rounded-xl border border-dashed border-orange-300 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 text-xs font-black uppercase tracking-wider hover:bg-orange-100/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Plus size={14} />
                                <span>Añadir tramo de turno</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Botón rápido para limpiar turno */}
                        {!isLocked && ((secData.shifts || []).some(s => s.start || s.end)) && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                updateModalSecondDayData({
                                  ...secData,
                                  shifts: [{ start: '', end: '' }]
                                });
                              }}
                              className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 flex items-center gap-1 p-1 cursor-pointer"
                            >
                              <Trash2 size={13} />
                              <span>Borrar turno de este día</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <>
                {/* Banner de Estado de Cambio de Turno con Compañero */}
                {(() => {
                  const currData = getModalDayData(selectedDay);
                  const swap = currData.swapInfo;
                  if (!swap || (!swap.cededToCoworker && !swap.coveringCoworker)) return null;

                  return (
                    <div className={cn(
                      "rounded-2xl p-3.5 space-y-2 shadow-2xs border",
                      swap.status === 'pending'
                        ? "bg-amber-50/80 border-amber-200"
                        : swap.status === 'rejected'
                          ? "bg-rose-50/80 border-rose-200"
                          : swap.status === 'accepted'
                            ? "bg-emerald-50/70 border-emerald-200"
                            : "bg-slate-100 border-slate-300"
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-slate-800">
                          <div className={cn(
                            "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                            swap.status === 'pending'
                              ? "bg-amber-100 border-amber-300 text-amber-700"
                              : swap.status === 'rejected'
                                ? "bg-rose-100 border-rose-300 text-rose-700"
                                : swap.status === 'accepted'
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                                  : "bg-slate-200 border-slate-300 text-slate-700"
                          )}>
                            {swap.status === 'pending' ? (
                              <Clock size={15} />
                            ) : swap.status === 'rejected' ? (
                              <XCircle size={15} />
                            ) : swap.status === 'accepted' ? (
                              <CheckCircle2 size={15} />
                            ) : (
                              <Users size={15} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider text-black">
                                Cambio de Turno con {swap.coworkerName || 'Compañero'}
                              </span>
                              {swap.status && (
                                <span className={cn(
                                  "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md",
                                  swap.status === 'pending'
                                    ? "bg-amber-200/80 text-amber-900"
                                    : swap.status === 'accepted'
                                      ? "bg-emerald-200/80 text-emerald-900"
                                      : "bg-rose-200/80 text-rose-900"
                                )}>
                                  {swap.status === 'pending'
                                    ? 'Pendiente'
                                    : swap.status === 'accepted'
                                      ? 'Aceptado'
                                      : 'Rechazado'}
                                </span>
                              )}
                            </div>
                            {swap.cededToCoworker && !swap.coveringCoworker && (
                              <span className="block text-[10px] font-bold text-slate-600">
                                {swap.status === 'pending'
                                  ? `Solicitud pendiente: ${swap.coworkerName || 'tu compañero'} haría este turno.`
                                  : swap.status === 'rejected'
                                    ? `${swap.coworkerName || 'Tu compañero'} rechazó este cambio. Puedes restaurar tu turno.`
                                    : `Este turno no lo realizas tú, lo hace ${swap.coworkerName || 'tu compañero'}.`}
                                {swap.linkedDate && swap.linkedDate !== currData.date && (
                                  <> Tú le haces el día <strong className="text-black">{safeFormat(parseISO(swap.linkedDate), 'd MMM', { locale: es })}</strong>.</>
                                )}
                              </span>
                            )}
                            {swap.coveringCoworker && !swap.cededToCoworker && (
                              <span className="block text-[10px] font-bold text-slate-600">
                                {swap.status === 'pending'
                                  ? `Solicitud pendiente: turno que le harías a ${swap.coworkerName || 'tu compañero'}.`
                                  : swap.status === 'rejected'
                                    ? `${swap.coworkerName || 'Tu compañero'} rechazó este cambio. Puedes restaurar tu turno.`
                                    : `Turno que le haces a ${swap.coworkerName || 'tu compañero'}.`}
                                {swap.linkedDate && swap.linkedDate !== currData.date && (
                                  <> Por tu turno del <strong className="text-black">{safeFormat(parseISO(swap.linkedDate), 'd MMM', { locale: es })}</strong>.</>
                                )}
                              </span>
                            )}
                            {swap.cededToCoworker && swap.coveringCoworker && (
                              <span className="block text-[10px] font-bold text-slate-600">
                                Intercambio en el mismo día con {swap.coworkerName || 'tu compañero'}
                                {Array.isArray(swap.originalShifts) && swap.originalShifts.some(s => s.start && s.end) && (
                                  <> (Tu turno original era: <strong className="text-black">{swap.originalShifts.filter(s => s.start && s.end).map(s => `${s.start}-${s.end}`).join(' / ')}</strong>)</>
                                )}.
                              </span>
                            )}
                          </div>
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleUndoShiftSwap(currData.date)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 text-[9px] font-black uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
                          >
                            {swap.status === 'pending'
                              ? 'Cancelar'
                              : swap.status === 'rejected'
                                ? 'Restaurar'
                                : 'Deshacer'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Panel de Intercambio de Turno con Compañero */}
                {isSwappingDay ? (
                  (() => {
                    const myDayIso = safeFormat(selectedDay, 'yyyy-MM-dd');
                    const myDayData = getModalDayData(selectedDay);
                    const myValidShifts = (myDayData.swapInfo?.originalShifts || myDayData.shifts || []).filter(s => s && s.start && s.end);
                    const myTotalHours = myValidShifts.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);

                    // Evaluate coworker's shifts for the selected month
                    const coworkerCandidates = (() => {
                      if (!coworkerMonthData || !Array.isArray(coworkerMonthData.shifts)) return [];
                      const targetMonthPrefix = safeFormat(selectedDay, 'yyyy-MM');
                      const cwVacationsList = Array.isArray(coworkerMonthData.vacations) ? coworkerMonthData.vacations : [];
                      return coworkerMonthData.shifts
                        .filter(cs =>
                          cs &&
                          typeof cs.date === 'string' &&
                          cs.date.startsWith(targetMonthPrefix) &&
                          isValid(parseISO(cs.date)) &&
                          !cwVacationsList.includes(cs.date) &&
                          (cs.shifts || []).some(sh => sh && sh.start && sh.end) &&
                          cs.type !== 'Vacaciones' &&
                          cs.type !== 'Baja IT' &&
                          cs.type !== 'Ausencia Justificada' &&
                          cs.type !== 'Horas Sindicales'
                        )
                        .map(cs => {
                          const candValidShifts = (cs.shifts || []).filter(sh => sh && sh.start && sh.end);
                          const candHours = candValidShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);
                          const hoursDiff = candHours - myTotalHours;
                          const absHoursDiff = Math.abs(hoursDiff);

                          const candDateObj = parseISO(cs.date);
                          const isSameDaySwap = cs.date === myDayIso;
                          const myExistingOnCand = shifts.find(s => s.date === cs.date);
                          const iAlreadyWorkOnCand = !isSameDaySwap && !!(
                            myExistingOnCand &&
                            (myExistingOnCand.shifts || []).some(sh => sh && sh.start && sh.end) &&
                            !(myExistingOnCand.swapInfo?.cededToCoworker && !myExistingOnCand.swapInfo?.coveringCoworker)
                          );

                          // 1. Check MY 12h legal rest if I work coworker's shift on cs.date (and don't work my shift on myDayIso)
                          const simulatedMyShiftOnCand: DayShift = {
                            date: cs.date,
                            type: 'Laboral',
                            shifts: candValidShifts,
                            perentorias: { day: 0, night: 0 },
                            complementarias: { day: 0, night: 0 },
                            extraShifts: []
                          };
                          const getSimulatedMyDay = (iso: string): DayShift | undefined => {
                            if (iso === cs.date) return simulatedMyShiftOnCand;
                            if (iso === myDayIso) return undefined; // I ceded my shift on myDayIso
                            return shifts.find(s => s.date === iso);
                          };
                          const prevCandIso = safeFormat(addDays(candDateObj, -1), 'yyyy-MM-dd');
                          const nextCandIso = safeFormat(addDays(candDateObj, 1), 'yyyy-MM-dd');
                          const myPrevRest = getRestBetweenDays(getSimulatedMyDay(prevCandIso), simulatedMyShiftOnCand, settings.vacations);
                          const myNextRest = getRestBetweenDays(simulatedMyShiftOnCand, getSimulatedMyDay(nextCandIso), settings.vacations);
                          const myRestViolation = !!(myPrevRest?.hasViolation || myNextRest?.hasViolation);
                          const myMinRestHours = Math.min(
                            myPrevRest ? myPrevRest.restHours : 99,
                            myNextRest ? myNextRest.restHours : 99
                          );

                          // 2. Check COWORKER'S 12h legal rest if they work my shift on myDayIso (and don't work their shift on cs.date)
                          let coworkerRestViolation = false;
                          let coworkerMinRestHours = 99;
                          if (myValidShifts.length > 0) {
                            const simulatedCoworkerOnMyDay: DayShift = {
                              date: myDayIso,
                              type: 'Laboral',
                              shifts: myValidShifts,
                              perentorias: { day: 0, night: 0 },
                              complementarias: { day: 0, night: 0 },
                              extraShifts: []
                            };
                            const getSimulatedCoworkerDay = (iso: string): DayShift | undefined => {
                              if (iso === myDayIso) return simulatedCoworkerOnMyDay;
                              if (iso === cs.date) return undefined;
                              return coworkerMonthData.shifts.find(s => s.date === iso);
                            };
                            const prevMyIso = safeFormat(addDays(selectedDay, -1), 'yyyy-MM-dd');
                            const nextMyIso = safeFormat(addDays(selectedDay, 1), 'yyyy-MM-dd');
                            const cwVacations = Array.isArray(coworkerMonthData.vacations) ? coworkerMonthData.vacations : [];
                            const cwPrevRest = getRestBetweenDays(getSimulatedCoworkerDay(prevMyIso), simulatedCoworkerOnMyDay, cwVacations);
                            const cwNextRest = getRestBetweenDays(simulatedCoworkerOnMyDay, getSimulatedCoworkerDay(nextMyIso), cwVacations);
                            coworkerRestViolation = !!(cwPrevRest?.hasViolation || cwNextRest?.hasViolation);
                            coworkerMinRestHours = Math.min(
                              cwPrevRest ? cwPrevRest.restHours : 99,
                              cwNextRest ? cwNextRest.restHours : 99
                            );
                          }

                          const compliesBothRest = !myRestViolation && !coworkerRestViolation;
                          const isRecommended = (!iAlreadyWorkOnCand) && compliesBothRest && (myTotalHours === 0 || absHoursDiff <= 1.5);

                          // Score for sorting best matches first
                          const score =
                            (iAlreadyWorkOnCand ? 1000 : 0) +
                            (myRestViolation ? 500 : 0) +
                            (coworkerRestViolation ? 250 : 0) +
                            absHoursDiff * 10;

                          return {
                            date: cs.date,
                            dateObj: candDateObj,
                            shifts: candValidShifts,
                            candHours,
                            hoursDiff,
                            absHoursDiff,
                            isSameDaySwap,
                            iAlreadyWorkOnCand,
                            myRestViolation,
                            myPrevRest,
                            myNextRest,
                            myMinRestHours,
                            coworkerRestViolation,
                            coworkerMinRestHours,
                            compliesBothRest,
                            isRecommended,
                            score
                          };
                        })
                        .sort((a, b) => a.score - b.score || a.date.localeCompare(b.date));
                    })();

                    const displayedCandidates = swapFilterMode === 'best'
                      ? coworkerCandidates.filter(c => !c.iAlreadyWorkOnCand)
                      : coworkerCandidates;

                    return (
                      <div className="space-y-4">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <ArrowLeftRight size={14} className="text-azul-blue" />
                              Intercambiar Turno del Día
                            </span>
                            <span className="text-[10px] font-black text-azul-blue bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                              {myValidShifts.length > 0
                                ? `${myValidShifts.map(s => `${s.start}-${s.end}`).join(' / ')} (${formatNumber(myTotalHours)}h)`
                                : 'Sin turno propio'}
                            </span>
                          </div>
                          <p className="text-[10px] font-semibold text-slate-500 leading-snug">
                            Selecciona un compañero de <strong>Compartir/Colab.</strong> o introduce su código de 4 dígitos para comprobar qué turno suyo encaja mejor en horas y si se cumplen las 12h de descanso legal.
                          </p>
                        </div>

                        {/* Compañeros vinculados por Compartir/Colab. */}
                        {user && (
                          <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3.5 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[9.5px] font-black text-sky-900 uppercase tracking-widest flex items-center gap-1.5">
                                <Users size={13} className="text-azul-blue" />
                                Compartir/Colab. (Accesos)
                              </span>
                              {isLoadingCollabUsers && (
                                <Loader2 size={13} className="animate-spin text-azul-blue" />
                              )}
                            </div>

                            {collabUsers.length > 0 ? (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {collabUsers.map((collab) => {
                                    const isSelected = selectedCollabUid === collab.ownerUid && coworkerMonthData?.code === 'COLAB';
                                    const isLoadingThis = loadingCollabUid === collab.ownerUid;
                                    const isMutual = !!mutualCollabUids[collab.ownerUid];
                                    return (
                                      <button
                                        key={collab.ownerUid}
                                        type="button"
                                        onClick={() => handleSelectCollabForSwap(collab)}
                                        disabled={isLoadingThis}
                                        className={cn(
                                          "px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 border cursor-pointer active:scale-95",
                                          isSelected
                                            ? "bg-azul-blue text-white border-azul-blue shadow-xs"
                                            : "bg-white text-slate-700 border-sky-200 hover:border-azul-blue/60"
                                        )}
                                      >
                                        {isLoadingThis ? (
                                          <Loader2 size={11} className="animate-spin shrink-0" />
                                        ) : (
                                          <UserCheck size={11} className="shrink-0" />
                                        )}
                                        <span className="truncate max-w-[140px]">
                                          {collab.ownerName || collab.ownerEmail || 'Compañero'}
                                        </span>
                                        {isMutual && (
                                          <span className={cn(
                                            "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider shrink-0",
                                            isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                                          )}>
                                            Mutuo
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                {selectedCollabUid && (
                                  <p className="text-[9.5px] font-bold text-sky-700 leading-snug">
                                    Al pulsar Solicitar, tu compañero recibirá una notificación para aceptar o rechazar el cambio.
                                  </p>
                                )}
                              </div>
                            ) : !isLoadingCollabUsers ? (
                              <p className="text-[10px] font-semibold text-slate-500 leading-snug">
                                No tienes compañeros vinculados en <strong>Compartir/Colab. → Accesos</strong> todavía. Cuando alguien te dé acceso a su app, aparecerá aquí directamente.
                              </p>
                            ) : null}
                          </div>
                        )}

                        {/* Buscador por código de 4 dígitos */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            O mediante código de 4 dígitos del compañero (o enlace)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={coworkerCodeInput}
                              onChange={(e) => setCoworkerCodeInput(e.target.value.toUpperCase())}
                              placeholder="Ej. A7K2"
                              maxLength={120}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black tracking-widest text-black uppercase outline-none focus:border-azul-blue"
                            />
                            <button
                              type="button"
                              onClick={() => handleLoadCoworkerShifts()}
                              disabled={isLoadingCoworker || !coworkerCodeInput.trim()}
                              className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-black font-black transition-all shrink-0 flex items-center justify-center cursor-pointer"
                              title="Comprobar código"
                              aria-label="Comprobar código"
                            >
                              {isLoadingCoworker ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            </button>
                          </div>
                          {coworkerLoadError && (
                            <p className="text-[10px] font-bold text-rose-600">{coworkerLoadError}</p>
                          )}
                        </div>

                        {/* Pestañas de vista: Mejores opciones / Todos / Manual */}
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setSwapFilterMode('best')}
                            className={cn(
                              "py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                              swapFilterMode === 'best' ? "bg-white text-black shadow-2xs" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            Recomendados
                          </button>
                          <button
                            type="button"
                            onClick={() => setSwapFilterMode('all')}
                            className={cn(
                              "py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                              swapFilterMode === 'all' ? "bg-white text-black shadow-2xs" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            Todo el mes
                          </button>
                          <button
                            type="button"
                            onClick={() => setSwapFilterMode('manual')}
                            className={cn(
                              "py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                              swapFilterMode === 'manual' ? "bg-white text-black shadow-2xs" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            Manual
                          </button>
                        </div>

                        {swapFilterMode === 'manual' ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                              Introducir turno del compañero manualmente
                            </p>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Compañero</label>
                                <input
                                  type="text"
                                  value={manualSwapName}
                                  onChange={(e) => setManualSwapName(e.target.value)}
                                  placeholder="Nombre (opcional)"
                                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Día que le haces</label>
                                <input
                                  type="date"
                                  value={manualSwapDate}
                                  onChange={(e) => setManualSwapDate(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Hora Entrada</label>
                                <input
                                  type="time"
                                  value={manualSwapStart}
                                  onChange={(e) => setManualSwapStart(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Hora Salida</label>
                                <input
                                  type="time"
                                  value={manualSwapEnd}
                                  onChange={(e) => setManualSwapEnd(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-slate-800"
                                />
                              </div>
                            </div>

                            {/* Comprobación en vivo de horas y descanso de las 12h para cambio manual */}
                            {manualSwapDate && manualSwapStart && manualSwapEnd && (() => {
                              const manDateObj = parseISO(manualSwapDate);
                              if (!isValid(manDateObj)) return null;
                              const manHours = getShiftDuration(manualSwapStart, manualSwapEnd);
                              const diffH = manHours - myTotalHours;
                              const simShift: DayShift = {
                                date: manualSwapDate,
                                type: 'Laboral',
                                shifts: [{ start: manualSwapStart, end: manualSwapEnd }],
                                perentorias: { day: 0, night: 0 },
                                complementarias: { day: 0, night: 0 },
                                extraShifts: []
                              };
                              const getSimDay = (iso: string) => {
                                if (iso === manualSwapDate) return simShift;
                                if (iso === myDayIso) return undefined;
                                return shifts.find(s => s.date === iso);
                              };
                              const pRest = getRestBetweenDays(getSimDay(safeFormat(addDays(manDateObj, -1), 'yyyy-MM-dd')), simShift, settings.vacations);
                              const nRest = getRestBetweenDays(simShift, getSimDay(safeFormat(addDays(manDateObj, 1), 'yyyy-MM-dd')), settings.vacations);
                              const hasViol = !!(pRest?.hasViolation || nRest?.hasViolation);

                              return (
                                <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="text-slate-500">Duración turno compañero:</span>
                                    <span className="font-black text-black">
                                      {formatNumber(manHours)}h ({diffH === 0 ? 'Mismas horas' : `Dif. ${diffH > 0 ? '+' : ''}${formatNumber(diffH)}h`})
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="text-slate-500">Descanso legal 12h (tuyo):</span>
                                    <span className={cn("font-black", hasViol ? "text-rose-600" : "text-emerald-600")}>
                                      {hasViol
                                        ? `⚠️ No cumple (${pRest?.hasViolation ? `${formatRestHours(pRest.restHours)} ant.` : ''}${pRest?.hasViolation && nRest?.hasViolation ? ' / ' : ''}${nRest?.hasViolation ? `${formatRestHours(nRest.restHours)} sig.` : ''})`
                                        : '✅ Cumple ≥ 12h'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            <button
                              type="button"
                              onClick={() => {
                                if (!manualSwapDate || !manualSwapStart || !manualSwapEnd) return;
                                handleExecuteShiftSwap(
                                  myDayIso,
                                  manualSwapDate,
                                  [{ start: manualSwapStart, end: manualSwapEnd }],
                                  manualSwapName.trim() || 'Compañero'
                                );
                              }}
                              className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-black font-black text-[10px] uppercase tracking-widest transition-all active:scale-98"
                            >
                              Confirmar Cambio de Turno
                            </button>
                          </div>
                        ) : coworkerMonthData ? (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                Turnos de {coworkerMonthData.ownerName} ({coworkerMonthData.code === 'COLAB' ? 'Compartir/Colab.' : coworkerMonthData.code})
                              </span>
                              <span className="text-[9px] font-bold text-slate-400">
                                {displayedCandidates.length} opciones
                              </span>
                            </div>

                            {displayedCandidates.length === 0 ? (
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                                <p className="text-xs font-bold text-slate-500">
                                  No se encontraron turnos disponibles en este filtro. Prueba en «Todo el mes».
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {displayedCandidates.map((cand) => (
                                  <div
                                    key={cand.date}
                                    className={cn(
                                      "p-3 rounded-2xl border transition-all space-y-2",
                                      cand.isRecommended
                                        ? "bg-emerald-50/40 border-emerald-200/90"
                                        : cand.iAlreadyWorkOnCand
                                          ? "bg-slate-50/70 border-slate-200 opacity-75"
                                          : "bg-white border-slate-200"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2.5">
                                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-200 border border-slate-300 text-black text-center min-w-[52px]">
                                          <span className="block text-[8px] font-black uppercase leading-none">
                                            {safeFormat(cand.dateObj, 'EEE', { locale: es })}
                                          </span>
                                          <span className="block text-xs font-black leading-tight mt-0.5">
                                            {safeFormat(cand.dateObj, 'd MMM', { locale: es })}
                                          </span>
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-black">
                                              {cand.shifts.map(s => `${s.start} → ${s.end}`).join(' / ')}
                                            </span>
                                            {cand.isRecommended && (
                                              <span className="text-[8px] font-black uppercase bg-emerald-500 text-white px-1.5 py-0.5 rounded-md">
                                                ★ Mejor opción
                                              </span>
                                            )}
                                            {cand.isSameDaySwap && (
                                              <span className="text-[8px] font-black uppercase bg-azul-blue/10 text-azul-blue px-1.5 py-0.5 rounded-md">
                                                Mismo día
                                              </span>
                                            )}
                                            {cand.iAlreadyWorkOnCand && (
                                              <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                                                Ya trabajas este día
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                            <span className={cn(
                                              "text-[8.5px] font-black px-1.5 py-0.5 rounded-md",
                                              cand.absHoursDiff <= 0.25
                                                ? "bg-emerald-100 text-emerald-800"
                                                : cand.absHoursDiff <= 1.5
                                                  ? "bg-sky-100 text-sky-800"
                                                  : "bg-slate-100 text-slate-700"
                                            )}>
                                              {formatNumber(cand.candHours)}h
                                              {myTotalHours > 0 && (
                                                cand.absHoursDiff <= 0.05
                                                  ? ' (Mismas horas)'
                                                  : ` (${cand.hoursDiff > 0 ? '+' : ''}${formatNumber(cand.hoursDiff)}h)`
                                              )}
                                            </span>
                                            <span className={cn(
                                              "text-[8.5px] font-black px-1.5 py-0.5 rounded-md",
                                              cand.myRestViolation
                                                ? "bg-rose-100 text-rose-700"
                                                : "bg-emerald-100 text-emerald-800"
                                            )}>
                                              {cand.myRestViolation
                                                ? `⚠️ Tu descanso <12h (${formatRestHours(cand.myMinRestHours)})`
                                                : '✅ Tu descanso ≥12h'}
                                            </span>
                                            {myValidShifts.length > 0 && (
                                              <span className={cn(
                                                "text-[8.5px] font-black px-1.5 py-0.5 rounded-md",
                                                cand.coworkerRestViolation
                                                  ? "bg-rose-100 text-rose-700"
                                                  : "bg-slate-100 text-slate-700"
                                              )}>
                                                {cand.coworkerRestViolation
                                                  ? `⚠️ Desc. comp. <12h (${formatRestHours(cand.coworkerMinRestHours)})`
                                                  : '✅ Desc. comp. ≥12h'}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleExecuteShiftSwap(
                                            myDayIso,
                                            cand.date,
                                            cand.shifts,
                                            coworkerMonthData.ownerName,
                                            coworkerMonthData.code,
                                            coworkerMonthData.code === 'COLAB' ? (selectedCollabUid || undefined) : undefined
                                          )
                                        }
                                        className="px-3 py-2 rounded-xl bg-azul-blue hover:bg-azul-blue/90 active:scale-95 text-white font-black text-[9px] uppercase tracking-wider shrink-0 transition-all cursor-pointer"
                                      >
                                        {coworkerMonthData.code === 'COLAB' ? 'Solicitar' : 'Cambiar'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-1.5">
                            <Users size={24} className="mx-auto text-slate-400" />
                            <p className="text-xs font-black text-slate-700 uppercase">
                              Sin cuadrante de compañero cargado
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">
                              Pídele a tu compañero su código de 4 dígitos (generado desde el botón «Compartir turnos del mes» debajo del calendario) o usa la pestaña «Manual».
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : null}

                {/* Alerta de Descanso Legal (< 12h) en el Día Seleccionado */}
                {(() => {
                  const currData = getModalDayData(selectedDay);
                  const prevDay = addDays(selectedDay, -1);
                  const nextDay = addDays(selectedDay, 1);
                  const prevData = getDayData(prevDay);
                  const nextData = getDayData(nextDay);
                  const modalVacations = currData.type === 'Vacaciones'
                    ? (settings.vacations.includes(currData.date) ? settings.vacations : [...settings.vacations, currData.date])
                    : settings.vacations.filter(v => v !== currData.date);
                  const prevRest = getRestBetweenDays(prevData, currData, modalVacations);
                  const nextRest = getRestBetweenDays(currData, nextData, modalVacations);
                  const hasPrevViolation = !!prevRest?.hasViolation;
                  const hasNextViolation = !!nextRest?.hasViolation;

                  if (!hasPrevViolation && !hasNextViolation) return null;

                  return (
                    <div id="aviso-descanso-legal-modal" className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-rose-700">
                        <AlertCircle size={16} className="shrink-0 text-rose-600" />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          Aviso de Descanso Legal entre Jornadas (&lt; 12h)
                        </span>
                      </div>
                      {hasPrevViolation && prevRest && (
                        <p className="text-[11px] font-bold text-rose-900 dark:text-rose-400 leading-snug">
                          • Desde el día anterior ({safeFormat(prevDay, 'd MMM', { locale: es })} salida <span className="font-black">{prevRest.prevEnd}</span>) hasta la entrada de hoy (<span className="font-black">{prevRest.currStart}</span>) solo hay <span className="font-black underline">{formatRestHours(prevRest.restHours)}</span> de descanso.
                        </p>
                      )}
                      {hasNextViolation && nextRest && (
                        <p className="text-[11px] font-bold text-rose-900 dark:text-rose-400 leading-snug">
                          • Desde la salida de hoy (<span className="font-black">{nextRest.prevEnd}</span>) hasta la entrada de mañana ({safeFormat(nextDay, 'd MMM', { locale: es })} <span className="font-black">{nextRest.currStart}</span>) solo hay <span className="font-black underline">{formatRestHours(nextRest.restHours)}</span> de descanso.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {(!isSwappingDay || isLocked) && (!isEditingDay || isLocked ? (
                  <>
                    {(() => {
                      const dData = getModalDayData(selectedDay);
                      const isVac = dData.type === 'Vacaciones';
                      const isComp = dData.type === 'A Compensar';
                      const isSindical = dData.type === 'Horas Sindicales';
                      const isBajaIT = dData.type === 'Baja IT';
                      const isAusencia = dData.type === 'Ausencia Justificada';
                      const isCambioFuncion = dData.type === 'Cambio de función';
                      const isPermisoRetribuido = dData.type === 'Permiso Retribuido';
                      const hasValidOrdinaryShifts = (dData.shifts || []).some(s => s.start && s.end);
                      const hasValidExtraShifts = (dData.extraShifts || []).some(s => s.start && s.end);
                      const isPartiallyComp = isDayPartiallyCompensated(dData);
                      const isPartiallySind = isDayPartiallySindical(dData);
                      const effectiveShifts = isComp || isSindical ? getEffectiveShiftsForDay(dData) : (dData.shifts || []).filter(s => s.start && s.end);
                      
                      const showPlaceholder = isVac || ((isComp || isBajaIT || isAusencia || isSindical || isCambioFuncion || isPermisoRetribuido) && !hasValidOrdinaryShifts && !hasValidExtraShifts);

                      if (showPlaceholder) {
                        return (
                          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                            <motion.div 
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={cn(
                                "w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-xl shadow-slate-200/50",
                                isVac
                                  ? "bg-amber-500 text-white"
                                  : isPermisoRetribuido
                                    ? "bg-[#800020] text-white shadow-[#800020]/25"
                                    : isSindical
                                      ? "bg-[#002266] text-azul-yellow border border-[#003399]"
                                      : isBajaIT
                                        ? "shift-pill-baja-it bg-neutral-950 text-white"
                                        : isAusencia
                                          ? "shift-pill-ausencia bg-orange-400 text-black"
                                          : "bg-sky-500 text-white"
                              )}
                            >
                              {isVac ? <Sun size={36} /> : isPermisoRetribuido ? <FileText size={36} /> : isSindical ? <span className="text-xl font-black text-azul-yellow leading-none">HH.SS.</span> : <Zap size={36} />}
                            </motion.div>
                            <h4 className="text-lg font-bold text-slate-800 uppercase tracking-wider mb-2">
                              {dData.type}
                            </h4>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-[280px]">
                              Este día está registrado como <span className="font-semibold text-slate-700">{dData.type.toLowerCase()}</span>.
                              {(isBajaIT || isAusencia) ? ' No genera horas, pluses ni % de jornada.' : isPermisoRetribuido ? ' Día con permiso justificado remunerado.' : isSindical ? ' Cómputan en el mes y en el total anual.' : ' No tienes turnos ordinarios planificados.'}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {/* Banner informativo si son horas sindicales */}
                          {isSindical && (
                            <div className="bg-[#002266]/10 border border-[#003399]/30 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#002266] text-azul-yellow flex items-center justify-center shadow-sm shrink-0 font-black text-xs">
                                  HH.SS.
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[9px] font-black text-[#003399] dark:text-azul-yellow uppercase tracking-wider">
                                      {isPartiallySind ? 'Jornada con Horas Sindicales' : 'Día Completo Horas Sindicales'}
                                    </span>
                                    {isPartiallySind && (
                                      <span className="text-[8px] font-black text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                                        Trabajo Efectivo
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                                    {dData.sindicalMode === 'range' && dData.sindicalRange?.start && dData.sindicalRange?.end
                                      ? `Tramo sindical: ${dData.sindicalRange.start} → ${dData.sindicalRange.end} (${formatNumber(getShiftDuration(dData.sindicalRange.start, dData.sindicalRange.end))}h)`
                                      : `${formatNumber(getSindicalHoursForDay(dData))}h sindicales`}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-azul-yellow bg-[#002266] px-2.5 py-1.5 rounded-xl border border-[#003399] shadow-xs shrink-0">
                                {formatNumber(getSindicalHoursForDay(dData))}h sind.
                              </span>
                            </div>
                          )}

                          {/* Banner informativo si es Baja IT o Ausencia Justificada */}
                          {isBajaIT && (
                            <div className="shift-pill-baja-it bg-neutral-950 border border-neutral-800 p-3.5 rounded-2xl flex items-center justify-between shadow-xs text-white">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
                                  <Info size={18} />
                                </div>
                                <div>
                                  <span className="block text-[9px] font-black text-white uppercase tracking-wider">
                                    Día en Baja IT
                                  </span>
                                  <p className="text-[11px] font-bold text-neutral-300">
                                    No genera horas, pluses ni % de jornada
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-white bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/15 shrink-0">
                                0h comp.
                              </span>
                            </div>
                          )}

                          {isAusencia && (
                            <div className="shift-pill-ausencia bg-orange-400 border border-orange-500 p-3.5 rounded-2xl flex items-center justify-between shadow-xs text-black">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-black/10 text-black flex items-center justify-center shrink-0">
                                  <Info size={18} />
                                </div>
                                <div>
                                  <span className="block text-[9px] font-black text-black uppercase tracking-wider">
                                    Ausencia Justificada {isDayPartiallyAusencia(dData) ? '(Parcial)' : ''}
                                  </span>
                                  <p className="text-[11px] font-bold text-black/80">
                                    No genera pluses ni horas efectivas. Se descuenta en la nómina del próximo mes bajo el concepto 'Impuntualidad/Absent'.
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-black bg-black/10 px-2.5 py-1.5 rounded-xl border border-black/15 shrink-0">
                                {formatNumber(getAusenciaHoursForDay(dData), 1)}h aus.
                              </span>
                            </div>
                          )}

                          {isCambioFuncion && (
                            <div className="shift-pill-cambio-funcion bg-[#ff007f] border border-[#ff007f] p-3.5 rounded-2xl flex items-center justify-between shadow-xs text-white">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                                  <Briefcase size={18} />
                                </div>
                                <div>
                                  <span className="block text-[9px] font-black text-white uppercase tracking-wider">
                                    Cambio de función
                                  </span>
                                  <p className="text-[11px] font-bold text-white/90">
                                    Se cobrará en la nómina del siguiente mes según las horas desempeñadas en la nueva función.
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-white bg-white/20 px-2.5 py-1.5 rounded-xl border border-white/20 shrink-0">
                                {formatNumber((dData.shifts || []).filter(sh => sh.start && sh.end).reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0), 1)}h
                              </span>
                            </div>
                          )}

                          {/* Banner informativo si es turno a compensar */}
                          {isComp && (
                            <div className="bg-sky-50 border border-sky-200/80 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-sm shrink-0">
                                  <ArrowLeftRight size={18} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[9px] font-black text-sky-800 uppercase tracking-wider">
                                      {isPartiallyComp ? 'Turno Parcialmente Compensado' : 'Turno a Compensar'}
                                    </span>
                                    {isPartiallyComp && (
                                      <span className="text-[8px] font-black text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                                        Trabajo Efectivo
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-bold text-sky-950">
                                    {dData.compensatedMode === 'range' && dData.compensatedRange?.start && dData.compensatedRange?.end
                                      ? `Tramo compensado: ${dData.compensatedRange.start} → ${dData.compensatedRange.end} (${formatNumber(getShiftDuration(dData.compensatedRange.start, dData.compensatedRange.end))}h)`
                                      : `${formatNumber(getCompensatedHoursForDay(dData))}h a compensar`}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-sky-800 bg-white px-2.5 py-1.5 rounded-xl border border-sky-200/70 shadow-xs shrink-0">
                                {formatNumber(getCompensatedHoursForDay(dData))}h comp.
                              </span>
                            </div>
                          )}

                          <div id="horarios-jornada-section" className="space-y-3">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Horarios y Jornada</h5>
                            <div className="space-y-2">
                              {[...dData.shifts, ...(dData.extraShifts || [])].filter(s => s.start && s.end).map((sh, idx) => {
                                const isExtra = dData.extraShifts?.includes(sh);
                                return (
                                  <div key={idx} className="flex flex-col bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100/80 hover:bg-slate-50 transition-colors gap-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className={cn(
                                          "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0",
                                          isExtra 
                                            ? "bg-purple-100 text-purple-650" 
                                            : isSindical
                                              ? "bg-[#002266] text-azul-yellow"
                                              : isComp 
                                                ? "bg-sky-100 text-sky-700" 
                                                : "bg-azul-blue/10 text-azul-blue"
                                        )}>
                                          {isExtra ? <Zap size={14} /> : isSindical ? <span className="font-black text-[10px] leading-none">SS</span> : isComp ? <ArrowLeftRight size={16} /> : <Clock size={14} />}
                                        </div>
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                            {isExtra 
                                              ? (settings.contractType === 'Completo' ? 'H. Perentoria' : 'H. Complementaria') 
                                              : isSindical
                                                ? `Turno Sindical ${idx + 1}`
                                                : isComp 
                                                  ? `Turno Planificado ${idx + 1}` 
                                                  : `Turno Ordinario ${idx + 1}`}
                                          </p>
                                          <p className="text-sm font-bold text-slate-800 tracking-tight">{sh.start} <span className="text-slate-300 mx-1">→</span> {sh.end}</p>
                                        </div>
                                      </div>
                                      <span className="text-xs font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/50">
                                        {formatNumber(getShiftDuration(sh.start, sh.end))}h
                                      </span>
                                    </div>

                                    {/* Si el turno está parcialmente compensado o sindical, mostrar tramo efectivo */}
                                    {!isExtra && ((isComp && isPartiallyComp) || (isSindical && isPartiallySind)) && effectiveShifts.length > 0 && (
                                      <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-100 px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-900 mt-0.5">
                                        <span className="flex items-center gap-1.5 text-emerald-800 font-black text-[9px] uppercase tracking-wider">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                          Tramo Efectivo
                                        </span>
                                        <span>
                                          {effectiveShifts.map(es => `${es.start} → ${es.end} (${formatNumber(getShiftDuration(es.start, es.end))}h)`).join(', ')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Summary Area */}
                              <div className={cn(
                                "grid gap-3 mt-3",
                                isComp || isSindical ? "grid-cols-2" : (dData.shifts.length > 1 && dData.shifts[1].start ? "grid-cols-2" : "grid-cols-1")
                              )}>
                                {isComp ? (
                                  <>
                                    <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100/80 flex flex-col justify-between">
                                      <p className="text-[8px] font-black text-emerald-700 uppercase tracking-wider mb-1">Horas Efectivas</p>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-emerald-700 leading-none">
                                          {formatNumber(dayStats?.effectiveHours || 0)}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600/70">horas</span>
                                      </div>
                                    </div>
                                    <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100/80 flex flex-col justify-between">
                                      <p className="text-[8px] font-black text-sky-700 uppercase tracking-wider mb-1">A Compensar</p>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-sky-700 leading-none">
                                          {formatNumber(dayStats?.compensatedHours || 0)}
                                        </span>
                                        <span className="text-[10px] font-bold text-sky-600/70">horas</span>
                                      </div>
                                    </div>
                                  </>
                                ) : isSindical ? (
                                  <>
                                    <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100/80 flex flex-col justify-between">
                                      <p className="text-[8px] font-black text-emerald-700 uppercase tracking-wider mb-1">Horas Efectivas</p>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-emerald-700 leading-none">
                                          {formatNumber(dayStats?.effectiveHours || 0)}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600/70">horas</span>
                                      </div>
                                    </div>
                                    <div className="bg-[#002266]/10 p-3.5 rounded-2xl border border-[#003399]/20 flex flex-col justify-between">
                                      <p className="text-[8px] font-black text-[#003399] uppercase tracking-wider mb-1">H. Sindicales</p>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-[#002266] leading-none">
                                          {formatNumber(dayStats?.sindicalHours || 0)}
                                        </span>
                                        <span className="text-[10px] font-bold text-[#003399]/70">horas</span>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="bg-azul-blue/[0.04] p-3.5 rounded-2xl border border-azul-blue/10 flex flex-col justify-between">
                                    <p className="text-[8px] font-black text-azul-blue/80 uppercase tracking-wider mb-1">Total Horas</p>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-2xl font-black text-azul-blue leading-none">
                                        {formatNumber((dayStats?.totalHours || 0) + (dayStats?.perentDay || 0) + (dayStats?.perentNight || 0) + (dayStats?.complDay || 0) + (dayStats?.complNight || 0))}
                                      </span>
                                      <span className="text-[10px] font-bold text-azul-blue/60">horas</span>
                                    </div>
                                  </div>
                                )}

                                {!isComp && !isSindical && dData.shifts.length > 1 && dData.shifts[1].start && (
                                  <div className="bg-orange-50/40 p-3.5 rounded-2xl border border-orange-100/80 flex flex-col justify-between">
                                    <p className="text-[8px] font-black text-orange-500/80 uppercase tracking-wider mb-1">Descanso / Parón</p>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-2xl font-black text-orange-600 leading-none">
                                        {formatNumber(getShiftDuration(dData.shifts[0].end, dData.shifts[1].start))}
                                      </span>
                                      <span className="text-[10px] font-bold text-orange-400">horas</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {dayStats && (
                            <div id="desglose-conceptos-section" className="space-y-3 pt-2">
                              <div className="flex justify-between items-center px-1">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desglose de Conceptos</h5>
                                {(() => {
                                  const hasExtra = (dData.extraShifts || []).some(s => s.start && s.end) || 
                                                 (dData.perentorias?.day || 0) > 0 || (dData.perentorias?.night || 0) > 0 ||
                                                 (dData.complementarias?.day || 0) > 0 || (dData.complementarias?.night || 0) > 0;
                                  const hasOrdinaryShift = dData.shifts && dData.shifts.some(sh => sh.start && sh.end);
                                  if (hasExtra && !hasOrdinaryShift) {
                                    return null;
                                  }
                                  const isPlusDisabled = dData.generatePluses === false || (dData.generatePluses === undefined && hasExtra && !hasOrdinaryShift);
                                  return isPlusDisabled ? (
                                    <span className="text-[8px] font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">Solo Nocturnas</span>
                                  ) : null;
                                })()}
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                {(dayStats.nightHours + dayStats.nightHoursSub) > 0 && (
                                  <div className="flex items-center gap-3 bg-indigo-50/30 p-2.5 rounded-2xl border border-indigo-100/45 hover:bg-indigo-50/50 transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🌜</span>
                                    <div>
                                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-wider mb-0.5">Nocturnidad</p>
                                      <p className="text-xs font-black text-indigo-700">{formatHoursWithDecimals(dayStats.nightHours + dayStats.nightHoursSub)}</p>
                                    </div>
                                  </div>
                                )}
                                {(dayStats.madrugues + dayStats.madruguesSub) > 0 && (
                                  <div className="flex items-center gap-3 bg-amber-50/30 p-2.5 rounded-2xl border border-amber-100/45 hover:bg-amber-50/50 transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🌅</span>
                                    <div>
                                      <p className="text-[8px] font-black text-amber-500 uppercase tracking-wider mb-0.5">Madrugue</p>
                                      <p className="text-xs font-black text-amber-700">{dayStats.madrugues + dayStats.madruguesSub} serv.</p>
                                    </div>
                                  </div>
                                )}
                                {(dayStats.sundays + dayStats.sundaysSub) > 0 && (
                                  <div className="flex items-center gap-3 bg-rose-50/30 p-2.5 rounded-2xl border border-rose-100/45 hover:bg-rose-50/50 transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🔴</span>
                                    <div>
                                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-wider mb-0.5">Domingo</p>
                                      <p className="text-xs font-black text-rose-700">{formatHoursWithDecimals(dayStats.sundays + dayStats.sundaysSub)}</p>
                                    </div>
                                  </div>
                                )}
                                {(dayStats.festivos + dayStats.festivosSub) > 0 && (
                                  <div className="flex items-center gap-3 bg-emerald-50/30 p-2.5 rounded-2xl border border-emerald-100/45 hover:bg-emerald-50/50 transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🎉</span>
                                    <div>
                                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">
                                        {(() => {
                                          const dYear = selectedDay.getFullYear();
                                          const currentYearPluses = pluses[dYear] || pluses[Object.keys(pluses).map(Number).sort((a,b)=>b-a)[0]] || {};
                                          const isDomingoSubFestivo = settings.isSubrogado && isSunday(selectedDay) && !!currentYearPluses['Domingo SUB']?.festivos;
                                          return isDomingoSubFestivo ? "Festivo SUB (Dom)" : "Festivo";
                                        })()}
                                      </p>
                                      <p className="text-xs font-black text-emerald-700">{formatHoursWithDecimals(dayStats.festivos + dayStats.festivosSub)}</p>
                                    </div>
                                  </div>
                                )}
                                {(dayStats.perentDay + dayStats.perentNight + dayStats.complDay + dayStats.complNight) > 0 && (
                                  <div className="col-span-2 flex items-center justify-between bg-purple-50/30 p-3 rounded-2xl border border-purple-100/45 hover:bg-purple-50/50 transition-all duration-200">
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl shrink-0 select-none">💰</span>
                                      <div>
                                        <p className="text-[8px] font-black text-purple-500 uppercase tracking-wider mb-0.5 border-none">
                                          {settings.contractType === 'Completo' ? 'Horas Perentorias' : 'Horas Complementarias'}
                                        </p>
                                        <p className="text-xs font-black text-purple-700">
                                          {formatHoursWithDecimals(dayStats.perentDay + dayStats.perentNight + dayStats.complDay + dayStats.complNight)} en total
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-4 pr-1">
                                      {(settings.contractType === 'Completo' ? dayStats.perentDay : dayStats.complDay) > 0 && (
                                        <div className="text-right">
                                          <p className="text-[7.5px] font-black text-purple-400 uppercase tracking-wider">Diurnas</p>
                                          <p className="text-xs font-bold text-purple-700">
                                            {formatHoursWithDecimals(settings.contractType === 'Completo' ? dayStats.perentDay : dayStats.complDay)}
                                          </p>
                                        </div>
                                      )}
                                      {(settings.contractType === 'Completo' ? dayStats.perentNight : dayStats.complNight) > 0 && (
                                        <div className="text-right">
                                          <p className="text-[7.5px] font-black text-purple-400 uppercase tracking-wider">Nocturnas</p>
                                          <p className="text-xs font-bold text-purple-700">
                                            {formatHoursWithDecimals(settings.contractType === 'Completo' ? dayStats.perentNight : dayStats.complNight)}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {dayStats.compensatedHours > 0 && (
                                  <div className="flex items-center gap-3 bg-sky-50/50 p-2.5 rounded-2xl border border-sky-100 hover:bg-sky-100/60 transition-all duration-200">
                                    <ArrowLeftRight size={22} className="text-sky-600 shrink-0" />
                                    <div>
                                      <p className="text-[8px] font-black text-sky-600 uppercase tracking-wider mb-0.5">Compensar</p>
                                      <p className="text-xs font-black text-sky-800">
                                        {(() => {
                                          const totalMinutes = Math.round(dayStats.compensatedHours * 60);
                                          const h = Math.floor(totalMinutes / 60);
                                          const m = totalMinutes % 60;
                                          return `${h}h ${m}m`;
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {dayStats.sindicalHours > 0 && (
                                  <div className="flex items-center gap-3 bg-[#002266]/10 p-2.5 rounded-2xl border border-[#003399]/20 hover:bg-[#002266]/15 transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🏛️</span>
                                    <div>
                                      <p className="text-[8px] font-black text-[#003399] uppercase tracking-wider mb-0.5">H. Sindicales</p>
                                      <p className="text-xs font-black text-[#002266]">
                                        {(() => {
                                          const totalMinutes = Math.round(dayStats.sindicalHours * 60);
                                          const h = Math.floor(totalMinutes / 60);
                                          const m = totalMinutes % 60;
                                          return `${h}h ${m}m`;
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {(dayStats.manutencion + dayStats.manutencionSub) > 0 && (
                                  <div className="flex items-center gap-3 bg-orange-50/30 p-2.5 rounded-2xl border border-orange-100/45 hover:bg-orange-50/50 transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🍽️</span>
                                    <div>
                                      <p className="text-[8px] font-black text-orange-500 uppercase tracking-wider mb-0.5">Manutención</p>
                                      <p className="text-xs font-black text-orange-700">{dayStats.manutencion + dayStats.manutencionSub} plus</p>
                                    </div>
                                  </div>
                                )}
                                {(dayStats.transport + dayStats.transportSub) > 0 && (
                                  <div className="flex items-center gap-3 bg-azul-blue/[0.03] p-2.5 rounded-2xl border border-azul-blue/10 hover:bg-azul-blue/[0.06] transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🚗</span>
                                    <div>
                                      <p className="text-[8px] font-black text-azul-blue/60 uppercase tracking-wider mb-0.5">Transporte</p>
                                      <p className="text-xs font-black text-azul-blue">{dayStats.transport + dayStats.transportSub} plus</p>
                                    </div>
                                  </div>
                                )}
                                {(() => {
                                  const dYear = selectedDay.getFullYear();
                                  const currentYearPluses = pluses[dYear] || pluses[Object.keys(pluses).map(Number).sort((a,b)=>b-a)[0]] || {};
                                  if (!currentYearPluses['Jornada Irregular Diaria']?.enabled || (dayStats.transport + dayStats.transportSub) <= 0) return null;
                                  return (
                                    <div className="flex items-center gap-3 bg-purple-50/40 p-2.5 rounded-2xl border border-purple-100 hover:bg-purple-100/50 transition-all duration-200">
                                      <span className="text-2xl shrink-0 select-none">📅</span>
                                      <div>
                                        <p className="text-[8px] font-black text-purple-500 uppercase tracking-wider mb-0.5">J. Irreg. Diaria</p>
                                        <p className="text-xs font-black text-purple-700">{dayStats.transport + dayStats.transportSub} plus</p>
                                      </div>
                                    </div>
                                  );
                                })()}
                                {(dayStats.splitLess4 + dayStats.splitLess4Sub + dayStats.split4to7 + dayStats.split4to7Sub + dayStats.splitPlus7 + dayStats.splitPlus7Sub) > 0 && (
                                  <div className="flex items-center gap-3 bg-slate-50/60 p-2.5 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-all duration-200">
                                    <span className="text-2xl shrink-0 select-none">🔄</span>
                                    <div>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">J. Fraccionada</p>
                                      <p className="text-xs font-black text-slate-700">1 plus</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    {/* Holiday Toggle */}
                    <div id="modal-dia-festivo-container" className="flex items-center justify-between bg-slate-50/60 p-4 rounded-2xl border border-slate-100/80">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl transition-all",
                          isModalHoliday(selectedDay) ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                        )}>
                          <Calendar size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Día Festivo</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isModalHoliday(selectedDay) ? 'Calcular horas como festivas' : 'Cómputo en día normal'}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (isFixedHoliday(selectedDay)) return;
                          setDraftIsHoliday(!isModalHoliday(selectedDay));
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300 pointer-events-auto shrink-0",
                          isModalHoliday(selectedDay) ? "bg-emerald-500" : "bg-slate-300"
                        )}
                      >
                        <motion.div 
                          layout
                          className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full",
                            isModalHoliday(selectedDay) ? "right-1" : "left-1"
                          )} 
                        />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Estado / Tipo del Día</label>
                      {(() => {
                        const selectedYear = selectedDay ? selectedDay.getFullYear() : currentMonth.getFullYear();
                        const dayYearPluses = pluses[selectedYear] || pluses[currentMonth.getFullYear()] || {};
                        const isCambioFuncionEnabled = !!dayYearPluses['Cambio de función']?.enabled;
                        const currentDayType = getModalDayData(selectedDay).type;
                        const isSecondarySelected = currentDayType !== 'Laboral';

                        return (
                          <>
                            <div className="flex gap-1.5 sm:gap-2">
                              {/* Botón Laboral más ancho */}
                              <motion.button 
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => {
                                  const data = getModalDayData(selectedDay);
                                  updateModalDayData({ ...data, type: 'Laboral' });
                                }}
                                className={cn(
                                  "flex-1 py-3 px-3 rounded-xl border-2 transition-all text-xs font-black uppercase tracking-wider text-center shrink-0 select-none leading-tight",
                                  currentDayType === 'Laboral' ? 
                                    "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/15 font-black" : 
                                    "bg-white border-slate-100 text-slate-400 hover:bg-slate-50 dark:bg-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-slate-700/60"
                                )}
                              >
                                Laboral
                              </motion.button>

                              {/* Botón Desplegable para el resto de tipos de día */}
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => setIsMoreDayTypesOpen(!isMoreDayTypesOpen)}
                                title={isMoreDayTypesOpen ? "Ocultar otros tipos de día" : "Mostrar otros tipos de día"}
                                className={cn(
                                  "px-3.5 sm:px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 shrink-0 select-none cursor-pointer",
                                  isSecondarySelected
                                    ? currentDayType === 'Permiso Retribuido'
                                      ? "bg-[#800020] border-[#800020] text-white shadow-md shadow-[#800020]/25"
                                      : currentDayType === 'Vacaciones'
                                        ? "bg-amber-400 border-amber-400 text-amber-950 shadow-md shadow-amber-400/15"
                                        : currentDayType === 'Ausencia Justificada'
                                          ? "shift-pill-ausencia bg-orange-400 border-orange-500 text-black shadow-md"
                                          : currentDayType === 'Cambio de función'
                                            ? "shift-pill-cambio-funcion bg-[#ff007f] border-[#ff007f] text-white shadow-md shadow-pink-500/20"
                                            : currentDayType === 'A Compensar'
                                              ? "bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-500/15"
                                              : currentDayType === 'Horas Sindicales'
                                                ? "bg-[#002266] border-[#003399] text-azul-yellow shadow-md"
                                                : "shift-pill-baja-it bg-neutral-950 border-neutral-900 text-white shadow-md"
                                    : isMoreDayTypesOpen
                                      ? "bg-slate-200 border-slate-300 text-slate-800 dark:bg-slate-700 dark:border-white/20 dark:text-slate-100"
                                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-slate-700/60"
                                )}
                              >
                                <span className="text-[10px] font-black uppercase tracking-wider hidden min-[380px]:inline">
                                  {isSecondarySelected ? currentDayType : 'Otros'}
                                </span>
                                <ChevronDown
                                  size={16}
                                  className={cn(
                                    "transition-transform duration-200 stroke-[2.5]",
                                    isMoreDayTypesOpen ? "rotate-180" : ""
                                  )}
                                />
                              </motion.button>
                            </div>

                            <AnimatePresence initial={false}>
                              {isMoreDayTypesOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid grid-cols-2 gap-2 pt-1">
                                    {([
                                      { 
                                        type: 'Vacaciones' as ShiftType, 
                                        label: 'Vacaciones',
                                        activeCls: 'bg-amber-400 border-amber-400 text-amber-950 shadow-md shadow-amber-400/15'
                                      },
                                      { 
                                        type: 'Permiso Retribuido' as ShiftType, 
                                        label: 'Permiso Retribuido',
                                        activeCls: 'bg-[#800020] border-[#800020] text-white shadow-md shadow-[#800020]/25'
                                      },
                                      { 
                                        type: 'A Compensar' as ShiftType, 
                                        label: 'A Compensar',
                                        activeCls: 'bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-500/15'
                                      },
                                      { 
                                        type: 'Ausencia Justificada' as ShiftType, 
                                        label: 'Ausencia Justificada',
                                        activeCls: 'shift-pill-ausencia bg-orange-400 border-orange-500 text-black shadow-md'
                                      },
                                      { 
                                        type: 'Horas Sindicales' as ShiftType, 
                                        label: 'Horas Sindicales',
                                        activeCls: 'bg-[#002266] border-[#003399] text-azul-yellow shadow-md shadow-[#002266]/20'
                                      },
                                      { 
                                        type: 'Baja IT' as ShiftType, 
                                        label: 'Baja IT',
                                        activeCls: 'shift-pill-baja-it bg-neutral-950 border-neutral-900 text-white shadow-md'
                                      },
                                      ...(isCambioFuncionEnabled ? [{ 
                                        type: 'Cambio de función' as ShiftType, 
                                        label: 'Cambio de función',
                                        activeCls: 'shift-pill-cambio-funcion bg-[#ff007f] border-[#ff007f] text-white shadow-md shadow-pink-500/20',
                                        colSpan: true
                                      }] : [])
                                    ]).map(({ type: t, label, activeCls, colSpan }: any) => (
                                      <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                          const data = getModalDayData(selectedDay);
                                          updateModalDayData({ ...data, type: t });
                                        }}
                                        className={cn(
                                          "py-2.5 px-2 rounded-xl border-2 transition-all text-[9.5px] leading-tight font-black uppercase tracking-wider text-center shrink-0 select-none flex items-center justify-center cursor-pointer",
                                          colSpan && "col-span-2",
                                          currentDayType === t
                                            ? `${activeCls} font-black`
                                            : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50 dark:bg-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-slate-700/60"
                                        )}
                                      >
                                        {label}
                                      </motion.button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        );
                      })()}

                      {/* Horas a compensar selector if type is 'A Compensar' */}
                      {(() => {
                        const activeDayData = getModalDayData(selectedDay);
                        if (activeDayData.type !== 'A Compensar') return null;
                        const regularShiftsDuration = activeDayData.shifts.reduce((acc, sh) => {
                          if (!sh.start || !sh.end) return acc;
                          return acc + getShiftDuration(sh.start, sh.end);
                        }, 0);

                        const currentMode = activeDayData.compensatedMode || (activeDayData.compensatedRange?.start && activeDayData.compensatedRange?.end ? 'range' : (activeDayData.compensatedHoursQty !== undefined && activeDayData.compensatedHoursQty < regularShiftsDuration ? 'range' : 'full'));

                        const firstValidShift = activeDayData.shifts.find(sh => sh.start && sh.end);
                        const defaultRangeStart = activeDayData.compensatedRange?.start || firstValidShift?.start || "08:00";
                        const defaultRangeEnd = activeDayData.compensatedRange?.end || firstValidShift?.end || "10:00";

                        const compDuration = currentMode === 'full'
                          ? regularShiftsDuration
                          : (activeDayData.compensatedRange?.start && activeDayData.compensatedRange?.end
                              ? getShiftDuration(activeDayData.compensatedRange.start, activeDayData.compensatedRange.end)
                              : (activeDayData.compensatedHoursQty ?? regularShiftsDuration));
                        const effectiveDuration = Math.max(0, regularShiftsDuration - compDuration);

                        return (
                          <motion.div 
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-sky-50 border border-sky-200/70 p-3.5 rounded-2xl space-y-3 mt-2"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <label className="block text-[10px] font-black text-sky-800 uppercase tracking-wider">Compensación de horas</label>
                                <p className="text-[9px] text-sky-600/80 font-bold leading-tight">Configura todo el turno o un tramo específico</p>
                              </div>
                              <span className="text-[9px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200/60">
                                {currentMode === 'full' ? 'Turno completo' : 'Tramo de horas'}
                              </span>
                            </div>

                            {/* Mode Toggle: Todo el turno vs Tramo de horas */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  updateModalDayData({
                                    ...activeDayData,
                                    compensatedMode: 'full',
                                    compensatedRange: undefined,
                                    compensatedHoursQty: undefined
                                  });
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-center",
                                  currentMode === 'full'
                                    ? "bg-sky-500 border-sky-500 text-white shadow-sm"
                                    : "bg-white border-sky-200 text-sky-700 hover:bg-sky-100/50"
                                )}
                              >
                                Todo el turno
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateModalDayData({
                                    ...activeDayData,
                                    compensatedMode: 'range',
                                    compensatedRange: {
                                      start: activeDayData.compensatedRange?.start || defaultRangeStart,
                                      end: activeDayData.compensatedRange?.end || defaultRangeEnd
                                    },
                                    compensatedHoursQty: undefined
                                  });
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-center",
                                  currentMode === 'range'
                                    ? "bg-sky-500 border-sky-500 text-white shadow-sm"
                                    : "bg-white border-sky-200 text-sky-700 hover:bg-sky-100/50"
                                )}
                              >
                                Tramo de horas
                              </button>
                            </div>

                            {currentMode === 'range' && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-2 pt-1 border-t border-sky-100"
                              >
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[9px] font-black text-sky-700 uppercase tracking-wider mb-1">Inicio tramo</label>
                                    <LocalInput 
                                      type="time" 
                                      value={activeDayData.compensatedRange?.start || defaultRangeStart}
                                      onChange={(val) => {
                                        const currentEnd = activeDayData.compensatedRange?.end || defaultRangeEnd;
                                        updateModalDayData({
                                          ...activeDayData,
                                          compensatedMode: 'range',
                                          compensatedRange: {
                                            start: val,
                                            end: currentEnd
                                          }
                                        });
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white border border-sky-200 rounded-xl text-center text-xs font-bold text-sky-950 focus:outline-none focus:ring-1.5 focus:ring-sky-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black text-sky-700 uppercase tracking-wider mb-1">Fin tramo</label>
                                    <LocalInput 
                                      type="time" 
                                      value={activeDayData.compensatedRange?.end || defaultRangeEnd}
                                      onChange={(val) => {
                                        const currentStart = activeDayData.compensatedRange?.start || defaultRangeStart;
                                        updateModalDayData({
                                          ...activeDayData,
                                          compensatedMode: 'range',
                                          compensatedRange: {
                                            start: currentStart,
                                            end: val
                                          }
                                        });
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white border border-sky-200 rounded-xl text-center text-xs font-bold text-sky-950 focus:outline-none focus:ring-1.5 focus:ring-sky-500"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            {/* Summary of hours */}
                            <div className="flex justify-between items-center text-[10px] text-sky-800 font-bold pt-2 border-t border-sky-200/60">
                              <span>Horas compensadas: <strong className="text-sky-900">{compDuration}h</strong></span>
                              <span>Horas efectivas: <strong className="text-emerald-700">{effectiveDuration}h</strong></span>
                            </div>
                          </motion.div>
                        );
                      })()}

                      {/* Horas sindicales selector if type is 'Horas Sindicales' */}
                      {(() => {
                        const activeDayData = getModalDayData(selectedDay);
                        if (activeDayData.type !== 'Horas Sindicales') return null;
                        const regularShiftsDuration = activeDayData.shifts.reduce((acc, sh) => {
                          if (!sh.start || !sh.end) return acc;
                          return acc + getShiftDuration(sh.start, sh.end);
                        }, 0);

                        const currentMode = activeDayData.sindicalMode || (activeDayData.sindicalRange?.start && activeDayData.sindicalRange?.end ? 'range' : (activeDayData.sindicalHoursQty !== undefined && activeDayData.sindicalHoursQty < regularShiftsDuration ? 'range' : 'full'));

                        const firstValidShift = activeDayData.shifts.find(sh => sh.start && sh.end);
                        const defaultRangeStart = activeDayData.sindicalRange?.start || firstValidShift?.start || "08:00";
                        const defaultRangeEnd = activeDayData.sindicalRange?.end || firstValidShift?.end || "12:00";

                        const sindDuration = currentMode === 'full'
                          ? (regularShiftsDuration > 0 ? regularShiftsDuration : (activeDayData.sindicalHoursQty ?? 0))
                          : (activeDayData.sindicalRange?.start && activeDayData.sindicalRange?.end
                              ? getShiftDuration(activeDayData.sindicalRange.start, activeDayData.sindicalRange.end)
                              : (activeDayData.sindicalHoursQty ?? regularShiftsDuration));
                        const effectiveDuration = Math.max(0, regularShiftsDuration - sindDuration);

                        return (
                          <motion.div 
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#002266]/5 border border-[#003399]/20 p-3.5 rounded-2xl space-y-3 mt-2"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <label className="block text-[10px] font-black text-[#003399] uppercase tracking-wider">Horas Sindicales</label>
                                <p className="text-[9px] text-slate-500 font-bold leading-tight">Configura todo el turno o un tramo específico</p>
                              </div>
                              <span className="text-[9px] font-bold text-azul-yellow bg-[#002266] px-2 py-0.5 rounded-full border border-[#003399]">
                                {currentMode === 'full' ? 'Turno completo' : 'Tramo de horas'}
                              </span>
                            </div>

                            {/* Mode Toggle: Todo el turno vs Tramo de horas */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  updateModalDayData({
                                    ...activeDayData,
                                    sindicalMode: 'full',
                                    sindicalRange: undefined,
                                    sindicalHoursQty: undefined
                                  });
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-center",
                                  currentMode === 'full'
                                    ? "bg-[#002266] border-[#003399] text-azul-yellow shadow-sm"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                Todo el turno
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateModalDayData({
                                    ...activeDayData,
                                    sindicalMode: 'range',
                                    sindicalRange: {
                                      start: activeDayData.sindicalRange?.start || defaultRangeStart,
                                      end: activeDayData.sindicalRange?.end || defaultRangeEnd
                                    },
                                    sindicalHoursQty: undefined
                                  });
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-center",
                                  currentMode === 'range'
                                    ? "bg-[#002266] border-[#003399] text-azul-yellow shadow-sm"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                Tramo de horas
                              </button>
                            </div>

                            {currentMode === 'range' && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-2 pt-1 border-t border-[#003399]/15"
                              >
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[9px] font-black text-[#003399] uppercase tracking-wider mb-1">Inicio tramo</label>
                                    <LocalInput 
                                      type="time" 
                                      value={activeDayData.sindicalRange?.start || defaultRangeStart}
                                      onChange={(val) => {
                                        const currentEnd = activeDayData.sindicalRange?.end || defaultRangeEnd;
                                        updateModalDayData({
                                          ...activeDayData,
                                          sindicalMode: 'range',
                                          sindicalRange: {
                                            start: val,
                                            end: currentEnd
                                          }
                                        });
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white border border-[#003399]/30 rounded-xl text-center text-xs font-bold text-[#002266] focus:outline-none focus:ring-1.5 focus:ring-[#003399]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black text-[#003399] uppercase tracking-wider mb-1">Fin tramo</label>
                                    <LocalInput 
                                      type="time" 
                                      value={activeDayData.sindicalRange?.end || defaultRangeEnd}
                                      onChange={(val) => {
                                        const currentStart = activeDayData.sindicalRange?.start || defaultRangeStart;
                                        updateModalDayData({
                                          ...activeDayData,
                                          sindicalMode: 'range',
                                          sindicalRange: {
                                            start: currentStart,
                                            end: val
                                          }
                                        });
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white border border-[#003399]/30 rounded-xl text-center text-xs font-bold text-[#002266] focus:outline-none focus:ring-1.5 focus:ring-[#003399]"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            {/* Summary of hours */}
                            <div className="flex justify-between items-center text-[10px] text-[#003399] font-bold pt-2 border-t border-[#003399]/20">
                              <span>Horas sindicales: <strong className="text-[#002266]">{formatNumber(sindDuration)}h</strong></span>
                              <span>Horas efectivas restantes: <strong className="text-emerald-700">{formatNumber(effectiveDuration)}h</strong></span>
                            </div>
                          </motion.div>
                        );
                      })()}

                      {/* Ausencia justificada selector if type is 'Ausencia Justificada' */}
                      {(() => {
                        const activeDayData = getModalDayData(selectedDay);
                        if (activeDayData.type !== 'Ausencia Justificada') return null;
                        const regularShiftsDuration = activeDayData.shifts.reduce((acc, sh) => {
                          if (!sh.start || !sh.end) return acc;
                          return acc + getShiftDuration(sh.start, sh.end);
                        }, 0);

                        const currentMode = activeDayData.ausenciaMode || (activeDayData.ausenciaRange?.start && activeDayData.ausenciaRange?.end ? 'range' : (activeDayData.ausenciaHoursQty !== undefined && activeDayData.ausenciaHoursQty < regularShiftsDuration ? 'range' : 'full'));

                        const firstValidShift = activeDayData.shifts.find(sh => sh.start && sh.end);
                        const defaultRangeStart = activeDayData.ausenciaRange?.start || firstValidShift?.start || "08:00";
                        const defaultRangeEnd = activeDayData.ausenciaRange?.end || firstValidShift?.end || "12:00";

                        const ausDuration = currentMode === 'full'
                          ? (regularShiftsDuration > 0 ? regularShiftsDuration : (activeDayData.ausenciaHoursQty ?? 7.07))
                          : (activeDayData.ausenciaRange?.start && activeDayData.ausenciaRange?.end
                              ? getShiftDuration(activeDayData.ausenciaRange.start, activeDayData.ausenciaRange.end)
                              : (activeDayData.ausenciaHoursQty ?? regularShiftsDuration));
                        const effectiveDuration = Math.max(0, regularShiftsDuration - ausDuration);

                        return (
                          <motion.div 
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-800/40 p-3.5 rounded-2xl space-y-3 mt-2"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <label className="block text-[10px] font-black text-orange-900 dark:text-orange-400 uppercase tracking-wider">Ausencia Justificada</label>
                                <p className="text-[9px] text-orange-700/80 dark:text-orange-400/80 font-bold leading-tight">Configura todo el turno o un tramo específico</p>
                              </div>
                              <span className="text-[9px] font-bold text-orange-800 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded-full border border-orange-200/60 dark:border-orange-800/50">
                                {currentMode === 'full' ? 'Turno completo' : 'Tramo de horas'}
                              </span>
                            </div>

                            {/* Mode Toggle: Todo el turno vs Tramo de horas */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  updateModalDayData({
                                    ...activeDayData,
                                    ausenciaMode: 'full',
                                    ausenciaRange: undefined,
                                    ausenciaHoursQty: undefined
                                  });
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-center",
                                  currentMode === 'full'
                                    ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                                    : "bg-white dark:bg-slate-800 border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 hover:bg-orange-100/50"
                                )}
                              >
                                Todo el turno
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateModalDayData({
                                    ...activeDayData,
                                    ausenciaMode: 'range',
                                    ausenciaRange: {
                                      start: activeDayData.ausenciaRange?.start || defaultRangeStart,
                                      end: activeDayData.ausenciaRange?.end || defaultRangeEnd
                                    },
                                    ausenciaHoursQty: undefined
                                  });
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-center",
                                  currentMode === 'range'
                                    ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                                    : "bg-white dark:bg-slate-800 border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 hover:bg-orange-100/50"
                                )}
                              >
                                Tramo de horas
                              </button>
                            </div>

                            {currentMode === 'range' && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-2 pt-1 border-t border-orange-100 dark:border-orange-900/30"
                              >
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[9px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-1">Inicio tramo</label>
                                    <LocalInput 
                                      type="time" 
                                      value={activeDayData.ausenciaRange?.start || defaultRangeStart}
                                      onChange={(val) => {
                                        const currentEnd = activeDayData.ausenciaRange?.end || defaultRangeEnd;
                                        updateModalDayData({
                                          ...activeDayData,
                                          ausenciaMode: 'range',
                                          ausenciaRange: {
                                            start: val,
                                            end: currentEnd
                                          }
                                        });
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/50 rounded-xl text-center text-xs font-bold text-orange-950 dark:text-orange-200 focus:outline-none focus:ring-1.5 focus:ring-orange-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-1">Fin tramo</label>
                                    <LocalInput 
                                      type="time" 
                                      value={activeDayData.ausenciaRange?.end || defaultRangeEnd}
                                      onChange={(val) => {
                                        const currentStart = activeDayData.ausenciaRange?.start || defaultRangeStart;
                                        updateModalDayData({
                                          ...activeDayData,
                                          ausenciaMode: 'range',
                                          ausenciaRange: {
                                            start: currentStart,
                                            end: val
                                          }
                                        });
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/50 rounded-xl text-center text-xs font-bold text-orange-950 dark:text-orange-200 focus:outline-none focus:ring-1.5 focus:ring-orange-500"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            {/* Summary of hours */}
                            <div className="flex justify-between items-center text-[10px] text-orange-800 dark:text-orange-400 font-bold pt-2 border-t border-orange-200/60 dark:border-orange-900/30">
                              <span>Horas de ausencia: <strong className="text-orange-900 dark:text-orange-300">{formatNumber(ausDuration, 1)}h</strong></span>
                              <span>Horas efectivas: <strong className="text-emerald-700 dark:text-emerald-400">{formatNumber(effectiveDuration, 1)}h</strong></span>
                            </div>
                            <p className="text-[9px] text-orange-600/90 dark:text-orange-400/80 font-medium">
                              * Se descontará en la nómina del próximo mes bajo el concepto 'Impuntualidad/Absent'.
                            </p>
                          </motion.div>
                        );
                      })()}
                    </div>

                    <div className="space-y-3 pt-1">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Horarios / Jornada</label>
                          {activeShiftEntryTab === 'extra' && (
                            <motion.button 
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const data = getModalDayData(selectedDay);
                                const validOrdinary = (data.shifts || []).filter(s => s && s.start && s.end);
                                const defaultStart = validOrdinary.length > 0 ? validOrdinary[validOrdinary.length - 1].end : '';
                                const currentExtra = (data.extraShifts && data.extraShifts.length > 0) ? data.extraShifts : [];
                                if (currentExtra.length === 0) {
                                  updateModalDayData({ ...data, extraShifts: [{ start: defaultStart, end: '' }] });
                                } else {
                                  const lastExtra = currentExtra[currentExtra.length - 1];
                                  const nextStart = lastExtra?.end || defaultStart;
                                  updateModalDayData({ ...data, extraShifts: [...currentExtra, { start: nextStart, end: '' }] });
                                }
                              }}
                              className="text-[10px] font-black text-purple-650 uppercase tracking-wider flex items-center gap-1 hover:opacity-80 transition-all"
                            >
                              <Plus size={12} /> Añadir
                            </motion.button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => setActiveShiftEntryTab('ordinario')}
                            className={cn(
                              "py-3 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-wider text-center shrink-0 select-none",
                              activeShiftEntryTab === 'ordinario'
                                ? "bg-azul-blue border-azul-blue text-white shadow-md shadow-azul-blue/15 font-black"
                                : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                            )}
                          >
                            Turno Ordinario
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => {
                              setActiveShiftEntryTab('extra');
                              const data = getModalDayData(selectedDay);
                              const validOrdinary = (data.shifts || []).filter(s => s && s.start && s.end);
                              if (validOrdinary.length > 0) {
                                const defaultStart = validOrdinary[validOrdinary.length - 1].end;
                                const currentExtra = data.extraShifts || [];
                                if (currentExtra.length === 0) {
                                  updateModalDayData({ ...data, extraShifts: [{ start: defaultStart, end: '' }] });
                                } else if (currentExtra.length === 1 && !currentExtra[0].start && !currentExtra[0].end) {
                                  updateModalDayData({ ...data, extraShifts: [{ ...currentExtra[0], start: defaultStart }] });
                                }
                              }
                            }}
                            className={cn(
                              "py-3 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-wider text-center shrink-0 select-none",
                              activeShiftEntryTab === 'extra'
                                ? "bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-600/15 font-black"
                                : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                            )}
                          >
                            {settings.contractType === 'Completo' ? 'H. Perentorias' : 'H. Complementarias'}
                          </motion.button>
                        </div>

                        {/* Plantillas de Turnos Frecuentes (Desplegable recogido por defecto) */}
                        <div id="plantillas-rapidas-box" className="bg-slate-50/50 border border-slate-100 dark:border-white/[0.08] rounded-2xl overflow-hidden transition-all">
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !isQuickTemplatesOpen;
                              setIsQuickTemplatesOpen(nextState);
                              if (!nextState) {
                                setIsCreatingTemplate(false);
                                setIsManagingTemplates(false);
                              }
                            }}
                            className="w-full p-3 flex items-center justify-between hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors"
                          >
                            <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Zap size={12} className="text-amber-500" />
                              Plantillas Rápidas
                              {shiftTemplates.length > 0 && (
                                <span className="text-[8px] font-black bg-white dark:bg-slate-900 text-slate-400 border border-slate-200/80 dark:border-white/10 px-1.5 py-0.2 rounded-full">
                                  {shiftTemplates.length}
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                {isQuickTemplatesOpen ? 'Ocultar' : 'Mostrar'}
                              </span>
                              <ChevronDown
                                size={14}
                                className={cn(
                                  "text-slate-400 transition-transform duration-200",
                                  isQuickTemplatesOpen ? "rotate-180" : ""
                                )}
                              />
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {isQuickTemplatesOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-slate-100">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {(() => {
                                      const dayData = getModalDayData(selectedDay);
                                      const activeList = activeShiftEntryTab === 'ordinario'
                                        ? dayData.shifts.filter(s => s.start && s.end)
                                        : (dayData.extraShifts || []).filter(s => s.start && s.end);
                                      if (activeList.length === 0) return null;
                                      const signature = activeList.map(s => `${s.start}-${s.end}`).join('|');
                                      const alreadyExists = shiftTemplates.some(
                                        t => t.shifts.map(s => `${s.start}-${s.end}`).join('|') === signature
                                      );
                                      if (alreadyExists) return null;
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newTpl: ShiftTemplate = {
                                              id: `tpl-${Date.now()}`,
                                              shifts: JSON.parse(JSON.stringify(activeList))
                                            };
                                            updateShiftTemplates([...shiftTemplates, newTpl]);
                                          }}
                                          className="text-[9px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-2 py-0.5 rounded-lg uppercase tracking-wider transition-all active:scale-95"
                                        >
                                          + Guardar actual
                                        </button>
                                      );
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsCreatingTemplate(!isCreatingTemplate);
                                        setIsManagingTemplates(false);
                                      }}
                                      className={cn(
                                        "text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider transition-all",
                                        isCreatingTemplate
                                          ? "bg-azul-blue text-white"
                                          : "bg-white border border-slate-200 text-azul-blue hover:bg-slate-100"
                                      )}
                                    >
                                      + Nueva
                                    </button>
                                    {shiftTemplates.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsManagingTemplates(!isManagingTemplates);
                                          setIsCreatingTemplate(false);
                                        }}
                                        className={cn(
                                          "text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider transition-all",
                                          isManagingTemplates
                                            ? "bg-rose-500 text-white"
                                            : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                                        )}
                                      >
                                        {isManagingTemplates ? 'Listo' : 'Editar'}
                                      </button>
                                    )}
                                  </div>

                                  {/* Formulario rápido para crear nueva plantilla */}
                                  <AnimatePresence initial={false}>
                                    {isCreatingTemplate && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2.5 mb-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <input
                                              type="text"
                                              value={newTplName}
                                              onChange={(e) => setNewTplName(e.target.value)}
                                              placeholder="Nombre opcional (ej. Mañana, Partido...)"
                                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-azul-blue"
                                            />
                                            {newTplShifts.length < 2 && (
                                              <button
                                                type="button"
                                                onClick={() => setNewTplShifts([...newTplShifts, { start: '14:00', end: '18:00' }])}
                                                className="text-[9px] font-black text-azul-blue bg-azul-blue/5 hover:bg-azul-blue/10 px-2 py-1.5 rounded-lg uppercase tracking-wider shrink-0"
                                              >
                                                + 2º Tramo
                                              </button>
                                            )}
                                          </div>
                                          <div className="space-y-1.5">
                                            {newTplShifts.map((st, sIdx) => (
                                              <div key={sIdx} className="flex items-center gap-1.5">
                                                <input
                                                  type="time"
                                                  value={st.start}
                                                  onChange={(e) => {
                                                    const copy = [...newTplShifts];
                                                    copy[sIdx] = { ...copy[sIdx], start: e.target.value };
                                                    setNewTplShifts(copy);
                                                  }}
                                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-800"
                                                />
                                                <span className="text-slate-300 font-bold">→</span>
                                                <input
                                                  type="time"
                                                  value={st.end}
                                                  onChange={(e) => {
                                                    const copy = [...newTplShifts];
                                                    copy[sIdx] = { ...copy[sIdx], end: e.target.value };
                                                    setNewTplShifts(copy);
                                                  }}
                                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-800"
                                                />
                                                {newTplShifts.length > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => setNewTplShifts(newTplShifts.filter((_, i) => i !== sIdx))}
                                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                                                  >
                                                    <X size={14} />
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                          <div className="flex justify-end gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => setIsCreatingTemplate(false)}
                                              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:bg-slate-100"
                                            >
                                              Cancelar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const valid = newTplShifts.filter(s => s.start && s.end);
                                                if (valid.length === 0) return;
                                                const created: ShiftTemplate = {
                                                  id: `tpl-${Date.now()}`,
                                                  name: newTplName.trim() || undefined,
                                                  shifts: valid
                                                };
                                                updateShiftTemplates([...shiftTemplates, created]);
                                                setNewTplName('');
                                                setNewTplShifts([{ start: '06:00', end: '14:00' }]);
                                                setIsCreatingTemplate(false);
                                              }}
                                              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase bg-azul-blue text-white shadow-xs active:scale-95"
                                            >
                                              Guardar Plantilla
                                            </button>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  {/* Botones de plantillas */}
                                  {shiftTemplates.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {shiftTemplates.map((tpl) => {
                                        const totalTplHours = tpl.shifts.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                                        const dayData = getModalDayData(selectedDay);
                                        const currentTargetShifts = activeShiftEntryTab === 'ordinario' ? dayData.shifts : (dayData.extraShifts || []);
                                        const isCurrentMatch =
                                          currentTargetShifts.filter(s => s.start && s.end).map(s => `${s.start}-${s.end}`).join('|') ===
                                          tpl.shifts.map(s => `${s.start}-${s.end}`).join('|');

                                        return (
                                          <div key={tpl.id} className="relative flex items-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (isManagingTemplates) {
                                                  updateShiftTemplates(shiftTemplates.filter(t => t.id !== tpl.id));
                                                  return;
                                                }
                                                const data = getModalDayData(selectedDay);
                                                const clonedShifts = JSON.parse(JSON.stringify(tpl.shifts));
                                                if (activeShiftEntryTab === 'ordinario') {
                                                  updateModalDayData({ ...data, shifts: clonedShifts });
                                                } else {
                                                  updateModalDayData({ ...data, extraShifts: clonedShifts });
                                                }
                                              }}
                                              className={cn(
                                                "w-full px-3 py-2 rounded-xl border text-left transition-all active:scale-95 flex items-center justify-between gap-1.5",
                                                isManagingTemplates
                                                  ? "bg-rose-50/70 border-rose-200 text-rose-800 hover:bg-rose-100"
                                                  : isCurrentMatch
                                                    ? (activeShiftEntryTab === 'ordinario'
                                                        ? "bg-azul-blue text-white border-azul-blue shadow-sm"
                                                        : "bg-purple-600 text-white border-purple-600 shadow-sm")
                                                    : "bg-white hover:bg-slate-100/80 border-slate-200/80 text-slate-700 shadow-2xs dark:bg-[#0f172a] dark:border-white/10 dark:text-slate-100 dark:hover:bg-slate-800/80"
                                              )}
                                            >
                                              <div className="min-w-0 flex-1">
                                                {tpl.name && (
                                                  <span className={cn(
                                                    "block text-[8px] font-black uppercase tracking-wider truncate leading-none mb-0.5",
                                                    isCurrentMatch && !isManagingTemplates ? "text-white/75" : "text-slate-400"
                                                  )}>
                                                    {tpl.name}
                                                  </span>
                                                )}
                                                <span className="block text-[10.5px] font-black tracking-tight truncate leading-tight">
                                                  {tpl.shifts.map(s => `${s.start}-${s.end}`).join(' / ')}
                                                </span>
                                              </div>
                                              {isManagingTemplates ? (
                                                <Trash2 size={13} className="text-rose-500 shrink-0" />
                                              ) : (
                                                <span className={cn(
                                                  "text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0",
                                                  isCurrentMatch
                                                    ? "bg-white/20 text-white"
                                                    : "bg-slate-100 text-slate-500 dark:bg-[#020617] dark:text-slate-300 dark:border dark:border-white/[0.08]"
                                                )}>
                                                  {formatNumber(totalTplHours)}h
                                                </span>
                                              )}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] font-bold text-slate-400 text-center py-1">
                                      No tienes plantillas guardadas. Pulsa "+ Nueva" para crear tus horarios frecuentes.
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {activeShiftEntryTab === 'ordinario' ? (
                        <div className="space-y-3">
                          {getModalDayData(selectedDay).shifts.map((s, idx) => (
                            <React.Fragment key={idx}>
                              <div className="bg-slate-50/50 dark:bg-white/[0.03] p-4 rounded-2xl border border-slate-100/80 dark:border-white/[0.08] space-y-3 relative group">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Turno {idx + 1}</span>
                                  <motion.button 
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                      const data = getModalDayData(selectedDay);
                                      if (data.shifts[idx].start || data.shifts[idx].end) {
                                        setShiftToDelete(idx);
                                      } else {
                                        const newShifts = [...data.shifts];
                                        if (newShifts.length > 1) {
                                          newShifts.splice(idx, 1);
                                        } else {
                                          newShifts[0] = { start: '', end: '' };
                                        }
                                        updateModalDayData({ ...data, shifts: newShifts });
                                      }
                                    }}
                                    className="text-slate-400 hover:text-rose-550 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                                    title="Borrar turno"
                                  >
                                    <Trash2 size={13} />
                                  </motion.button>
                                </div>
                                <div className="grid grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Entrada</label>
                                    <div className="relative">
                                      <LocalInput 
                                        type="time" 
                                        value={s.start}
                                        onChange={(val) => {
                                          const data = getModalDayData(selectedDay);
                                          const newShifts = data.shifts.map((slot, i) => i === idx ? { ...slot, start: val } : slot);
                                          updateModalDayData({ ...data, shifts: newShifts });
                                        }}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-azul-blue/20 focus:border-azul-blue outline-none transition-all shadow-sm"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Salida</label>
                                    <div className="relative">
                                      <LocalInput 
                                        type="time" 
                                        value={s.end}
                                        onChange={(val) => {
                                          const data = getModalDayData(selectedDay);
                                          const newShifts = data.shifts.map((slot, i) => i === idx ? { ...slot, end: val } : slot);
                                          updateModalDayData({ ...data, shifts: newShifts });
                                        }}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-azul-blue/20 focus:border-azul-blue outline-none transition-all shadow-sm"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Botón '+ Añadir turno' debajo de contenedor Turno 1 */}
                              {idx === 0 && getModalDayData(selectedDay).shifts.length < 2 && (
                                <motion.button 
                                  whileTap={{ scale: 0.98 }}
                                  type="button"
                                  onClick={() => {
                                    const data = getModalDayData(selectedDay);
                                    updateModalDayData({ ...data, shifts: [...data.shifts, { start: '', end: '' }] });
                                  }}
                                  className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-azul-blue/40 hover:border-azul-blue bg-azul-blue/5 hover:bg-azul-blue/10 text-azul-blue text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                                >
                                  <Plus size={14} /> Añadir turno
                                </motion.button>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(() => {
                            const dayData = getModalDayData(selectedDay);
                            const validOrdinary = (dayData.shifts || []).filter(s => s && s.start && s.end);
                            const isFraccionada = validOrdinary.length >= 2;
                            const defaultStart = validOrdinary.length > 0 ? validOrdinary[validOrdinary.length - 1].end : '';
                            const extraList = (dayData.extraShifts && dayData.extraShifts.length > 0)
                              ? dayData.extraShifts.map((s, sIdx) => {
                                  if (sIdx === 0 && !s.start && defaultStart) {
                                    return { ...s, start: defaultStart };
                                  }
                                  return s;
                                })
                              : [{ start: defaultStart, end: '' }];

                            return extraList.map((ex, idx) => (
                              <div key={idx} className="bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100/60 dark:border-purple-900/40 p-4 rounded-2xl space-y-3 relative group">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest">Tramo Extra {idx + 1}</span>
                                  <motion.button 
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                      const data = getModalDayData(selectedDay);
                                      const currentExtra = data.extraShifts || [];
                                      if (currentExtra[idx]?.start || currentExtra[idx]?.end) {
                                        setExtraShiftToDelete(idx);
                                      } else {
                                        const newExtra = [...currentExtra];
                                        if (newExtra.length > 1) {
                                          newExtra.splice(idx, 1);
                                        } else {
                                          newExtra.length = 0;
                                        }
                                        updateModalDayData({ ...data, extraShifts: newExtra });
                                      }
                                    }}
                                    className="text-purple-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                                    title="Borrar tramo extra"
                                  >
                                    <Trash2 size={13} />
                                  </motion.button>
                                </div>

                                {/* Selector de salida ordinaria si hay jornada fraccionada */}
                                {isFraccionada && (
                                  <div className="bg-purple-100/70 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-200/80 dark:border-purple-800/50 space-y-2">
                                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                      <span className="flex items-center gap-1.5">
                                        <Clock size={12} className="text-purple-600 dark:text-purple-400" />
                                        Inicio tras salida de jornada fraccionada:
                                      </span>
                                      <span className="text-[8px] font-bold text-purple-600/80 dark:text-purple-400/80">Elegir salida</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {validOrdinary.slice(0, 2).map((ordShift, ordIdx) => {
                                        const isSelected = (ex.start || defaultStart) === ordShift.end;
                                        return (
                                          <motion.button
                                            key={ordIdx}
                                            whileTap={{ scale: 0.97 }}
                                            type="button"
                                            onClick={() => {
                                              const data = getModalDayData(selectedDay);
                                              const newExtra = (data.extraShifts && data.extraShifts.length > 0)
                                                ? [...data.extraShifts]
                                                : [{ start: defaultStart, end: '' }];
                                              newExtra[idx] = { ...newExtra[idx], start: ordShift.end };
                                              updateModalDayData({ ...data, extraShifts: newExtra });
                                            }}
                                            className={cn(
                                              "flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border select-none text-left cursor-pointer",
                                              isSelected
                                                ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/20"
                                                : "bg-white dark:bg-slate-800 border-purple-200/70 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                                            )}
                                          >
                                            <div className="flex flex-col">
                                              <span className={cn("text-[7.5px] uppercase font-bold", isSelected ? "text-purple-200" : "text-purple-500 dark:text-purple-400")}>
                                                Turno {ordIdx + 1} ({ordShift.start} - {ordShift.end})
                                              </span>
                                              <span className="text-[11px] font-black">Salida: {ordShift.end}</span>
                                            </div>
                                            {isSelected ? (
                                              <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[8px] font-black flex items-center gap-0.5 shrink-0">
                                                <Check size={10} strokeWidth={3} /> Activo
                                              </span>
                                            ) : (
                                              <span className="text-[8px] text-purple-600 dark:text-purple-400 font-bold underline decoration-dotted shrink-0">
                                                Usar
                                              </span>
                                            )}
                                          </motion.button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Conector directo con salida ordinaria si hay 1 solo turno */}
                                {validOrdinary.length === 1 && (
                                  <div className="flex items-center justify-between bg-purple-100/50 dark:bg-purple-950/30 px-3 py-1.5 rounded-xl border border-purple-200/60 dark:border-purple-800/40 text-[9px]">
                                    <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                                      <Clock size={11} className="text-purple-600 dark:text-purple-400" />
                                      Salida ordinaria: <span className="font-black text-purple-900 dark:text-purple-100">{validOrdinary[0].end}</span>
                                    </span>
                                    {(ex.start || defaultStart) !== validOrdinary[0].end ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getModalDayData(selectedDay);
                                          const newExtra = (data.extraShifts && data.extraShifts.length > 0)
                                            ? [...data.extraShifts]
                                            : [{ start: defaultStart, end: '' }];
                                          newExtra[idx] = { ...newExtra[idx], start: validOrdinary[0].end };
                                          updateModalDayData({ ...data, extraShifts: newExtra });
                                        }}
                                        className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[8.5px] font-black uppercase tracking-wider transition-all shadow-2xs cursor-pointer"
                                      >
                                        Alinear entrada
                                      </button>
                                    ) : (
                                      <span className="text-[8.5px] font-black text-purple-700 dark:text-purple-300 flex items-center gap-0.5">
                                        <Check size={10} strokeWidth={3} /> Entrada alineada
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="block text-[9px] font-black text-purple-400 uppercase tracking-wider mb-1">Entrada</label>
                                    <LocalInput 
                                      type="time" 
                                      value={ex.start}
                                      onChange={(val) => {
                                        const data = getModalDayData(selectedDay);
                                        const newExtra = (data.extraShifts && data.extraShifts.length > 0)
                                          ? [...data.extraShifts]
                                          : [{ start: defaultStart, end: '' }];
                                        newExtra[idx] = { ...newExtra[idx], start: val };
                                        updateModalDayData({ ...data, extraShifts: newExtra });
                                      }}
                                      className="w-full bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/60 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 focus:border-purple-500 outline-none transition-all shadow-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-black text-purple-400 uppercase tracking-wider mb-1">Salida</label>
                                    <LocalInput 
                                      type="time" 
                                      value={ex.end}
                                      onChange={(val) => {
                                        const data = getModalDayData(selectedDay);
                                        const newExtra = (data.extraShifts && data.extraShifts.length > 0)
                                          ? [...data.extraShifts]
                                          : [{ start: defaultStart, end: '' }];
                                        newExtra[idx] = { ...newExtra[idx], end: val };
                                        updateModalDayData({ ...data, extraShifts: newExtra });
                                      }}
                                      className="w-full bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/60 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 focus:border-purple-500 outline-none transition-all shadow-sm"
                                    />
                                  </div>
                                </div>
                                {getNightHours(ex.start, ex.end) > 0 && (
                                  <div className="flex justify-end pt-0.5">
                                    <span className="text-[8px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest bg-purple-50 dark:bg-purple-950/60 border border-purple-100/60 dark:border-purple-900/50 px-2.5 py-0.5 rounded-full">
                                      🌙 Nocturnas: {formatNumber(getNightHours(ex.start, ex.end))}h
                                    </span>
                                  </div>
                                )}
                              </div>
                            ));
                          })()}
                        </div>
                      )}

                      {(() => {
                        const data = getModalDayData(selectedDay);
                        const hasExtraWork = (data.extraShifts || []).some(s => s.start && s.end) || 
                                             (data.perentorias?.day || 0) > 0 || (data.perentorias?.night || 0) > 0 ||
                                             (data.complementarias?.day || 0) > 0 || (data.complementarias?.night || 0) > 0;
                        
                        if (!hasExtraWork) return null;

                        return (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-100/60 mt-2 space-y-2.5"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <div className="p-1.5 bg-emerald-100/80 text-emerald-600 rounded-lg">
                                <Car size={14} />
                              </div>
                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Contabilizar Pluses</p>
                            </div>

                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => updateModalDayData({ ...data, generatePluses: false })}
                                className={cn(
                                  "text-right text-[9.5px] font-black uppercase tracking-wider leading-tight transition-all py-1.5 px-2 rounded-xl cursor-pointer select-none",
                                  !data.generatePluses
                                    ? "text-emerald-700 bg-emerald-100/70 shadow-2xs"
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Solo horas nocturnas
                              </button>

                              <button 
                                type="button"
                                onClick={() => {
                                  updateModalDayData({ ...data, generatePluses: !data.generatePluses });
                                }}
                                aria-label="Cambiar modo de contabilizar pluses"
                                className={cn(
                                  "w-12 h-6 rounded-full relative transition-all duration-300 pointer-events-auto shrink-0 cursor-pointer shadow-inner",
                                  data.generatePluses ? "bg-emerald-500" : "bg-emerald-600/70"
                                )}
                              >
                                <motion.div 
                                  layout
                                  className={cn(
                                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-xs",
                                    data.generatePluses ? "right-1" : "left-1"
                                  )} 
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => updateModalDayData({ ...data, generatePluses: true })}
                                className={cn(
                                  "text-left text-[9.5px] font-black uppercase tracking-wider leading-tight transition-all py-1.5 px-2 rounded-xl cursor-pointer select-none",
                                  data.generatePluses
                                    ? "text-emerald-700 bg-emerald-100/70 shadow-2xs"
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Pluses ordinarios activos
                              </button>
                            </div>
                          </motion.div>
                        );
                      })()}

                      {(() => {
                        const data = getModalDayData(selectedDay);
                        const hasExtraWork = (data.extraShifts || []).some(s => s.start && s.end) || 
                                             (data.perentorias?.day || 0) > 0 || (data.perentorias?.night || 0) > 0 ||
                                             (data.complementarias?.day || 0) > 0 || (data.complementarias?.night || 0) > 0;
                        
                        if (!hasExtraWork) return null;

                        const isCompensate = data.extraHoursStrategy === 'compensate';

                        return (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-sky-50/40 p-3.5 rounded-2xl border border-sky-100/60 mt-2 space-y-2.5"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <div className="p-1.5 bg-sky-100/80 text-sky-600 rounded-lg">
                                <Clock size={14} />
                              </div>
                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Estrategia de Horas</p>
                            </div>

                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => updateModalDayData({ ...data, extraHoursStrategy: 'pay' })}
                                className={cn(
                                  "text-right text-[9.5px] font-black uppercase tracking-wider leading-tight transition-all py-1.5 px-2 rounded-xl cursor-pointer select-none",
                                  !isCompensate
                                    ? "text-sky-700 bg-sky-100/70 shadow-2xs"
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Cobrar (Próxima nómina)
                              </button>

                              <button 
                                type="button"
                                onClick={() => {
                                  updateModalDayData({ ...data, extraHoursStrategy: isCompensate ? 'pay' : 'compensate' });
                                }}
                                aria-label="Cambiar estrategia de horas"
                                className={cn(
                                  "w-12 h-6 rounded-full relative transition-all duration-300 pointer-events-auto shrink-0 cursor-pointer shadow-inner",
                                  isCompensate ? "bg-sky-500" : "bg-sky-600/70"
                                )}
                              >
                                <motion.div 
                                  layout
                                  className={cn(
                                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-xs",
                                    isCompensate ? "right-1" : "left-1"
                                  )} 
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => updateModalDayData({ ...data, extraHoursStrategy: 'compensate' })}
                                className={cn(
                                  "text-left text-[9.5px] font-black uppercase tracking-wider leading-tight transition-all py-1.5 px-2 rounded-xl cursor-pointer select-none",
                                  isCompensate
                                    ? "text-sky-700 bg-sky-100/70 shadow-2xs"
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Compensar (Bolsa de tiempo)
                              </button>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </div>
                  </>
                ))}
              </>
            )}
          </div>
              
              <div id="detalles-dia-modal-footer" className="p-4 bg-slate-50/80 border-t border-slate-100 flex gap-3.5 shrink-0">
                {activeCompany === 'second' ? (
                  <motion.button 
                    whileTap={{ scale: 0.97 }}
                    onClick={commitSecondDayChanges}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all text-center cursor-pointer"
                  >
                    Guardar y Cerrar
                  </motion.button>
                ) : isSwappingDay ? (
                  <motion.button 
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsSwappingDay(false)}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-black py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-300 active:scale-95 transition-all text-center"
                  >
                    Volver al Detalle del Día
                  </motion.button>
                ) : !isEditingDay ? (
                  <>
                    <motion.button 
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setIsEditingDay(true)}
                      className="flex-1 bg-white text-azul-blue py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-azul-blue/15 shadow-sm active:scale-95 hover:bg-slate-50 transition-all"
                    >
                      Editar Turno
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.97 }}
                      onClick={closeDayModal}
                      className="flex-1 bg-azul-blue text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-azul-blue/20 active:scale-95 hover:bg-azul-blue/95 transition-all text-center"
                    >
                      Entendido
                    </motion.button>
                  </>
                ) : (
                  <motion.button 
                    whileTap={{ scale: 0.97 }}
                    onClick={commitMainDayChanges}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/15 active:scale-95 transition-all text-center"
                  >
                    Guardar y Ver Resumen
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Modal para Compartir Turnos del Mes mediante Código Alfanumérico de 4 dígitos */}
      <AnimatePresence>
        {isShareMonthModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsShareMonthModalOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-110 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-200 text-black flex items-center justify-center">
                    <Share2 size={20} />
                  </div>
                  <div>
                    <h3 id="share-month-modal-title" className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Compartir turnos del mes
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareMonthModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Tu nombre o alias (opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareOwnerName}
                      onChange={(e) => {
                        setShareOwnerName(e.target.value);
                        localStorage.setItem('share_owner_name', e.target.value);
                      }}
                      placeholder="Ej. Ángel, Compañero..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-azul-blue"
                    />
                    <button
                      type="button"
                      onClick={handleOpenShareMonthModal}
                      disabled={isGeneratingShareCode}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[9px] uppercase tracking-wider shrink-0 transition-all"
                    >
                      Actualizar
                    </button>
                  </div>
                </div>

                {/* Código Alfanumérico de 4 dígitos */}
                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
                  <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Código alfanumérico de 4 dígitos
                  </span>

                  {isGeneratingShareCode ? (
                    <div className="py-4 flex items-center justify-center gap-2 text-slate-500">
                      <Loader2 size={20} className="animate-spin" />
                      <span className="text-xs font-black uppercase">Generando código...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2.5">
                      {(sharedMonthCode || '----').split('').map((ch, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-14 rounded-2xl bg-white border-2 border-slate-300 shadow-xs flex items-center justify-center text-2xl font-black text-black tracking-wider select-all"
                        >
                          {ch}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] font-semibold text-slate-500 leading-snug">
                    Comparte este código de 4 dígitos con tu compañero. Al introducirlo en el botón de intercambio de cualquier día, la app comprobará qué turnos encajan en horas y si cumplen las 12h de descanso.
                  </p>

                  {shareError && (
                    <p className="text-[10px] font-bold text-amber-700">{shareError}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!sharedMonthCode || isGeneratingShareCode}
                      onClick={() => {
                        if (!sharedMonthCode) return;
                        navigator.clipboard?.writeText(sharedMonthCode);
                        setJustCopiedShareCode(true);
                        setTimeout(() => setJustCopiedShareCode(false), 2000);
                      }}
                      className={cn(
                        "py-3 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border",
                        justCopiedShareCode
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-slate-200 hover:bg-slate-300 text-black border-slate-300"
                      )}
                    >
                      {justCopiedShareCode ? <Check size={14} /> : <Copy size={14} />}
                      <span>{justCopiedShareCode ? 'Código copiado' : 'Copiar código'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isGeneratingShareCode}
                      onClick={() => {
                        const monthKey = safeFormat(currentMonth, 'yyyy-MM');
                        const start = addDays(startOfMonth(currentMonth), -1);
                        const end = addDays(endOfMonth(currentMonth), 1);
                        const monthShiftsToShare = shifts.filter(
                          s => s.date >= safeFormat(start, 'yyyy-MM-dd') && s.date <= safeFormat(end, 'yyyy-MM-dd')
                        );
                        const url = encodeShareLinkPayload(monthKey, shareOwnerName.trim() || 'Compañero', monthShiftsToShare, sharedMonthCode);
                        navigator.clipboard?.writeText(url);
                        setJustCopiedShareLink(true);
                        setTimeout(() => setJustCopiedShareLink(false), 2000);
                      }}
                      className={cn(
                        "py-3 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border",
                        justCopiedShareLink
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                      )}
                    >
                      {justCopiedShareLink ? <Check size={14} /> : <Share2 size={14} />}
                      <span>{justCopiedShareLink ? 'Enlace copiado' : 'Copiar link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Selección de Mes */}
      <MonthPickerModal 
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        currentMonth={currentMonth}
        onSelectMonth={setCurrentMonth}
      />
      </div>
    </motion.div>
  );
};
