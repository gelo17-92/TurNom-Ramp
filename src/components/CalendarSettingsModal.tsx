import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  SlidersHorizontal, 
  Calendar, 
  List,
  Building2, 
  Sparkles, 
  Check, 
  ArrowLeft, 
  ChevronRight,
  Sun,
  Sunset,
  CalendarCheck,
  CheckCircle2,
  CalendarDays,
  Lock,
  AlertCircle,
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  Pencil,
  ArrowLeftRight,
  Users,
  UserCheck,
  Loader2,
  Mail,
  Send,
  Inbox,
  Clock,
  XCircle,
  Bell,
  RotateCcw
} from 'lucide-react';
import { CustomRotationModal } from './CustomRotationModal';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  differenceInCalendarDays, 
  parseISO, 
  isValid, 
  getDate, 
  setDate,
  addDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Settings, DayShift, CalendarRotationConfig, AutoShiftsConfig, MixedRotationConfig, cn, ShiftTemplate, SharedQuadrantInfo, ShiftEntry, SwapNotification, SwapRequest } from '../types';
import { safeFormat, getRotationForMonth, getAutoShiftsForMonth, isRotationFreeDay, getCalendarRotationDayShift, loadSavedMixedRotation, formatMixedRotationShortLabel, formatNumber, getShiftDuration, getRestBetweenDays } from '../utils';
import type { User } from '../firebase';

interface CalendarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  currentMonth: Date;
  shifts: DayShift[];
  onApplyAutoShifts: (generatedShifts: DayShift[]) => void;
  viewMode: 'calendar' | 'list';
  setViewMode: (mode: 'calendar' | 'list') => void;
  onShowToast?: (toast: { type: 'success' | 'error'; title: string; desc: string }) => void;
  activeCompany?: 'main' | 'second';
  isLocked?: boolean;
  user?: User | null;
  collabUsers?: SharedQuadrantInfo[];
  mutualCollabUids?: Record<string, boolean>;
  isLoadingCollabUsers?: boolean;
  onLoadCollabData?: (collab: SharedQuadrantInfo) => Promise<{ shifts: DayShift[]; vacations: string[] }>;
  onExecuteShiftSwap?: (
    myDateIso: string,
    targetDateIso: string,
    coworkerShiftsOnTarget: ShiftEntry[],
    coworkerNameStr: string,
    coworkerCodeStr?: string,
    coworkerUidOverride?: string
  ) => Promise<{ mutualSynced: boolean }> | void;
  onUndoShiftSwap?: (dayIso: string) => Promise<{ mutualSynced: boolean }> | void;
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
  onJumpToDate?: (dateIso: string) => void;
}

export const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  updateSettings,
  currentMonth,
  shifts,
  onApplyAutoShifts,
  viewMode,
  setViewMode,
  onShowToast,
  activeCompany = 'main',
  isLocked = false,
  user = null,
  collabUsers = [],
  mutualCollabUids = {},
  isLoadingCollabUsers = false,
  onLoadCollabData,
  onExecuteShiftSwap,
  onUndoShiftSwap,
  unreadSwapCount = 0,
  swapNotifications = [],
  sentSwapRequests = [],
  receivedSwapRequests = [],
  respondingSwapReqId = null,
  onMarkSwapNotificationsRead,
  onMarkSingleSwapNotificationRead,
  onDeleteSwapNotification,
  onRespondSwapRequest,
  onDeleteSwapRequest,
  onJumpToDate
}) => {
  const isSecondCompany = activeCompany === 'second';
  const [currentView, setCurrentView] = useState<'grid' | 'libranzas' | 'autoshifts' | 'swap'>('grid');

  // --- Swap View State (Cambiar Turno) ---
  const [swapSubView, setSwapSubView] = useState<'menu' | 'request' | 'notifications'>('menu');
  const [requestTab, setRequestTab] = useState<'sent' | 'received'>('sent');
  const [isCreatingNewSwapRequest, setIsCreatingNewSwapRequest] = useState(false);
  const [selectedSwapMyDate, setSelectedSwapMyDate] = useState<string | null>(null);
  const [selectedCollabUid, setSelectedCollabUid] = useState<string | null>(null);
  const [collabDataMap, setCollabDataMap] = useState<Record<string, { shifts: DayShift[]; vacations: string[] }>>({});
  const [loadingCollabUid, setLoadingCollabUid] = useState<string | null>(null);
  const [collabLoadError, setCollabLoadError] = useState<string | null>(null);
  const [swapTab, setSwapTab] = useState<'best' | 'all' | 'calendar'>('best');
  const [selectedCollabCalDate, setSelectedCollabCalDate] = useState<string | null>(null);
  const pendingReceivedCount = useMemo(
    () => receivedSwapRequests.filter(r => r.status === 'pending').length,
    [receivedSwapRequests]
  );
  const pendingSentCount = useMemo(
    () => sentSwapRequests.filter(r => r.status === 'pending').length,
    [sentSwapRequests]
  );

  // Month information
  const monthKey = safeFormat(currentMonth, 'yyyy-MM');
  const monthName = safeFormat(currentMonth, 'MMMM yyyy', { locale: es });
  const monthOnlyName = safeFormat(currentMonth, 'MMMM', { locale: es });
  const daysInMonthCount = getDate(endOfMonth(currentMonth));

  // --- 1. Rotation State ---
  const currentRotation = getRotationForMonth(currentMonth, settings) || {
    enabled: false,
    type: '6x3',
    anchorDate: safeFormat(currentMonth, 'yyyy-MM-01'),
    effectiveFromMonth: monthKey,
    firstFreeDay: 1
  };

  const [rotationEnabled, setRotationEnabled] = useState(currentRotation.enabled);
  const [rotationType, setRotationType] = useState<'6x3' | '4x4' | 'custom' | 'mixed' | string>(currentRotation.type || '6x3');
  const [linePosition, setLinePosition] = useState<'top' | 'bottom'>((currentRotation.linePosition === 'bottom' ? 'bottom' : 'top'));
  const [isCustomRotationModalOpen, setIsCustomRotationModalOpen] = useState(false);
  const [customModalInitialMode, setCustomModalInitialMode] = useState<'simple' | 'mixed'>('simple');
  const [mixedConfig, setMixedConfig] = useState<MixedRotationConfig>(() => currentRotation.mixedConfig || loadSavedMixedRotation(settings, currentMonth));

  const customWorkDays = settings.customRotation?.workDays || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).workDays || 5;
    } catch (e) {}
    return 5;
  })();

  const customFreeDays = settings.customRotation?.freeDays || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).freeDays || 2;
    } catch (e) {}
    return 2;
  })();
  
  // Anchor day in current month (1 to daysInMonth) representing the first free day
  const calculateInitialFirstFreeDay = () => {
    // If explicitly set for this month, use it
    if (settings.monthlyRotations?.[monthKey]?.firstFreeDay) {
      return settings.monthlyRotations[monthKey].firstFreeDay!;
    }
    // If inheriting an active rotation, find the first free day in this month
    if (currentRotation.enabled && currentRotation.anchorDate) {
      for (let d = 1; d <= daysInMonthCount; d++) {
        const dayDate = setDate(startOfMonth(currentMonth), d);
        if (isRotationFreeDay(dayDate, currentRotation)) {
          return d;
        }
      }
    }
    if (currentRotation.firstFreeDay) return currentRotation.firstFreeDay;
    if (currentRotation.anchorDate) {
      const parsed = parseISO(currentRotation.anchorDate);
      if (isValid(parsed)) return getDate(parsed);
    }
    return 1;
  };

  const [firstFreeDay, setFirstFreeDay] = useState<number>(calculateInitialFirstFreeDay());

  // --- 2. Auto Shifts State ---
  const currentAutoShifts = getAutoShiftsForMonth(currentMonth, settings) || {
    enabled: false,
    firstMorningDate: safeFormat(currentMonth, 'yyyy-MM-01'),
    morningStart: '07:00',
    morningEnd: '15:00',
    afternoonStart: '15:00',
    afternoonEnd: '23:00'
  };

  const [autoShiftsEnabled, setAutoShiftsEnabled] = useState(currentAutoShifts.enabled);
  const [morningStart, setMorningStart] = useState<string>(currentAutoShifts.morningStart || '07:00');
  const [morningEnd, setMorningEnd] = useState<string>(currentAutoShifts.morningEnd || '15:00');
  const [afternoonStart, setAfternoonStart] = useState<string>(currentAutoShifts.afternoonStart || '15:00');
  const [afternoonEnd, setAfternoonEnd] = useState<string>(currentAutoShifts.afternoonEnd || '23:00');
  const [autoShiftsSuccess, setAutoShiftsSuccess] = useState(false);

  // --- 3. Shift Templates (Turnos Guardados) State ---
  const shiftTemplates: ShiftTemplate[] = useMemo(() => {
    if (Array.isArray(settings.shiftTemplates)) {
      return settings.shiftTemplates.filter(t => !['tpl-madrugue', 'tpl-manana', 'tpl-tarde', 'tpl-cierre'].includes(t.id));
    }
    return [];
  }, [settings.shiftTemplates]);

  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [newTplStart, setNewTplStart] = useState('07:00');
  const [newTplEnd, setNewTplEnd] = useState('15:00');
  const [newTplCategory, setNewTplCategory] = useState<'auto' | 'manana' | 'tarde'>('auto');
  const [isMorningOpen, setIsMorningOpen] = useState(false);
  const [isAfternoonOpen, setIsAfternoonOpen] = useState(false);

  const getShiftCategory = (tpl: ShiftTemplate): 'manana' | 'tarde' => {
    if (tpl.category === 'manana' || tpl.category === 'tarde') {
      return tpl.category;
    }
    const name = (tpl.name || '').toLowerCase();
    if (name.includes('mañana') || name.includes('manana') || name.includes('madrugue')) return 'manana';
    if (name.includes('tarde') || name.includes('cierre') || name.includes('noche')) return 'tarde';
    const start = tpl.shifts?.[0]?.start || '';
    if (!start) return 'manana';
    const [h] = start.split(':').map(Number);
    return (h >= 4 && h < 14) ? 'manana' : 'tarde';
  };

  const sortByShiftHour = (a: ShiftTemplate, b: ShiftTemplate) => {
    const startA = a.shifts?.[0]?.start || '99:99';
    const startB = b.shifts?.[0]?.start || '99:99';
    if (startA !== startB) {
      return startA.localeCompare(startB);
    }
    const endA = a.shifts?.[0]?.end || '99:99';
    const endB = b.shifts?.[0]?.end || '99:99';
    return endA.localeCompare(endB);
  };

  const morningTemplates = useMemo(() => {
    return shiftTemplates
      .filter(t => getShiftCategory(t) === 'manana')
      .sort(sortByShiftHour);
  }, [shiftTemplates]);

  const afternoonTemplates = useMemo(() => {
    return shiftTemplates
      .filter(t => getShiftCategory(t) === 'tarde')
      .sort(sortByShiftHour);
  }, [shiftTemplates]);

  const updateShiftTemplates = (newTemplates: ShiftTemplate[]) => {
    if (isLocked) return;
    updateSettings({
      ...settings,
      shiftTemplates: newTemplates
    });
  };

  const handleApplyTemplateToMorning = (tpl: ShiftTemplate) => {
    if (isLocked || !tpl.shifts || tpl.shifts.length === 0) return;
    const s = tpl.shifts[0];
    setMorningStart(s.start);
    setMorningEnd(s.end);
    handleSaveAndSync({
      autoShiftsConfig: {
        enabled: autoShiftsEnabled,
        firstMorningDate: getAnchorDateString(firstFreeDay),
        morningStart: s.start,
        morningEnd: s.end,
        afternoonStart,
        afternoonEnd
      }
    });
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Horario de Mañanas asignado',
        desc: `${tpl.name ? tpl.name + ': ' : ''}${s.start} → ${s.end}`
      });
    }
  };

  const handleApplyTemplateToAfternoon = (tpl: ShiftTemplate) => {
    if (isLocked || !tpl.shifts || tpl.shifts.length === 0) return;
    const s = tpl.shifts[0];
    setAfternoonStart(s.start);
    setAfternoonEnd(s.end);
    handleSaveAndSync({
      autoShiftsConfig: {
        enabled: autoShiftsEnabled,
        firstMorningDate: getAnchorDateString(firstFreeDay),
        morningStart,
        morningEnd,
        afternoonStart: s.start,
        afternoonEnd: s.end
      }
    });
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Horario de Tardes asignado',
        desc: `${tpl.name ? tpl.name + ': ' : ''}${s.start} → ${s.end}`
      });
    }
  };

  // Helper to reliably match date strings (handles 'YYYY-MM-DD' vs full ISO 'YYYY-MM-DDTHH:mm:ss...')
  const isDateEqual = (d1: string | Date | undefined | null, d2: string | Date | undefined | null): boolean => {
    if (!d1 || !d2) return false;
    const s1 = typeof d1 === 'string' ? d1.split('T')[0] : safeFormat(d1, 'yyyy-MM-dd');
    const s2 = typeof d2 === 'string' ? d2.split('T')[0] : safeFormat(d2, 'yyyy-MM-dd');
    if (s1 && s2 && s1 === s2) return true;
    const p1 = typeof d1 === 'string' ? parseISO(d1) : d1;
    const p2 = typeof d2 === 'string' ? parseISO(d2) : d2;
    if (isValid(p1) && isValid(p2)) {
      return safeFormat(p1, 'yyyy-MM-dd') === safeFormat(p2, 'yyyy-MM-dd');
    }
    return false;
  };

  // Sync state on modal open or month change
  useEffect(() => {
    if (isOpen) {
      setCurrentView('grid');
      setSwapSubView('menu');
      setRequestTab('sent');
      setIsCreatingNewSwapRequest(false);
      const rot = getRotationForMonth(currentMonth, settings);
      setMixedConfig(rot?.mixedConfig || loadSavedMixedRotation(settings, currentMonth));
      if (rot) {
        setRotationEnabled(rot.enabled);
        setRotationType(rot.type || '6x3');
        setLinePosition(rot.linePosition === 'bottom' ? 'bottom' : 'top');
        if (settings.monthlyRotations?.[monthKey]?.firstFreeDay) {
          setFirstFreeDay(settings.monthlyRotations[monthKey].firstFreeDay!);
        } else if (rot.enabled && (rot.anchorDate || rot.mixedConfig)) {
          let foundDay = 0;
          for (let d = 1; d <= daysInMonthCount; d++) {
            const dayDate = setDate(startOfMonth(currentMonth), d);
            if (isRotationFreeDay(dayDate, rot)) {
              foundDay = d;
              break;
            }
          }
          setFirstFreeDay(foundDay || rot.firstFreeDay || 1);
        } else {
          setFirstFreeDay(rot.firstFreeDay || 1);
        }
      } else {
        setRotationEnabled(false);
        setRotationType('6x3');
        setLinePosition('top');
        setFirstFreeDay(1);
      }

      const auto = getAutoShiftsForMonth(currentMonth, settings);
      if (auto) {
        setAutoShiftsEnabled(auto.enabled);
        setMorningStart(auto.morningStart || '07:00');
        setMorningEnd(auto.morningEnd || '15:00');
        setAfternoonStart(auto.afternoonStart || '15:00');
        setAfternoonEnd(auto.afternoonEnd || '23:00');
      } else {
        setAutoShiftsEnabled(false);
        setMorningStart('07:00');
        setMorningEnd('15:00');
        setAfternoonStart('15:00');
        setAfternoonEnd('23:00');
      }
      setAutoShiftsSuccess(false);
      setSelectedSwapMyDate(null);
      setSelectedCollabCalDate(null);
      setCollabLoadError(null);
      setSwapTab('best');
    }
  }, [isOpen, monthKey]);

  const formatRestHours = (hours: number) => {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleSelectCollab = async (collab: SharedQuadrantInfo) => {
    setSelectedCollabUid(collab.ownerUid);
    setSelectedCollabCalDate(null);
    setCollabLoadError(null);
    if (collabDataMap[collab.ownerUid] || !onLoadCollabData) return;
    setLoadingCollabUid(collab.ownerUid);
    try {
      const data = await onLoadCollabData(collab);
      setCollabDataMap(prev => ({ ...prev, [collab.ownerUid]: data }));
    } catch (err) {
      console.error('Error loading collaborator shifts:', err);
      setCollabLoadError(`No se pudieron cargar los turnos de ${collab.ownerName || 'este compañero'}.`);
    } finally {
      setLoadingCollabUid(null);
    }
  };

  useEffect(() => {
    if (!isOpen || currentView !== 'swap' || collabUsers.length === 0) return;
    const target = selectedCollabUid
      ? collabUsers.find(c => c.ownerUid === selectedCollabUid) || collabUsers[0]
      : collabUsers[0];
    if (target) {
      if (selectedCollabUid !== target.ownerUid) {
        setSelectedCollabUid(target.ownerUid);
      }
      if (!collabDataMap[target.ownerUid] && loadingCollabUid !== target.ownerUid && onLoadCollabData) {
        handleSelectCollab(target);
      }
    }
  }, [isOpen, currentView, collabUsers, selectedCollabUid, collabDataMap, loadingCollabUid]);

  const swapMonthDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });
  }, [currentMonth]);

  const swapLeadingEmptyCount = useMemo(() => {
    return (startOfMonth(currentMonth).getDay() + 6) % 7;
  }, [currentMonth]);

  // Build anchor date string based on firstFreeDay and current month
  const getAnchorDateString = (dayNum: number): string => {
    const safeDay = Math.min(Math.max(1, dayNum), daysInMonthCount);
    const d = setDate(startOfMonth(currentMonth), safeDay);
    return safeFormat(d, 'yyyy-MM-dd');
  };

  // Save changes to settings per month
  const handleSaveCustomRotation = (w: number, f: number, freeDay?: number, anchorDateStr?: string) => {
    const customType = `${w}x${f}`;
    const selectedFreeDay = freeDay ?? firstFreeDay;
    const finalAnchor = anchorDateStr ?? getAnchorDateString(selectedFreeDay);
    const newCustomRotation = { 
      workDays: w, 
      freeDays: f,
      firstFreeDay: selectedFreeDay,
      anchorDate: finalAnchor
    };
    setRotationType(customType);
    setFirstFreeDay(selectedFreeDay);
    setRotationEnabled(true);
    try {
      localStorage.setItem('customRotationConfig', JSON.stringify(newCustomRotation));
      localStorage.setItem('rotationCycleType', customType);
    } catch (e) {}

    handleSaveAndSync({
      customRotation: newCustomRotation,
      calendarRotation: {
        ...currentRotation,
        enabled: true,
        type: customType,
        workDays: w,
        freeDays: f,
        anchorDate: finalAnchor,
        firstFreeDay: selectedFreeDay,
        effectiveFromMonth: monthKey,
        linePosition
      }
    }, selectedFreeDay);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Ciclo personalizado aplicado',
        desc: `Ciclo ${w}x${f} configurado con inicio el día ${selectedFreeDay}. Prolongado a los próximos meses.`
      });
    }
  };

  const handleSaveMixedRotation = (newMixed: MixedRotationConfig) => {
    setMixedConfig(newMixed);
    setRotationType('mixed');
    const anchorDay = newMixed.firstFreeDay || firstFreeDay || 1;
    setFirstFreeDay(anchorDay);
    setRotationEnabled(true);
    try {
      localStorage.setItem('mixedRotationConfig', JSON.stringify(newMixed));
      localStorage.setItem('rotationCycleType', 'mixed');
    } catch (e) {}

    handleSaveAndSync({
      mixedRotation: newMixed,
      calendarRotation: {
        ...currentRotation,
        enabled: true,
        type: 'mixed',
        anchorDate: newMixed.firstAnchorDate,
        firstFreeDay: anchorDay,
        effectiveFromMonth: monthKey,
        linePosition,
        mixedConfig: newMixed,
      }
    }, anchorDay);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Rotación mixta aplicada',
        desc: `Rotación mixta ${formatMixedRotationShortLabel(newMixed)} configurada y sincronizada.`
      });
    }
  };

  const handleSaveAndSync = (overrides?: Partial<Settings>, explicitFirstFreeDay?: number) => {
    if (isLocked) return;
    const freeDayToSave = explicitFirstFreeDay ?? overrides?.calendarRotation?.firstFreeDay ?? firstFreeDay;
    const finalType = overrides?.calendarRotation?.type ?? rotationType;
    const activeMixed = overrides?.calendarRotation?.mixedConfig ?? overrides?.mixedRotation ?? (finalType === 'mixed' ? mixedConfig : undefined);
    const anchorDateStr = overrides?.calendarRotation?.anchorDate ?? (finalType === 'mixed' && activeMixed?.firstAnchorDate ? activeMixed.firstAnchorDate : getAnchorDateString(freeDayToSave));
    let finalWorkDays = overrides?.calendarRotation?.workDays;
    let finalFreeDays = overrides?.calendarRotation?.freeDays;
    if (finalWorkDays === undefined && finalType.includes('x') && finalType !== '6x3' && finalType !== '4x4') {
      const parts = finalType.split('x').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        finalWorkDays = parts[0];
        finalFreeDays = parts[1];
      }
    } else if (finalWorkDays === undefined && finalType === 'custom') {
      finalWorkDays = customWorkDays;
      finalFreeDays = customFreeDays;
    }

    const updatedRotation: CalendarRotationConfig = {
      enabled: overrides?.calendarRotation?.enabled ?? rotationEnabled,
      type: finalType,
      workDays: finalType === 'mixed' ? undefined : finalWorkDays,
      freeDays: finalType === 'mixed' ? undefined : finalFreeDays,
      anchorDate: anchorDateStr,
      firstFreeDay: freeDayToSave,
      effectiveFromMonth: monthKey,
      linePosition: overrides?.calendarRotation?.linePosition ?? linePosition,
      ...(finalType === 'mixed' && activeMixed ? { mixedConfig: activeMixed } : {}),
    };

    const updatedAutoShifts: AutoShiftsConfig = {
      enabled: overrides?.autoShiftsConfig?.enabled ?? autoShiftsEnabled,
      firstMorningDate: overrides?.autoShiftsConfig?.firstMorningDate ?? anchorDateStr,
      morningStart: overrides?.autoShiftsConfig?.morningStart ?? morningStart,
      morningEnd: overrides?.autoShiftsConfig?.morningEnd ?? morningEnd,
      afternoonStart: overrides?.autoShiftsConfig?.afternoonStart ?? afternoonStart,
      afternoonEnd: overrides?.autoShiftsConfig?.afternoonEnd ?? afternoonEnd
    };

    const updatedMonthlyRotations = {
      ...(settings.monthlyRotations || {}),
      [monthKey]: updatedRotation
    };

    const updatedMonthlyAutoShifts = {
      ...(settings.monthlyAutoShifts || {}),
      [monthKey]: updatedAutoShifts
    };

    const updated: Settings = {
      ...settings,
      ...overrides,
      ...(finalType === 'mixed' && activeMixed ? { mixedRotation: activeMixed } : {}),
      calendarRotation: updatedRotation,
      autoShiftsConfig: updatedAutoShifts,
      monthlyRotations: updatedMonthlyRotations,
      monthlyAutoShifts: updatedMonthlyAutoShifts
    };

    updateSettings(updated);
  };

  // Handler for selecting the first free day of the month
  const handleSelectFirstFreeDay = (val: number) => {
    const safeVal = Math.min(Math.max(1, val), daysInMonthCount);
    setFirstFreeDay(safeVal);
    if (rotationType === 'mixed') {
      const clickedDateStr = getAnchorDateString(safeVal);
      if (mixedConfig.mode === 'by_date' && mixedConfig.switchDate && clickedDateStr >= mixedConfig.switchDate) {
        setMixedConfig(prev => ({ ...prev, secondAnchorDate: clickedDateStr }));
      } else {
        setMixedConfig(prev => ({ ...prev, firstAnchorDate: clickedDateStr, firstFreeDay: safeVal }));
      }
    }
  };

  // Long press refs and handler to deactivate libranzas
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  const handleLongPressDeactivateLibranzas = () => {
    if (!rotationEnabled || isLocked) return;
    setRotationEnabled(false);
    handleSaveAndSync({
      calendarRotation: {
        ...currentRotation,
        enabled: false,
        type: rotationType,
        anchorDate: getAnchorDateString(firstFreeDay),
        firstFreeDay,
        effectiveFromMonth: monthKey,
        linePosition
      }
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {
        // ignore vibrate if unsupported
      }
    }
    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Visualización de libranzas desactivada',
        desc: `Se ha desactivado la visualización de libranzas para ${monthName}.`
      });
    }
  };

  const handlePointerDownLibranzas = () => {
    isLongPressTriggeredRef.current = false;
    if (!rotationEnabled || isLocked) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      handleLongPressDeactivateLibranzas();
    }, 550);
  };

  const handlePointerUpLibranzas = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Computed list of free days in currentMonth based on firstFreeDay and rotationType (including mixed)
  const previewFreeDaysInMonth = useMemo(() => {
    const daysOfMonth = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });

    const previewRotConfig: CalendarRotationConfig = {
      enabled: true,
      type: rotationType,
      workDays: rotationType === 'custom' ? customWorkDays : undefined,
      freeDays: rotationType === 'custom' ? customFreeDays : undefined,
      anchorDate: rotationType === 'mixed' ? mixedConfig.firstAnchorDate : getAnchorDateString(firstFreeDay),
      firstFreeDay,
      effectiveFromMonth: monthKey,
      mixedConfig: rotationType === 'mixed' ? mixedConfig : undefined,
    };

    const freeDays: number[] = [];
    daysOfMonth.forEach(d => {
      if (getCalendarRotationDayShift(d, previewRotConfig) === 'L') {
        freeDays.push(getDate(d));
      }
    });

    return freeDays;
  }, [firstFreeDay, rotationType, currentMonth, customWorkDays, customFreeDays, mixedConfig, monthKey]);

  // Toggle 2º Calendar from section 2
  const handleToggleDualMode = () => {
    if (isLocked) return;
    const nextDual = !settings.dualMode;
    handleSaveAndSync({ dualMode: nextDual });
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: nextDual ? '2º Calendario activado' : '2º Calendario desactivado',
        desc: nextDual 
          ? 'Ahora puedes registrar turnos y gestionar solapes de una segunda empresa.'
          : 'Se ha desactivado el 2º calendario.'
      });
    }
  };

  // Toggle View Mode (Calendar / List) from section 1
  const handleToggleViewMode = () => {
    const nextMode = viewMode === 'calendar' ? 'list' : 'calendar';
    setViewMode(nextMode);
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: nextMode === 'calendar' ? 'Modo Calendario activado' : 'Modo Lista activado',
        desc: nextMode === 'calendar' 
          ? 'Visualización en cuadrícula mensual activada.'
          : 'Visualización en lista detallada de turnos activada.'
      });
    }
  };

  // Apply auto shifts to current month regardless of day status/type (supports standard, custom, and mixed rotations)
  const handleApplyShiftsToMonth = () => {
    if (isLocked) return;
    const anchorDateStr = rotationType === 'mixed' ? mixedConfig.firstAnchorDate : getAnchorDateString(firstFreeDay);
    const anchorDateObj = parseISO(anchorDateStr);
    if (!isValid(anchorDateObj) && rotationType !== 'mixed') return;

    setAutoShiftsEnabled(true);

    // Persist latest hours and status (directly enabled on apply)
    handleSaveAndSync({
      autoShiftsConfig: {
        enabled: true,
        firstMorningDate: anchorDateStr,
        morningStart,
        morningEnd,
        afternoonStart,
        afternoonEnd
      }
    });

    const effectiveRotConfig: CalendarRotationConfig = {
      enabled: true,
      type: rotationType,
      workDays: rotationType === 'custom' ? customWorkDays : undefined,
      freeDays: rotationType === 'custom' ? customFreeDays : undefined,
      anchorDate: anchorDateStr,
      firstFreeDay,
      effectiveFromMonth: monthKey,
      mixedConfig: rotationType === 'mixed' ? mixedConfig : undefined,
    };

    const daysOfMonth = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });

    const generatedShifts: DayShift[] = [];

    daysOfMonth.forEach(dayDate => {
      const dateStr = safeFormat(dayDate, 'yyyy-MM-dd');
      const existing = shifts.find(s => isDateEqual(s.date, dateStr));
      const dayType = existing?.type || 'Laboral';

      const shiftCode = getCalendarRotationDayShift(dayDate, effectiveRotConfig);

      if (shiftCode === 'L' || shiftCode === null) {
        // Día Libre: lista de turnos vacía
        generatedShifts.push({
          date: dateStr,
          type: dayType,
          shifts: [],
          perentorias: existing?.perentorias || { day: 0, night: 0 },
          complementarias: existing?.complementarias || { day: 0, night: 0 },
          extraShifts: existing?.extraShifts || []
        });
      } else if (shiftCode === 'M') {
        // Turno de Mañanas
        generatedShifts.push({
          date: dateStr,
          type: dayType,
          shifts: [{ start: morningStart, end: morningEnd }],
          perentorias: existing?.perentorias || { day: 0, night: 0 },
          complementarias: existing?.complementarias || { day: 0, night: 0 },
          extraShifts: existing?.extraShifts || []
        });
      } else {
        // Turno de Tardes
        generatedShifts.push({
          date: dateStr,
          type: dayType,
          shifts: [{ start: afternoonStart, end: afternoonEnd }],
          perentorias: existing?.perentorias || { day: 0, night: 0 },
          complementarias: existing?.complementarias || { day: 0, night: 0 },
          extraShifts: existing?.extraShifts || []
        });
      }
    });

    onApplyAutoShifts(generatedShifts);
    setAutoShiftsSuccess(true);
    setTimeout(() => setAutoShiftsSuccess(false), 3500);
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Turnos autocompletados',
        desc: `Se han asignado automáticamente los turnos de mañana y tarde para ${monthName}.`
      });
    }
  };

  const renderTemplateCard = (tpl: ShiftTemplate, section: 'manana' | 'tarde') => {
    const totalTplHours = (tpl.shifts || []).reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
    const firstShift = tpl.shifts?.[0];
    const isMatchMorning = firstShift && firstShift.start === morningStart && firstShift.end === morningEnd;
    const isMatchAfternoon = firstShift && firstShift.start === afternoonStart && firstShift.end === afternoonEnd;
    const isSelected = section === 'manana' ? isMatchMorning : isMatchAfternoon;

    return (
      <div
        key={tpl.id}
        onClick={() => {
          if (isManagingTemplates) return;
          if (section === 'manana') {
            handleApplyTemplateToMorning(tpl);
          } else {
            handleApplyTemplateToAfternoon(tpl);
          }
        }}
        className={cn(
          "p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 shadow-2xs relative select-none",
          !isManagingTemplates && "cursor-pointer active:scale-[0.98]",
          isSelected
            ? section === 'manana'
              ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/30"
              : "bg-orange-50/70 dark:bg-orange-950/40 border-orange-500 dark:border-orange-500 ring-2 ring-orange-500/30"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1">
            {tpl.name && (
              <span className={cn(
                "block text-[8.5px] font-black uppercase tracking-wider truncate leading-tight",
                section === 'manana' ? "text-amber-700 dark:text-amber-400" : "text-orange-700 dark:text-orange-400"
              )}>
                {tpl.name}
              </span>
            )}
            <span className="block text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
              {tpl.shifts.map(s => `${s.start} → ${s.end}`).join(' / ')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSelected && !isManagingTemplates && (
              <span className={cn(
                "p-0.5 rounded-full text-white flex items-center justify-center",
                section === 'manana' ? "bg-amber-500" : "bg-orange-500"
              )} title="Turno asignado">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
            {isManagingTemplates ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateShiftTemplates(shiftTemplates.filter(t => t.id !== tpl.id));
                }}
                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                title="Eliminar turno guardado"
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                {formatNumber(totalTplHours)}h
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.25rem] shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent top line */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20 shrink-0">
          <div className="flex items-center gap-3">
            {currentView !== 'grid' && (
              <button
                type="button"
                onClick={() => {
                  if (currentView === 'swap' && swapSubView !== 'menu') {
                    setSwapSubView('menu');
                  } else {
                    setCurrentView('grid');
                  }
                }}
                className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all cursor-pointer shadow-xs active:scale-95"
                title={currentView === 'swap' && swapSubView !== 'menu' ? 'Volver a Cambiar Turno' : 'Volver a los ajustes principales'}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="p-2 sm:p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 shrink-0">
              {currentView === 'swap' && swapSubView === 'notifications' ? (
                <Mail size={20} />
              ) : currentView === 'swap' ? (
                <ArrowLeftRight size={20} />
              ) : (
                <SlidersHorizontal size={20} />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {currentView === 'grid' && 'Ajustes del Calendario'}
                {currentView === 'libranzas' && 'Visualizar Libranzas'}
                {currentView === 'autoshifts' && 'Autocompletar Turnos'}
                {currentView === 'swap' && swapSubView === 'menu' && 'Cambiar Turno'}
                {currentView === 'swap' && swapSubView === 'request' && 'Solicitar Cambio de Turno'}
                {currentView === 'swap' && swapSubView === 'notifications' && 'Notificaciones'}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-xs sm:text-[13px] font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                  {monthName}
                </span>
                {isSecondCompany && currentView !== 'libranzas' && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
                    <span className="text-[10px] sm:text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-tight">
                      2º Calendario ({settings.secondCompanyName || '2ª Empresa'})
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLocked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                <Lock size={11} /> Solo Lectura
              </span>
            )}
            <button
              onClick={() => {
                if (!isLocked && currentView === 'grid') {
                  handleSaveAndSync();
                }
                onClose();
              }}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer active:scale-95"
              aria-label="Cerrar ajustes"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {isLocked && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-2.5 text-amber-800 dark:text-amber-200 text-xs font-semibold shadow-2xs">
              <Lock size={16} className="text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-100">Permiso de edición bloqueado</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  El titular del cuadrante ha bloqueado la edición. Los ajustes del calendario están en modo de solo lectura.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VISTA PRINCIPAL: CUADRÍCULA 2x2 (2 COLUMNAS Y 2 FILAS) */}
          {/* ======================================================== */}
          {currentView === 'grid' && (
            <div className="space-y-3">
              {/* Aviso explicativo cuando se consulta desde el 2º Calendario */}
              {isSecondCompany && (
                <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-black uppercase tracking-tight block">
                      2º Calendario activo ({settings.secondCompanyName || '2ª Empresa'})
                    </span>
                    <p className="text-[11px] font-medium leading-snug text-amber-800 dark:text-amber-300">
                      Las opciones de <strong>Visualizar libranzas</strong> y <strong>Autocompletar turnos</strong> son exclusivas de la empresa principal (Azul Handling).
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 select-none">
                
                {/* ---------------------------------------------------- */}
                {/* SECCIÓN 1 (ARRIBA IZQUIERDA): CALENDARIO / LISTA */}
                {/* ---------------------------------------------------- */}
                <button
                  type="button"
                  onClick={handleToggleViewMode}
                  className={cn(
                    "p-3 sm:p-4 rounded-2xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2 shadow-xs min-h-[130px] sm:min-h-[145px] group",
                    viewMode === 'calendar'
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-400"
                      : "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 hover:border-indigo-400"
                  )}
                >
                  <div className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs text-white transition-transform group-hover:scale-105 shrink-0",
                    viewMode === 'calendar' ? "bg-emerald-500" : "bg-indigo-500"
                  )}>
                    {viewMode === 'calendar' ? (
                      <List size={22} className="stroke-[2.5]" />
                    ) : (
                      <Calendar size={22} className="stroke-[2.5]" />
                    )}
                  </div>

                  <span className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
                    Calendario/Lista
                  </span>

                  <div className={cn(
                    "px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border",
                    viewMode === 'calendar'
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-400"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", viewMode === 'calendar' ? "bg-emerald-500" : "bg-indigo-500")} />
                    <span>{viewMode === 'calendar' ? 'Calendario' : 'Lista'}</span>
                  </div>
                </button>

                {/* ---------------------------------------------------- */}
                {/* SECCIÓN 2 (ARRIBA DERECHA): 2º CALENDARIO */}
                {/* ---------------------------------------------------- */}
                <button
                  type="button"
                  onClick={handleToggleDualMode}
                  className={cn(
                    "p-3 sm:p-4 rounded-2xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2 shadow-xs min-h-[130px] sm:min-h-[145px] group",
                    settings.dualMode
                      ? "bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/60 hover:border-amber-400"
                      : "bg-slate-50/80 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 shrink-0",
                    settings.dualMode
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>
                    <Building2 size={22} className="stroke-[2.5]" />
                  </div>

                  <span className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
                    2º Calendario
                  </span>

                  <div className={cn(
                    "px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border",
                    settings.dualMode
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400"
                      : "bg-slate-500/10 border-slate-400/20 text-slate-400 dark:text-slate-500"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", settings.dualMode ? "bg-amber-500" : "bg-slate-400")} />
                    <span>{settings.dualMode ? 'Activado' : 'Desactivado'}</span>
                  </div>
                </button>

                {/* ---------------------------------------------------- */}
                {/* SECCIÓN 3 (ABAJO IZQUIERDA): VISUALIZAR LIBRANZAS */}
                {/* ---------------------------------------------------- */}
                {isSecondCompany ? (
                  <div
                    className="p-3 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center gap-2 shadow-xs min-h-[130px] sm:min-h-[145px] opacity-55 cursor-not-allowed select-none relative"
                    title="Visualizar libranzas solo está disponible para la empresa principal (Azul Handling)"
                  >
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shrink-0">
                      <CalendarCheck size={22} className="stroke-[2.5]" />
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight leading-tight">
                        Visualizar libranzas
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        Solo empresa principal
                      </span>
                    </div>

                    <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                      <Lock size={10} className="shrink-0" />
                      <span>Solo Azul H.</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onPointerDown={handlePointerDownLibranzas}
                    onPointerUp={handlePointerUpLibranzas}
                    onPointerLeave={handlePointerUpLibranzas}
                    onPointerCancel={handlePointerUpLibranzas}
                    onClick={() => {
                      if (isLongPressTriggeredRef.current) {
                        isLongPressTriggeredRef.current = false;
                        return;
                      }
                      setCurrentView('libranzas');
                    }}
                    onContextMenu={(e) => {
                      if (isLongPressTriggeredRef.current) {
                        e.preventDefault();
                      }
                    }}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2 shadow-xs min-h-[130px] sm:min-h-[145px] group select-none",
                      rotationEnabled
                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-400"
                        : "bg-slate-50/80 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 shrink-0",
                      rotationEnabled
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    )}>
                      <CalendarCheck size={22} className="stroke-[2.5]" />
                    </div>

                    <span className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
                      Visualizar libranzas
                    </span>

                    <div className="flex flex-col items-center gap-0.5">
                      <div className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border",
                        rotationEnabled
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-500/10 border-slate-400/20 text-slate-400 dark:text-slate-500"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", rotationEnabled ? "bg-emerald-500" : "bg-slate-400")} />
                        <span>{rotationEnabled ? 'Activado' : 'Desactivado'}</span>
                      </div>
                      {rotationEnabled && (
                        <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                          Mantén pulsado para desactivar
                        </span>
                      )}
                    </div>
                  </button>
                )}

                {/* ---------------------------------------------------- */}
                {/* SECCIÓN 4 (ABAJO DERECHA): AUTOCOMPLETAR TURNOS */}
                {/* ---------------------------------------------------- */}
                {isSecondCompany ? (
                  <div
                    className="p-3 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center gap-2 shadow-xs min-h-[130px] sm:min-h-[145px] opacity-55 cursor-not-allowed select-none relative"
                    title="Autocompletar turnos solo está disponible para la empresa principal (Azul Handling)"
                  >
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shrink-0">
                      <Sparkles size={22} className="stroke-[2.5]" />
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight leading-tight">
                        Autocompletar turnos
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        Solo empresa principal
                      </span>
                    </div>

                    <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                      <Lock size={10} className="shrink-0" />
                      <span>Solo Azul H.</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentView('autoshifts')}
                    className={cn(
                      "p-3 sm:p-4 rounded-2xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2 shadow-xs min-h-[130px] sm:min-h-[145px] group",
                      autoShiftsEnabled
                        ? "bg-purple-50/70 dark:bg-purple-950/25 border-purple-300 dark:border-purple-800/60 hover:border-purple-400"
                        : "bg-slate-50/80 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 shrink-0",
                      autoShiftsEnabled
                        ? "bg-purple-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    )}>
                      <Sparkles size={22} className="stroke-[2.5]" />
                    </div>

                    <span className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
                      Autocompletar turnos
                    </span>
                  </button>
                )}

                {/* ---------------------------------------------------- */}
                {/* SECCIÓN 5 (ANCHO COMPLETO): CAMBIAR TURNO            */}
                {/* ---------------------------------------------------- */}
                {isSecondCompany ? (
                  <div
                    className="col-span-2 p-3 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3 shadow-xs opacity-55 cursor-not-allowed select-none"
                    title="Cambiar turno con Compartir/Colab. solo está disponible para la empresa principal (Azul Handling)"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shrink-0">
                        <ArrowLeftRight size={21} className="stroke-[2.5]" />
                      </div>
                      <div className="text-left">
                        <span className="text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight block leading-tight">
                          Cambiar Turno
                        </span>
                        <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 block mt-0.5">
                          Solo empresa principal (Azul Handling)
                        </span>
                      </div>
                    </div>
                    <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 shrink-0">
                      <Lock size={10} className="shrink-0" />
                      <span>Solo Azul H.</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSwapSubView('menu');
                      setCurrentView('swap');
                    }}
                    className="col-span-2 p-3 sm:p-4 rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50/70 dark:bg-sky-950/25 hover:border-sky-400 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between gap-3 shadow-xs group relative"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs bg-azul-blue text-white transition-transform group-hover:scale-105 shrink-0 relative">
                        <ArrowLeftRight size={21} className="stroke-[2.5]" />
                        {(unreadSwapCount > 0 || pendingReceivedCount > 0) && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-85" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white dark:border-slate-900" />
                          </span>
                        )}
                      </div>
                      <div className="text-left">
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight block leading-tight">
                          Cambiar Turno
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mt-0.5">
                          Solicitar cambios y revisar notificaciones
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(unreadSwapCount > 0 || pendingReceivedCount > 0) ? (
                        <div className="px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 animate-pulse">
                          <Mail size={11} className="shrink-0" />
                          <span>{Math.max(unreadSwapCount, pendingReceivedCount)} nueva{Math.max(unreadSwapCount, pendingReceivedCount) === 1 ? '' : 's'}</span>
                        </div>
                      ) : (
                        <div className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border",
                          collabUsers.length > 0
                            ? "bg-azul-blue/10 border-azul-blue/25 text-azul-blue dark:text-sky-400"
                            : "bg-slate-500/10 border-slate-400/20 text-slate-500 dark:text-slate-400"
                        )}>
                          <Users size={11} className="shrink-0" />
                          <span>
                            {collabUsers.length > 0
                              ? `${collabUsers.length} ${collabUsers.length === 1 ? 'acceso' : 'accesos'}`
                              : 'Colab.'}
                          </span>
                        </div>
                      )}
                      <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                )}

              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-VENTANA 3: VISUALIZAR LIBRANZAS (ROTACIÓN Y DÍA LIBRE) */}
          {/* ======================================================== */}
          {currentView === 'libranzas' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className={cn("space-y-4", isLocked && "pointer-events-none opacity-60 select-none")}>
              {/* Selector de Rotación: 6x3, 4x4 o Personalizado con botón lápiz */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Elige el tipo de rotación:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModalInitialMode(rotationType === 'mixed' ? 'mixed' : 'simple');
                      setIsCustomRotationModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold text-azul-blue dark:text-sky-400 bg-azul-blue/10 dark:bg-sky-950/40 hover:bg-azul-blue/20 dark:hover:bg-sky-900/50 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="Definir ciclo personalizado o rotación mixta"
                  >
                    <Pencil size={11} className="stroke-[2.5]" />
                    <span>{rotationType === 'mixed' ? `Mixta (${formatMixedRotationShortLabel(mixedConfig)})` : `Personalizar / Mixta`}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 w-full">
                  <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-full p-1 flex-1 select-none gap-0.5">
                    {(['6x3', '4x4'] as const).map((cycle) => {
                      const isSel = rotationType === cycle;
                      return (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => {
                            setRotationType(cycle);
                          }}
                          className={cn(
                            "flex-1 py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                            isSel 
                              ? "bg-[#0f172a] dark:bg-slate-800 text-white dark:text-white shadow-md shadow-slate-950/15 dark:border dark:border-slate-700"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                        >
                          {cycle.toUpperCase()}
                        </button>
                      );
                    })}
                    {/* Botón de ciclo personalizado */}
                    {(() => {
                      const customLabel = `${customWorkDays}x${customFreeDays}`;
                      const isCustomSel = rotationType === 'custom' || rotationType === customLabel;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setRotationType(customLabel);
                          }}
                          className={cn(
                            "flex-1 py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                            isCustomSel 
                              ? "bg-[#0f172a] dark:bg-slate-800 text-white dark:text-white shadow-md shadow-slate-950/15 dark:border dark:border-slate-700"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                        >
                          {customLabel.toUpperCase()}
                        </button>
                      );
                    })()}
                    {/* Botón de rotación mixta */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!settings.mixedRotation && !currentRotation.mixedConfig) {
                          setCustomModalInitialMode('mixed');
                          setIsCustomRotationModalOpen(true);
                        } else {
                          setRotationType('mixed');
                        }
                      }}
                      className={cn(
                        "flex-1 py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                        rotationType === 'mixed'
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                      title="Rotación mixta (ej. 5x2 y después 6x3)"
                    >
                      MIXTA
                    </button>
                  </div>

                  {/* Botón (lápiz) independiente */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModalInitialMode(rotationType === 'mixed' ? 'mixed' : 'simple');
                      setIsCustomRotationModalOpen(true);
                    }}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-azul-blue dark:hover:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title="Definir ciclo de rotación personalizado o mixto"
                    aria-label="Definir ciclo de rotación personalizado o mixto"
                  >
                    <Pencil size={14} className="stroke-[2.5]" />
                  </button>
                </div>

                {rotationType === 'mixed' && (
                  <div className="flex items-center justify-between gap-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl px-3 py-2 text-[10.5px]">
                    <div className="text-indigo-900 dark:text-indigo-200 font-bold">
                      <span>Mixta activa: <strong>{formatMixedRotationShortLabel(mixedConfig)}</strong></span>
                      <span className="block text-[9.5px] text-indigo-700/80 dark:text-indigo-300/80">
                        {mixedConfig.mode === 'by_date' && mixedConfig.switchDate
                          ? `Cambia a ${mixedConfig.secondWorkDays}x${mixedConfig.secondFreeDays} el ${safeFormat(parseISO(mixedConfig.switchDate), 'dd/MM/yyyy')}`
                          : `Alterna continuamente ${mixedConfig.firstWorkDays}x${mixedConfig.firstFreeDays} y ${mixedConfig.secondWorkDays}x${mixedConfig.secondFreeDays}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomModalInitialMode('mixed');
                        setIsCustomRotationModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black uppercase text-[9.5px] hover:bg-indigo-700 transition-colors cursor-pointer shrink-0"
                    >
                      Editar mixta
                    </button>
                  </div>
                )}
              </div>

              {/* Selector del Primer Bloque de Libranza del Mes */}
              <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      PRIMER BLOQUE DE LIBRANZA DEL MES DE{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        {monthOnlyName.toUpperCase()}
                      </span>:
                    </span>
                  </div>
                </div>

                {/* Selector visual directo de días del mes */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Pulsa directamente en el día del mes:
                  </span>
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
                    {Array.from({ length: daysInMonthCount }, (_, i) => i + 1).map(dayNum => {
                      const isSelected = firstFreeDay === dayNum;
                      const isFreeInRotation = previewFreeDaysInMonth.includes(dayNum);
                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => handleSelectFirstFreeDay(dayNum)}
                          className={cn(
                            "py-1.5 sm:py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer relative",
                            isSelected
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500 scale-105 z-10"
                              : isFreeInRotation
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-100"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                          )}
                          title={isSelected ? `Día ${dayNum} (Primer bloque de libranza seleccionado)` : isFreeInRotation ? `Día ${dayNum} (Libranza calculada)` : `Día ${dayNum}`}
                        >
                          {isSelected && (
                            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-300" />
                          )}
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selector de Posición de la Fina Línea Verde (Integrado entre el calendario y el efecto visual) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Visualizar la fina línea verde en:
                  </label>
                  <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-full p-1 w-full select-none gap-1">
                    {[
                      { id: 'top' as const, label: 'Arriba' },
                      { id: 'bottom' as const, label: 'Abajo' }
                    ].map((pos) => {
                      const isSel = linePosition === pos.id;
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => {
                            setLinePosition(pos.id);
                          }}
                          className={cn(
                            "py-1.5 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                            isSel 
                              ? "bg-[#0f172a] dark:bg-slate-800 text-white shadow-md shadow-slate-950/15 dark:border dark:border-slate-700"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                        >
                          {pos.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Muestra visual de la fina línea verde con degradado difuminado */}
                <div className="pt-1 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Efecto visual:
                  </span>
                  <div className="relative w-12 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center shadow-xs">
                    {linePosition === 'top' && (
                      <>
                        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-emerald-500/45 via-emerald-500/18 via-45% to-transparent pointer-events-none" />
                        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-emerald-500 shadow-xs" />
                      </>
                    )}
                    {linePosition === 'bottom' && (
                      <>
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-emerald-500/45 via-emerald-500/18 via-45% to-transparent pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-emerald-500 shadow-xs" />
                      </>
                    )}
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 z-10">{firstFreeDay}</span>
                  </div>
                  <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                    {linePosition === 'top'
                      ? 'Fina línea verde superior con degradado vertical difuminado'
                      : 'Fina línea verde inferior con degradado vertical difuminado'}
                  </span>
                </div>
              </div>
            </div>

              {/* Botón Volver y Guardar y cerrar */}
              <div className="flex justify-between items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCurrentView('grid')}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 transition-colors cursor-pointer"
                >
                  ← Volver a Ajustes
                </button>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setRotationEnabled(true);
                      handleSaveAndSync({
                        ...(rotationType === 'mixed' ? { mixedRotation: mixedConfig } : {}),
                        calendarRotation: {
                          ...currentRotation,
                          enabled: true,
                          type: rotationType,
                          anchorDate: rotationType === 'mixed' ? mixedConfig.firstAnchorDate : getAnchorDateString(firstFreeDay),
                          firstFreeDay,
                          effectiveFromMonth: monthKey,
                          linePosition,
                          ...(rotationType === 'mixed' ? { mixedConfig } : {}),
                        }
                      });
                      if (onShowToast) {
                        onShowToast({
                          type: 'success',
                          title: 'Libranzas guardadas',
                          desc: `Libranzas guardadas y activadas para ${monthName} (${linePosition === 'top' ? 'arriba' : 'abajo'}).`
                        });
                      }
                      onClose();
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>Guardar y cerrar</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-VENTANA 4: AUTOCOMPLETAR TURNOS (MAÑANAS Y TARDES) */}
          {/* ======================================================== */}
          {currentView === 'autoshifts' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className={cn("space-y-4", isLocked && "pointer-events-none opacity-60 select-none")}>
              {/* Referencia de rotación utilizada */}
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-xs font-black text-purple-900 dark:text-purple-200 block">
                    Rotación vinculada: {rotationType === 'mixed' ? `Mixta (${formatMixedRotationShortLabel(mixedConfig)})` : rotationType}
                  </span>
                  <span className="text-[10px] text-purple-700 dark:text-purple-300 block">
                    {rotationType === 'mixed'
                      ? (mixedConfig.mode === 'by_date' && mixedConfig.switchDate
                          ? `Cambio el ${safeFormat(parseISO(mixedConfig.switchDate), 'dd/MM/yyyy')} · ${mixedConfig.firstWorkDays}x${mixedConfig.firstFreeDays} → ${mixedConfig.secondWorkDays}x${mixedConfig.secondFreeDays}`
                          : `Ciclo alterno continuo (${mixedConfig.firstWorkDays}x${mixedConfig.firstFreeDays} + ${mixedConfig.secondWorkDays}x${mixedConfig.secondFreeDays})`)
                      : `Primer bloque de libranza en ${monthName}: Día ${firstFreeDay}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModalInitialMode('mixed');
                      setIsCustomRotationModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    Mixta
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('libranzas')}
                    className="px-2.5 py-1 rounded-lg bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100 font-bold text-[10px] hover:bg-purple-300 transition-colors cursor-pointer"
                  >
                    Cambiar rotación
                  </button>
                </div>
              </div>

              {/* Sección de Turnos Guardados (Plantillas como en Horarios/Jornada) */}
              <div id="autoshifts-plantillas-box" className="bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden transition-all">
                <div className="w-full p-3 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-800/80">
                  <span className="text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500 fill-amber-500/20" />
                    Turnos Guardados
                    {shiftTemplates.length > 0 && (
                      <span className="text-[8.5px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.2 rounded-full">
                        {shiftTemplates.length}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingTemplate(!isCreatingTemplate);
                        setIsManagingTemplates(false);
                      }}
                      className={cn(
                        "text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all cursor-pointer",
                        isCreatingTemplate
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-purple-700 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-slate-650"
                      )}
                    >
                      {isCreatingTemplate ? 'Cerrar' : '+ Nueva'}
                    </button>
                    {shiftTemplates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsManagingTemplates(!isManagingTemplates);
                          setIsCreatingTemplate(false);
                        }}
                        className={cn(
                          "text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all cursor-pointer",
                          isManagingTemplates
                            ? "bg-rose-500 text-white"
                            : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-650"
                        )}
                      >
                        {isManagingTemplates ? 'Listo' : 'Editar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 space-y-3">
                  {/* Formulario para añadir nueva plantilla */}
                  <AnimatePresence initial={false}>
                    {isCreatingTemplate && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 mb-2 shadow-xs">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                            Crear nuevo turno guardado:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={newTplStart}
                              onChange={(e) => setNewTplStart(e.target.value)}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-slate-800 dark:text-slate-100"
                            />
                            <span className="text-slate-400 font-bold">→</span>
                            <input
                              type="time"
                              value={newTplEnd}
                              onChange={(e) => setNewTplEnd(e.target.value)}
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-slate-800 dark:text-slate-100"
                            />
                          </div>

                          {/* Selector de categoría (Mañanas o Tardes) con botones más grandes */}
                          <div className="space-y-1 pt-0.5">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                              Guardar en la sección:
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setNewTplCategory('manana')}
                                className={cn(
                                  "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                  (newTplCategory === 'manana' || (newTplCategory === 'auto' && parseInt((newTplStart || '07:00').split(':')[0], 10) < 14))
                                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
                                )}
                              >
                                <Sun size={15} />
                                <span>Mañanas</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewTplCategory('tarde')}
                                className={cn(
                                  "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                  (newTplCategory === 'tarde' || (newTplCategory === 'auto' && parseInt((newTplStart || '07:00').split(':')[0], 10) >= 14))
                                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-400/50"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
                                )}
                              >
                                <Sunset size={15} />
                                <span>Tardes</span>
                              </button>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingTemplate(false);
                                setNewTplCategory('auto');
                              }}
                              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!newTplStart || !newTplEnd) return;
                                const autoCat: 'manana' | 'tarde' = parseInt((newTplStart || '07:00').split(':')[0], 10) >= 14 ? 'tarde' : 'manana';
                                const finalCat: 'manana' | 'tarde' = newTplCategory === 'auto' ? autoCat : newTplCategory;
                                const created: ShiftTemplate = {
                                  id: `tpl-${Date.now()}`,
                                  shifts: [{ start: newTplStart, end: newTplEnd }],
                                  category: finalCat
                                };
                                updateShiftTemplates([...shiftTemplates, created]);
                                setNewTplCategory('auto');
                                setIsCreatingTemplate(false);
                                if (finalCat === 'manana') {
                                  setIsMorningOpen(true);
                                } else {
                                  setIsAfternoonOpen(true);
                                }
                                if (onShowToast) {
                                  onShowToast({
                                    type: 'success',
                                    title: 'Turno guardado',
                                    desc: `${newTplStart} → ${newTplEnd} (${finalCat === 'manana' ? 'Mañanas' : 'Tardes'})`
                                  });
                                }
                              }}
                              className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/25 active:scale-95 cursor-pointer transition-all"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Listado de turnos separados en dos mini secciones: Mañanas y Tardes (Desplegables) */}
                  {shiftTemplates.length > 0 ? (
                    <div className="space-y-2.5">
                      {/* Mini-sección Mañanas (Desplegable, recogida por defecto) */}
                      <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 overflow-hidden transition-all">
                        <button
                          type="button"
                          onClick={() => setIsMorningOpen(!isMorningOpen)}
                          className="w-full p-2.5 flex items-center justify-between text-left transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-900/30 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2">
                            <Sun size={14} className="text-amber-500 shrink-0" />
                            <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                              Mañanas
                            </span>
                            <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700 px-1.5 py-0.2 rounded-full">
                              {morningTemplates.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-400 hidden xs:inline">Ordenados por hora</span>
                            <ChevronDown
                              size={15}
                              className={cn(
                                "transition-transform duration-200 text-amber-600 dark:text-amber-400",
                                isMorningOpen && "rotate-180"
                              )}
                            />
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isMorningOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-2.5 pt-0 border-t border-amber-200/60 dark:border-amber-900/30">
                                {morningTemplates.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-2 pt-2">
                                    {morningTemplates.map((tpl) => renderTemplateCard(tpl, 'manana'))}
                                  </div>
                                ) : (
                                  <div className="p-3 text-center rounded-xl bg-white/60 dark:bg-slate-900/40 border border-dashed border-amber-200 dark:border-amber-800 text-[10px] font-bold text-slate-400 mt-2">
                                    No hay turnos de mañana guardados.
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Mini-sección Tardes (Desplegable, recogida por defecto) */}
                      <div className="rounded-xl border border-orange-200/80 dark:border-orange-900/40 bg-orange-50/30 dark:bg-orange-950/20 overflow-hidden transition-all">
                        <button
                          type="button"
                          onClick={() => setIsAfternoonOpen(!isAfternoonOpen)}
                          className="w-full p-2.5 flex items-center justify-between text-left transition-colors hover:bg-orange-100/50 dark:hover:bg-orange-900/30 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2">
                            <Sunset size={14} className="text-orange-500 shrink-0" />
                            <span className="text-xs font-black uppercase tracking-wider text-orange-900 dark:text-orange-200">
                              Tardes
                            </span>
                            <span className="text-[9px] font-black bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300 border border-orange-300/80 dark:border-orange-700 px-1.5 py-0.2 rounded-full">
                              {afternoonTemplates.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-400 hidden xs:inline">Ordenados por hora</span>
                            <ChevronDown
                              size={15}
                              className={cn(
                                "transition-transform duration-200 text-orange-600 dark:text-orange-400",
                                isAfternoonOpen && "rotate-180"
                              )}
                            />
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isAfternoonOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-2.5 pt-0 border-t border-orange-200/60 dark:border-orange-900/30">
                                {afternoonTemplates.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-2 pt-2">
                                    {afternoonTemplates.map((tpl) => renderTemplateCard(tpl, 'tarde'))}
                                  </div>
                                ) : (
                                  <div className="p-3 text-center rounded-xl bg-white/60 dark:bg-slate-900/40 border border-dashed border-orange-200 dark:border-orange-800 text-[10px] font-bold text-slate-400 mt-2">
                                    No hay turnos de tarde guardados.
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-white/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-700/80 text-center space-y-1">
                      <p className="text-xs font-black text-slate-600 dark:text-slate-300">
                        No hay ningún turno guardado
                      </p>
                      <p className="text-[10.5px] font-medium text-slate-400">
                        Pulsa en <strong className="text-purple-600 dark:text-purple-400 font-bold">+ Nueva</strong> para guardar tus turnos de Mañanas o Tardes.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen de turnos configurados para aplicar */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Sun size={15} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Turno Mañanas
                    </span>
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-100">
                      {morningStart} → {morningEnd}
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <Sunset size={15} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Turno Tardes
                    </span>
                    <span className="block text-xs font-black text-slate-800 dark:text-slate-100">
                      {afternoonStart} → {afternoonEnd}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* Botones de acción */}
              <div className="flex justify-between items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCurrentView('grid')}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 transition-colors cursor-pointer"
                >
                  ← Volver a Ajustes
                </button>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyShiftsToMonth();
                      onClose();
                    }}
                    className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Calendar size={15} />
                    <span>Rellenar y cerrar</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-VENTANA 5: CAMBIAR TURNO (SOLICITAR + NOTIFICACIONES) */}
          {/* ======================================================== */}
          {currentView === 'swap' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              {!user ? (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <Users size={26} className="mx-auto text-azul-blue" />
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">
                    Inicia sesión para usar Compartir/Colab.
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Para enviar o recibir solicitudes de cambio de turno necesitas haber iniciado sesión y tener acceso en Compartir/Colab. → Accesos.
                  </p>
                </div>
              ) : swapSubView === 'menu' ? (
                /* MENÚ DE CAMBIAR TURNO: DOS BOTONES PRINCIPALES */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Botón 1: Solicitar cambio de turno */}
                    <button
                      type="button"
                      onClick={() => {
                        setSwapSubView('request');
                        setIsCreatingNewSwapRequest(false);
                      }}
                      className="p-4 sm:p-5 rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50/70 dark:bg-sky-950/25 hover:border-sky-400 transition-all active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs group relative min-h-[145px]"
                    >
                      {(pendingReceivedCount > 0 || pendingSentCount > 0) && (
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                          {pendingReceivedCount > 0
                            ? `${pendingReceivedCount} recibida${pendingReceivedCount === 1 ? '' : 's'}`
                            : `${pendingSentCount} pendiente${pendingSentCount === 1 ? '' : 's'}`}
                        </span>
                      )}
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm bg-azul-blue text-white transition-transform group-hover:scale-105">
                        <ArrowLeftRight size={23} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight block leading-tight">
                          Solicitar cambio de turno
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mt-1">
                          Enviadas y recibidas con compañeros
                        </span>
                      </div>
                    </button>

                    {/* Botón 2: Notificaciones (icono carta postal) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSwapSubView('notifications');
                        if (unreadSwapCount > 0) {
                          onMarkSwapNotificationsRead?.();
                        }
                      }}
                      className="p-4 sm:p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/25 hover:border-emerald-400 transition-all active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs group relative min-h-[145px]"
                    >
                      {unreadSwapCount > 0 && (
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-emerald-600 text-white shadow-xs animate-pulse">
                          {unreadSwapCount} nueva{unreadSwapCount === 1 ? '' : 's'}
                        </span>
                      )}
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm bg-emerald-600 text-white transition-transform group-hover:scale-105 relative">
                        <Mail size={23} className="stroke-[2.3]" />
                        {unreadSwapCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-85" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white dark:border-slate-900" />
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight block leading-tight">
                          Notificaciones
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mt-1">
                          {swapNotifications.length > 0
                            ? `${swapNotifications.length} aviso${swapNotifications.length === 1 ? '' : 's'} de cambio`
                            : 'Sin avisos recientes'}
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex justify-start items-center pt-1">
                    <button
                      type="button"
                      onClick={() => setCurrentView('grid')}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 transition-colors cursor-pointer"
                    >
                      ← Volver a Ajustes
                    </button>
                  </div>
                </div>
              ) : swapSubView === 'notifications' ? (
                /* SUB-VISTA: NOTIFICACIONES */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <Mail size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Avisos de cambios de turno ({swapNotifications.length})</span>
                    </span>
                    {unreadSwapCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onMarkSwapNotificationsRead?.()}
                        className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        Marcar vistas
                      </button>
                    )}
                  </div>

                  {swapNotifications.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                      <Mail size={26} className="mx-auto text-slate-400" />
                      <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                        No tienes notificaciones
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Aquí aparecerán las solicitudes de cambio de turno que recibas y las respuestas a tus solicitudes.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {swapNotifications.map((notif) => {
                        const origDateObj = parseISO(notif.myOriginalDate);
                        const covDateObj = parseISO(notif.coveredDate);
                        const origLabel = isValid(origDateObj) ? safeFormat(origDateObj, 'd MMM', { locale: es }) : notif.myOriginalDate;
                        const covLabel = isValid(covDateObj) ? safeFormat(covDateObj, 'd MMM', { locale: es }) : notif.coveredDate;
                        const covShiftLabel = (notif.coveredShifts || [])
                          .filter(s => s && s.start && s.end)
                          .map(s => `${s.start}-${s.end}`)
                          .join('/');
                        const linkedReceivedReq = notif.requestId
                          ? receivedSwapRequests.find(r => r.id === notif.requestId)
                          : undefined;
                        const linkedSentReq = notif.requestId
                          ? sentSwapRequests.find(r => r.id === notif.requestId)
                          : undefined;
                        const effectiveStatus = linkedReceivedReq?.status || linkedSentReq?.status || notif.status;
                        const isPendingRequest =
                          notif.type === 'shift_swap_request' &&
                          linkedReceivedReq?.status === 'pending';
                        const isUndo = notif.type === 'shift_swap_undo' || effectiveStatus === 'undone';
                        const isAccepted = !isUndo && (notif.type === 'shift_swap_accepted' || effectiveStatus === 'accepted');
                        const isRejected = !isUndo && (notif.type === 'shift_swap_rejected' || effectiveStatus === 'rejected');
                        const isPendingBadge = notif.type === 'shift_swap_request' && !isUndo && !isAccepted && !isRejected;
                        const isBusy = !!notif.requestId && respondingSwapReqId === notif.requestId;

                        return (
                          <div
                            key={notif.id}
                            className={cn(
                              "p-3 rounded-2xl border text-left space-y-2 transition-all",
                              !notif.read
                                ? "bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                                : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {!notif.read && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  )}
                                  <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                    {notif.senderName}
                                  </span>
                                  <span className={cn(
                                    "text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded-md inline-flex items-center gap-1",
                                    isUndo
                                      ? "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300"
                                      : isRejected
                                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                        : isPendingBadge
                                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                          : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                  )}>
                                    {isUndo && <RotateCcw size={10} />}
                                    {isPendingBadge && <Clock size={10} />}
                                    {isAccepted && <CheckCircle2 size={10} />}
                                    {isRejected && <XCircle size={10} />}
                                    {isUndo
                                      ? 'Deshecho'
                                      : isRejected
                                        ? 'Rechazada'
                                        : isPendingBadge
                                          ? 'Pendiente'
                                          : isAccepted
                                            ? 'Aceptada'
                                            : 'Cambio aplicado'}
                                  </span>
                                </div>
                                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-snug mt-1">
                                  {isUndo
                                    ? `Restaurado tu turno del ${origLabel}.`
                                    : notif.type === 'shift_swap_request'
                                      ? `Te solicita cambiar tu turno del ${origLabel} por su turno del ${covLabel}${covShiftLabel ? ` (${covShiftLabel})` : ''}.`
                                      : notif.type === 'shift_swap_accepted'
                                        ? `Aceptó cambiar tu ${origLabel} por su ${covLabel}${covShiftLabel ? ` (${covShiftLabel})` : ''}.`
                                        : notif.type === 'shift_swap_rejected'
                                          ? `Rechazó cambiar tu ${origLabel} por su ${covLabel}.`
                                          : `Cambiado tu ${origLabel} por su ${covLabel}${covShiftLabel ? ` (${covShiftLabel})` : ''}.`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onDeleteSwapNotification?.(notif.id)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                                title="Eliminar notificación"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {isPendingRequest && notif.requestId && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => onRespondSwapRequest?.(notif.requestId!, 'accepted')}
                                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                >
                                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
                                  <span>Aceptar</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => onRespondSwapRequest?.(notif.requestId!, 'rejected')}
                                  className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-950/80 disabled:opacity-50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <X size={13} />
                                  <span>Rechazar</span>
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!notif.read) onMarkSingleSwapNotificationRead?.(notif.id);
                                  onJumpToDate?.(isValid(covDateObj) ? notif.coveredDate : notif.myOriginalDate);
                                }}
                                className="text-[10px] font-black uppercase tracking-wider text-azul-blue dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <CalendarDays size={12} />
                                <span>Ver en calendario</span>
                              </button>
                              {!notif.read && (
                                <button
                                  type="button"
                                  onClick={() => onMarkSingleSwapNotificationRead?.(notif.id)}
                                  className="text-[9.5px] font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
                                >
                                  <Check size={11} />
                                  <span>Marcar vista</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-start items-center pt-1">
                    <button
                      type="button"
                      onClick={() => setSwapSubView('menu')}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 transition-colors cursor-pointer"
                    >
                      ← Volver a Cambiar Turno
                    </button>
                  </div>
                </div>
              ) : (
                /* SUB-VISTA: SOLICITAR CAMBIO DE TURNO (PESTAÑAS ENVIADAS Y RECIBIDAS) */
                <div className="space-y-4">
                  {/* Dos pestañas: Enviadas (avión de papel) y Recibidas (bandeja de entrada) */}
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setRequestTab('sent');
                        setIsCreatingNewSwapRequest(false);
                      }}
                      className={cn(
                        "py-2.5 px-3 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        requestTab === 'sent'
                          ? "bg-white dark:bg-slate-800 text-azul-blue dark:text-sky-400 shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      <Send size={13} className="shrink-0" />
                      <span>Enviadas</span>
                      {sentSwapRequests.length > 0 && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full text-[8.5px] font-black",
                          requestTab === 'sent'
                            ? "bg-azul-blue/10 text-azul-blue dark:text-sky-300"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        )}>
                          {sentSwapRequests.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRequestTab('received');
                        setIsCreatingNewSwapRequest(false);
                        if (unreadSwapCount > 0) {
                          onMarkSwapNotificationsRead?.();
                        }
                      }}
                      className={cn(
                        "py-2.5 px-3 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        requestTab === 'received'
                          ? "bg-white dark:bg-slate-800 text-azul-blue dark:text-sky-400 shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      <Inbox size={13} className="shrink-0" />
                      <span>Recibidas</span>
                      {pendingReceivedCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-amber-500 text-white animate-pulse">
                          {pendingReceivedCount}
                        </span>
                      ) : receivedSwapRequests.length > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {receivedSwapRequests.length}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  {requestTab === 'sent' ? (
                    /* PESTAÑA ENVIADAS: PRIMERO ESTADO DE SOLICITUDES + BOTÓN NUEVA SOLICITUD */
                    <div className="space-y-4">
                      {!isCreatingNewSwapRequest ? (
                        <>
                          {/* 1. Estado de las solicitudes enviadas */}
                          <div className="bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <Send size={12} className="text-azul-blue dark:text-sky-400" />
                                Estado de mis solicitudes enviadas ({sentSwapRequests.length})
                              </span>
                            </div>

                            {sentSwapRequests.length === 0 ? (
                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 text-center py-3">
                                Todavía no has enviado ninguna solicitud de cambio de turno.
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                                {sentSwapRequests.map((req) => {
                                  const sDateObj = parseISO(req.senderDate);
                                  const rDateObj = parseISO(req.recipientDate);
                                  const sLabel = isValid(sDateObj) ? safeFormat(sDateObj, 'd MMM', { locale: es }) : req.senderDate;
                                  const rLabel = isValid(rDateObj) ? safeFormat(rDateObj, 'd MMM', { locale: es }) : req.recipientDate;
                                  const sShiftTxt = (req.senderShifts || []).filter(s => s.start && s.end).map(s => `${s.start}-${s.end}`).join('/');
                                  const rShiftTxt = (req.recipientShifts || []).filter(s => s.start && s.end).map(s => `${s.start}-${s.end}`).join('/');
                                  const matchingShiftInCal = shifts.find(s => s.swapInfo?.requestId === req.id);

                                  return (
                                    <div
                                      key={req.id}
                                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                              Para: {req.recipientName}
                                            </span>
                                            <span className={cn(
                                              "text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded-md inline-flex items-center gap-1",
                                              req.status === 'pending'
                                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                                : req.status === 'accepted'
                                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                                  : req.status === 'undone'
                                                    ? "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300"
                                                    : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                            )}>
                                              {req.status === 'pending' && <Clock size={10} />}
                                              {req.status === 'accepted' && <CheckCircle2 size={10} />}
                                              {req.status === 'undone' && <RotateCcw size={10} />}
                                              {req.status === 'rejected' && <XCircle size={10} />}
                                              {req.status === 'pending'
                                                ? 'Pendiente'
                                                : req.status === 'accepted'
                                                  ? 'Aceptada'
                                                  : req.status === 'undone'
                                                    ? 'Deshecho'
                                                    : 'Rechazada'}
                                            </span>
                                          </div>
                                          <p className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                                            Tu <strong>{sLabel}</strong>{sShiftTxt ? ` (${sShiftTxt})` : ''} ↔ Su <strong>{rLabel}</strong>{rShiftTxt ? ` (${rShiftTxt})` : ''}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (req.status === 'pending' && matchingShiftInCal && onUndoShiftSwap) {
                                              onUndoShiftSwap(matchingShiftInCal.date);
                                            } else {
                                              onDeleteSwapRequest?.(req.id);
                                            }
                                          }}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                                          title={req.status === 'pending' ? 'Cancelar solicitud' : 'Eliminar registro'}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>

                                      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                                        {req.status === 'undone' ? (
                                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            ↺ Cambio deshecho · Turno original restaurado
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => onJumpToDate?.(req.recipientDate)}
                                            className="text-[9.5px] font-black uppercase tracking-wider text-azul-blue dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                                          >
                                            <CalendarDays size={11} />
                                            <span>Ver en calendario</span>
                                          </button>
                                        )}
                                        {req.status !== 'undone' && matchingShiftInCal && onUndoShiftSwap && !isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => onUndoShiftSwap(matchingShiftInCal.date)}
                                            className="text-[9.5px] font-black uppercase tracking-wider text-rose-600 hover:underline cursor-pointer"
                                          >
                                            {req.status === 'pending'
                                              ? 'Cancelar solicitud'
                                              : req.status === 'rejected'
                                                ? 'Restaurar turno'
                                                : 'Deshacer cambio'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 2. Botón para crear una nueva solicitud de cambio */}
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingNewSwapRequest(true);
                                setSelectedCollabCalDate(null);
                              }}
                              className="w-full py-3.5 px-4 rounded-2xl bg-azul-blue hover:bg-azul-blue/90 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider shadow-md shadow-azul-blue/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Plus size={16} className="stroke-[2.8]" />
                              <span>Crear nueva solicitud de cambio</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Cabecera del asistente de nueva solicitud */}
                          <div className="flex items-center justify-between gap-2 px-1">
                            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              <Plus size={14} className="text-azul-blue dark:text-sky-400" />
                              <span>Nueva solicitud de cambio</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingNewSwapRequest(false);
                                setSelectedCollabCalDate(null);
                              }}
                              className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-azul-blue dark:text-slate-400 dark:hover:text-sky-400 cursor-pointer"
                            >
                              ← Ver enviadas
                            </button>
                          </div>

                          {/* Paso 1: Elegir usuario de Compartir/Colab. */}
                          <div className="bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-800/60 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-sky-900 dark:text-sky-200 uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={13} className="text-azul-blue dark:text-sky-400" />
                            1. Compañero (Compartir/Colab.)
                          </span>
                          {isLoadingCollabUsers && (
                            <Loader2 size={14} className="animate-spin text-azul-blue dark:text-sky-400" />
                          )}
                        </div>

                        {collabUsers.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {collabUsers.map((collab) => {
                                const isSelected = selectedCollabUid === collab.ownerUid;
                                const isLoadingThis = loadingCollabUid === collab.ownerUid;
                                const isMutual = !!mutualCollabUids[collab.ownerUid];
                                return (
                                  <button
                                    key={collab.ownerUid}
                                    type="button"
                                    onClick={() => handleSelectCollab(collab)}
                                    disabled={isLoadingThis}
                                    className={cn(
                                      "px-3 py-1.5 rounded-xl text-[10.5px] font-black transition-all flex items-center gap-1.5 border cursor-pointer active:scale-95",
                                      isSelected
                                        ? "bg-azul-blue text-white border-azul-blue shadow-xs"
                                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-sky-200 dark:border-slate-700 hover:border-azul-blue/60"
                                    )}
                                  >
                                    {isLoadingThis ? (
                                      <Loader2 size={12} className="animate-spin shrink-0" />
                                    ) : (
                                      <UserCheck size={12} className="shrink-0" />
                                    )}
                                    <span className="truncate max-w-[160px]">
                                      {collab.ownerName || collab.ownerEmail || 'Compañero'}
                                    </span>
                                    {isMutual && (
                                      <span
                                        className={cn(
                                          "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0",
                                          isSelected
                                            ? "bg-white/20 text-white"
                                            : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                        )}
                                      >
                                        Mutuo
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {selectedCollabUid && (
                              <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 pt-0.5 leading-snug">
                                <Send size={11} className="shrink-0" />
                                <span>
                                  Al solicitar el cambio, tu compañero recibirá una notificación para aceptarlo o rechazarlo.
                                </span>
                              </p>
                            )}
                          </>
                        ) : !isLoadingCollabUsers ? (
                          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-snug">
                            No tienes acceso a ningún usuario en <strong>Compartir/Colab. → Accesos</strong>. Pídele a tu compañero que te autorice o introduce su llave de acceso en Compartir/Colab.
                          </p>
                        ) : null}

                        {collabLoadError && (
                          <p className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400">{collabLoadError}</p>
                        )}
                      </div>

                      {/* Paso 2: Calendario mensual propio para pinchar el día */}
                      <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={13} className="text-azul-blue dark:text-sky-400" />
                            2. Pincha en el día de {monthOnlyName} que quieres cambiar
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            Tu calendario
                          </span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center">
                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((wd, idx) => (
                            <span
                              key={wd}
                              className={cn(
                                "text-[9px] font-black uppercase py-1",
                                idx === 6 ? "text-rose-500" : "text-slate-400"
                              )}
                            >
                              {wd}
                            </span>
                          ))}
                          {Array.from({ length: swapLeadingEmptyCount }).map((_, idx) => (
                            <div key={`empty-${idx}`} />
                          ))}
                          {swapMonthDays.map((dayObj) => {
                            const iso = safeFormat(dayObj, 'yyyy-MM-dd');
                            const dayNum = getDate(dayObj);
                            const dayShift = shifts.find(s => s.date === iso);
                            const validShifts = (dayShift?.shifts || []).filter(s => s && s.start && s.end);
                            const isVacation = settings.vacations.includes(iso) || dayShift?.type === 'Vacaciones';
                            const isBaja = dayShift?.type === 'Baja IT';
                            const isAus = dayShift?.type === 'Ausencia Justificada';
                            const isSind = dayShift?.type === 'Horas Sindicales';
                            const isCeded = !!(dayShift?.swapInfo?.cededToCoworker && !dayShift?.swapInfo?.coveringCoworker);
                            const isCovering = !!dayShift?.swapInfo?.coveringCoworker;
                            const daySwapStatus = dayShift?.swapInfo?.status;
                            const isSelected = selectedSwapMyDate === iso;
                            const isSunday = dayObj.getDay() === 0;
                            const rot = getRotationForMonth(dayObj, settings);
                            const isFreeRot = rot?.enabled ? isRotationFreeDay(dayObj, rot) : false;

                            const isCededAcceptedCleared = isCeded && (daySwapStatus === 'accepted' || validShifts.length === 0);

                            let shortBadge = '—';
                            if (isCeded && !isCededAcceptedCleared) shortBadge = 'CED';
                            else if (isVacation) shortBadge = 'VAC';
                            else if (isBaja) shortBadge = 'BAJ';
                            else if (isAus) shortBadge = 'AUS';
                            else if (isSind) shortBadge = 'SIND';
                            else if (validShifts.length > 0) {
                              shortBadge = `${validShifts[0].start.slice(0, 2)}-${validShifts[0].end.slice(0, 2)}`;
                            } else if (isFreeRot) {
                              shortBadge = 'LIB';
                            }

                            return (
                              <button
                                key={iso}
                                type="button"
                                onClick={() => {
                                  setSelectedSwapMyDate(iso);
                                  setSelectedCollabCalDate(null);
                                }}
                                className={cn(
                                  "py-1.5 px-0.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center min-h-[46px] relative",
                                  isSelected
                                    ? "bg-azul-blue text-white border-azul-blue ring-2 ring-azul-blue/40 shadow-md scale-[1.03] z-10"
                                    : isCovering
                                      ? daySwapStatus === 'pending'
                                        ? "bg-amber-50 dark:bg-amber-950/35 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 border-dashed"
                                        : daySwapStatus === 'rejected'
                                          ? "bg-rose-50 dark:bg-rose-950/35 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700"
                                          : "bg-slate-200/80 dark:bg-slate-700/80 text-slate-900 dark:text-white border-emerald-400 dark:border-emerald-600"
                                      : isCeded && !isCededAcceptedCleared
                                        ? "bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/60"
                                        : isVacation
                                          ? "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800/50"
                                          : validShifts.length > 0
                                            ? "bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-azul-blue/50"
                                            : isFreeRot
                                              ? "bg-emerald-50/60 dark:bg-emerald-950/25 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50"
                                              : "bg-white dark:bg-slate-900/30 text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-50"
                                )}
                              >
                                {(isCovering || isCeded) && !isSelected && (
                                  <span className="absolute top-0.5 right-0.5">
                                    {daySwapStatus === 'pending' ? (
                                      <Clock size={8} className="text-amber-600" />
                                    ) : daySwapStatus === 'accepted' ? (
                                      <CheckCircle2 size={8} className="text-emerald-600" />
                                    ) : daySwapStatus === 'rejected' ? (
                                      <XCircle size={8} className="text-rose-600" />
                                    ) : (
                                      <span className="block w-1.5 h-1.5 rounded-full bg-azul-blue" />
                                    )}
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[11px] font-black leading-none",
                                  !isSelected && isSunday && "text-rose-500"
                                )}>
                                  {dayNum}
                                </span>
                                <span className={cn(
                                  "text-[8px] font-black leading-none mt-1 tracking-tighter",
                                  isSelected ? "text-white/90" : "opacity-80"
                                )}>
                                  {shortBadge}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Paso 3: Compatibilidad con el compañero para el día pinchado */}
                      {selectedSwapMyDate && (() => {
                        const myDateObj = parseISO(selectedSwapMyDate);
                        const myDayObj = shifts.find(s => s.date === selectedSwapMyDate);
                        const myOriginalOrCurrentShifts = (myDayObj?.swapInfo?.originalShifts || myDayObj?.shifts || []).filter(s => s && s.start && s.end);
                        const myTotalHours = myOriginalOrCurrentShifts.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                        const selectedCollab = collabUsers.find(c => c.ownerUid === selectedCollabUid) || null;
                        const collabData = selectedCollab ? collabDataMap[selectedCollab.ownerUid] : undefined;

                        const cwVacations = Array.isArray(collabData?.vacations) ? collabData!.vacations : [];
                        const allCollabShifts = Array.isArray(collabData?.shifts) ? collabData!.shifts : [];

                        const candidates = allCollabShifts
                          .filter(cs =>
                            cs &&
                            typeof cs.date === 'string' &&
                            cs.date.startsWith(monthKey) &&
                            isValid(parseISO(cs.date)) &&
                            !cwVacations.includes(cs.date) &&
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
                            const isSameDaySwap = cs.date === selectedSwapMyDate;
                            const myExistingOnCand = shifts.find(s => s.date === cs.date);
                            const iAlreadyWorkOnCand = !isSameDaySwap && !!(
                              myExistingOnCand &&
                              (myExistingOnCand.shifts || []).some(sh => sh && sh.start && sh.end) &&
                              !(myExistingOnCand.swapInfo?.cededToCoworker && !myExistingOnCand.swapInfo?.coveringCoworker)
                            );

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
                              if (iso === selectedSwapMyDate) return undefined;
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

                            let coworkerRestViolation = false;
                            let coworkerMinRestHours = 99;
                            if (myOriginalOrCurrentShifts.length > 0) {
                              const simulatedCoworkerOnMyDay: DayShift = {
                                date: selectedSwapMyDate,
                                type: 'Laboral',
                                shifts: myOriginalOrCurrentShifts,
                                perentorias: { day: 0, night: 0 },
                                complementarias: { day: 0, night: 0 },
                                extraShifts: []
                              };
                              const getSimulatedCoworkerDay = (iso: string): DayShift | undefined => {
                                if (iso === selectedSwapMyDate) return simulatedCoworkerOnMyDay;
                                if (iso === cs.date) return undefined;
                                return allCollabShifts.find(s => s.date === iso);
                              };
                              const prevMyIso = safeFormat(addDays(myDateObj, -1), 'yyyy-MM-dd');
                              const nextMyIso = safeFormat(addDays(myDateObj, 1), 'yyyy-MM-dd');
                              const cwPrevRest = getRestBetweenDays(getSimulatedCoworkerDay(prevMyIso), simulatedCoworkerOnMyDay, cwVacations);
                              const cwNextRest = getRestBetweenDays(simulatedCoworkerOnMyDay, getSimulatedCoworkerDay(nextMyIso), cwVacations);
                              coworkerRestViolation = !!(cwPrevRest?.hasViolation || cwNextRest?.hasViolation);
                              coworkerMinRestHours = Math.min(
                                cwPrevRest ? cwPrevRest.restHours : 99,
                                cwNextRest ? cwNextRest.restHours : 99
                              );
                            }

                            const compliesBothRest = !myRestViolation && !coworkerRestViolation;
                            const isRecommended = !iAlreadyWorkOnCand && compliesBothRest && (myTotalHours === 0 || absHoursDiff <= 1.5);
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
                              myMinRestHours,
                              coworkerRestViolation,
                              coworkerMinRestHours,
                              compliesBothRest,
                              isRecommended,
                              score
                            };
                          })
                          .sort((a, b) => a.score - b.score || a.date.localeCompare(b.date));

                        const displayedCandidates = swapTab === 'best'
                          ? candidates.filter(c => !c.iAlreadyWorkOnCand)
                          : candidates;

                        const selectedCalCandidate = selectedCollabCalDate
                          ? candidates.find(c => c.date === selectedCollabCalDate) || null
                          : null;

                        const renderCandidateRow = (cand: typeof candidates[number]) => (
                          <div
                            key={cand.date}
                            className={cn(
                              "p-3 rounded-2xl border transition-all space-y-2",
                              cand.isRecommended
                                ? "bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-200/90 dark:border-emerald-800/60"
                                : cand.iAlreadyWorkOnCand
                                  ? "bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-75"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-black dark:text-white text-center min-w-[52px] shrink-0">
                                  <span className="block text-[8px] font-black uppercase leading-none">
                                    {safeFormat(cand.dateObj, 'EEE', { locale: es })}
                                  </span>
                                  <span className="block text-xs font-black leading-tight mt-0.5">
                                    {safeFormat(cand.dateObj, 'd MMM', { locale: es })}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-black text-black dark:text-white">
                                      {cand.shifts.map(s => `${s.start} → ${s.end}`).join(' / ')}
                                    </span>
                                    {cand.isRecommended && (
                                      <span className="text-[8px] font-black uppercase bg-emerald-500 text-white px-1.5 py-0.5 rounded-md">
                                        ★ Mejor opción
                                      </span>
                                    )}
                                    {cand.isSameDaySwap && (
                                      <span className="text-[8px] font-black uppercase bg-azul-blue/10 text-azul-blue dark:text-sky-400 px-1.5 py-0.5 rounded-md">
                                        Mismo día
                                      </span>
                                    )}
                                    {cand.iAlreadyWorkOnCand && (
                                      <span className="text-[8px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded-md">
                                        Ya trabajas este día
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    <span className={cn(
                                      "text-[8.5px] font-black px-1.5 py-0.5 rounded-md",
                                      cand.absHoursDiff <= 0.25
                                        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                                        : cand.absHoursDiff <= 1.5
                                          ? "bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300"
                                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
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
                                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                        : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                                    )}>
                                      {cand.myRestViolation
                                        ? `⚠️ Tu desc. <12h (${formatRestHours(cand.myMinRestHours)})`
                                        : '✅ Tu desc. ≥12h'}
                                    </span>
                                    {myOriginalOrCurrentShifts.length > 0 && (
                                      <span className={cn(
                                        "text-[8.5px] font-black px-1.5 py-0.5 rounded-md",
                                        cand.coworkerRestViolation
                                          ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                      )}>
                                        {cand.coworkerRestViolation
                                          ? `⚠️ Comp. <12h (${formatRestHours(cand.coworkerMinRestHours)})`
                                          : '✅ Comp. ≥12h'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {!isLocked && onExecuteShiftSwap && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onExecuteShiftSwap(
                                      selectedSwapMyDate,
                                      cand.date,
                                      cand.shifts,
                                      selectedCollab?.ownerName || selectedCollab?.ownerEmail || 'Compañero',
                                      'COLAB',
                                      selectedCollab?.ownerUid
                                    );
                                    setSelectedCollabCalDate(null);
                                    setIsCreatingNewSwapRequest(false);
                                  }}
                                  className="px-3 py-2 rounded-xl bg-azul-blue hover:bg-azul-blue/90 active:scale-95 text-white font-black text-[9.5px] uppercase tracking-wider shrink-0 transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  <Send size={11} />
                                  <span>Solicitar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );

                        return (
                          <div className="space-y-3">
                            {/* Resumen del día pinchado */}
                            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">
                                  Día seleccionado para cambiar
                                </span>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                  <span className="text-xs font-black text-slate-900 dark:text-white capitalize">
                                    {safeFormat(myDateObj, "EEEE d 'de' MMMM", { locale: es })}
                                  </span>
                                  <span className="text-[10px] font-black text-azul-blue dark:text-sky-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {myOriginalOrCurrentShifts.length > 0
                                      ? `${myOriginalOrCurrentShifts.map(s => `${s.start}-${s.end}`).join(' / ')} (${formatNumber(myTotalHours)}h)`
                                      : 'Sin turno propio'}
                                  </span>
                                </div>
                              </div>
                              {myDayObj?.swapInfo && !isLocked && onUndoShiftSwap && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUndoShiftSwap(selectedSwapMyDate);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 text-rose-600 border border-slate-200 dark:border-slate-700 hover:border-rose-200 text-[9.5px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                                >
                                  {myDayObj.swapInfo.status === 'pending'
                                    ? `Cancelar solicitud (${myDayObj.swapInfo.coworkerName})`
                                    : myDayObj.swapInfo.status === 'rejected'
                                      ? 'Restaurar turno'
                                      : `Deshacer cambio (${myDayObj.swapInfo.coworkerName})`}
                                </button>
                              )}
                            </div>

                            {selectedCollab ? (
                              loadingCollabUid === selectedCollab.ownerUid ? (
                                <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                                  <Loader2 size={22} className="animate-spin mx-auto text-azul-blue" />
                                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    Cargando turnos de {selectedCollab.ownerName || 'tu compañero'}...
                                  </p>
                                </div>
                              ) : collabData ? (
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between gap-2 px-1">
                                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                      3. Opciones con {selectedCollab.ownerName || 'Compañero'}
                                    </span>
                                    <span className="text-[9.5px] font-bold text-slate-400">
                                      {displayedCandidates.length} turnos en {monthOnlyName}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                                    {[
                                      { id: 'best' as const, label: 'Recomendados' },
                                      { id: 'all' as const, label: 'Todo el mes' },
                                      { id: 'calendar' as const, label: 'Calendario' }
                                    ].map((t) => (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setSwapTab(t.id)}
                                        className={cn(
                                          "py-2 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                          swapTab === t.id
                                            ? "bg-white dark:bg-slate-800 text-black dark:text-white shadow-2xs"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                        )}
                                      >
                                        {t.label}
                                      </button>
                                    ))}
                                  </div>

                                  {swapTab === 'calendar' ? (
                                    <div className="space-y-2.5">
                                      <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                                        <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
                                          <span>Calendario de {selectedCollab.ownerName}</span>
                                          <span className="text-[9px]">Verde = Mejor opción</span>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 text-center">
                                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((wd, idx) => (
                                            <span key={wd} className={cn("text-[9px] font-black uppercase py-0.5", idx === 6 ? "text-rose-500" : "text-slate-400")}>
                                              {wd}
                                            </span>
                                          ))}
                                          {Array.from({ length: swapLeadingEmptyCount }).map((_, idx) => (
                                            <div key={`cw-empty-${idx}`} />
                                          ))}
                                          {swapMonthDays.map((dObj) => {
                                            const cIso = safeFormat(dObj, 'yyyy-MM-dd');
                                            const cand = candidates.find(c => c.date === cIso);
                                            const isCwVac = cwVacations.includes(cIso);
                                            const isSelCand = selectedCollabCalDate === cIso;
                                            return (
                                              <button
                                                key={cIso}
                                                type="button"
                                                disabled={!cand}
                                                onClick={() => cand && setSelectedCollabCalDate(cIso)}
                                                className={cn(
                                                  "py-1.5 px-0.5 rounded-xl border text-center min-h-[42px] flex flex-col items-center justify-center transition-all",
                                                  !cand
                                                    ? isCwVac
                                                      ? "bg-cyan-50/60 dark:bg-cyan-950/20 border-cyan-200/60 text-cyan-600/70 cursor-default"
                                                      : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-default"
                                                    : isSelCand
                                                      ? "bg-azul-blue text-white border-azul-blue ring-2 ring-azul-blue/40 cursor-pointer"
                                                      : cand.isRecommended
                                                        ? "bg-emerald-50 dark:bg-emerald-950/35 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 cursor-pointer"
                                                        : cand.iAlreadyWorkOnCand
                                                          ? "bg-amber-50/70 dark:bg-amber-950/25 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 cursor-pointer"
                                                          : cand.myRestViolation || cand.coworkerRestViolation
                                                            ? "bg-rose-50/70 dark:bg-rose-950/25 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 cursor-pointer"
                                                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-azul-blue cursor-pointer"
                                                )}
                                              >
                                                <span className="text-[10.5px] font-black leading-none">{getDate(dObj)}</span>
                                                <span className="text-[7.5px] font-black leading-none mt-1">
                                                  {cand ? `${cand.shifts[0].start.slice(0, 2)}-${cand.shifts[0].end.slice(0, 2)}` : isCwVac ? 'VAC' : '—'}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {selectedCalCandidate ? (
                                        renderCandidateRow(selectedCalCandidate)
                                      ) : (
                                        <p className="text-[10.5px] font-semibold text-center text-slate-500 dark:text-slate-400 py-1">
                                          Pincha en cualquier día con turno del calendario de {selectedCollab.ownerName} para ver la compatibilidad y solicitar el cambio.
                                        </p>
                                      )}
                                    </div>
                                  ) : displayedCandidates.length === 0 ? (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-center">
                                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        No se encontraron turnos disponibles en este filtro para {monthOnlyName}. Prueba en «Todo el mes» o «Calendario».
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                      {displayedCandidates.map((cand) => renderCandidateRow(cand))}
                                    </div>
                                  )}
                                </div>
                              ) : null
                            ) : null}
                          </div>
                        );
                      })()}
                        </>
                      )}
                    </div>
                  ) : (
                    /* PESTAÑA RECIBIDAS: ACEPTAR / RECHAZAR Y VER ESTADO */
                    <div className="space-y-2.5">
                      {receivedSwapRequests.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                          <Inbox size={26} className="mx-auto text-slate-400" />
                          <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                            Sin solicitudes recibidas
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Cuando un compañero te proponga un cambio de turno aparecerá aquí para que puedas aceptarlo o rechazarlo.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
                          {receivedSwapRequests.map((req) => {
                            const sDateObj = parseISO(req.senderDate);
                            const rDateObj = parseISO(req.recipientDate);
                            const sLabel = isValid(sDateObj) ? safeFormat(sDateObj, 'EEE d MMM', { locale: es }) : req.senderDate;
                            const rLabel = isValid(rDateObj) ? safeFormat(rDateObj, 'EEE d MMM', { locale: es }) : req.recipientDate;
                            const sShiftTxt = (req.senderShifts || []).filter(s => s.start && s.end).map(s => `${s.start}-${s.end}`).join(' / ');
                            const rShiftTxt = (req.recipientShifts || []).filter(s => s.start && s.end).map(s => `${s.start}-${s.end}`).join(' / ');
                            const isBusy = respondingSwapReqId === req.id;
                            const matchingShiftInCal = shifts.find(s => s.swapInfo?.requestId === req.id);

                            return (
                              <div
                                key={req.id}
                                className={cn(
                                  "p-3.5 rounded-2xl border space-y-2.5 transition-all",
                                  req.status === 'pending'
                                    ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/70 shadow-2xs"
                                    : req.status === 'accepted'
                                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/50"
                                      : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                        De: {req.senderName}
                                      </span>
                                      <span className={cn(
                                        "text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded-md inline-flex items-center gap-1",
                                        req.status === 'pending'
                                          ? "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200"
                                          : req.status === 'accepted'
                                            ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200"
                                            : req.status === 'undone'
                                              ? "bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300"
                                              : "bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300"
                                      )}>
                                        {req.status === 'pending' && <Clock size={10} />}
                                        {req.status === 'accepted' && <CheckCircle2 size={10} />}
                                        {req.status === 'undone' && <RotateCcw size={10} />}
                                        {req.status === 'rejected' && <XCircle size={10} />}
                                        {req.status === 'pending'
                                          ? 'Pendiente'
                                          : req.status === 'accepted'
                                            ? 'Aceptada'
                                            : req.status === 'undone'
                                              ? 'Deshecho'
                                              : 'Rechazada'}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 space-y-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                      <p className="leading-snug">
                                        <span className="text-slate-500 dark:text-slate-400">Te cubre tu día:</span>{' '}
                                        <strong className="capitalize text-slate-900 dark:text-white">{rLabel}</strong>
                                        {rShiftTxt ? ` (${rShiftTxt})` : ''}
                                      </p>
                                      <p className="leading-snug">
                                        <span className="text-slate-500 dark:text-slate-400">Nuevo turno para ti:</span>{' '}
                                        <strong className="capitalize text-azul-blue dark:text-sky-400">{sLabel}</strong>
                                        {sShiftTxt ? ` (${sShiftTxt})` : ' (Sin turno asignado)'}
                                      </p>
                                    </div>
                                  </div>

                                  {req.status !== 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteSwapRequest?.(req.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                                      title="Eliminar del historial"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>

                                {req.status === 'pending' ? (
                                  <div className="flex items-center gap-2 pt-0.5">
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => onRespondSwapRequest?.(req.id, 'accepted')}
                                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs"
                                    >
                                      {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                                      <span>Aceptar cambio</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => onRespondSwapRequest?.(req.id, 'rejected')}
                                      className="flex-1 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                                    >
                                      <X size={14} />
                                      <span>Rechazar</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                      {req.status === 'accepted'
                                        ? '✓ Nuevo turno mostrado en tu calendario'
                                        : req.status === 'undone'
                                          ? '↺ Cambio deshecho · Turno original restaurado'
                                          : '✕ Solicitud rechazada'}
                                    </span>
                                    {req.status === 'accepted' && (
                                      <div className="flex items-center gap-2.5">
                                        <button
                                          type="button"
                                          onClick={() => onJumpToDate?.(req.senderDate)}
                                          className="text-[10px] font-black uppercase tracking-wider text-azul-blue dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                          <CalendarDays size={12} />
                                          <span>Ver en calendario</span>
                                        </button>
                                        {matchingShiftInCal && onUndoShiftSwap && !isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => onUndoShiftSwap(matchingShiftInCal.date)}
                                            className="text-[10px] font-black uppercase tracking-wider text-rose-600 hover:underline cursor-pointer"
                                          >
                                            Deshacer cambio
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-start items-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewSwapRequest(false);
                        setSwapSubView('menu');
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 transition-colors cursor-pointer"
                    >
                      ← Volver a Cambiar Turno
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer when in grid view */}
        {currentView === 'grid' && (
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
            {isLocked ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Cerrar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleSaveAndSync();
                  onClose();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check size={16} />
                <span>Guardar y Cerrar</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal para definir ciclo de rotación personalizado o mixto (lápiz) */}
      <CustomRotationModal
        isOpen={isCustomRotationModalOpen}
        onClose={() => setIsCustomRotationModalOpen(false)}
        initialWorkDays={customWorkDays}
        initialFreeDays={customFreeDays}
        initialFirstFreeDay={firstFreeDay}
        initialMode={customModalInitialMode}
        initialMixedConfig={mixedConfig}
        currentMonth={currentMonth}
        onSave={(w, f, freeDay, anchorDate) => {
          handleSaveCustomRotation(w, f, freeDay, anchorDate);
        }}
        onSaveMixed={handleSaveMixedRotation}
      />
    </div>
  );
};
