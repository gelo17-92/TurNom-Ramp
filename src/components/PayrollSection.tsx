import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Settings as SettingsIcon, 
  PieChart, 
  CheckCircle2, 
  Check,
  FileText, 
  Edit2,
  Save,
  X,
  Trash2,
  ChevronDown,
  Upload,
  Loader2,
  AlertCircle,
  ArrowLeftRight,
  Plus,
  LayoutGrid,
  Clock,
  MinusCircle,
  Users,
  Calendar,
  Download,
  EyeOff,
  Palmtree,
  RotateCcw
} from 'lucide-react';
import { subMonths, isSameMonth, parseISO, isWithinInterval, startOfMonth, endOfMonth, addDays, addYears, differenceInDays, isValid, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

import { getShiftDuration, getStatsForShifts, calculateLevelMetrics, formatNumber, formatCurrency as originalFormatCurrency, safeFormat, compressImageFile, isExtraPayroll, getAusenciaHoursForDay, getCounterConfigForDate, getEffectiveSubPlusPrice } from '../utils';
import { LocalInput } from './LocalInput';
import { ConfirmModal } from './ConfirmModal';
import { PayrollReviewModal } from './PayrollReviewModal';
import { useScrollLock } from '../hooks/useScrollLock';
import { cn, MonthlyOptions, YearlyLevels, YearlyPluses, PlusConfig, SavedPayroll, UploadedPayroll } from '../types';
import { extractPayrollData, type PayrollPdfDocument } from '../services/payrollOcr';
import type { ExtractedPayrollPayload } from '../utils/payrollValidation';
import { computeVacationVariablesAggregation } from '../utils/payrollBuilder';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer el archivo PDF.'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo PDF.'));
    reader.readAsDataURL(file);
  });

const STANDARD_PLUSES = [
  'Tiempo Parcial - Discontinuo', 'Teamleader', 'Jornada Irregular', 
  'Turnicidad', 'Turnicidad 2', 'Turnicidad 3', 'Turnicidad 4', 'Turnicidad 5+',
  'Jornada Fraccionada < 4h', 'Jornada Fraccionada >= 4h', 'Jornada Fraccionada >= 7h',
  'Transporte', 'Manutención', 'Madrugue', 'Festivo', 'Domingo', 'Nocturnas',
  'Multitasking', 'Productividad', 'ARCO', 'RCO', 'Duty', 'Super', 'Cambio de función',
  'Jornada Irregular Diaria'
];

interface PayrollSectionProps {
  settings: any;
  shifts: any[];
  levels: YearlyLevels;
  pluses: YearlyPluses;
  currentMonth: Date;
  updateSettings: (settings: any) => void;
  onModalStateChange?: (isOpen: boolean) => void;
  hideAmounts?: boolean;
}

export const PayrollSection = ({
  settings,
  shifts,
  levels,
  pluses,
  currentMonth,
  updateSettings,
  onModalStateChange,
  hideAmounts = false
}: PayrollSectionProps) => {
  const formatCurrency = (val: any) => {
    if (hideAmounts) return '•••• €';
    return originalFormatCurrency(val);
  };
  const [isEditingDevengos, setIsEditingDevengos] = useState(false);
  const [isEditingDeducciones, setIsEditingDeducciones] = useState(false);
  const [isDevengosExpanded, setIsDevengosExpanded] = useState(false);
  const [isDeduccionesExpanded, setIsDeduccionesExpanded] = useState(false);
  const [isVacationSettingsExpanded, setIsVacationSettingsExpanded] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<any>(null);
  const [originalMonthlyOptions, setOriginalMonthlyOptions] = useState<any>(null);
  const [expandedPayrollId, setExpandedPayrollId] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [showPlusSuccess, setShowPlusSuccess] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'reading' | 'analyzing' | 'idle'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingReviewPayroll, setPendingReviewPayroll] = useState<{
    data: ExtractedPayrollPayload;
    payload: {
      text: string;
      monthContext: string;
      base64Images: string[];
      pdfDocuments: PayrollPdfDocument[];
    };
  } | null>(null);
  const [isRetryingReview, setIsRetryingReview] = useState(false);

  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(isComparisonModalOpen || !!pendingReviewPayroll);
    }
  }, [isComparisonModalOpen, pendingReviewPayroll, onModalStateChange]);

  useEffect(() => {
    if (!isUploading) {
      setUploadProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (uploadStep === 'reading') {
          if (prev < 25) {
            return prev + 2.5;
          }
          return prev;
        } else if (uploadStep === 'analyzing') {
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
  }, [isUploading, uploadStep]);

  const isAnyModalActive = !!(isComparisonModalOpen || isUploading || isUploadModalOpen || pendingReviewPayroll);
  useScrollLock(isAnyModalActive);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showUploadInfo, setShowUploadInfo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isAddingManualPlus, setIsAddingManualPlus] = useState(false);
  const [newManualPlus, setNewManualPlus] = useState({ name: '', value: 0, qty: 1 });

  const [payrollMode, setPayrollMode] = useState<'monthly' | 'extra' | 'vacation_variables'>('monthly');

  // Reset states when month changes
  useEffect(() => {
    setIsEditingDevengos(false);
    setIsEditingDeducciones(false);
    setIsDevengosExpanded(false);
    setIsDeduccionesExpanded(false);
    setPayrollMode('monthly');
    setOriginalSettings(null);
    setOriginalMonthlyOptions(null);
    setPendingReviewPayroll(null);
    setIsRetryingReview(false);
  }, [currentMonth]);

  const [isSavedPayrollsExpanded, setIsSavedPayrollsExpanded] = useState(false);
  const [isUploadExpanded, setIsUploadExpanded] = useState(false);
  const [isPlusesExpanded, setIsPlusesExpanded] = useState(false);
  const [isAjustesExpanded, setIsAjustesExpanded] = useState(false);
  const [isAnotacionesExpanded, setIsAnotacionesExpanded] = useState(false);
  const [isDeleteUploadedConfirmOpen, setIsDeleteUploadedConfirmOpen] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState<string | null>(null);

  const currentMonthKey = safeFormat(currentMonth, 'yyyy-MM');
  const uploadedPayroll = settings.uploadedPayrolls?.find((p: UploadedPayroll) => p.monthKey === currentMonthKey);

  const currentYear = currentMonth.getFullYear();
  const getYearlyData = <T,>(data: Record<number, T>): T => {
    if (data[currentYear]) return data[currentYear];
    const years = Object.keys(data).map(Number).sort((a, b) => b - a);
    return data[years[0]];
  };

  const currentYearLevels = getYearlyData(levels);
  const currentYearPluses = getYearlyData(pluses);

  const subrogadoBaseAnual = (settings.isSubrogado && settings.subrogadoBaseSalaries?.[currentYear]) 
    ? settings.subrogadoBaseSalaries[currentYear] * settings.pagas
    : 0;

  const isProductividadMonth = (date: Date): boolean => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0 = Jan, 3 = Apr, 6 = Jul, 9 = Oct
    if (year < 2026) return false;
    return month === 0 || month === 3 || month === 6 || month === 9;
  };

  const isDateAfterLoanEnd = (date: Date, endDate?: string): boolean => {
    if (!endDate) return false;
    try {
      const trimmed = endDate.trim();
      if (!trimmed) return false;
      if (trimmed.length === 7) {
        const currentMonthKey = safeFormat(date, 'yyyy-MM');
        return currentMonthKey > trimmed;
      }
      const end = parseISO(trimmed);
      if (!isValid(end)) return false;
      return startOfMonth(date) > end;
    } catch {
      return false;
    }
  };

  const getMonthlyOptions = (date: Date): MonthlyOptions => {
    const key = safeFormat(date, 'yyyy-MM');
    const monthData = settings.monthlyOptions[key] || {};

    const pastKeys = Object.keys(settings.monthlyOptions)
      .filter(k => k < key)
      .sort((a, b) => b.localeCompare(a));
    const lastOptions = pastKeys.length > 0 ? settings.monthlyOptions[pastKeys[0]] : null;

    const isProdMonth = isProductividadMonth(date);

    const prestamoConfig = settings.prestamo || (lastOptions?.descuentoOtro ? {
      amount: lastOptions.descuentoOtro,
      endDate: lastOptions.descuentoOtroEndDate
    } : null);

    const defaultEndDate = monthData.descuentoOtroEndDate ?? (lastOptions?.descuentoOtroEndDate ?? prestamoConfig?.endDate ?? '');
    let defaultDescuentoOtro = '';
    if (monthData.descuentoOtro !== undefined) {
      defaultDescuentoOtro = monthData.descuentoOtro;
    } else if (prestamoConfig?.amount) {
      const isExpired = isDateAfterLoanEnd(date, defaultEndDate);
      defaultDescuentoOtro = isExpired ? '' : prestamoConfig.amount;
    }

    const defaults: MonthlyOptions = {
      teamleader: lastOptions ? lastOptions.teamleader : (currentYearPluses['Teamleader']?.enabled || false),
      multitasking: lastOptions ? lastOptions.multitasking : (currentYearPluses['Multitasking']?.enabled || false),
      productividad: isProdMonth ? (currentYearPluses['Productividad']?.enabled || false) : false,
      productividadPct: lastOptions ? (lastOptions.productividadPct ?? 100) : 100,
      arco: lastOptions ? lastOptions.arco : (currentYearPluses['ARCO']?.enabled || false),
      rco: lastOptions ? lastOptions.rco : (currentYearPluses['RCO']?.enabled || false),
      dutty: lastOptions ? (lastOptions.dutty ?? lastOptions.duty ?? (currentYearPluses['Duty']?.enabled || currentYearPluses['Dutty']?.enabled || false)) : (currentYearPluses['Duty']?.enabled || currentYearPluses['Dutty']?.enabled || false),
      duty: lastOptions ? (lastOptions.duty ?? lastOptions.dutty ?? (currentYearPluses['Duty']?.enabled || currentYearPluses['Dutty']?.enabled || false)) : (currentYearPluses['Duty']?.enabled || currentYearPluses['Dutty']?.enabled || false),
      super: lastOptions ? (lastOptions.super ?? (currentYearPluses['Super']?.enabled || false)) : (currentYearPluses['Super']?.enabled || false),
      turnicidad: lastOptions ? lastOptions.turnicidad : (currentYearPluses['Turnicidad 2']?.enabled || currentYearPluses['Turnicidad 3']?.enabled || currentYearPluses['Turnicidad 4']?.enabled || currentYearPluses['Turnicidad 5+']?.enabled),
      jornadaIrregular: lastOptions ? lastOptions.jornadaIrregular : false,
      atrasos: '',
      descuento: '',
      descuentoDinero: '',
      descuentoOtro: defaultDescuentoOtro,
      descuentoOtroEndDate: defaultEndDate,
      irpf: lastOptions ? lastOptions.irpf : settings.irpf,
      useManualBaseSalary: lastOptions ? lastOptions.useManualBaseSalary : false,
      manualBaseSalary: lastOptions ? lastOptions.manualBaseSalary : 0,
      useManualHours: false,
      manualHoursParcial: undefined,
      manualPluses: {},
      customToggles: lastOptions ? { ...lastOptions.customToggles } : {},
      extraHoursType: lastOptions ? lastOptions.extraHoursType : 'H.Perent.',
      extraHoursQty: 0,
      extraHoursPrice: 0,
      useExtraHours: false,
      manualLevel: undefined,
      levelJumpMode: 'full_month',
      notes: '',
    };

    const finalOpts = { ...defaults, ...monthData };
    if (!isProdMonth) {
      finalOpts.productividad = false;
    }
    return finalOpts;
  };

  const saveMonthlyOptions = (date: Date, options: MonthlyOptions) => {
    const key = safeFormat(date, 'yyyy-MM');
    const newMonthlyOptions = { ...settings.monthlyOptions, [key]: options };

    updateSettings({
      ...settings,
      monthlyOptions: newMonthlyOptions
    });
  };

  const monthlyOpts = getMonthlyOptions(currentMonth);

  const handleEditDevengos = () => {
    if (!isEditingDevengos) {
      setOriginalMonthlyOptions({ ...monthlyOpts });
      setIsEditingDevengos(true);
      setIsDevengosExpanded(true);
    } else {
      setIsEditingDevengos(false);
      setOriginalMonthlyOptions(null);
    }
  };

  const handleCancelDevengos = () => {
    if (originalMonthlyOptions) {
      saveMonthlyOptions(currentMonth, originalMonthlyOptions);
    }
    setIsEditingDevengos(false);
    setOriginalMonthlyOptions(null);
  };

  const handleEditDeducciones = () => {
    if (!isEditingDeducciones) {
      setOriginalSettings({ ...settings });
      setOriginalMonthlyOptions({ ...monthlyOpts });
      setIsEditingDeducciones(true);
      setIsDeduccionesExpanded(true);
    } else {
      setIsEditingDeducciones(false);
      setOriginalSettings(null);
      setOriginalMonthlyOptions(null);
    }
  };

  const handleCancelDeducciones = () => {
    if (originalSettings) {
      updateSettings(originalSettings);
    }
    if (originalMonthlyOptions) {
      saveMonthlyOptions(currentMonth, originalMonthlyOptions);
    }
    setIsEditingDeducciones(false);
    setOriginalSettings(null);
    setOriginalMonthlyOptions(null);
  };

  const getPlusItem = (name: string, defaultQty: number | string, defaultPrice: number, defaultTotal: number, baseName?: string) => {
    const lookupName = baseName || name;
    
    const formatConceptName = (n: string): string => {
      let clean = n;
      clean = clean.replace(/\bSUB\b(?!\))/gi, '(SUB)');
      clean = clean.replace(/\bCON\b(?!\))/gi, '(CON)');
      clean = clean.replace(/\s*\((SUB|CON)\)/gi, ' ($1)');
      return clean;
    };

    const formattedName = formatConceptName(name);

    const manual = monthlyOpts.manualPluses?.[lookupName];
    if (manual?.useManual) {
      const qty = typeof manual.qty === 'number' ? manual.qty : 1;
      return {
        name: formattedName,
        qty: manual.qty,
        price: manual.value,
        value: Math.round(qty * manual.value * 100) / 100,
        isManual: true,
        baseName: lookupName
      };
    }
    return {
      name: formattedName,
      qty: defaultQty,
      price: defaultPrice,
      value: Math.round(defaultTotal * 100) / 100,
      isManual: false,
      baseName: lookupName
    };
  };

  const getExtendedMonthShifts = (month: Date) => {
    const start = startOfMonth(month);
    const dayBefore = addDays(start, -1);
    const dayBeforeStr = safeFormat(dayBefore, 'yyyy-MM-dd');
    return shifts.filter(s => isSameMonth(parseISO(s.date), month) || s.date === dayBeforeStr);
  };

  const currentMonthShifts = getExtendedMonthShifts(currentMonth);
  const prevMonth = subMonths(currentMonth, 1);
  const prevMonthShifts = getExtendedMonthShifts(prevMonth);
  
  const hasCurrentMonthShifts = currentMonthShifts.some(s => s.shifts.some(sh => sh.start && sh.end));

  const currentCounterCfg = useMemo(() => getCounterConfigForDate(settings, currentMonth), [settings, currentMonth]);
  const prevCounterCfg = useMemo(() => getCounterConfigForDate(settings, prevMonth), [settings, prevMonth]);

  const currentStats = useMemo(() => getStatsForShifts(
    currentMonthShifts, 
    settings.holidays, 
    settings.vacations, 
    settings.contractType, 
    false, 
    shifts, 
    currentCounterCfg.period,
    currentCounterCfg.targets['Nocturnas'] || 0,
    currentYearPluses['Nocturnas'],
    currentCounterCfg.targets['Madrugue'] || 0,
    currentYearPluses['Madrugue'],
    currentMonth,
    settings.isSubrogado,
    currentCounterCfg.targets,
    currentYearPluses
  ), [currentMonthShifts, settings.holidays, settings.vacations, settings.contractType, shifts, currentCounterCfg, currentYearPluses, currentMonth, settings.isSubrogado]);

  const prevStats = useMemo(() => getStatsForShifts(
    prevMonthShifts, 
    settings.holidays, 
    settings.vacations, 
    settings.contractType, 
    false, 
    shifts, 
    prevCounterCfg.period,
    prevCounterCfg.targets['Nocturnas'] || 0,
    currentYearPluses['Nocturnas'],
    prevCounterCfg.targets['Madrugue'] || 0,
    currentYearPluses['Madrugue'],
    prevMonth,
    settings.isSubrogado,
    prevCounterCfg.targets,
    currentYearPluses
  ), [prevMonthShifts, settings.holidays, settings.vacations, settings.contractType, shifts, prevCounterCfg, currentYearPluses, prevMonth, settings.isSubrogado]);

  const prevMonthAusenciaHours = useMemo(() => {
    if (!prevMonth || !isValid(prevMonth)) return 0;
    const ausenciaShifts = shifts.filter(s => {
      if (!s.date || s.type !== 'Ausencia Justificada') return false;
      const d = parseISO(s.date);
      return isValid(d) && isSameMonth(d, prevMonth);
    });
    return Math.round(ausenciaShifts.reduce((acc, s) => acc + getAusenciaHoursForDay(s), 0) * 100) / 100;
  }, [shifts, prevMonth]);

  const prevMonthCambioFuncionHours = useMemo(() => {
    if (!prevMonth || !isValid(prevMonth)) return 0;
    const cdfShifts = shifts.filter(s => {
      if (!s.date || s.type !== 'Cambio de función') return false;
      const d = parseISO(s.date);
      return isValid(d) && isSameMonth(d, prevMonth);
    });
    return Math.round(cdfShifts.reduce((acc, s) => {
      const valid = (s.shifts || []).filter(sh => sh.start && sh.end);
      return acc + valid.reduce((hAcc, sh) => hAcc + getShiftDuration(sh.start, sh.end), 0);
    }, 0) * 100) / 100;
  }, [shifts, prevMonth]);

  const activeLevel = useMemo(() => {
    if (monthlyOpts.manualLevel) return monthlyOpts.manualLevel;
    if (monthlyOpts.useManualBaseSalary && settings.contractType === 'Completo') return settings.selectedLevel;
    if (!settings.nextLevelDate) return settings.currentLevel;
    const nextDate = startOfMonth(parseISO(settings.nextLevelDate));
    const payrollDate = startOfMonth(currentMonth);
    if (payrollDate >= nextDate) return Math.min(7, settings.currentLevel + 1);
    return settings.currentLevel;
  }, [settings.currentLevel, settings.nextLevelDate, currentMonth, monthlyOpts.useManualBaseSalary, settings.selectedLevel, monthlyOpts.manualLevel, settings.contractType]);

  const levelJumpInfo = useMemo(() => {
    if (settings.nextLevelDate && settings.currentLevel < 7) {
      const nextDateObj = parseISO(settings.nextLevelDate);
      if (isValid(nextDateObj) && isSameMonth(nextDateObj, currentMonth)) {
        return {
          fromLevel: settings.currentLevel,
          toLevel: Math.min(7, settings.currentLevel + 1),
          date: nextDateObj
        };
      }
    }

    if (!settings.manualLevelProgression && settings.seniorityDate) {
      const seniority = parseISO(settings.seniorityDate);
      if (isValid(seniority)) {
        let totalFrozenDays = 0;
        const today = new Date();
        if (settings.frozenPeriods && Array.isArray(settings.frozenPeriods)) {
          settings.frozenPeriods.forEach((period: any) => {
            if (period.start && period.end) {
              const start = parseISO(period.start);
              const end = parseISO(period.end);
              if (isValid(start) && isValid(end)) {
                const effectiveStart = start > seniority ? start : seniority;
                const effectiveEnd = end < today ? end : today;
                if (effectiveEnd >= effectiveStart) {
                  totalFrozenDays += differenceInDays(effectiveEnd, effectiveStart) + 1;
                }
              }
            }
          });
        }

        const milestones = [
          { years: 1, fromLevel: 1, toLevel: 2 },
          { years: 4, fromLevel: 2, toLevel: 3 },
          { years: 6, fromLevel: 3, toLevel: 4 },
          { years: 8, fromLevel: 4, toLevel: 5 },
          { years: 10, fromLevel: 5, toLevel: 6 },
          { years: 12, fromLevel: 6, toLevel: 7 },
        ];

        for (const m of milestones) {
          const mDate = addDays(addYears(seniority, m.years), totalFrozenDays);
          if (isValid(mDate) && isSameMonth(mDate, currentMonth)) {
            return {
              fromLevel: m.fromLevel,
              toLevel: m.toLevel,
              date: mDate
            };
          }
        }
      }
    }

    return null;
  }, [settings.nextLevelDate, settings.currentLevel, settings.manualLevelProgression, settings.seniorityDate, settings.frozenPeriods, currentMonth]);

  const levelData = currentYearLevels.find(l => l.nivel === activeLevel)!;
  const standardMetrics = calculateLevelMetrics(levelData.anual, settings.pagas);
  const activeLevelJumpMode: 'full_month' | 'exact_day' = monthlyOpts.levelJumpMode || 'full_month';

  const metrics = useMemo(() => {
    if (subrogadoBaseAnual > 0) {
      return calculateLevelMetrics(subrogadoBaseAnual, settings.pagas);
    }
    if (levelJumpInfo && levelJumpInfo.date.getDate() > 1 && activeLevelJumpMode === 'exact_day' && !monthlyOpts.manualLevel) {
      const fromLvlData = currentYearLevels.find(l => l.nivel === levelJumpInfo.fromLevel) || levelData;
      const toLvlData = currentYearLevels.find(l => l.nivel === levelJumpInfo.toLevel) || levelData;
      const fromM = calculateLevelMetrics(fromLvlData.anual, settings.pagas);
      const toM = calculateLevelMetrics(toLvlData.anual, settings.pagas);
      const totalDays = endOfMonth(currentMonth).getDate();
      const jumpDay = levelJumpInfo.date.getDate();
      // Del día 1 al (jumpDay - 1) al nivel anterior; del jumpDay (inclusive) al último día del mes al nuevo nivel
      const prevDays = Math.max(0, Math.min(totalDays, jumpDay - 1));
      const newDays = Math.max(0, totalDays - prevDays);
      const prevRatio = prevDays / totalDays;
      const newRatio = newDays / totalDays;

      return {
        mensual: fromM.mensual * prevRatio + toM.mensual * newRatio,
        hora: fromM.hora * prevRatio + toM.hora * newRatio,
        perentoria: fromM.perentoria * prevRatio + toM.perentoria * newRatio,
        complementaria: fromM.complementaria * prevRatio + toM.complementaria * newRatio,
      };
    }
    return standardMetrics;
  }, [subrogadoBaseAnual, settings.pagas, levelJumpInfo, activeLevelJumpMode, monthlyOpts.manualLevel, currentYearLevels, levelData, currentMonth, standardMetrics]);

  const hasManualHours = settings.contractType === 'Parcial' && !!monthlyOpts.useManualHours;
  const effectivePct = (hasManualHours && monthlyOpts.manualHoursParcial !== undefined && monthlyOpts.manualHoursParcial !== null)
    ? (monthlyOpts.manualHoursParcial / 155.63) * 100 
    : currentStats.effectivePercentage;
  const baseSalarioBase = (monthlyOpts.useManualBaseSalary && settings.contractType === 'Completo')
    ? (monthlyOpts.manualBaseSalary || 0)
    : (settings.contractType === 'Completo' ? metrics.mensual : metrics.mensual * (Math.min(100, effectivePct) / 100));
  const salarioBase = settings.contractType === 'Completo' ? baseSalarioBase : ((hasCurrentMonthShifts || hasManualHours) ? baseSalarioBase : 0);

  const getPlusConfig = (name: string): PlusConfig | undefined => currentYearPluses[name];

  const getBeforeCount = (name: string): number => {
    const config = getPlusConfig(name);
    if (!config) return 0;
    const start = parseISO(prevCounterCfg.period.start);
    if (!isValid(start) || !isValid(prevMonth)) return 0;
    const beforeShifts = shifts.filter(s => {
      const d = parseISO(s.date);
      return isValid(d) && d >= start && d < parseISO(safeFormat(prevMonth, 'yyyy-MM-01'));
    });
    const statsMap: Record<string, string> = {
      'Jornada Fraccionada < 4h': 'splitLess4',
      'Jornada Fraccionada >= 4h': 'split4to7',
      'Jornada Fraccionada >= 7h': 'splitPlus7',
      'Transporte': 'transport',
      'Manutención': 'manutencion',
      'Madrugue': 'madrugues',
      'Festivo': 'festivos',
      'Domingo': 'sundays',
      'Nocturnas': 'nightHours',
    };
    const statsKey = statsMap[name];
    if (statsKey) {
      const beforeStats = getStatsForShifts(beforeShifts, settings.holidays, settings.vacations, settings.contractType, false, shifts, prevCounterCfg.period, prevCounterCfg.targets['Nocturnas'] || 0, currentYearPluses['Nocturnas'], prevCounterCfg.targets['Madrugue'] || 0, currentYearPluses['Madrugue'], undefined, settings.isSubrogado, prevCounterCfg.targets, currentYearPluses);
      const subKey = statsKey === 'nightHours' ? 'nightHoursSub' : (statsKey === 'madrugues' ? 'madruguesSub' : (statsKey === 'sundays' ? 'sundaysSub' : (statsKey === 'festivos' ? 'festivosSub' : `${statsKey}Sub`)));
      return ((beforeStats as any)[statsKey] || 0) + ((beforeStats as any)[subKey] || 0);
    }
    return 0; // Simplified for this component
  };

  const pluses14Base = Object.entries(currentYearPluses).reduce((acc, [name, p]) => {
    if (p.pagas === 14 && p.enabled) {
      if (settings.contractType === 'Parcial' && name.startsWith('Turnicidad')) return acc;
      const isToggled = (monthlyOpts as any)[name.toLowerCase()];
      if (!STANDARD_PLUSES.includes(name) || isToggled) return acc + p.value;
    }
    return acc;
  }, 0);

  const ppExtra = (salarioBase + pluses14Base) / 6;
  const extraPct = (settings.contractType === 'Parcial' && effectivePct > 100) ? effectivePct - 100 : 0;
  const ajusteJornadaValue = metrics.mensual * (extraPct / 100);
  
  const devengos = useMemo(() => {
    const isSubrogadoPlus = (n: string) => n.endsWith(' SUB') || n.endsWith('/Comida SUB');

    const getPlusItems = (name: string, qty: number) => {
      const manual = monthlyOpts.manualPluses?.[name];
      if (manual?.useManual) return [getPlusItem(name, manual.qty, manual.value, manual.qty * manual.value)];

      if (name === 'Transporte' && settings.isSubrogado) {
        const subConfig = getPlusConfig('Transporte SUB');
        if (subConfig && subConfig.enabled) {
          const val = subConfig.value;
          return [getPlusItem('Transporte SUB', 1, val, val)];
        }
      }

      const config = getPlusConfig(name);
      if (!config || !config.enabled) return [];
      if (qty <= 0 && !isEditingDevengos) return [];
      const target = prevCounterCfg.targets[name] || 0;

      // Handle custom individual subrogated pluses if personal subrogado is active
      const subName = name === 'Manutención' ? 'Manutención/Comida SUB' : `${name} SUB`;
      const subConfig = settings.isSubrogado ? getPlusConfig(subName) : undefined;
      const hasIndividualSub = subConfig !== undefined && subConfig.enabled;

      let subRate = config.subValue;
      let subLabel = `${name} (SUB)`;

      if (settings.isSubrogado && hasIndividualSub) {
        subRate = subConfig.value;
      }

      if (!settings.isSubrogado || target <= 0 || subRate === undefined) {
        return [getPlusItem(name, Math.max(0, qty), config.value, Math.max(0, qty) * config.value)];
      }
      const beforeCount = getBeforeCount(name);
      const remainingTarget = Math.max(0, target - beforeCount);
      const subQty = Math.max(0, Math.min(qty, remainingTarget));
      const conQty = Math.max(0, qty - subQty);
      const items = [];
      const conLabel = subQty > 0 ? `${name} (CON)` : name;
      if (subQty > 0 || (isEditingDevengos && remainingTarget > 0)) items.push(getPlusItem(subLabel, subQty, subRate, subQty * subRate, name));
      if (conQty > 0 || (isEditingDevengos && conQty <= 0 && items.length === 0)) items.push(getPlusItem(conLabel, conQty, config.value, conQty * config.value, name));
      return items;
    };

    const baseDevengos = [
      getPlusItem('Salario Base', settings.contractType === 'Completo' ? 1 : ((hasCurrentMonthShifts || hasManualHours) ? Math.min(100, effectivePct) / 100 : 0), monthlyOpts.useManualBaseSalary ? salarioBase : metrics.mensual, salarioBase),
      ...(extraPct > 0 || (isEditingDevengos && settings.contractType === 'Parcial') ? [getPlusItem('Ajuste de Jornada', extraPct / 100, metrics.mensual, ajusteJornadaValue)] : []),
      { ...getPlusItem(`PP Extra (${settings.pagas} pagas)`, (settings.contractType === 'Completo' || hasCurrentMonthShifts || hasManualHours) ? 1 : 0, ppExtra, ppExtra), isProrrata: settings.pagas === 14 },
      ...getPlusItems('Tiempo Parcial - Discontinuo', (settings.contractType === 'Parcial' && getPlusConfig('Tiempo Parcial - Discontinuo')?.enabled) ? effectivePct / 100 : 0),
      ...getPlusItems('Teamleader', (monthlyOpts.teamleader && getPlusConfig('Teamleader')?.enabled) ? (settings.contractType === 'Completo' ? 1 : effectivePct / 100) : 0),
      ...getPlusItems('Jornada Irregular', (monthlyOpts.jornadaIrregular && getPlusConfig('Jornada Irregular')?.enabled) ? 1 : 0),
      ...(settings.contractType === 'Completo' ? [
        getPlusItem('Turnicidad',
          (isEditingDevengos || prevStats.uniqueShiftsCount >= 2) ? (prevStats.uniqueShiftsCount >= 5 ? '5 o más' : `${prevStats.uniqueShiftsCount} turnos`) : 0,
          (prevStats.uniqueShiftsCount >= 5 ? getPlusConfig('Turnicidad 5+')?.value || 0 : (prevStats.uniqueShiftsCount === 4 ? getPlusConfig('Turnicidad 4')?.value || 0 : (prevStats.uniqueShiftsCount === 3 ? getPlusConfig('Turnicidad 3')?.value || 0 : (prevStats.uniqueShiftsCount === 2 ? getPlusConfig('Turnicidad 2')?.value || 0 : 0)))),
          (prevStats.uniqueShiftsCount >= 5 && getPlusConfig('Turnicidad 5+')?.enabled ? getPlusConfig('Turnicidad 5+')!.value : (prevStats.uniqueShiftsCount === 4 && getPlusConfig('Turnicidad 4')?.enabled ? getPlusConfig('Turnicidad 4')!.value : (prevStats.uniqueShiftsCount === 3 && getPlusConfig('Turnicidad 3')?.enabled ? getPlusConfig('Turnicidad 3')!.value : (prevStats.uniqueShiftsCount === 2 && getPlusConfig('Turnicidad 2')?.enabled ? getPlusConfig('Turnicidad 2')!.value : 0))))
        )
      ] : []),
      ...getPlusItems('Jornada Fraccionada < 4h', prevStats.splitLess4 + prevStats.splitLess4Sub),
      ...getPlusItems('Jornada Fraccionada >= 4h', prevStats.split4to7 + prevStats.split4to7Sub),
      ...getPlusItems('Jornada Fraccionada >= 7h', prevStats.splitPlus7 + prevStats.splitPlus7Sub),
      ...getPlusItems('Transporte', prevStats.transport + prevStats.transportSub),
      ...getPlusItems('Jornada Irregular Diaria', prevStats.transport + prevStats.transportSub),
      ...getPlusItems('Manutención', prevStats.manutencion + prevStats.manutencionSub),
      ...getPlusItems('Madrugue', prevStats.madrugues + prevStats.madruguesSub),
      ...getPlusItems('Festivo', prevStats.festivos + prevStats.festivosSub),
      ...getPlusItems('Domingo', prevStats.sundays + prevStats.sundaysSub),
      ...getPlusItems('Nocturnas', prevStats.nightHours + prevStats.nightHoursSub),
      getPlusItem('Perentorias', prevStats.perentDay, metrics.perentoria, prevStats.perentDay * metrics.perentoria),
      getPlusItem('Perentorias Noc.', prevStats.perentNight, metrics.perentoria + (getPlusConfig('Nocturnas')?.value || 0), prevStats.perentNight * (metrics.perentoria + (getPlusConfig('Nocturnas')?.value || 0))),
      getPlusItem('Complementarias', prevStats.complDay, settings.complementariasPrice || metrics.complementaria, prevStats.complDay * (settings.complementariasPrice || metrics.complementaria)),
      getPlusItem('Complementarias Noc.', prevStats.complNight, (settings.complementariasPrice || metrics.complementaria) + (getPlusConfig('Nocturnas')?.value || 0), prevStats.complNight * ((settings.complementariasPrice || metrics.complementaria) + (getPlusConfig('Nocturnas')?.value || 0))),
      ...getPlusItems('Multitasking', (monthlyOpts.multitasking && getPlusConfig('Multitasking')?.enabled) ? 1 : 0),
      ...getPlusItems('Productividad', (monthlyOpts.productividad && getPlusConfig('Productividad')?.enabled) ? ((monthlyOpts.productividadPct || 100) / 100) : 0),
      ...getPlusItems('ARCO', (monthlyOpts.arco && getPlusConfig('ARCO')?.enabled) ? 1 : 0),
      ...getPlusItems('RCO', (monthlyOpts.rco && getPlusConfig('RCO')?.enabled) ? 1 : 0),
      ...getPlusItems('Duty', ((monthlyOpts.duty || monthlyOpts.dutty) && (getPlusConfig('Duty')?.enabled || getPlusConfig('Dutty')?.enabled)) ? 1 : 0),
      ...getPlusItems('Super', (monthlyOpts.super && getPlusConfig('Super')?.enabled) ? 1 : 0),
      ...((() => {
        const cdfConfig = getPlusConfig('Cambio de función');
        if (!cdfConfig?.enabled && !isEditingDevengos) return [];
        const cdfFullAmount = cdfConfig?.value || 0;
        const baseContractHours = 155.63;
        const cdfHourlyPrice = baseContractHours > 0 ? (cdfFullAmount / baseContractHours) : 0;
        const cdfQty = prevMonthCambioFuncionHours;
        const cdfValue = Math.round(cdfQty * cdfHourlyPrice * 100) / 100;
        if (!cdfConfig?.enabled) return [];
        if (cdfQty <= 0 && !isEditingDevengos) return [];
        return [getPlusItem('Cambio de función', cdfQty, cdfHourlyPrice, cdfValue)];
      })()),
    ];

    const customPluses = Object.entries(currentYearPluses)
      .filter(([name, p]) => {
        const isSub = isSubrogadoPlus(name);
        const subrogadosBaseKeys = [
          'Nocturnas SUB',
          'Madrugue SUB',
          'Manutención/Comida SUB',
          'Transporte SUB',
          'Festivo SUB',
          'Domingo SUB',
          'Jornada Irregular Diaria'
        ];
        if (STANDARD_PLUSES.includes(name)) return false;
        const autoCount = (prevStats as any)?.customCounts?.[name];
        const hasAutoCount = typeof autoCount === 'number' && autoCount > 0;
        const isProporcional = p.baseType === 'proporcional_jornada' || p.calculationType === 'proporcional_jornada' || p.cloneOf === 'Tiempo Parcial - Discontinuo' || p.cloneOf === 'Teamleader';
        const isFijo = p.baseType === 'fijo' || p.calculationType === 'fijo' || p.cloneOf === 'Jornada Irregular' || p.cloneOf === 'Productividad' || p.cloneOf === 'Multitasking' || p.cloneOf === 'Duty' || p.cloneOf === 'Super';

        const isToggled = monthlyOpts.customToggles?.[name] !== undefined 
          ? !!monthlyOpts.customToggles[name] 
          : (isProporcional || isFijo ? (p.defaultActiveInPayroll !== false) : false);

        if (isSub) {
          return settings.isSubrogado && p.enabled && !subrogadosBaseKeys.includes(name) && (isToggled || isEditingDevengos || hasAutoCount);
        }
        return p.enabled && (isToggled || isEditingDevengos || hasAutoCount);
      })
      .flatMap(([name, p]) => {
        const autoCount = (prevStats as any)?.customCounts?.[name];
        const isProporcional = p.baseType === 'proporcional_jornada' || p.calculationType === 'proporcional_jornada' || p.cloneOf === 'Tiempo Parcial - Discontinuo' || p.cloneOf === 'Teamleader';
        const isFijo = p.baseType === 'fijo' || p.calculationType === 'fijo' || p.cloneOf === 'Jornada Irregular' || p.cloneOf === 'Productividad' || p.cloneOf === 'Multitasking' || p.cloneOf === 'Duty' || p.cloneOf === 'Super';

        const isToggled = monthlyOpts.customToggles?.[name] !== undefined 
          ? !!monthlyOpts.customToggles[name] 
          : (isProporcional || isFijo ? (p.defaultActiveInPayroll !== false) : false);

        let qty = 0;
        if (autoCount !== undefined) {
          qty = autoCount;
        } else if (isProporcional) {
          const factor = settings.contractType === 'Completo' ? 1 : (effectivePct / 100);
          qty = isToggled ? factor : 0;
        } else if (isFijo) {
          qty = isToggled ? 1 : 0;
        } else {
          qty = isToggled ? 1 : 0;
        }

        return getPlusItems(name, qty);
      });

    const adHocPluses = Object.entries(monthlyOpts.manualPluses || {})
      .filter(([name, m]) => {
        const isSub = isSubrogadoPlus(name);
        const subrogadosBaseKeys = [
          'Nocturnas SUB',
          'Madrugue SUB',
          'Manutención/Comida SUB',
          'Transporte SUB',
          'Festivo SUB',
          'Domingo SUB',
          'Jornada Irregular Diaria'
        ];
        if (!m.useManual || STANDARD_PLUSES.includes(name) || currentYearPluses[name]) return false;
        if (name === 'Salario Base' || name === 'Ajuste de Jornada' || name.startsWith('PP Extra') || name.startsWith('Perentorias') || name.startsWith('Complementarias')) return false;
        if (isSub) {
          return settings.isSubrogado && !subrogadosBaseKeys.includes(name);
        }
        return true;
      })
      .map(([name, m]) => getPlusItem(name, m.qty, m.value, m.qty * m.value));

    const extraHoursType = monthlyOpts.extraHoursType || 'H.Perent.';
    const extraHoursPrice = Math.round((monthlyOpts.extraHoursPrice || (extraHoursType === 'H.Perent.' ? metrics.perentoria : (settings.complementariasPrice || metrics.complementaria))) * 100) / 100;
    const extraHoursQty = monthlyOpts.extraHoursQty || 0;
    const extraHoursValue = Math.round(extraHoursQty * extraHoursPrice * 100) / 100;

    const manualImpuntualidadHours = parseFloat(monthlyOpts.impuntualidad || '') || 0;
    const impuntualidadHours = Math.round((manualImpuntualidadHours + prevMonthAusenciaHours) * 100) / 100;
    const impuntualidadPrice = Math.round(metrics.hora * 100) / 100;
    const impuntualidadValue = Math.round(-(impuntualidadHours * impuntualidadPrice) * 100) / 100;

    const descDinero = parseFloat(monthlyOpts.descuentoDinero || '') || 0;

    return [
      ...baseDevengos,
      ...customPluses,
      ...adHocPluses,
      { name: extraHoursType, value: extraHoursValue, qty: extraHoursQty, price: extraHoursPrice, isExtraHours: true },
      { name: 'Concepto a abonar', value: Math.round((parseFloat(monthlyOpts.atrasos || '') || 0) * 100) / 100, qty: 1, price: Math.round((parseFloat(monthlyOpts.atrasos || '') || 0) * 100) / 100 },
      { name: 'Concepto a descontar', value: Math.round(-descDinero * 100) / 100, qty: 1, price: Math.round(-descDinero * 100) / 100 },
      { name: 'Impuntualidad/Absent', value: impuntualidadValue, qty: impuntualidadHours, price: impuntualidadPrice },
    ];
  }, [salarioBase, hasCurrentMonthShifts, settings.contractType, settings.isSubrogado, metrics.mensual, metrics.hora, effectivePct, extraPct, ajusteJornadaValue, settings.pagas, ppExtra, currentYearPluses, prevStats, monthlyOpts, currentStats, metrics.perentoria, metrics.complementaria, settings.complementariasPrice, prevCounterCfg, shifts, prevMonth, prevMonthAusenciaHours, prevMonthCambioFuncionHours, isEditingDevengos]);

  const totalDevengado = Math.round(devengos.reduce((acc, d) => acc + (d.isProrrata ? 0 : d.value), 0) * 100) / 100;
  
  const conceptosADescontar = useMemo(() => {
    const items = [];
    items.push({ name: 'Cuota Sindical', value: Math.round(-settings.cuotaSindical * 100) / 100, qty: 1, price: Math.round(-settings.cuotaSindical * 100) / 100, color: 'text-red-600', key: 'cuotaSindical' });
    const loanEndDate = monthlyOpts.descuentoOtroEndDate || settings.prestamo?.endDate;
    const isLoanExpired = isDateAfterLoanEnd(currentMonth, loanEndDate);
    const descOtro = isLoanExpired ? 0 : (parseFloat(monthlyOpts.descuentoOtro || '') || 0);
    items.push({ name: 'Otro (Préstamos/etc.)', value: Math.round(-descOtro * 100) / 100, qty: 1, price: Math.round(-descOtro * 100) / 100, color: 'text-red-600', key: 'descuentoOtro' });
    return items;
  }, [settings.cuotaSindical, monthlyOpts.descuentoOtro, monthlyOpts.descuentoOtroEndDate, settings.prestamo, currentMonth]);

  const totalDescuentos = conceptosADescontar.reduce((acc, d) => acc + d.value, 0);
  const salarioBaseItemVal = devengos.find(d => d.name === 'Salario Base')?.value || 0;
  const ajusteJornadaItemVal = devengos.find(d => d.name === 'Ajuste de Jornada')?.value || 0;
  const ppExtraItemVal = devengos.find(d => d.name.startsWith('PP Extra'))?.value || 0;
  // Los descuentos de dinero en la columna de devengos (Impuntualidad/Absent, Concepto a descontar, o cualquier d.value < 0)
  // no se tienen en cuenta en las secciones de deducciones (Contingencias Comunes, Desempleo, Formación y Mecanismo de Equidad),
  // por lo que sólo se suman los complementos positivos (d.value > 0) a la base de cotización.
  const plusesCotizablesItems = devengos.filter(d => d.name !== 'Salario Base' && d.name !== 'Ajuste de Jornada' && !d.name.startsWith('PP Extra') && d.value > 0);
  const plusesCotizablesVal = Math.round(plusesCotizablesItems.reduce((acc, d) => acc + d.value, 0) * 100) / 100;
  const remuneracionMensual = Math.round((salarioBaseItemVal + ajusteJornadaItemVal + plusesCotizablesVal) * 100) / 100;
  const baseCotizacion = Math.round((remuneracionMensual + ppExtraItemVal) * 100) / 100;
  const deducciones = useMemo(() => [
    { name: 'Contingencias Comunes', value: Math.round(baseCotizacion * (settings.rateContingencias / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateContingencias, key: 'rateContingencias' },
    { name: 'Desempleo', value: Math.round(baseCotizacion * (settings.rateDesempleo / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateDesempleo, key: 'rateDesempleo' },
    { name: 'Formación', value: Math.round(baseCotizacion * (settings.rateFormacion / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateFormacion, key: 'rateFormacion' },
    { name: 'Mecanismo Equidad', value: Math.round(baseCotizacion * (settings.rateEquidad / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateEquidad, key: 'rateEquidad' },
    { name: 'IRPF', value: Math.round(totalDevengado * (monthlyOpts.irpf! / 100) * 100) / 100, base: totalDevengado, rate: monthlyOpts.irpf!, key: 'irpf' },
  ], [baseCotizacion, totalDevengado, settings, monthlyOpts.irpf]);

  const totalDeducciones = Math.round((deducciones.reduce((acc, d) => acc + d.value, 0) - totalDescuentos) * 100) / 100;
  const liquido = Math.round((totalDevengado - totalDeducciones) * 100) / 100;

  const isSummerExtra = settings.pagas === 14 && currentMonth.getMonth() === 5;
  const isWinterExtra = settings.pagas === 14 && currentMonth.getMonth() === 11;
  const isMarch = currentMonth.getMonth() === 2;
  const prevYear = currentMonth.getFullYear() - 1;
  const prevYearPluses = pluses[prevYear] || pluses[currentYear] || currentYearPluses;

  // Detalle y suma de los 6 meses de PP Extra correspondientes al ciclo (Verano: Ene-Jun, Navidad: Jul-Dic)
  const semesterPpExtraDetails = useMemo(() => {
    if (!isSummerExtra && !isWinterExtra) return [];

    const monthIndices = isSummerExtra 
      ? [0, 1, 2, 3, 4, 5] 
      : [6, 7, 8, 9, 10, 11];

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthShortNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];

    const currentYearLevelsList = levels[currentYear] || levels[2026] || Object.values(levels)[0] || [];
    const currentYearPlusesList = pluses[currentYear] || pluses[2026] || Object.values(pluses)[0] || {};

    return monthIndices.map(mIdx => {
      const mDate = new Date(currentYear, mIdx, 1);
      const mMonthName = monthNames[mIdx];
      const mShortName = monthShortNames[mIdx];
      const mKey = safeFormat(mDate, 'yyyy-MM');

      // Si es el mes actualmente seleccionado en la sección Nómina, usamos directamente el valor ya calculado
      if (mIdx === currentMonth.getMonth()) {
        const isAccrued = settings.contractType === 'Completo' || hasCurrentMonthShifts || hasManualHours;
        const val = isAccrued ? Math.round(ppExtra * 100) / 100 : 0;
        return {
          monthIndex: mIdx,
          monthName: mMonthName,
          shortName: mShortName,
          monthKey: mKey,
          ppExtra: val,
          isAccrued,
          salarioBase: Math.round(salarioBase * 100) / 100,
          pluses14Base: Math.round(pluses14Base * 100) / 100,
          isCurrentMonth: true
        };
      }

      // Para los otros 5 meses del ciclo, calculamos con las mismas reglas exactas de la sección Nómina
      const mOpts = getMonthlyOptions(mDate);
      const mShifts = getExtendedMonthShifts(mDate);
      const mHasShifts = mShifts.some(s => s.shifts.some(sh => sh.start && sh.end));
      const mHasManualHours = settings.contractType === 'Parcial' && !!mOpts.useManualHours;
      const isAccrued = settings.contractType === 'Completo' || mHasShifts || mHasManualHours;

      if (!isAccrued) {
        return {
          monthIndex: mIdx,
          monthName: mMonthName,
          shortName: mShortName,
          monthKey: mKey,
          ppExtra: 0,
          isAccrued: false,
          salarioBase: 0,
          pluses14Base: 0,
          isCurrentMonth: false
        };
      }

      // Determinar nivel activo para mDate
      let mActiveLevel = settings.currentLevel;
      if (mOpts.manualLevel) {
        mActiveLevel = mOpts.manualLevel;
      } else if (mOpts.useManualBaseSalary && settings.contractType === 'Completo') {
        mActiveLevel = settings.selectedLevel;
      } else if (settings.nextLevelDate) {
        const nextDate = startOfMonth(parseISO(settings.nextLevelDate));
        const pDate = startOfMonth(mDate);
        if (pDate >= nextDate) {
          mActiveLevel = Math.min(7, settings.currentLevel + 1);
        } else {
          mActiveLevel = settings.currentLevel;
        }
      }

      const mLevelData = currentYearLevelsList.find(l => l.nivel === mActiveLevel) || currentYearLevelsList[0];
      let mMetrics = calculateLevelMetrics(mLevelData.anual, settings.pagas);

      if (subrogadoBaseAnual > 0) {
        mMetrics = calculateLevelMetrics(subrogadoBaseAnual, settings.pagas);
      } else {
        let mJumpInfo: { fromLevel: number; toLevel: number; date: Date } | null = null;
        if (settings.nextLevelDate && settings.currentLevel < 7) {
          const ndObj = parseISO(settings.nextLevelDate);
          if (isValid(ndObj) && isSameMonth(ndObj, mDate)) {
            mJumpInfo = { fromLevel: settings.currentLevel, toLevel: Math.min(7, settings.currentLevel + 1), date: ndObj };
          }
        }
        if (!settings.manualLevelProgression && settings.seniorityDate && !mJumpInfo) {
          const seniority = parseISO(settings.seniorityDate);
          if (isValid(seniority)) {
            let totalFrozen = 0;
            const today = new Date();
            if (settings.frozenPeriods && Array.isArray(settings.frozenPeriods)) {
              settings.frozenPeriods.forEach((period: any) => {
                if (period.start && period.end) {
                  const startP = parseISO(period.start);
                  const endP = parseISO(period.end);
                  if (isValid(startP) && isValid(endP)) {
                    const effS = startP > seniority ? startP : seniority;
                    const effE = endP < today ? endP : today;
                    if (effE >= effS) totalFrozen += differenceInDays(effE, effS) + 1;
                  }
                }
              });
            }
            const milestones = [
              { years: 1, fromLevel: 1, toLevel: 2 },
              { years: 4, fromLevel: 2, toLevel: 3 },
              { years: 6, fromLevel: 3, toLevel: 4 },
              { years: 8, fromLevel: 4, toLevel: 5 },
              { years: 10, fromLevel: 5, toLevel: 6 },
              { years: 12, fromLevel: 6, toLevel: 7 },
            ];
            for (const ml of milestones) {
              const mlDate = addDays(addYears(seniority, ml.years), totalFrozen);
              if (isValid(mlDate) && isSameMonth(mlDate, mDate)) {
                mJumpInfo = { fromLevel: ml.fromLevel, toLevel: ml.toLevel, date: mlDate };
                break;
              }
            }
          }
        }

        const mJumpMode = mOpts.levelJumpMode || 'full_month';
        if (mJumpInfo && mJumpInfo.date.getDate() > 1 && mJumpMode === 'exact_day' && !mOpts.manualLevel) {
          const fromL = currentYearLevelsList.find(l => l.nivel === mJumpInfo!.fromLevel) || mLevelData;
          const toL = currentYearLevelsList.find(l => l.nivel === mJumpInfo!.toLevel) || mLevelData;
          const fromM = calculateLevelMetrics(fromL.anual, settings.pagas);
          const toM = calculateLevelMetrics(toL.anual, settings.pagas);
          const totalDays = endOfMonth(mDate).getDate();
          const jumpDay = mJumpInfo.date.getDate();
          const prevDays = Math.max(0, Math.min(totalDays, jumpDay - 1));
          const newDays = Math.max(0, totalDays - prevDays);
          mMetrics = {
            mensual: fromM.mensual * (prevDays / totalDays) + toM.mensual * (newDays / totalDays),
            hora: fromM.hora * (prevDays / totalDays) + toM.hora * (newDays / totalDays),
            perentoria: fromM.perentoria * (prevDays / totalDays) + toM.perentoria * (newDays / totalDays),
            complementaria: fromM.complementaria * (prevDays / totalDays) + toM.complementaria * (newDays / totalDays),
          };
        }
      }

      const mCounterCfg = getCounterConfigForDate(settings, mDate);
      const mStats = getStatsForShifts(
        mShifts,
        settings.holidays,
        settings.vacations,
        settings.contractType,
        false,
        shifts,
        mCounterCfg.period,
        mCounterCfg.targets['Nocturnas'] || 0,
        currentYearPlusesList['Nocturnas'],
        mCounterCfg.targets['Madrugue'] || 0,
        currentYearPlusesList['Madrugue'],
        mDate,
        settings.isSubrogado,
        mCounterCfg.targets,
        currentYearPlusesList
      );

      const mEffectivePct = (mHasManualHours && mOpts.manualHoursParcial !== undefined && mOpts.manualHoursParcial !== null)
        ? (mOpts.manualHoursParcial / 155.63) * 100
        : mStats.effectivePercentage;

      const mBaseSalarioBase = (mOpts.useManualBaseSalary && settings.contractType === 'Completo')
        ? (mOpts.manualBaseSalary || 0)
        : (settings.contractType === 'Completo' ? mMetrics.mensual : mMetrics.mensual * (Math.min(100, mEffectivePct) / 100));

      const mSalBase = settings.contractType === 'Completo' ? mBaseSalarioBase : ((mHasShifts || mHasManualHours) ? mBaseSalarioBase : 0);

      const mPluses14 = Object.entries(currentYearPlusesList).reduce((acc, [name, plusObj]) => {
        const p = plusObj as PlusConfig;
        if (p && p.pagas === 14 && p.enabled) {
          if (settings.contractType === 'Parcial' && name.startsWith('Turnicidad')) return acc;
          const isToggled = (mOpts as any)[name.toLowerCase()];
          if (!STANDARD_PLUSES.includes(name) || isToggled) return acc + p.value;
        }
        return acc;
      }, 0);

      const mPp = Math.round(((mSalBase + mPluses14) / 6) * 100) / 100;

      return {
        monthIndex: mIdx,
        monthName: mMonthName,
        shortName: mShortName,
        monthKey: mKey,
        ppExtra: mPp,
        isAccrued: true,
        salarioBase: Math.round(mSalBase * 100) / 100,
        pluses14Base: Math.round(mPluses14 * 100) / 100,
        isCurrentMonth: false
      };
    });
  }, [
    isSummerExtra, 
    isWinterExtra, 
    currentYear, 
    currentMonth, 
    levels, 
    pluses, 
    settings, 
    shifts, 
    ppExtra, 
    salarioBase, 
    pluses14Base, 
    hasCurrentMonthShifts, 
    hasManualHours, 
    subrogadoBaseAnual
  ]);

  const semesterPpExtraSum = useMemo(() => {
    if (!isSummerExtra && !isWinterExtra) return 0;
    const total = semesterPpExtraDetails.reduce((acc, item) => acc + item.ppExtra, 0);
    return Math.round(total * 100) / 100;
  }, [isSummerExtra, isWinterExtra, semesterPpExtraDetails]);

  const extraGross = (isSummerExtra || isWinterExtra) ? semesterPpExtraSum : (salarioBase + pluses14Base);
  const extraIrpf = monthlyOpts.irpf || settings.irpf;
  const extraNet = Math.round(extraGross * (1 - extraIrpf / 100) * 100) / 100;

  const extraDevengos = useMemo(() => {
    if (!isSummerExtra && !isWinterExtra) return [];
    return [
      { name: isSummerExtra ? 'PAGA EXTRA DE VERANO' : 'PAGA EXTRA DE NAVIDAD', value: extraGross, price: extraGross, qty: 1 }
    ];
  }, [isSummerExtra, isWinterExtra, extraGross]);

  const extraDeducciones = useMemo(() => {
    if (!isSummerExtra && !isWinterExtra) return [];
    return [
      { name: 'IRPF', value: Math.round(extraGross * (extraIrpf / 100) * 100) / 100, base: extraGross, rate: extraIrpf, key: 'irpf' }
    ];
  }, [isSummerExtra, isWinterExtra, extraGross, extraIrpf]);

  // Agregado real de conceptos variables cobrados en las 12 nóminas de Febrero (prevYear) a Enero (currentYear)
  const vacationVariablesAggregation = useMemo(() => {
    if (!isMarch) return null;
    return computeVacationVariablesAggregation(currentYear, {
      settings,
      shifts,
      levels,
      pluses
    });
  }, [isMarch, currentYear, settings, shifts, levels, pluses]);

  const isDefaultActiveConcept = (name: string): boolean => {
    const normalized = name.toLowerCase();
    if (normalized.includes('nocturna')) return true;
    if (normalized.includes('domingo')) return true;
    if (normalized.includes('festivo')) return true;
    if (normalized.includes('fraccionada')) return true;
    if (normalized.includes('manutención') || normalized.includes('manutencion') || normalized.includes('comida')) return true;
    if (normalized.includes('madrugue')) return true;
    if (normalized.includes('transporte')) return true;
    return false;
  };

  const getLegacyVacationConceptKey = (name: string): string | null => {
    if (name === 'Transporte (SUB)') return 'Transporte SUB';
    return null;
  };

  const isConceptActive = (name: string): boolean => {
    const toggles = monthlyOpts.vacationVariablesToggles;
    if (toggles && toggles[name] !== undefined) {
      return !!toggles[name];
    }
    const legacyKey = getLegacyVacationConceptKey(name);
    if (legacyKey && toggles && toggles[legacyKey] !== undefined) {
      return !!toggles[legacyKey];
    }
    return isDefaultActiveConcept(name);
  };

  const handleToggleVacationConcept = (name: string) => {
    const currentActive = isConceptActive(name);
    const updatedToggles = {
      ...(monthlyOpts.vacationVariablesToggles || {}),
      [name]: !currentActive
    };
    saveMonthlyOptions(currentMonth, {
      ...monthlyOpts,
      vacationVariablesToggles: updatedToggles
    });
  };

  const handleResetVacationToggles = () => {
    saveMonthlyOptions(currentMonth, {
      ...monthlyOpts,
      vacationVariablesToggles: undefined
    });
  };

  const autoPrevYearVacationDays = useMemo(() => {
    const dateSet = new Set<string>();
    (settings.vacations || []).forEach((v: string) => {
      if (typeof v === 'string' && v.startsWith(`${prevYear}-`)) {
        dateSet.add(v.slice(0, 10));
      }
    });
    (shifts || []).forEach((s: any) => {
      if (s?.type === 'Vacaciones' && typeof s.date === 'string' && s.date.startsWith(`${prevYear}-`)) {
        dateSet.add(s.date.slice(0, 10));
      }
    });
    return dateSet.size;
  }, [settings.vacations, shifts, prevYear]);

  const daysInPrevYear = useMemo(() => {
    const isLeap = (prevYear % 4 === 0 && prevYear % 100 !== 0) || prevYear % 400 === 0;
    return isLeap ? 366 : 365;
  }, [prevYear]);

  const calcWorkedMonthsFromVacDays = (vacDays: number) => {
    const clampedVac = Math.max(0, Math.min(daysInPrevYear - 1, vacDays));
    const workedDays = daysInPrevYear - clampedVac;
    return Math.max(0.01, Math.round(((workedDays / daysInPrevYear) * 12) * 100) / 100);
  };

  const effectivePrevYearVacDays = monthlyOpts.vacationVariablesPrevYearVacDays !== undefined
    ? monthlyOpts.vacationVariablesPrevYearVacDays
    : autoPrevYearVacationDays;

  const defaultWorkedMonths = useMemo(
    () => calcWorkedMonthsFromVacDays(effectivePrevYearVacDays),
    [effectivePrevYearVacDays, daysInPrevYear]
  );

  const effectiveWorkedMonths = monthlyOpts.vacationVariablesWorkedMonths !== undefined
    ? Math.max(0.01, Math.round(monthlyOpts.vacationVariablesWorkedMonths * 100) / 100)
    : defaultWorkedMonths;

  const vacationDivisorMode: '11' | '12' | 'worked_months' = useMemo(() => {
    if (monthlyOpts.vacationVariablesDivisorMode) return monthlyOpts.vacationVariablesDivisorMode;
    if (monthlyOpts.vacationVariablesDivisor === 12) return '12';
    return '11';
  }, [monthlyOpts.vacationVariablesDivisorMode, monthlyOpts.vacationVariablesDivisor]);

  const vacationVariablesDivisor = useMemo(() => {
    if (vacationDivisorMode === '12') return 12;
    if (vacationDivisorMode === 'worked_months') return effectiveWorkedMonths;
    return 11;
  }, [vacationDivisorMode, effectiveWorkedMonths]);

  // Porcentaje del Mecanismo de Equidad (MEI) correspondiente a las nóminas del año anterior (prevYear)
  const prevYearEquidadRate = useMemo(() => {
    if (monthlyOpts.vacationVariablesRateEquidad !== undefined) {
      return monthlyOpts.vacationVariablesRateEquidad;
    }

    // 1. Buscar primero en nóminas subidas o guardadas del año anterior (de más reciente a más antigua)
    const uploadedPrevYear = (settings.uploadedPayrolls || [])
      .filter((p: UploadedPayroll) => p && typeof p.monthKey === 'string' && p.monthKey.startsWith(`${prevYear}-`) && !p.monthKey.includes('extra'))
      .sort((a: UploadedPayroll, b: UploadedPayroll) => b.monthKey.localeCompare(a.monthKey));

    for (const up of uploadedPrevYear) {
      const meiItem = (up.data?.deducciones || []).find((d) => {
        const c = (d.concepto || '').toLowerCase();
        return (c.includes('equidad') || c.includes('mei')) && Number(d.tipo) > 0;
      });
      if (meiItem && Number(meiItem.tipo) > 0) {
        return Number(meiItem.tipo);
      }
    }

    const savedPrevYear = (settings.savedPayrolls || [])
      .filter((p: SavedPayroll) => p && typeof p.monthKey === 'string' && p.monthKey.startsWith(`${prevYear}-`) && !p.monthKey.includes('extra'))
      .sort((a: SavedPayroll, b: SavedPayroll) => b.monthKey.localeCompare(a.monthKey));

    for (const sp of savedPrevYear) {
      const meiItem = (sp.deducciones || []).find((d) => {
        const n = (d.name || '').toLowerCase();
        return (n.includes('equidad') || n.includes('mei')) && Number(d.rate) > 0;
      });
      if (meiItem && Number(meiItem.rate) > 0) {
        return Number(meiItem.rate);
      }
    }

    // 2. Porcentaje oficial MEI cuota trabajador por año (RD-ley 2/2023)
    const MEI_BY_YEAR: Record<number, number> = {
      2023: 0.10,
      2024: 0.12,
      2025: 0.13,
      2026: 0.15,
      2027: 0.17,
      2028: 0.18,
      2029: 0.20,
    };
    if (prevYear < 2023) return 0;
    if (prevYear >= 2029) return 0.20;
    return MEI_BY_YEAR[prevYear] ?? settings.rateEquidad;
  }, [monthlyOpts.vacationVariablesRateEquidad, settings.uploadedPayrolls, settings.savedPayrolls, settings.rateEquidad, prevYear]);

  const vacationVariablesDevengos = useMemo(() => {
    if (!isMarch || !vacationVariablesAggregation) return [];

    interface RawConceptDef {
      name: string;
      annualQty: number;
      annualValue: number;
      defaultPrice: number;
      monthsPaid: number;
    }

    const { itemsByName, orderedItems } = vacationVariablesAggregation;

    const getSubPriceFallback = (baseName: string): number => {
      return (
        getEffectiveSubPlusPrice(prevYearPluses, baseName, settings.isSubrogado) ??
        getEffectiveSubPlusPrice(currentYearPluses, baseName, settings.isSubrogado) ??
        0
      );
    };

    const getConPriceFallback = (baseName: string): number => {
      return prevYearPluses[baseName]?.value ?? currentYearPluses[baseName]?.value ?? 0;
    };

    const addedNames = new Set<string>();
    const allConcepts: RawConceptDef[] = [];

    const pushConcept = (name: string, fallbackPrice: number, onlyIfAggregated = false) => {
      if (addedNames.has(name)) return;
      const agg = itemsByName[name];
      if (onlyIfAggregated && !agg) return;
      addedNames.add(name);
      allConcepts.push({
        name,
        annualQty: agg ? agg.annualQty : 0,
        annualValue: agg ? agg.annualValue : 0,
        defaultPrice: agg && agg.annualQty > 0 ? agg.weightedPrice : fallbackPrice,
        monthsPaid: agg ? agg.monthsPaid : 0
      });
    };

    const standardBaseNames = [
      'Nocturnas',
      'Domingo',
      'Festivo',
      'Jornada Fraccionada < 4h',
      'Jornada Fraccionada >= 4h',
      'Jornada Fraccionada >= 7h',
      'Manutención',
      'Madrugue'
    ];

    standardBaseNames.forEach(baseName => {
      pushConcept(baseName, getConPriceFallback(baseName), false);
      pushConcept(`${baseName} (SUB)`, getSubPriceFallback(baseName), true);
    });

    // Transporte y Transporte (SUB)
    const transSubFallback = prevYearPluses['Transporte SUB']?.value ?? currentYearPluses['Transporte SUB']?.value ?? getSubPriceFallback('Transporte');
    if (itemsByName['Transporte (SUB)']) {
      pushConcept('Transporte (SUB)', transSubFallback, false);
      pushConcept('Transporte', getConPriceFallback('Transporte'), true);
    } else {
      pushConcept('Transporte', getConPriceFallback('Transporte'), false);
      pushConcept('Transporte (SUB)', transSubFallback, true);
    }

    // Conceptos variables mensuales / opcionales
    const optionalConceptNames = [
      'Turnicidad',
      'Jornada Irregular Diaria',
      'Jornada Irregular',
      'Cambio de función',
      'Teamleader',
      'Multitasking',
      'Productividad',
      'ARCO',
      'RCO',
      'Duty',
      'Super'
    ];

    optionalConceptNames.forEach(cName => {
      if (itemsByName[cName]) {
        pushConcept(cName, itemsByName[cName].weightedPrice, false);
        return;
      }
      if (cName === 'Turnicidad') {
        const turnCfg =
          prevYearPluses['Turnicidad 2'] ||
          prevYearPluses['Turnicidad 3'] ||
          prevYearPluses['Turnicidad 4'] ||
          prevYearPluses['Turnicidad 5+'] ||
          currentYearPluses['Turnicidad 2'];
        if (turnCfg?.enabled) {
          pushConcept('Turnicidad', turnCfg.value || 0, false);
        }
        return;
      }
      const cfg = prevYearPluses[cName] || currentYearPluses[cName];
      if (cfg && cfg.enabled) {
        pushConcept(cName, cfg.value || 0, false);
      }
    });

    // Cualquier otro concepto variable cobrado en las nóminas Feb-Ene (pluses personalizados, ad-hoc manuales, variantes SUB)
    orderedItems.forEach(item => {
      if (!addedNames.has(item.name)) {
        pushConcept(item.name, item.weightedPrice, false);
      }
    });

    // Pluses personalizados activos aunque tengan 0 cobrado en el periodo (para edición manual)
    const subrogadosBaseKeys = [
      'Nocturnas SUB',
      'Madrugue SUB',
      'Manutención/Comida SUB',
      'Transporte SUB',
      'Festivo SUB',
      'Domingo SUB',
      'Jornada Irregular Diaria'
    ];
    const mergedCustomMap = new Map<string, PlusConfig>();
    Object.entries(currentYearPluses).forEach(([pName, pCfg]) => mergedCustomMap.set(pName, pCfg));
    Object.entries(prevYearPluses).forEach(([pName, pCfg]) => mergedCustomMap.set(pName, pCfg));

    mergedCustomMap.forEach((pCfg, pName) => {
      if (STANDARD_PLUSES.includes(pName)) return;
      if (subrogadosBaseKeys.includes(pName)) return;
      const isSub = pName.endsWith(' SUB') || pName.endsWith('/Comida SUB');
      if (isSub && !settings.isSubrogado) return;
      if (pCfg && pCfg.enabled) {
        pushConcept(pName, pCfg.value || 0, false);
      }
    });

    // Conservar cualquier concepto editado manualmente en Variables Vacaciones
    Object.entries(monthlyOpts.vacationVariablesManual || {}).forEach(([mName, mVal]) => {
      if (mName === 'Transporte SUB' && addedNames.has('Transporte (SUB)')) return;
      if (!addedNames.has(mName) && mVal?.useManual) {
        pushConcept(mName, mVal.price || 0, false);
      }
    });

    return allConcepts.map(c => {
      const legacyKey = getLegacyVacationConceptKey(c.name);
      const manual =
        monthlyOpts.vacationVariablesManual?.[c.name] ??
        (legacyKey ? monthlyOpts.vacationVariablesManual?.[legacyKey] : undefined);
      const annualQty = c.annualQty;
      const annualValue = c.annualValue;
      const divisor = vacationVariablesDivisor;

      const hasManualQty = manual?.qty !== undefined;
      const hasManualPrice = manual?.price !== undefined;
      const hasManualValue = manual?.value !== undefined;

      const qty = hasManualQty
        ? manual.qty
        : (annualQty > 0 ? Math.round((annualQty / divisor) * 100) / 100 : 0);

      const price = hasManualPrice
        ? manual.price
        : c.defaultPrice;

      // En modo automático dividimos el importe anual real cobrado entre el divisor
      // para evitar pérdidas de redondeo cuando cambian tarifas entre Dic (N-1) y Ene (N)
      const rawValue = hasManualValue
        ? manual.value
        : (hasManualQty || hasManualPrice)
          ? Math.round(qty * price * 100) / 100
          : (annualValue > 0 ? Math.round((annualValue / divisor) * 100) / 100 : 0);

      const active = isConceptActive(c.name);
      const value = active ? rawValue : 0;

      return {
        name: c.name,
        qty,
        price,
        rawValue,
        value,
        isActive: active,
        annualQty,
        annualValue,
        monthsPaid: c.monthsPaid,
        isVacationVariable: true,
        isManual: !!manual?.useManual
      };
    });
  }, [isMarch, vacationVariablesAggregation, prevYearPluses, currentYearPluses, vacationVariablesDivisor, monthlyOpts.vacationVariablesManual, monthlyOpts.vacationVariablesToggles, settings.isSubrogado]);

  const vacationVariablesTotalDevengado = useMemo(() => {
    return Math.round(vacationVariablesDevengos.filter(d => d.isActive).reduce((acc, d) => acc + d.rawValue, 0) * 100) / 100;
  }, [vacationVariablesDevengos]);

  const vacationVariablesDeducciones = useMemo(() => {
    const base = vacationVariablesTotalDevengado;
    const irpfRate = monthlyOpts.irpf || settings.irpf;
    return [
      { name: 'Contingencias Comunes', value: Math.round(base * (settings.rateContingencias / 100) * 100) / 100, base, rate: settings.rateContingencias, key: 'rateContingencias' },
      { name: 'Desempleo', value: Math.round(base * (settings.rateDesempleo / 100) * 100) / 100, base, rate: settings.rateDesempleo, key: 'rateDesempleo' },
      { name: 'Formación', value: Math.round(base * (settings.rateFormacion / 100) * 100) / 100, base, rate: settings.rateFormacion, key: 'rateFormacion' },
      { name: 'Mecanismo Equidad', value: Math.round(base * (prevYearEquidadRate / 100) * 100) / 100, base, rate: prevYearEquidadRate, key: 'vacationVariablesRateEquidad' },
      { name: 'IRPF', value: Math.round(base * (irpfRate / 100) * 100) / 100, base, rate: irpfRate, key: 'irpf' },
    ];
  }, [
    vacationVariablesTotalDevengado,
    settings.rateContingencias,
    settings.rateDesempleo,
    settings.rateFormacion,
    prevYearEquidadRate,
    monthlyOpts.irpf,
    settings.irpf
  ]);

  const vacationVariablesTotalDeducciones = useMemo(() => {
    return Math.round(vacationVariablesDeducciones.reduce((acc, d) => acc + d.value, 0) * 100) / 100;
  }, [vacationVariablesDeducciones]);
  const vacationVariablesLiquido = Math.round((vacationVariablesTotalDevengado - vacationVariablesTotalDeducciones) * 100) / 100;

  const displayDevengos = payrollMode === 'extra' 
    ? extraDevengos 
    : payrollMode === 'vacation_variables' 
      ? vacationVariablesDevengos 
      : devengos;

  const displayDeducciones = payrollMode === 'extra' 
    ? extraDeducciones 
    : payrollMode === 'vacation_variables' 
      ? vacationVariablesDeducciones 
      : deducciones;

  const displayTotalDevengado = payrollMode === 'extra' 
    ? extraGross 
    : payrollMode === 'vacation_variables' 
      ? vacationVariablesTotalDevengado 
      : totalDevengado;

  const displayTotalDeducciones = payrollMode === 'extra' 
    ? (extraDeducciones[0]?.value || 0) 
    : payrollMode === 'vacation_variables' 
      ? vacationVariablesTotalDeducciones 
      : totalDeducciones;

  const displayLiquido = payrollMode === 'extra' 
    ? extraNet 
    : payrollMode === 'vacation_variables' 
      ? vacationVariablesLiquido 
      : liquido;

  const exportMonthlyPayrollPdf = async (savedPayroll?: SavedPayroll) => {
    try {
      const { jsPDF } = await import('jspdf');
      const isSaved = !!savedPayroll;
      const monthKey = isSaved ? savedPayroll.monthKey.split('-extra')[0] : safeFormat(currentMonth, 'yyyy-MM');
      const [yearStr, mStr] = monthKey.split('-');
      const year = parseInt(yearStr) || currentMonth.getFullYear();
      const monthIdx = parseInt(mStr) ? parseInt(mStr) - 1 : currentMonth.getMonth();
      const monthDate = new Date(year, monthIdx, 1);
      const monthName = safeFormat(monthDate, 'MMMM yyyy', { locale: es });

      const pDevengos = isSaved ? savedPayroll.devengos : displayDevengos;
      const pDeducciones = isSaved ? savedPayroll.deducciones : displayDeducciones;
      const pConceptosADescontar = isSaved ? (savedPayroll.conceptosADescontar || []) : (payrollMode === 'monthly' ? conceptosADescontar : []);
      const pTotalDevengado = isSaved ? savedPayroll.totals.totalDevengado : displayTotalDevengado;
      const pTotalDeducciones = isSaved ? savedPayroll.totals.totalDeducciones : displayTotalDeducciones;
      const pLiquido = isSaved ? savedPayroll.totals.liquido : displayLiquido;
      const pBaseCotizacion = isSaved
        ? (savedPayroll.totals.baseCotizacion ?? baseCotizacion)
        : (payrollMode === 'vacation_variables' ? vacationVariablesTotalDevengado : baseCotizacion);
      const pContract = isSaved ? (savedPayroll.settings?.contractType || settings.contractType) : settings.contractType;
      const pLevel = isSaved ? (savedPayroll.settings?.level || settings.level) : settings.level;

      // Filter shifts for this month
      const monthDays = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
      const monthShifts = monthDays.map(day => {
        const dKey = safeFormat(day, 'yyyy-MM-dd');
        const found = (shifts || []).find((s: any) => s.date === dKey);
        return {
          date: day,
          dKey,
          dayNum: day.getDate(),
          dayName: safeFormat(day, 'EEEEEE', { locale: es }).toUpperCase(),
          type: found?.type || 'Laboral',
          shifts: (found?.shifts || []).filter((s: any) => s && s.start && s.end),
          extraShifts: (found?.extraShifts || []).filter((s: any) => s && s.start && s.end),
        };
      });

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const contentWidth = pageWidth - margin * 2; // 186 mm

      // Header banner
      doc.setFillColor(0, 78, 137); // Azul Blue
      doc.roundedRect(margin, margin, contentWidth, 22, 2.5, 2.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('HOJA MENSUAL DE TURNOS Y RECIBO DE NÓMINA', margin + 6, margin + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(224, 242, 254);
      doc.text(`Período: ${monthName.toUpperCase()}  •  Sector Handling (Pasaje / Rampa)`, margin + 6, margin + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`Contrato: ${pContract}  •  Nivel: ${pLevel}`, pageWidth - margin - 6, margin + 8, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(224, 242, 254);
      doc.text(`Emisión: ${safeFormat(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin - 6, margin + 15, { align: 'right' });

      // KPIs Summary Bar
      let curY = margin + 25;
      const kpiH = 13;
      const kpiCount = 4;
      const kpiW = (contentWidth - 3 * (kpiCount - 1)) / kpiCount;

      const totWorkedH = monthShifts.reduce((acc, ms) => {
        const ord = ms.shifts.reduce((sAcc: number, s: any) => sAcc + getShiftDuration(s.start, s.end), 0);
        const ext = ms.extraShifts.reduce((sAcc: number, s: any) => sAcc + getShiftDuration(s.start, s.end), 0);
        return acc + ord + ext;
      }, 0);

      const labDays = monthShifts.filter(ms => ms.shifts.length > 0 || ms.extraShifts.length > 0).length;
      const freeDays = monthShifts.filter(ms => ms.type === 'Libre' || ms.type === 'Libranza').length;
      const vacDays = monthShifts.filter(ms => ms.type === 'Vacaciones').length;

      const kpiData = [
        { label: 'HORAS TRABAJADAS', val: `${formatNumber(totWorkedH, 2)} h`, highlight: false },
        { label: 'DÍAS TRABAJADOS', val: `${labDays} días`, highlight: false },
        { label: 'DÍAS LIBRES / VAC', val: `${freeDays} / ${vacDays}`, highlight: false },
        { label: 'LÍQUIDO A PERCIBIR', val: formatCurrency(pLiquido), highlight: true }
      ];

      kpiData.forEach((kpi, i) => {
        const kX = margin + i * (kpiW + 3);
        if (kpi.highlight) {
          doc.setFillColor(16, 185, 129); // emerald-500
          doc.roundedRect(kX, curY, kpiW, kpiH, 2, 2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(236, 253, 245);
          doc.text(kpi.label, kX + kpiW / 2, curY + 4.5, { align: 'center' });
          doc.setFontSize(9.5);
          doc.setTextColor(255, 255, 255);
          doc.text(kpi.val, kX + kpiW / 2, curY + 10, { align: 'center' });
        } else {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(kX, curY, kpiW, kpiH, 2, 2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          doc.text(kpi.label, kX + kpiW / 2, curY + 4.5, { align: 'center' });
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(kpi.val, kX + kpiW / 2, curY + 10, { align: 'center' });
        }
      });

      curY += kpiH + 5;

      // SECTION 1: CUADRANTE DE TURNOS DEL MES
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, curY, contentWidth, 5.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('1. CUADRANTE DE TURNOS DEL MES', margin + 3, curY + 4);

      curY += 6.5;

      // Compact 3-column calendar table
      const cols = 3;
      const colWidth = (contentWidth - 4) / cols;
      const daysPerCol = Math.ceil(monthShifts.length / cols);
      const rowH = 4.2;

      for (let c = 0; c < cols; c++) {
        const colX = margin + c * (colWidth + 2);
        // Col Header
        doc.setFillColor(226, 232, 240);
        doc.rect(colX, curY, colWidth, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(51, 65, 85);
        doc.text('DÍA', colX + 2, curY + 3);
        doc.text('TURNO / ESTADO', colX + 16, curY + 3);
        doc.text('HORAS', colX + colWidth - 2, curY + 3, { align: 'right' });

        const colDays = monthShifts.slice(c * daysPerCol, (c + 1) * daysPerCol);
        colDays.forEach((cd, rIdx) => {
          const rY = curY + 4 + rIdx * rowH;
          if (rIdx % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(colX, rY, colWidth, rowH, 'F');
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.setTextColor(15, 23, 42);
          doc.text(`${cd.dayName} ${String(cd.dayNum).padStart(2, '0')}`, colX + 2, rY + 3);

          let turnDesc = cd.type;
          let dayHours = 0;
          if (cd.shifts.length > 0) {
            turnDesc = cd.shifts.map((s: any) => `${s.start}-${s.end}`).join(' / ');
            dayHours = cd.shifts.reduce((sum: number, s: any) => sum + getShiftDuration(s.start, s.end), 0);
            if (cd.extraShifts.length > 0) {
              turnDesc += ` +H.Ext`;
              dayHours += cd.extraShifts.reduce((sum: number, s: any) => sum + getShiftDuration(s.start, s.end), 0);
            }
          }

          doc.setFont('helvetica', cd.shifts.length > 0 ? 'bold' : 'normal');
          doc.setFontSize(5.8);
          doc.setTextColor(cd.shifts.length > 0 ? 0 : 120, cd.shifts.length > 0 ? 78 : 120, cd.shifts.length > 0 ? 137 : 120);
          doc.text(turnDesc.substring(0, 24), colX + 16, rY + 3);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.setTextColor(15, 23, 42);
          doc.text(dayHours > 0 ? `${formatNumber(dayHours, 1)}h` : '-', colX + colWidth - 2, rY + 3, { align: 'right' });
        });
      }

      curY += 4 + daysPerCol * rowH + 6;

      // SECTION 2: RECIBO DE NÓMINA (DEVENGOS Y DEDUCCIONES)
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, curY, contentWidth, 5.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('2. DESGLOSE DEL RECIBO DE NÓMINA', margin + 3, curY + 4);

      curY += 7;

      const halfW = (contentWidth - 4) / 2;
      // Left: Devengos
      const devX = margin;
      doc.setFillColor(240, 253, 244);
      doc.rect(devX, curY, halfW, 4.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(22, 101, 52);
      doc.text('DEVENGOS (PERCEPCIONES)', devX + 2, curY + 3.2);
      doc.text('IMPORTE', devX + halfW - 2, curY + 3.2, { align: 'right' });

      let devY = curY + 5;
      const activeDevs = pDevengos.filter(d => d.value !== 0);
      activeDevs.forEach((d, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(252, 252, 252);
          doc.rect(devX, devY, halfW, 4.2, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(30, 41, 59);
        doc.text(d.name.substring(0, 32), devX + 2, devY + 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formatCurrency(d.value), devX + halfW - 2, devY + 3, { align: 'right' });
        devY += 4.2;
      });

      // Subtotal Devengado
      doc.setFillColor(236, 253, 245);
      doc.rect(devX, devY, halfW, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(6, 95, 70);
      doc.text('TOTAL DEVENGADO (BRUTO)', devX + 2, devY + 3.5);
      doc.text(formatCurrency(pTotalDevengado), devX + halfW - 2, devY + 3.5, { align: 'right' });
      devY += 5;

      // Right: Deducciones
      const dedX = margin + halfW + 4;
      doc.setFillColor(254, 242, 242);
      doc.rect(dedX, curY, halfW, 4.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(153, 27, 27);
      doc.text('DEDUCCIONES Y RETENCIONES', dedX + 2, curY + 3.2);
      doc.text('IMPORTE', dedX + halfW - 2, curY + 3.2, { align: 'right' });

      let dedY = curY + 5;
      const activeDeds = pDeducciones.filter(d => d.value !== 0);
      activeDeds.forEach((d, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(252, 252, 252);
          doc.rect(dedX, dedY, halfW, 4.2, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(30, 41, 59);
        const rateStr = d.rate ? ` (${d.rate}%)` : '';
        doc.text(`${d.name}${rateStr}`.substring(0, 32), dedX + 2, dedY + 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text(`-${formatCurrency(d.value)}`, dedX + halfW - 2, dedY + 3, { align: 'right' });
        dedY += 4.2;
      });

      pConceptosADescontar.filter(c => c.value !== 0).forEach((c, idx) => {
        if ((activeDeds.length + idx) % 2 === 0) {
          doc.setFillColor(252, 252, 252);
          doc.rect(dedX, dedY, halfW, 4.2, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(30, 41, 59);
        doc.text(c.name.substring(0, 32), dedX + 2, dedY + 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text(formatCurrency(c.value), dedX + halfW - 2, dedY + 3, { align: 'right' });
        dedY += 4.2;
      });

      // Subtotal Deducciones
      doc.setFillColor(254, 226, 226);
      doc.rect(dedX, dedY, halfW, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(153, 27, 27);
      doc.text('TOTAL A DEDUCIR', dedX + 2, dedY + 3.5);
      doc.text(`-${formatCurrency(pTotalDeducciones)}`, dedX + halfW - 2, dedY + 3.5, { align: 'right' });
      dedY += 5;

      curY = Math.max(devY, dedY) + 4;

      // BASES Y LÍQUIDO FINAL
      const bW = (contentWidth - 6) / 3;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, curY, bW, 12, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('BASE COTIZACIÓN SEG. SOCIAL', margin + 3, curY + 4.5);
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(formatCurrency(pBaseCotizacion), margin + 3, curY + 9.5);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin + bW + 3, curY, bW, 12, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('BASE IRPF / TRIBUTABLE', margin + bW + 6, curY + 4.5);
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(formatCurrency(pTotalDevengado), margin + bW + 6, curY + 9.5);

      // Final Net Liquid Box
      const liqX = margin + 2 * (bW + 3);
      doc.setFillColor(16, 185, 129); // emerald
      doc.roundedRect(liqX, curY, bW, 12, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(236, 253, 245);
      doc.text('LÍQUIDO TOTAL A PERCIBIR', liqX + bW / 2, curY + 4.5, { align: 'center' });
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text(formatCurrency(pLiquido), liqX + bW / 2, curY + 9.5, { align: 'center' });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Documento informativo generado por la aplicación de Gestión de Turnos y Nóminas del Sector de Handling. Página 1 de 1.`, margin, pageHeight - 8);

      doc.save(`Hoja_Turnos_Nomina_${safeFormat(monthDate, 'yyyy_MM')}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF de nómina:', err);
    }
  };

  const detailedComparison = useMemo(() => {
    if (!uploadedPayroll) return null;

    const normalize = (str: string) => str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\(\)]/g, "")
      .replace(/plus\s+/g, '')
      .replace(/salario\s+/g, '')
      .replace(/ajuste\s+/g, '')
      .replace(/de\s+/g, '')
      .replace(/\s+/g, '')
      .trim();

    const isMatch = (appN: string, pdfN: string) => {
      const app = appN.trim();
      const pdf = pdfN.trim();
      const lowerApp = app.toLowerCase();
      const lowerPdf = pdf.toLowerCase();
      
      if (app.startsWith('Jornada Fraccionada < 4h') && pdf === 'JORNADA FRACC CONVENIO') return true;
      if (app.startsWith('Jornada Fraccionada >= 4h') && pdf === 'PLUS JORNADA FRACC.C+ 4H') return true;
      if (app.startsWith('Jornada Fraccionada >= 7h') && pdf === 'PLUS JORNADA FRACC.C+ 7H') return true;
      if (app.startsWith('Tiempo Parcial - Discontinuo') && pdf === 'PLUS FIJO TIEMPO PARCIAL') return true;
      if (app.startsWith('Transporte') && pdf === 'PLUS TRANSPORTE C') return true;
      if (app.startsWith('Turnicidad') && pdf.startsWith('PLUS TURNICIDAD')) return true;
      if (app.startsWith('Madrugue') && pdf === 'MADRUGUE CON') return true;
      if (app.startsWith('Festivo') && pdf === 'PLUS FESTIVO CON') return true;
      if (app.startsWith('Domingo') && pdf === 'PLUS DOMINGO CON') return true;
      if (app.startsWith('Nocturnas') && pdf === 'PLUS NOCTURNO CONV') return true;
      if (app.startsWith('Complementarias') && !lowerApp.includes('noc') && pdf === 'HHCC ESPECIALES') return true;
      if (lowerApp.startsWith('complementarias noc') && pdf === 'HHCC ESPECIALES NOCTURNAS') return true;
      if (app.startsWith('Perentorias') && !lowerApp.includes('noc') && (pdf === 'HORAS PERENTORIA D CON' || pdf === 'HORAS PERENT D CON')) return true;
      if (lowerApp.startsWith('perentorias noc') && (pdf === 'HORAS PERENTORIA NOCTURNA CON' || pdf === 'HORAS PERENT N CON')) return true;
      if ((app === 'Impuntualidad' || app === 'Impuntualidad/Absent') && pdf === 'IMPUNTUALIDAD/ABSENT') return true;
      if ((app === 'Concepto a descontar' || app === 'Descuento de Dinero') && (pdf === 'CONCEPTO A DESCONTAR' || pdf === 'DESCUENTO DE DINERO')) return true;
      if (app === 'Productividad' && pdf === 'PLUS PRODUCTIVIDAD') return true;
      if (app === 'Multitasking' && pdf === 'PLUS MULTITASKING') return true;
      if (app === 'Ajuste de Jornada' && pdf === 'AJUSTE JORNADA MES') return true;
      if (app === 'Teamleader' && pdf === 'PLUS SUPERVISIÓN') return true;

      if (app.startsWith('Contingencia') && pdf === 'Aportac. Contingencias Comunes') return true;
      if (app === 'Desempleo' && (pdf === 'Aportación Desempleo' || pdf === 'Aportacion Desempleo')) return true;
      if (app === 'Formación' && (pdf === 'Aportación Formación Profes.' || pdf === 'Aportacion Formacion Profes.')) return true;
      if (app === 'Mecanismo Equidad' && pdf === 'Aportac. Mecanismo de equidad') return true;
      if (app === 'IRPF' && pdf === 'IRPF Cta. Ajena Dinerarios') return true;
      if (app === 'Cuota Sindical' && lowerPdf.includes('cuota sindical')) return true;

      return normalize(app) === normalize(pdf);
    };

    const devengosForApp = [
      ...devengos.filter(d => (d as any).value !== 0 && !d.isProrrata)
    ];

    const deduccionesForApp = [
      ...deducciones,
      ...conceptosADescontar.filter(c => c.name === 'Cuota Sindical' && c.value !== 0)
        .map(c => ({ ...c, value: Math.abs(c.value) }))
    ];

    const buildComparison = (pdfList: any[], appList: any[]) => {
      const matchedAppIndices = new Set<number>();
      const results: any[] = [];

      pdfList.forEach(pdf => {
        const appIdx = appList.findIndex((app, idx) => !matchedAppIndices.has(idx) && isMatch(app.name, pdf.concepto));
        if (appIdx !== -1) {
          matchedAppIndices.add(appIdx);
          const app = appList[appIdx];
          results.push({
            name: pdf.concepto,
            pdfValue: pdf.importe,
            appValue: app.value,
            diff: Math.round((pdf.importe - app.value) * 100) / 100,
            pdfQty: pdf.unidades,
            pdfPrice: pdf.precio,
            appQty: app.qty,
            appPrice: app.price,
            pdfRate: pdf.tipo,
            appRate: app.rate
          });
        } else {
          results.push({
            name: pdf.concepto,
            pdfValue: pdf.importe,
            appValue: 0,
            diff: pdf.importe,
            pdfQty: pdf.unidades,
            pdfPrice: pdf.precio,
            appQty: undefined,
            appPrice: undefined,
            pdfRate: pdf.tipo,
            appRate: undefined
          });
        }
      });

      appList.forEach((app, idx) => {
        if (!matchedAppIndices.has(idx)) {
          results.push({
            name: app.name,
            pdfValue: 0,
            appValue: app.value,
            diff: Math.round((-app.value) * 100) / 100,
            pdfQty: undefined,
            pdfPrice: undefined,
            appQty: app.qty,
            appPrice: app.price,
            pdfRate: undefined,
            appRate: app.rate
          });
        }
      });

      return results;
    };

    const devengoComparison = buildComparison(uploadedPayroll.data.devengos, devengosForApp);
    const deduccionComparison = buildComparison(uploadedPayroll.data.deducciones, deduccionesForApp);

    const pdfDevTotal = uploadedPayroll.data.totalDevengados || devengoComparison.reduce((sum, item) => sum + item.pdfValue, 0);
    const appDevTotal = devengoComparison.reduce((sum, item) => sum + item.appValue, 0);
    const pdfDedTotal = uploadedPayroll.data.totalDeducciones || deduccionComparison.reduce((sum, item) => sum + item.pdfValue, 0);
    const appDedTotal = deduccionComparison.reduce((sum, item) => sum + item.appValue, 0);

    return { 
      devengoComparison, 
      deduccionComparison,
      totals: {
        pdfDevengos: Math.round(pdfDevTotal * 100) / 100,
        appDevengos: Math.round(appDevTotal * 100) / 100,
        pdfDeducciones: Math.round(pdfDedTotal * 100) / 100,
        appDeducciones: Math.round(appDedTotal * 100) / 100,
      }
    };
  }, [uploadedPayroll, devengos, deducciones, conceptosADescontar]);

  const handleSavePayroll = () => {
    const saveMonthKey = payrollMode === 'extra' 
      ? `${currentMonthKey}-extra` 
      : payrollMode === 'vacation_variables' 
        ? `${currentMonthKey}-vacaciones` 
        : currentMonthKey;
    const newSavedPayroll: SavedPayroll = {
      id: Date.now().toString(),
      monthKey: saveMonthKey,
      saveDate: new Date().toISOString(),
      devengos: displayDevengos
        .filter(d => {
          if (payrollMode === 'vacation_variables') {
            const qtyNum = typeof d.qty === 'number' ? d.qty : (parseFloat(String(d.qty)) || 0);
            return qtyNum > 0;
          }
          return (d.value !== 0) || (d as any).isProrrata;
        })
        .map(d => ({ name: d.name, qty: d.qty, price: d.price, value: d.value, isProrrata: (d as any).isProrrata })),
      conceptosADescontar: (payrollMode === 'extra' || payrollMode === 'vacation_variables') ? [] : conceptosADescontar.map(d => ({ name: d.name, qty: d.qty, price: d.price, value: d.value })),
      deducciones: displayDeducciones.map(d => ({ name: d.name, base: d.base, rate: d.rate, value: d.value })),
      totals: { 
        totalDevengado: displayTotalDevengado, 
        totalDescuentos: (payrollMode === 'extra' || payrollMode === 'vacation_variables') ? 0 : totalDescuentos, 
        totalDeducciones: displayTotalDeducciones, 
        liquido: displayLiquido, 
        baseCotizacion 
      },
      settings: { contractType: settings.contractType, pagas: settings.pagas, level: activeLevel, irpf: monthlyOpts.irpf || settings.irpf },
      notes: payrollMode === 'monthly' ? (monthlyOpts.notes || undefined) : undefined
    };
    updateSettings({ ...settings, savedPayrolls: [newSavedPayroll, ...(settings.savedPayrolls || [])] });
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 5000);
  };

  const handleDeleteSavedPayroll = (id: string) => {
    setPayrollToDelete(id);
  };

  const persistUploadedPayroll = (extractedData: ExtractedPayrollPayload) => {
    const newUploadedPayroll: UploadedPayroll = {
      id: Date.now().toString(),
      monthKey: currentMonthKey,
      uploadDate: new Date().toISOString(),
      data: extractedData
    };

    updateSettings({
      ...settings,
      uploadedPayrolls: [
        ...(settings.uploadedPayrolls || []).filter((p: UploadedPayroll) => p.monthKey !== currentMonthKey),
        newUploadedPayroll
      ]
    });

    setPendingReviewPayroll(null);
    setIsRetryingReview(false);
    setShowUploadSuccess(true);
    setStagedFiles([]);
    setTimeout(() => setShowUploadSuccess(false), 5000);
  };

  const handleRetryReviewAnalysis = async () => {
    if (!pendingReviewPayroll || isRetryingReview) return;
    setIsRetryingReview(true);
    setUploadError(null);

    try {
      const retriedData = await extractPayrollData({
        ...pendingReviewPayroll.payload,
        strictRetry: true,
      });

      if (retriedData.validation && !retriedData.validation.isBalanced) {
        setPendingReviewPayroll({
          ...pendingReviewPayroll,
          data: retriedData,
        });
      } else {
        persistUploadedPayroll(retriedData);
      }
    } catch (error: any) {
      setUploadError(error instanceof Error ? error.message : 'No se pudo reintentar el análisis.');
      setPendingReviewPayroll(null);
    } finally {
      setIsRetryingReview(false);
    }
  };

  const handleUploadPayroll = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = stagedFiles.length > 0 ? stagedFiles : (e?.target.files ? Array.from(e.target.files) : []);
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadStep('reading');
    setUploadError(null);
    setShowUploadInfo(false);
    setIsUploadModalOpen(false);
    setPendingReviewPayroll(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const pdfFiles = filesToUpload
        .filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
        .slice(0, 4);
      const imageFiles = filesToUpload
        .filter(f => f.type.startsWith('image/'))
        .slice(0, 10);

      let allText = "";
      let base64Images: string[] = [];
      let pdfDocuments: PayrollPdfDocument[] = [];

      // Process PDFs natively (full visual layout) + non-fatal auxiliary text extraction
      if (pdfFiles.length > 0) {
        pdfDocuments = await Promise.all(
          pdfFiles.map(async (file) => ({
            data: await fileToBase64(file),
            name: file.name,
          }))
        );

        try {
          const [pdfjsLib, pdfWorkerModule] = await Promise.all([
            import('pdfjs-dist'),
            // @ts-ignore
            import('pdfjs-dist/build/pdf.worker?url'),
          ]);
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default;

          const extractedTexts = await Promise.all(
            pdfFiles.map(async (file) => {
              try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(async (i) => {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  return textContent.items.map((item: any) => item.str).join(" ");
                });
                const pagesText = await Promise.all(pagePromises);
                return pagesText.join("\n");
              } catch {
                return "";
              }
            })
          );
          allText = extractedTexts.filter(Boolean).join("\n\n");
        } catch {
          // Non-fatal: Gemini reads the native PDF directly
        }
      }

      // Process screenshots at higher resolution so small payroll table digits stay crisp
      if (imageFiles.length > 0) {
        base64Images = await Promise.all(imageFiles.map(file => compressImageFile(file, 2200, 0.90)));
      }

      if (controller.signal.aborted) return;

      setUploadStep('analyzing');
      const monthName = safeFormat(currentMonth, 'MMMM yyyy', { locale: es });
      const requestPayload = {
        text: allText,
        monthContext: monthName,
        base64Images,
        pdfDocuments,
      };
      const extractedData = await extractPayrollData({
        ...requestPayload,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (extractedData.validation && !extractedData.validation.isBalanced) {
        setPendingReviewPayroll({
          data: extractedData,
          payload: requestPayload,
        });
      } else {
        persistUploadedPayroll(extractedData);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.message !== 'Aborted') {
        setUploadError(error instanceof Error ? error.message : "Error al procesar el documento.");
      }
    } finally {
      setIsUploading(false);
      setUploadStep('idle');
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t-2 border-slate-100">
      {/* Upload Loading Overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-[200] bg-white/85 dark:bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center" data-modal-active="true">
          <div className="w-16 h-16 bg-azul-blue/10 dark:bg-azul-blue/20 rounded-3xl flex items-center justify-center text-azul-blue dark:text-sky-400 mb-4">
            <Loader2 size={32} className="animate-spin" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
            {uploadStep === 'reading' ? 'Leyendo Nómina' : 'Analizando y cuadrando importes'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs mb-6 text-sm">
            {uploadStep === 'reading' 
              ? 'Preparando el PDF y las capturas con máxima nitidez...' 
              : 'Extrayendo conceptos y verificando que las sumas cuadren con el líquido...'}
          </p>
          <button
            onClick={() => {
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
              }
              setIsUploading(false);
              setUploadStep('idle');
              setUploadProgress(0);
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
                {uploadStep === 'reading' ? 'Extrayendo datos de nómina...' : 'Interpretando conceptos con IA...'}
              </span>
              <span className="font-mono text-[11px] font-black text-azul-blue dark:text-sky-400">
                {Math.round(uploadProgress)}%
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
              <div 
                className="h-full bg-linear-to-r from-azul-blue via-sky-500 to-indigo-600 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                style={{ width: `${Math.max(5, Math.min(100, uploadProgress))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[pulse_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="text-center">
        <div 
          id="nomina-header-pill"
          className="nomina-header-pill flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 bg-azul-blue dark:bg-azul-blue/15 rounded-full shadow-xl shadow-azul-blue/20 dark:shadow-none w-full max-w-[280px] sm:max-w-[320px] mx-auto border border-white/20 dark:border-blue-400/40 scale-95 sm:scale-100"
        >
          <Wallet className="text-azul-yellow w-5 h-5 sm:w-6 sm:h-6" size={20} />
          <h2 className="text-lg sm:text-xl font-black text-white dark:text-azul-blue uppercase tracking-tight leading-none">
            NÓMINA
          </h2>
        </div>
      </div>

      <section className="space-y-4">
        {/* Toggle para Paga Extra (solo en Junio y Diciembre con 14 pagas) */}
        {(isSummerExtra || isWinterExtra) && (
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 max-w-[320px] mx-auto border border-slate-200/50 shadow-inner">
            <button
              onClick={() => setPayrollMode('monthly')}
              className={cn(
                "flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2",
                payrollMode === 'monthly' 
                  ? "bg-white text-azul-blue shadow-sm" 
                  : "text-slate-400 hover:text-slate-500"
              )}
            >
              <FileText size={12} />
              Nómina Mensual
            </button>
            <button
              onClick={() => setPayrollMode('extra')}
              className={cn(
                "flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2",
                payrollMode === 'extra' 
                  ? "bg-white text-azul-blue shadow-sm" 
                  : "text-slate-400 hover:text-slate-500"
              )}
            >
              <ArrowUpRight size={12} className="text-azul-yellow" />
              Paga Extra
            </button>
          </div>
        )}

        {/* Toggle para Variables Vacaciones del año anterior (solo en Marzo) */}
        {isMarch && (
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 max-w-[360px] mx-auto border border-slate-200/50 shadow-inner">
            <button
              onClick={() => setPayrollMode('monthly')}
              className={cn(
                "flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2",
                payrollMode === 'monthly' 
                  ? "bg-white text-azul-blue shadow-sm" 
                  : "text-slate-400 hover:text-slate-500"
              )}
            >
              <FileText size={12} />
              Nómina Mensual
            </button>
            <button
              onClick={() => setPayrollMode('vacation_variables')}
              className={cn(
                "flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2",
                payrollMode === 'vacation_variables' 
                  ? "bg-white text-emerald-700 shadow-sm" 
                  : "text-slate-400 hover:text-slate-500"
              )}
            >
              <Palmtree size={12} className="text-emerald-500" />
              Variables Vacaciones ({prevYear})
            </button>
          </div>
        )}



        <div 
          onClick={() => setIsUploadExpanded(!isUploadExpanded)} 
          className="w-full bg-white rounded-[1.5rem] shadow-sm border border-slate-100 p-3.5 flex items-center justify-between group transition-colors hover:bg-slate-50 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azul-blue/10 rounded-xl text-azul-blue group-hover:bg-azul-blue group-hover:text-white transition-all"><Upload size={14} /></div>
            <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-tight text-left">SUBIR NÓMINA (PDF/CAPTURA)</h3>
          </div>
          <div className={cn("p-1 rounded-lg transition-all", isUploadExpanded ? "bg-azul-blue text-white rotate-180" : "bg-slate-100 text-slate-400")}>
            <ChevronDown size={14} />
          </div>
        </div>

        <AnimatePresence>
          {isUploadExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 shadow-sm mx-1">
                <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-900 leading-tight text-left uppercase">
                  La lectura automática de nóminas puede dar error al subir el archivo o contener errores.
                </p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    setStagedFiles(prev => [...prev, ...Array.from(files)]);
                    setIsUploadModalOpen(true);
                    setIsUploadExpanded(false);
                  }
                }} 
                multiple
                accept="application/pdf,image/*" 
                className="hidden" 
              />
              {uploadedPayroll ? (
                <div className="bg-white rounded-3xl border border-azul-blue/10 shadow-sm overflow-hidden p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-azul-blue/10 rounded-xl text-azul-blue"><FileText size={18} /></div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-xs">PDF - {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}</h4>
                      </div>
                    </div>
                    <button onClick={() => setIsDeleteUploadedConfirmOpen(true)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100/50">
                      <span className="block text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Líquido PDF</span>
                      <span className="text-xl font-black text-rose-800">{formatCurrency(uploadedPayroll.data.liquido)}</span>
                    </div>
                    <div className={cn("p-4 rounded-2xl border flex flex-col items-center justify-center text-center", Math.abs(liquido - uploadedPayroll.data.liquido) <= 0.05 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200")}>
                      <span className="block text-[10px] font-black uppercase tracking-widest mb-1">Diferencia</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black">{formatNumber(liquido - uploadedPayroll.data.liquido)} €</span>
                        {Math.abs(liquido - uploadedPayroll.data.liquido) <= 0.05 && (
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white scale-110 shadow-sm animate-in zoom-in duration-300">
                            <Check size={12} strokeWidth={4} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {detailedComparison && (
                    <div id="analisis-diferencias-box" className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                          Análisis de Diferencias
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/50 px-2 py-0.5 rounded-full">
                          {detailedComparison.devengoComparison.filter(item => Math.abs(item.diff) > 0.05).length === 0 ? 'Coincide' : 'Diferencias'}
                        </span>
                      </div>
                      {(() => {
                        const diffDev = detailedComparison.devengoComparison.filter(item => Math.abs(item.diff) > 0.05);

                        if (diffDev.length === 0) {
                          return (
                            <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1.5 py-1">
                              <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={3} />
                              <span>Todos los devengos brutos coinciden perfectamente entre el PDF y la App.</span>
                            </p>
                          );
                        }

                        return (
                          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                            {diffDev.map((item, idx) => {
                              const nameLower = item.name.toLowerCase();
                              const isHiddenQtyConcept = 
                                nameLower.includes('salario base') ||
                                nameLower.includes('parcial') ||
                                nameLower.includes('turnicidad') ||
                                nameLower.includes('multitasking') ||
                                nameLower.includes('productividad') ||
                                nameLower.includes('teamleader') ||
                                nameLower.includes('jornada irregular') ||
                                nameLower.includes('pp extra') ||
                                nameLower.includes('ajuste de jornada');

                              const hasPdfQty = !isHiddenQtyConcept && item.pdfQty !== undefined && item.pdfQty !== null && String(item.pdfQty).trim() !== '' && String(item.pdfQty).trim() !== '0';
                              const hasAppQty = !isHiddenQtyConcept && item.appQty !== undefined && item.appQty !== null && String(item.appQty).trim() !== '' && String(item.appQty).trim() !== '0';

                              if (hasPdfQty || hasAppQty) {
                                return (
                                  <p key={`dev-txt-${idx}`} className="text-xs text-slate-600 leading-relaxed">
                                    • En la nómina PDF se ha cobrado <strong className="text-rose-600 font-bold">{item.pdfQty || 0}</strong> <span className="font-bold text-slate-800 uppercase text-[11px]">{item.name}</span> a <strong className="text-rose-600 font-bold">{formatNumber(item.pdfPrice ?? 0, 2)}€</strong> (total <strong className="text-rose-600 font-bold">{formatNumber(item.pdfValue, 2)}€</strong>) y en la app se han registrado <strong className="text-azul-blue font-bold">{item.appQty || 0}</strong> <span className="font-bold text-slate-800 uppercase text-[11px]">{item.name}</span> a <strong className="text-azul-blue font-bold">{formatNumber(item.appPrice ?? 0, 2)}€</strong> (total <strong className="text-azul-blue font-bold">{formatNumber(item.appValue, 2)}€</strong>).
                                  </p>
                                );
                              }

                              return (
                                <p key={`dev-txt-${idx}`} className="text-xs text-slate-600 leading-relaxed">
                                  • En la nómina PDF se ha cobrado <strong className="text-rose-600 font-bold">{formatNumber(item.pdfValue, 2)}€</strong> en <span className="font-bold text-slate-800 uppercase text-[11px]">{item.name}</span> y en la app se han registrado <strong className="text-azul-blue font-bold">{formatNumber(item.appValue, 2)}€</strong>.
                                </p>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <button onClick={() => setIsComparisonModalOpen(true)} className="w-full h-12 bg-azul-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-azul-blue/20 hover:bg-azul-blue/90 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <ArrowLeftRight size={16} />
                    Ver Comparativa Detallada
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-12 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] space-y-4 group hover:bg-slate-100 transition-all">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm text-slate-300 group-hover:text-azul-blue transition-colors">{isUploading ? <Loader2 className="animate-spin" size={32} /> : <FileText size={32} />}</div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Sube tú nómina en formato PDF o imagen para comparar los datos</p>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div id="previsualizacion-nomina-card" className={cn(
        "relative overflow-hidden rounded-[2rem] p-5 sm:p-8 text-white shadow-2xl transition-all duration-500 border border-white/10 isolate transform-gpu",
        payrollMode === 'extra' 
          ? "bg-gradient-to-br from-[#0d1b2a] via-[#1b263b] to-[#0d131a] shadow-[#1b263b]/30" 
          : payrollMode === 'vacation_variables'
            ? "bg-gradient-to-br from-[#062c26] via-[#0b3d35] to-[#041c18] shadow-emerald-950/40"
            : "bg-gradient-to-br from-slate-900 via-[#0a192f] to-slate-950 shadow-slate-950/40"
      )}>
        {/* Efectos sutiles de luz */}
        <div className={cn(
          "absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-25",
          payrollMode === 'extra' ? "bg-amber-400" : "bg-emerald-400"
        )} />
        <div className={cn(
          "absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20",
          payrollMode === 'extra' ? "bg-azul-blue" : "bg-blue-500"
        )} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/[0.02] rounded-full blur-2xl pointer-events-none" />

        {/* Aviso Flotante de Confirmación */}
        <AnimatePresence>
          {showSaveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              className="absolute top-4 right-4 z-30 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-2.5 backdrop-blur-xl border border-emerald-300"
            >
              <div className="w-5 h-5 bg-slate-950 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 size={13} strokeWidth={3} />
              </div>
              <span>¡Nómina guardada con éxito!</span>
              <button 
                onClick={() => setShowSaveSuccess(false)} 
                className="ml-1 text-slate-950/70 hover:text-slate-950 font-bold transition-colors"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="relative flex flex-col gap-6 z-10">
          {hideAmounts && (
            <div className="flex items-center gap-2.5 bg-amber-400/20 border border-amber-400/40 rounded-2xl p-3.5 text-amber-100 backdrop-blur-md shadow-sm">
              <div className="p-1.5 rounded-xl bg-amber-400/30 text-amber-200 shrink-0">
                <EyeOff size={16} strokeWidth={2.5} />
              </div>
              <p className="text-[11px] sm:text-xs font-bold leading-snug">
                <span className="font-black uppercase tracking-wider text-amber-300">Nómina Privada:</span>{' '}
                El propietario del cuadrante ha ocultado los importes económicos en el modo lectura compartido.
              </p>
            </div>
          )}

          {levelJumpInfo && (() => {
            const totalDays = endOfMonth(currentMonth).getDate();
            const jumpDay = levelJumpInfo.date.getDate();
            const prevDays = Math.max(0, Math.min(totalDays, jumpDay - 1));
            const newDays = Math.max(0, totalDays - prevDays);

            return (
              <div className="flex flex-col gap-2.5 bg-amber-400/15 border border-amber-400/35 rounded-2xl p-3.5 text-amber-200 backdrop-blur-md shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-amber-400/20 text-amber-300 shrink-0">
                    <TrendingUp size={15} strokeWidth={2.5} />
                  </div>
                  <p className="text-[11px] sm:text-xs font-bold leading-snug text-amber-100">
                    <span className="font-black uppercase tracking-wider text-amber-300">Salto de nivel este mes:</span>{' '}
                    Subes de <span className="font-black text-white">Nivel {levelJumpInfo.fromLevel}</span> a <span className="font-black text-white">Nivel {levelJumpInfo.toLevel}</span> el <span className="font-black text-amber-300">{safeFormat(levelJumpInfo.date, "d 'de' MMMM", { locale: es })}</span>.
                  </p>
                </div>

                {jumpDay > 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => saveMonthlyOptions(currentMonth, { ...monthlyOpts, levelJumpMode: 'full_month', manualLevel: undefined })}
                        className={cn(
                          "py-2 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer",
                          activeLevelJumpMode === 'full_month'
                            ? "bg-amber-400 text-black border-amber-300 shadow-sm"
                            : "bg-white/10 text-white/80 border-white/15 hover:bg-white/15"
                        )}
                      >
                        Todo el mes (Niv. {levelJumpInfo.toLevel})
                      </button>
                      <button
                        type="button"
                        onClick={() => saveMonthlyOptions(currentMonth, { ...monthlyOpts, levelJumpMode: 'exact_day', manualLevel: undefined })}
                        className={cn(
                          "py-2 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer",
                          activeLevelJumpMode === 'exact_day'
                            ? "bg-amber-400 text-black border-amber-300 shadow-sm"
                            : "bg-white/10 text-white/80 border-white/15 hover:bg-white/15"
                        )}
                      >
                        Desde el día {jumpDay} (incl.)
                      </button>
                    </div>

                    {activeLevelJumpMode === 'exact_day' && prevDays > 0 && (
                      <p className="text-[10px] font-bold text-amber-200/90 leading-tight px-1">
                        Prorrateo: del 1 al {jumpDay - 1} ({prevDays}d) a Nivel {levelJumpInfo.fromLevel} y del {jumpDay} (inclusive) al {totalDays} ({newDays}d) a Nivel {levelJumpInfo.toLevel}.
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* Fila Superior: Controles en píldoras estilizadas en la misma línea */}
          <div className="flex flex-row items-center gap-2 sm:gap-2.5 flex-nowrap w-full overflow-x-auto no-scrollbar">
            {/* Píldora Nivel Salarial */}
            <div id="payroll-nivel-salarial-box" className="group flex items-center gap-1.5 sm:gap-2.5 bg-white/[0.08] backdrop-blur-xl border border-white/15 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px] shadow-inner touch-manipulation shrink-0">
              <div className="flex items-center gap-1.5 text-blue-300 font-bold text-xs uppercase tracking-wider">
                <LayoutGrid size={13} className="shrink-0 text-blue-400" />
                <span>Nivel</span>
              </div>
              <div className="relative flex items-center">
                <select 
                  value={activeLevel} 
                  onChange={(e) => saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualLevel: parseInt(e.target.value) })}
                  className="bg-transparent font-black text-white text-sm focus:outline-none appearance-none cursor-pointer pr-5 sm:pr-6 tracking-tight min-h-[32px] sm:min-h-[36px] touch-manipulation"
                >
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n} className="text-slate-900 font-black">Nivel {n}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-white/60 group-hover:text-white transition-colors" />
              </div>
            </div>

            {/* Píldora IRPF % */}
            <div id="payroll-irpf-box" className="group flex items-center gap-1.5 sm:gap-2.5 bg-white/[0.08] backdrop-blur-xl border border-white/15 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px] shadow-inner touch-manipulation shrink-0">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                <TrendingUp size={13} className="shrink-0 text-emerald-400" />
                <span>IRPF</span>
              </div>
              <div className="flex items-center gap-0.5">
                <LocalInput 
                  type="number" 
                  value={monthlyOpts.irpf === 0 ? '' : monthlyOpts.irpf} 
                  onChange={(val) => saveMonthlyOptions(currentMonth, { ...monthlyOpts, irpf: parseFloat(val) || 0 })} 
                  className="w-11 sm:w-14 bg-transparent font-black text-white text-sm text-right focus:outline-none tracking-tight min-h-[32px] sm:min-h-[36px] touch-manipulation" 
                />
                <span className="text-xs font-black text-white/70 group-hover:text-white transition-colors">%</span>
              </div>
            </div>
          </div>

          {/* Tarjeta Glassmorphism: Líquido a Percibir */}
          {/* Líquido a Percibir */}
          <div id="liquido-percibir-box" className="space-y-2.5 mt-2">
            {/* Encabezado con icono y título Líquido Neto a Percibir (no se mueve, tamaño 10) */}
            <div className="flex items-center gap-1.5 text-white/80">
              <div className={cn(
                "p-1 rounded-md border border-white/10 backdrop-blur-md shadow-xs flex items-center justify-center shrink-0",
                payrollMode === 'extra' 
                  ? "bg-amber-400/20 text-amber-300" 
                  : payrollMode === 'vacation_variables'
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "bg-emerald-400/20 text-emerald-300"
              )}>
                {payrollMode === 'vacation_variables' ? <Palmtree size={10} strokeWidth={2.5} /> : <Wallet size={10} strokeWidth={2.5} />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-white/90 leading-none">
                {payrollMode === 'extra' 
                  ? (isSummerExtra ? 'Líquido Extra de Verano' : 'Líquido Extra de Navidad') 
                  : payrollMode === 'vacation_variables'
                    ? `Líquido Variables Vacaciones (${prevYear})`
                    : 'Líquido Neto a Percibir'}
              </span>
            </div>

            {/* Contenido centrado: importe + botones de acción (guardar y editar) + píldoras inferiores con detalles de contrato */}
            <div className="flex flex-col items-center justify-center text-center gap-3.5 sm:gap-4 py-1 w-full">
              {/* Importe y Botones con layout totalmente responsivo para evitar recortes o desplazamientos en iPhone */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 w-full">
                <div className="flex items-baseline justify-center gap-1.5 shrink-0">
                  <span className="text-4xl xs:text-5xl sm:text-7xl font-black tracking-tight text-white drop-shadow-md leading-none">
                    {hideAmounts ? '••••' : formatNumber(displayLiquido, 2)}
                  </span>
                  <span className="text-xl xs:text-2xl sm:text-3xl font-extrabold text-white/70 leading-none">€</span>
                </div>

                {/* Botones de acción: Guardar y Editar con touch target amplio y adaptado a iOS */}
                {!hideAmounts && (
                  <div className="flex flex-row sm:flex-col items-center justify-center gap-2 sm:gap-2 w-full sm:w-auto shrink-0">
                    <button 
                      type="button"
                      id="payroll-save-btn"
                      onClick={handleSavePayroll} 
                      title="Guardar nómina"
                      aria-label="Guardar nómina"
                      className={cn(
                        "flex-1 sm:flex-initial min-h-[44px] min-w-[110px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.98] shadow-xl shrink-0 cursor-pointer whitespace-nowrap select-none touch-manipulation",
                        payrollMode === 'extra'
                          ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-amber-500/20"
                          : "bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 hover:from-emerald-300 hover:to-emerald-400 shadow-emerald-500/20"
                      )}
                    >
                      <Save size={15} strokeWidth={2.5} className="shrink-0" />
                      <span>Guardar</span>
                    </button>

                    <button 
                      type="button"
                      id="payroll-edit-btn"
                      onClick={() => {
                        setIsDevengosExpanded(true);
                        setIsEditingDevengos(true);
                        setTimeout(() => {
                          const el = document.getElementById('total-devengado-section');
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 60);
                      }} 
                      title="Editar conceptos devengados"
                      aria-label="Editar conceptos devengados"
                      className={cn(
                        "flex-1 sm:flex-initial min-h-[44px] min-w-[110px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-150 active:scale-[0.98] shadow-xl shrink-0 cursor-pointer whitespace-nowrap select-none touch-manipulation",
                        payrollMode === 'extra'
                          ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-amber-500/20"
                          : "bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 hover:from-emerald-300 hover:to-emerald-400 shadow-emerald-500/20"
                      )}
                    >
                      <Edit2 size={15} strokeWidth={2.5} className="shrink-0" />
                      <span>Editar</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Píldoras inferiores con los detalles del contrato centradas */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {settings.contractType !== 'Completo' && payrollMode === 'monthly' && (
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-emerald-300 bg-emerald-500/20 px-2.5 sm:px-3 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md shadow-sm whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{formatNumber(currentStats.effectivePercentage, 2)}% jornada</span>
                  </div>
                )}
                {payrollMode === 'extra' && (
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-amber-300 bg-amber-500/20 px-2.5 sm:px-3 py-1 rounded-full border border-amber-500/30 backdrop-blur-md shadow-sm whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Suma 6 meses PP Extra ({isSummerExtra ? 'Ene - Jun' : 'Jul - Dic'})</span>
                  </div>
                )}
                <div className="text-[10px] sm:text-xs font-bold text-white/70 bg-white/[0.07] px-2.5 sm:px-3 py-1 rounded-full border border-white/10 backdrop-blur-md whitespace-nowrap">
                  {settings.contractType} • {settings.pagas} Pagas
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Desplegable AJUSTES (Solo en Variables Vacaciones, antes de TOTAL DEVENGADO) */}
        {payrollMode === 'vacation_variables' && (
          <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 flex flex-col justify-between col-span-full">
            <div
              onClick={() => setIsVacationSettingsExpanded(!isVacationSettingsExpanded)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors group select-none"
            >
              <div className="flex items-center gap-3">
                <SettingsIcon size={18} className="text-azul-blue shrink-0" />
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-black dark:text-white">AJUSTES</span>
                  <span className="text-sm sm:text-base font-black text-azul-blue dark:text-sky-400">
                    Divisor / {vacationDivisorMode === 'worked_months' ? formatNumber(vacationVariablesDivisor, 2) : vacationVariablesDivisor}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 rounded-xl transition-all",
                  isVacationSettingsExpanded ? "bg-azul-blue text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                )}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isVacationSettingsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-100 dark:border-white/[0.025]"
                >
                  <div className="p-4 space-y-3.5 bg-slate-50/40 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10.5px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        Ajuste del divisor · Nóminas Feb {prevYear} – Ene {currentYear}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          saveMonthlyOptions(currentMonth, {
                            ...monthlyOpts,
                            vacationVariablesDivisorMode: '11',
                            vacationVariablesDivisor: 11,
                            vacationVariablesPrevYearVacDays: undefined,
                            vacationVariablesWorkedMonths: undefined,
                          })
                        }
                        className="px-2.5 py-1 text-[9.5px] font-black uppercase rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1 cursor-pointer"
                        title="Restablecer divisor por defecto"
                      >
                        <RotateCcw size={10} />
                        Por defecto
                      </button>
                    </div>

                    {/* Opciones de Divisor (Sin Total): /11, /12, Meses trabajados */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          saveMonthlyOptions(currentMonth, {
                            ...monthlyOpts,
                            vacationVariablesDivisorMode: '11',
                            vacationVariablesDivisor: 11,
                          })
                        }
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          vacationDivisorMode === '11'
                            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-400/40"
                            : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "text-xs font-black uppercase",
                          vacationDivisorMode === '11' ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"
                        )}>
                          / 11 (Convenio)
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          Estándar convenio
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          saveMonthlyOptions(currentMonth, {
                            ...monthlyOpts,
                            vacationVariablesDivisorMode: '12',
                            vacationVariablesDivisor: 12,
                          })
                        }
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          vacationDivisorMode === '12'
                            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-400/40"
                            : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "text-xs font-black uppercase",
                          vacationDivisorMode === '12' ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"
                        )}>
                          / 12
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          Año completo (12 meses)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          saveMonthlyOptions(currentMonth, {
                            ...monthlyOpts,
                            vacationVariablesDivisorMode: 'worked_months',
                            vacationVariablesDivisor: effectiveWorkedMonths,
                          })
                        }
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          vacationDivisorMode === 'worked_months'
                            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-400/40"
                            : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "text-xs font-black uppercase",
                          vacationDivisorMode === 'worked_months' ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"
                        )}>
                          Meses trabajados ({formatNumber(effectiveWorkedMonths, 2)})
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          Según vacaciones {prevYear}
                        </div>
                      </button>
                    </div>

                    {/* Panel detallado del divisor por meses trabajados (con 2 decimales) */}
                    {vacationDivisorMode === 'worked_months' && (
                      <div className="bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 p-3.5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                              Días de vacaciones disfrutados ({prevYear})
                            </label>
                            <div className="flex items-center gap-2">
                              <LocalInput
                                type="number"
                                value={effectivePrevYearVacDays}
                                onChange={(val) => {
                                  const parsed = Math.max(0, Math.min(daysInPrevYear - 1, Math.round(parseFloat(val) || 0)));
                                  const computedMonths = calcWorkedMonthsFromVacDays(parsed);
                                  saveMonthlyOptions(currentMonth, {
                                    ...monthlyOpts,
                                    vacationVariablesDivisorMode: 'worked_months',
                                    vacationVariablesPrevYearVacDays: parsed,
                                    vacationVariablesWorkedMonths: computedMonths,
                                    vacationVariablesDivisor: computedMonths,
                                  });
                                }}
                                className="w-24 min-h-[38px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-sm font-black text-center outline-none focus:ring-2 focus:ring-azul-blue/30"
                              />
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                días (detectados: {autoPrevYearVacationDays})
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                              Divisor por meses trabajados (2 decimales)
                            </label>
                            <div className="flex items-center gap-2">
                              <LocalInput
                                type="number"
                                value={effectiveWorkedMonths.toFixed(2)}
                                onChange={(val) => {
                                  const raw = parseFloat(val);
                                  const clamped = Math.max(0.01, Math.min(12, Math.round((isNaN(raw) ? defaultWorkedMonths : raw) * 100) / 100));
                                  saveMonthlyOptions(currentMonth, {
                                    ...monthlyOpts,
                                    vacationVariablesDivisorMode: 'worked_months',
                                    vacationVariablesWorkedMonths: clamped,
                                    vacationVariablesDivisor: clamped,
                                  });
                                }}
                                className="w-28 min-h-[38px] bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl py-1.5 px-3 text-sm font-black text-center text-emerald-800 dark:text-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
                              />
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                meses
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>
                            Cálculo automático {prevYear}: ({daysInPrevYear} − {effectivePrevYearVacDays} días vac.) ÷ {daysInPrevYear} × 12 = <strong className="text-slate-800 dark:text-slate-200">{formatNumber(defaultWorkedMonths, 2)} meses</strong>
                          </span>
                          {(monthlyOpts.vacationVariablesPrevYearVacDays !== undefined || monthlyOpts.vacationVariablesWorkedMonths !== undefined) && (
                            <button
                              type="button"
                              onClick={() => {
                                const autoMonths = calcWorkedMonthsFromVacDays(autoPrevYearVacationDays);
                                saveMonthlyOptions(currentMonth, {
                                  ...monthlyOpts,
                                  vacationVariablesDivisorMode: 'worked_months',
                                  vacationVariablesPrevYearVacDays: undefined,
                                  vacationVariablesWorkedMonths: undefined,
                                  vacationVariablesDivisor: autoMonths,
                                });
                              }}
                              className="text-[10px] font-black uppercase text-azul-blue dark:text-sky-400 hover:underline cursor-pointer"
                            >
                              Usar días de {prevYear} ({autoPrevYearVacationDays}d)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between flex-wrap gap-1 pt-0.5">
                      <span>Mecanismo de Equidad aplicado ({prevYear}): <strong className="text-slate-700 dark:text-slate-200">{formatNumber(prevYearEquidadRate, 2)}%</strong></span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Desplegable Total Bruto */}
        <div 
          id="total-devengado-section"
          className={cn(
            "bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 flex flex-col justify-between scroll-mt-24",
            isDevengosExpanded ? "col-span-full" : "col-span-1"
          )}
        >
          <div 
            onClick={() => setIsDevengosExpanded(!isDevengosExpanded)}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors group select-none"
          >
            <div className="flex items-center gap-3">
              <ArrowUpRight size={18} className="text-emerald-500 shrink-0" />
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-black dark:text-white">TOTAL DEVENGADO</span>
                <span className="text-lg font-black text-black dark:text-white">{formatCurrency(displayTotalDevengado)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                isDevengosExpanded ? "bg-emerald-500 text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
              )}>
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isDevengosExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-slate-100 dark:border-white/[0.025]"
              >
                <div className="bg-slate-50/50 p-3 border-b border-slate-100 dark:border-white/[0.025] flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {payrollMode === 'vacation_variables' ? (
                      <Palmtree size={15} className="text-emerald-500 shrink-0" />
                    ) : (
                      <FileText size={14} className="text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-800 uppercase text-xs sm:text-sm tracking-widest">
                        {payrollMode === 'vacation_variables' ? `Variables Vacaciones (${prevYear})` : 'Conceptos Devengados'}
                      </h3>
                      {payrollMode === 'vacation_variables' && (
                        <p className="text-[10px] font-bold text-slate-400 leading-tight mt-0.5">
                          Nóminas Feb {prevYear} – Ene {currentYear} · Devengo Ene–Dic {prevYear}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Restablecer conceptos de Variables Vacaciones */}
                  {payrollMode === 'vacation_variables' && (
                    <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={handleResetVacationToggles}
                        className="px-2 py-1 text-[9px] font-black uppercase rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1 cursor-pointer"
                        title="Restablecer conceptos por defecto"
                      >
                        <RotateCcw size={10} />
                        Por defecto
                      </button>
                    </div>
                  )}

                  {!hideAmounts && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isEditingDevengos && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (payrollMode === 'vacation_variables') {
                              saveMonthlyOptions(currentMonth, { ...monthlyOpts, vacationVariablesManual: {} });
                            } else {
                              saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualPluses: {} });
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase hover:bg-rose-100 transition-colors mr-1 cursor-pointer touch-manipulation min-h-[38px] active:scale-95"
                        >
                          <Trash2 size={13} />
                          <span className="hidden xs:inline">Limpiar manuales</span>
                          <span className="xs:hidden">Limpiar</span>
                        </button>
                      )}
                      {isEditingDevengos && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelDevengos();
                          }} 
                          className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
                          title="Cancelar cambios"
                        >
                          <X size={16} />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDevengos();
                        }} 
                        className={cn(
                          "min-h-[40px] min-w-[40px] p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 shadow-xs",
                          isEditingDevengos ? "bg-emerald-500 text-white" : "bg-azul-blue/10 text-azul-blue hover:bg-azul-blue/20"
                        )}
                        title={isEditingDevengos ? "Guardar cambios" : "Editar devengos"}
                      >
                        {isEditingDevengos ? <Save size={16} /> : <Edit2 size={16} />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Desglose Semestral de PP Extra para Paga Extra (6 meses correspondientes) */}
                {payrollMode === 'extra' && semesterPpExtraDetails.length > 0 && (
                  <div className="p-3.5 sm:p-4 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-50/30 border-b border-amber-100/90">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 font-black text-[9px] uppercase tracking-wider">
                            Ciclo de 6 meses
                          </span>
                          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-950">
                            {isSummerExtra ? 'Paga Extra de Verano (Ene - Jun)' : 'Paga Extra de Navidad (Jul - Dic)'}
                          </h4>
                        </div>
                        <p className="text-[10.5px] font-medium text-amber-900/80 mt-0.5">
                          Suma de los conceptos <strong className="font-bold text-amber-950">"PP Extra"</strong> calculados dinámicamente en cada mes en la sección Nómina.
                        </p>
                      </div>
                      <div className="bg-white/80 border border-amber-200/80 px-3 py-1.5 rounded-xl shadow-xs shrink-0 self-start sm:self-auto text-right">
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-700/80 block">
                          Total Bruto Extra
                        </span>
                        <span className="text-base font-black text-amber-950">
                          {formatCurrency(extraGross)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2">
                      {semesterPpExtraDetails.map((m) => (
                        <div 
                          key={m.monthIndex}
                          className={cn(
                            "p-2.5 rounded-xl border text-center transition-all",
                            m.isCurrentMonth 
                              ? "bg-amber-100/90 border-amber-300 shadow-xs ring-1 ring-amber-400/40" 
                              : "bg-white/90 border-amber-200/70"
                          )}
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <span className="text-[10.5px] font-black uppercase text-slate-700">{m.monthName}</span>
                            {m.isCurrentMonth && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Mes en curso" />
                            )}
                          </div>
                          <span className={cn(
                            "block text-xs sm:text-sm font-black tracking-tight",
                            m.ppExtra > 0 ? "text-amber-950" : "text-slate-400"
                          )}>
                            {formatCurrency(m.ppExtra)}
                          </span>
                          <span className="block text-[8.5px] font-semibold text-slate-500 mt-0.5">
                            {m.isAccrued ? 'PP Extra' : 'Sin turnos'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.025]">
                        <th className="px-4 py-2">Concepto</th>
                        <th className="px-4 py-2 text-center">Cant.</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const items = displayDevengos.filter(d => {
                          if (payrollMode === 'vacation_variables') {
                            const qtyNum = typeof d.qty === 'number' ? d.qty : (parseFloat(String(d.qty)) || 0);
                            return qtyNum > 0 || (Number((d as any).rawValue) || 0) > 0 || isEditingDevengos;
                          }
                          const isManualManaged = d.name === 'Concepto a abonar' || d.name === 'Concepto a descontar' || d.name === 'H.Perent.' || d.name === 'H.Compl.' || d.name === 'Impuntualidad/Absent';
                          if (isEditingDevengos && isManualManaged) return false;
                          return (d.value !== 0) || (isEditingDevengos);
                        });

                        if (items.length === 0 && payrollMode === 'vacation_variables') {
                          return (
                            <tr>
                              <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                  No hay pluses variables cobrados en nóminas de Feb {prevYear} a Ene {currentYear}
                                </p>
                                <p className="text-[11px] font-medium text-slate-400">
                                  Todos los conceptos tienen cantidad 0. Puedes pulsar en "Editar" para introducirlos manualmente si lo deseas.
                                </p>
                              </td>
                            </tr>
                          );
                        }

                        return items.map((d, i) => {
                        const isSalarioBase = d.name.toUpperCase() === 'SALARIO BASE' || d.name.includes('PAGA EXTRA');
                        const formattedQty = typeof d.qty === 'number' ? formatNumber(d.qty, 2).replace(/,00$/, '') : d.qty;
                        const isProrrata = (d as any).isProrrata;
                        const isVacationVar = payrollMode === 'vacation_variables';
                        const isRowActive = isVacationVar ? (d as any).isActive : true;
                        
                        return (
                          <tr 
                            key={i} 
                            className={cn(
                              "hover:bg-slate-50/50 transition-colors", 
                              isProrrata && "bg-slate-50/20 opacity-60",
                              isVacationVar && !isRowActive && "bg-slate-50/30 opacity-60"
                            )}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2.5">
                                {isVacationVar && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleVacationConcept(d.name);
                                    }}
                                    className={cn(
                                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-xs",
                                      isRowActive ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-300 hover:bg-slate-400"
                                    )}
                                    title={isRowActive ? `Desactivar ${d.name}` : `Activar ${d.name}`}
                                    aria-label={isRowActive ? `Desactivar ${d.name}` : `Activar ${d.name}`}
                                  >
                                    <span
                                      className={cn(
                                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                                        isRowActive ? "translate-x-4" : "translate-x-0"
                                      )}
                                    />
                                  </button>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn(
                                      "font-black block leading-tight uppercase", 
                                      isProrrata ? "text-xs text-slate-500" : isVacationVar && !isRowActive ? "text-sm text-slate-400 line-through decoration-slate-400" : "text-sm text-slate-800"
                                    )}>
                                      {d.name}
                                    </span>
                                    {isProrrata && (
                                      <span className="text-[7px] font-black bg-slate-100 text-slate-400 px-1 py-0.5 rounded uppercase tracking-tighter">Info</span>
                                    )}
                                    {isVacationVar && (
                                      <span className={cn(
                                        "text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter",
                                        isRowActive ? "bg-emerald-100 text-emerald-700 border border-emerald-200/60" : "bg-slate-100 text-slate-400 border border-slate-200/60"
                                      )}>
                                        {isRowActive ? "Activo" : "Desactivado"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter block mt-0.5">
                                    {formatCurrency(d.price)}
                                    {isVacationVar && typeof (d as any).annualQty === 'number' && (d as any).annualQty > 0 && (
                                      <span className="ml-1 text-slate-400 font-bold lowercase">
                                        • {formatNumber((d as any).annualQty, 2).replace(/,00$/, '')} ({formatCurrency((d as any).annualValue)} feb {String(prevYear).slice(-2)}–ene {String(currentYear).slice(-2)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              {isVacationVar ? (
                                isEditingDevengos ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <LocalInput
                                      type="number"
                                      value={monthlyOpts.vacationVariablesManual?.[d.name]?.qty !== undefined ? monthlyOpts.vacationVariablesManual[d.name].qty : d.qty}
                                      onChange={(val) => {
                                        const manual = { ...(monthlyOpts.vacationVariablesManual || {}) };
                                        manual[d.name] = {
                                          ...(manual[d.name] || { price: d.price }),
                                          qty: parseFloat(val) || 0,
                                          useManual: true
                                        };
                                        saveMonthlyOptions(currentMonth, { ...monthlyOpts, vacationVariablesManual: manual });
                                      }}
                                      className="w-20 sm:w-20 min-h-[42px] bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-azul-blue rounded-xl py-2 px-2 text-base sm:text-sm font-black text-center shadow-xs outline-none focus:ring-2 focus:ring-azul-blue/30 transition-all touch-manipulation"
                                    />
                                    {monthlyOpts.vacationVariablesManual?.[d.name]?.useManual && (
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const manual = { ...(monthlyOpts.vacationVariablesManual || {}) };
                                          delete manual[d.name];
                                          saveMonthlyOptions(currentMonth, { ...monthlyOpts, vacationVariablesManual: manual });
                                        }}
                                        className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 min-h-[36px] min-w-[36px] p-2 flex items-center justify-center rounded-lg transition-colors cursor-pointer touch-manipulation"
                                        title="Restablecer automático"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className={cn(
                                    "font-black text-[11px]",
                                    isRowActive ? "text-slate-700" : "text-slate-400"
                                  )}>
                                    {formattedQty}
                                  </span>
                                )
                              ) : (
                                !isSalarioBase && !d.name.toLowerCase().includes('pp extra') && (
                                  isEditingDevengos && (d as any).baseName ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      {d.baseName === 'Turnicidad' ? (
                                        <select
                                          value={monthlyOpts.manualPluses?.['Turnicidad']?.qty ?? (prevStats.uniqueShiftsCount >= 5 ? '5 o más' : prevStats.uniqueShiftsCount >= 2 ? `${prevStats.uniqueShiftsCount} turnos` : '0')}
                                          onChange={(e) => {
                                            const label = e.target.value;
                                            const manualPluses = { ...(monthlyOpts.manualPluses || {}) };
                                            if (label === '0') {
                                              manualPluses['Turnicidad'] = { value: 0, qty: 0, useManual: true };
                                            } else {
                                              const qtyStr = label;
                                              let price = 0;
                                              if (qtyStr === '5 o más') price = getPlusConfig('Turnicidad 5+')?.value || 0;
                                              else if (qtyStr === '4 turnos') price = getPlusConfig('Turnicidad 4')?.value || 0;
                                              else if (qtyStr === '3 turnos') price = getPlusConfig('Turnicidad 3')?.value || 0;
                                              else if (qtyStr === '2 turnos') price = getPlusConfig('Turnicidad 2')?.value || 0;
                                              
                                              manualPluses['Turnicidad'] = { value: price, qty: qtyStr, useManual: true };
                                            }
                                            saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualPluses });
                                          }}
                                          className="w-32 sm:w-32 min-h-[42px] bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-azul-blue rounded-xl py-2 px-2 text-base sm:text-xs font-black text-center shadow-xs outline-none focus:ring-2 focus:ring-azul-blue/30 cursor-pointer transition-all touch-manipulation"
                                        >
                                          <option value="0">Sin Turnos</option>
                                          <option value="2 turnos">2 Turnos</option>
                                          <option value="3 turnos">3 Turnos</option>
                                          <option value="4 turnos">4 Turnos</option>
                                          <option value="5 o más">5 o más</option>
                                        </select>
                                      ) : (
                                        <LocalInput 
                                          type="number" 
                                          value={monthlyOpts.manualPluses?.[d.baseName]?.qty || (d.isManual ? d.qty : d.qty) || 0} 
                                          onChange={(val) => {
                                            const manualPluses = { ...(monthlyOpts.manualPluses || {}) };
                                            manualPluses[d.baseName!] = { ...(manualPluses[d.baseName!] || { value: d.price }), qty: parseFloat(val) || 0, useManual: true };
                                            saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualPluses });
                                          }}
                                          className="w-20 sm:w-20 min-h-[42px] bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-azul-blue rounded-xl py-2 px-2 text-base sm:text-sm font-black text-center shadow-xs outline-none focus:ring-2 focus:ring-azul-blue/30 transition-all touch-manipulation"
                                        />
                                      )}
                                      {d.isManual && (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const manualPluses = { ...(monthlyOpts.manualPluses || {}) };
                                            delete manualPluses[d.baseName!];
                                            saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualPluses });
                                          }}
                                          className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 min-h-[36px] min-w-[36px] p-2 flex items-center justify-center rounded-lg transition-colors cursor-pointer touch-manipulation"
                                          title="Restablecer automático"
                                        >
                                          <X size={14} />
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className={cn("font-black", d.isProrrata ? "text-[10px] text-slate-400" : "text-[11px] text-slate-600")}>{formattedQty}</span>
                                  )
                                )
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {isVacationVar ? (
                                <div className="flex flex-col items-end">
                                  <span className={cn(
                                    "font-black text-sm",
                                    isRowActive ? "text-emerald-600" : "text-slate-400 line-through decoration-slate-400"
                                  )}>
                                    {formatCurrency((d as any).rawValue)}
                                  </span>
                                  {!isRowActive && (
                                    <span className="text-[9px] font-black text-slate-400">
                                      0,00 €
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className={cn("font-black", d.isProrrata ? "text-xs text-slate-400" : d.value < 0 ? "text-sm text-rose-600" : "text-sm text-slate-800")}>{formatCurrency(d.value)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desplegable Deducciones */}
        <div className={cn(
          "bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 flex flex-col justify-between",
          isDeduccionesExpanded ? "col-span-full" : "col-span-1"
        )}>
          <div 
            onClick={() => setIsDeduccionesExpanded(!isDeduccionesExpanded)}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors group select-none"
          >
            <div className="flex items-center gap-3">
              <ArrowDownRight size={18} className="text-red-500 shrink-0" />
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-black dark:text-white">TOTAL DEDUCCIONES</span>
                <span className="text-lg font-black text-black dark:text-white">{formatCurrency(displayTotalDeducciones)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                isDeduccionesExpanded ? "bg-rose-500 text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
              )}>
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isDeduccionesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-slate-100 dark:border-white/[0.025]"
              >
                <div className="bg-slate-50/50 p-3 border-b border-slate-100 dark:border-white/[0.025] flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-slate-400" />
                    <h3 className="font-black text-slate-800 uppercase text-xs sm:text-sm tracking-widest">Conceptos y Retenciones</h3>
                  </div>
                  {!hideAmounts && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isEditingDeducciones && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelDeducciones();
                          }} 
                          className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95"
                          title="Cancelar cambios"
                        >
                          <X size={16} />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDeducciones();
                        }} 
                        className={cn(
                          "min-h-[40px] min-w-[40px] p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 shadow-xs",
                          isEditingDeducciones ? "bg-emerald-500 text-white" : "bg-azul-blue/10 text-azul-blue hover:bg-azul-blue/20"
                        )}
                        title={isEditingDeducciones ? "Guardar cambios" : "Editar deducciones"}
                      >
                        {isEditingDeducciones ? <Save size={16} /> : <Edit2 size={16} />}
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.025]">
                        <th className="px-4 py-2">Concepto</th>
                        <th className="px-4 py-2 text-center">Base</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDeducciones.filter(d => d.value !== 0 || isEditingDeducciones).map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-1.5">
                            <span className="text-sm font-black text-slate-800 block leading-tight uppercase">{d.name}</span>
                            <div className="flex items-center gap-1">
                              {isEditingDeducciones ? (
                                <div className="flex items-center gap-1">
                                  <LocalInput 
                                    type="number" 
                                    value={d.rate} 
                                    onChange={(val) => {
                                      if (d.key === 'irpf') {
                                        saveMonthlyOptions(currentMonth, { ...monthlyOpts, irpf: parseFloat(val) || 0 });
                                      } else if (d.key === 'vacationVariablesRateEquidad') {
                                        saveMonthlyOptions(currentMonth, { ...monthlyOpts, vacationVariablesRateEquidad: parseFloat(val) || 0 });
                                      } else {
                                        updateSettings({ ...settings, [d.key]: parseFloat(val) || 0 });
                                      }
                                    }}
                                    className="w-16 min-h-[38px] bg-white border border-slate-200 rounded-lg py-1 px-2 text-base sm:text-xs font-black text-center outline-none focus:ring-2 focus:ring-azul-blue/30 touch-manipulation"
                                  />
                                  <span className="text-[9px] font-bold text-slate-400">%</span>
                                </div>
                              ) : (
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">
                                  {formatNumber(d.rate, 2)}%{d.key === 'vacationVariablesRateEquidad' ? ` (${prevYear})` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-1.5 text-center">
                            <span className="text-[11px] font-black text-slate-400">{formatCurrency(d.base)}</span>
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            <span className="text-sm font-black text-rose-600">-{formatCurrency(d.value)}</span>
                          </td>
                        </tr>
                      ))}
                      {payrollMode === 'monthly' && conceptosADescontar.filter(c => c.value !== 0).map((c, i) => {
                        const isCuotaSindical = c.name.toUpperCase() === 'CUOTA SINDICAL';
                        const formattedQty = typeof c.qty === 'number' ? formatNumber(c.qty, 2).replace(/,00$/, '') : c.qty;

                        return (
                          <tr key={`desc-${i}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-1.5">
                              <span className="text-sm font-black text-slate-800 block leading-tight uppercase">{c.name}</span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{c.key === 'impuntualidad' ? `H: ${formattedQty} x ${formatCurrency(Math.abs(c.price))}` : formatCurrency(Math.abs(c.price))}</span>
                            </td>
                            <td className="px-4 py-1.5 text-center">
                              {!isCuotaSindical && (
                                <span className="text-[11px] font-black text-slate-400">{formattedQty}</span>
                              )}
                            </td>
                            <td className="px-4 py-1.5 text-right">
                              <span className="text-sm font-black text-rose-600">{formatCurrency(c.value)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Píldora Base de Contingencias Comunes */}
        {payrollMode === 'monthly' && (
          <div className={cn(
            "bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 flex flex-col justify-between col-span-full"
          )}>
            <div className="p-4 flex items-center justify-between select-none">
              <div className="flex items-center gap-3">
                <PieChart size={18} className="text-azul-blue shrink-0" />
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-black dark:text-white">BASE CONTINGENCIAS COMUNES</span>
                  <span className="text-lg font-black text-black dark:text-white">{formatCurrency(baseCotizacion)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pluses a Aplicar Section */}
      {payrollMode === 'monthly' && (
        <section className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div 
          onClick={() => setIsPlusesExpanded(!isPlusesExpanded)} 
          className="w-full p-3.5 flex items-center justify-between group transition-colors hover:bg-slate-50 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azul-yellow/10 rounded-xl text-azul-yellow group-hover:bg-azul-yellow group-hover:text-white transition-all">
              <Plus size={14} />
            </div>
            <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-tight">PLUSES A APLICAR</h3>
          </div>
          <div className={cn("p-1 rounded-lg transition-all", isPlusesExpanded ? "bg-azul-blue text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200")}>
            <ChevronDown size={14} />
          </div>
        </div>

        <AnimatePresence>
          {isPlusesExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              className="px-4 pb-4 overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'teamleader', label: 'Teamleader', plusName: 'Teamleader' },
                  { id: 'multitasking', label: 'Multitasking', plusName: 'Multitasking' },
                  { id: 'productividad', label: 'Productividad', plusName: 'Productividad' },
                  { id: 'duty', label: 'Duty', plusName: 'Duty' },
                  { id: 'arco', label: 'ARCO', plusName: 'ARCO' },
                  { id: 'rco', label: 'RCO', plusName: 'RCO' },
                  { id: 'super', label: 'Super', plusName: 'Super' },
                  { id: 'jornadaIrregular', label: 'J. Irregular', plusName: 'Jornada Irregular' },
                  { id: 'useManualBaseSalary', label: 'Salario Particular', onlyCompleto: true },
                  { id: 'useManualHours', label: 'Horas Manuales', onlyParcial: true },
                ].filter(p => {
                  if (p.id === 'productividad' && !isProductividadMonth(currentMonth)) {
                    return false;
                  }
                  if (p.onlyParcial && settings.contractType !== 'Parcial') {
                    return false;
                  }
                  if (p.onlyCompleto && settings.contractType !== 'Completo') {
                    return false;
                  }
                  return !p.plusName || getPlusConfig(p.plusName)?.enabled;
                }).map(p => {
                  const isEnabled = (monthlyOpts as any)[p.id];
                  return (
                    <div key={p.id} className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const manualPluses = { ...(monthlyOpts.manualPluses || {}) };
                          delete manualPluses[p.id];
                          if (p.id === 'productividad') delete manualPluses['Productividad'];
                          saveMonthlyOptions(currentMonth, { ...monthlyOpts, [p.id]: !isEnabled, manualPluses });
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3.5 py-3 rounded-xl border transition-all text-left flex-1 min-h-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]",
                          isEnabled 
                            ? "bg-azul-blue/5 border-azul-blue/20 text-azul-blue shadow-sm" 
                            : "bg-slate-50 border-slate-100 text-slate-400 opacity-60"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-tight leading-none">{p.label}</span>
                        <div className={cn(
                          "w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0",
                          isEnabled ? "bg-azul-blue text-white" : "bg-slate-200"
                        )}>
                          {isEnabled && <Check size={10} strokeWidth={4} />}
                        </div>
                      </button>
                      
                      {p.id === 'productividad' && isEnabled && (
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                          {[100, 70].map(pct => (
                            <button
                              key={pct}
                              onClick={() => {
                                const manualPluses = { ...(monthlyOpts.manualPluses || {}) };
                                delete manualPluses['Productividad'];
                                saveMonthlyOptions(currentMonth, { ...monthlyOpts, productividadPct: pct, manualPluses });
                              }}
                              className={cn(
                                "flex-1 py-1 text-[9px] font-black uppercase rounded-lg transition-all",
                                (monthlyOpts.productividadPct || 100) === pct 
                                  ? "bg-white text-azul-blue shadow-sm" 
                                  : "text-slate-400 hover:text-slate-500"
                              )}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Custom Toggles */}
                {Object.entries(currentYearPluses)
                  .filter(([name, p]) => {
                    if (STANDARD_PLUSES.includes(name)) return false;
                    const isSub = name.endsWith(' SUB') || name.endsWith('/Comida SUB');
                    const subrogadosBaseKeys = [
                      'Nocturnas SUB',
                      'Madrugue SUB',
                      'Manutención/Comida SUB',
                      'Transporte SUB',
                      'Festivo SUB',
                      'Domingo SUB',
                      'Jornada Irregular Diaria'
                    ];
                    if (isSub) {
                      return settings.isSubrogado && p.enabled && !subrogadosBaseKeys.includes(name);
                    }
                    return p.enabled;
                  })
                  .map(([name, p]) => {
                    const isProporcional = p.baseType === 'proporcional_jornada' || p.calculationType === 'proporcional_jornada' || p.cloneOf === 'Tiempo Parcial - Discontinuo' || p.cloneOf === 'Teamleader';
                    const isFijo = p.baseType === 'fijo' || p.calculationType === 'fijo' || p.cloneOf === 'Jornada Irregular' || p.cloneOf === 'Productividad' || p.cloneOf === 'Multitasking' || p.cloneOf === 'Duty' || p.cloneOf === 'Super';
                    const isShiftBased = p.baseType === 'madrugue' || p.calculationType === 'madrugue' || p.cloneOf === 'Madrugue' || p.cloneOf === 'Madrugue SUB' || p.baseType === 'nocturnas' || p.calculationType === 'nocturnas' || p.cloneOf === 'Nocturnas' || p.baseType === 'manutencion' || p.calculationType === 'manutencion' || p.cloneOf === 'Manutención' || p.baseType === 'transporte' || p.calculationType === 'transporte' || p.calculationType === 'dias_trabajados' || p.cloneOf === 'Transporte';

                    const isEnabled = monthlyOpts.customToggles?.[name] !== undefined 
                      ? !!monthlyOpts.customToggles[name] 
                      : (isProporcional || isFijo ? (p.defaultActiveInPayroll !== false) : false);

                    return (
                      <button
                        type="button"
                        key={name}
                        onClick={() => {
                          const customToggles = { ...(monthlyOpts.customToggles || {}), [name]: !isEnabled };
                          saveMonthlyOptions(currentMonth, { ...monthlyOpts, customToggles });
                        }}
                        className={cn(
                          "flex items-center justify-between px-3.5 py-3 rounded-xl border transition-all text-left min-h-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]",
                          isEnabled 
                            ? "bg-purple-50 border-purple-200 text-purple-700 shadow-sm" 
                            : "bg-slate-50 border-slate-100 text-slate-400 opacity-60"
                        )}
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <span className="text-[10px] font-black uppercase tracking-tight leading-none truncate">{name}</span>
                          <span className="text-[8.5px] font-semibold text-slate-400 leading-tight mt-0.5">
                            {isProporcional ? 'Proporcional jornada' : isFijo ? 'Fijo mensual' : isShiftBased ? 'Por turnos' : 'Personalizado'}
                          </span>
                        </div>
                        <div className={cn(
                          "w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0",
                          isEnabled ? "bg-purple-600 text-white" : "bg-slate-200"
                        )}>
                          {isEnabled && <Check size={10} strokeWidth={4} />}
                        </div>
                      </button>
                    );
                  })}

                {/* Manual Added Toggles */}
                {Object.entries(monthlyOpts.manualPluses || {})
                  .filter(([name, m]) => {
                    if (!m.useManual || STANDARD_PLUSES.includes(name) || currentYearPluses[name]) return false;
                    const isSub = name.endsWith(' SUB') || name.endsWith('/Comida SUB');
                    const subrogadosBaseKeys = [
                      'Nocturnas SUB',
                      'Madrugue SUB',
                      'Manutención/Comida SUB',
                      'Transporte SUB',
                      'Festivo SUB',
                      'Domingo SUB',
                      'Jornada Irregular Diaria'
                    ];
                    if (isSub) {
                      return settings.isSubrogado && !subrogadosBaseKeys.includes(name);
                    }
                    return true;
                  })
                  .map(([name]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm min-h-[44px]"
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight leading-none truncate pr-1">{name}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const manualPluses = { ...(monthlyOpts.manualPluses || {}) };
                          delete manualPluses[name];
                          saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualPluses });
                        }}
                        className="text-emerald-400 hover:text-rose-500 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg touch-manipulation cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                <button
                  type="button"
                  onClick={() => setIsAddingManualPlus(true)}
                  className="flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl border border-dashed border-azul-blue/30 text-azul-blue hover:bg-azul-blue/5 transition-all text-left min-h-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                >
                  <Plus size={15} />
                  <span className="text-[10px] font-black uppercase tracking-tight">Añadir Plus</span>
                </button>
              </div>

              <AnimatePresence>
                {isAddingManualPlus && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Nuevo Plus Manual</h4>
                      <button onClick={() => setIsAddingManualPlus(false)} className="text-slate-400 hover:text-rose-500 transition-all active:scale-90">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nombre del Concepto</label>
                        <input 
                          type="text" 
                          placeholder="P. Ej: Plus Especial"
                          value={newManualPlus.name}
                          onChange={(e) => setNewManualPlus({ ...newManualPlus, name: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-azul-blue/30"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Precio Unit.</label>
                          <LocalInput 
                            type="number" 
                            value={newManualPlus.value === 0 ? '' : newManualPlus.value}
                            onChange={(val) => setNewManualPlus({ ...newManualPlus, value: parseFloat(val) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-azul-blue/30"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Cantidad</label>
                          <LocalInput 
                            type="number" 
                            value={newManualPlus.qty === 0 ? '' : newManualPlus.qty}
                            onChange={(val) => setNewManualPlus({ ...newManualPlus, qty: parseFloat(val) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-azul-blue/30"
                          />
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (!newManualPlus.name) return;
                        const manualPluses = { ...(monthlyOpts.manualPluses || {}) };
                        manualPluses[newManualPlus.name] = { value: newManualPlus.value, qty: newManualPlus.qty, useManual: true };
                        saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualPluses });
                        setNewManualPlus({ name: '', value: 0, qty: 1 });
                        setIsAddingManualPlus(false);
                      }}
                      className="w-full bg-azul-blue text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-azul-blue/20 active:scale-[0.98] transition-all"
                    >
                      Añadir a la nómina
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {(monthlyOpts.useManualBaseSalary && settings.contractType === 'Completo') && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200"
                >
                  <label className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 ml-1">Salario Particular (Base)</label>
                  <div className="flex gap-2">
                    <LocalInput 
                      type="number" 
                      value={monthlyOpts.manualBaseSalary || 0}
                      onChange={(val) => saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualBaseSalary: parseFloat(val) || 0 })}
                      className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-black outline-none focus:ring-2 focus:ring-emerald-400/30 touch-manipulation"
                    />
                    <div className="px-3.5 py-2.5 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-sm min-h-[44px] shrink-0">€</div>
                  </div>
                </motion.div>
              )}

              {settings.contractType === 'Parcial' && monthlyOpts.useManualHours && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-4 bg-purple-50 rounded-2xl border border-purple-200"
                >
                  <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="block text-[8px] font-black text-purple-600 uppercase tracking-widest">Horas Manuales</label>
                    {monthlyOpts.manualHoursParcial !== undefined && monthlyOpts.manualHoursParcial !== null && (
                      <span className="text-[9px] font-black text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-200/20">
                        Jornada: {formatNumber((monthlyOpts.manualHoursParcial / 155.63) * 100, 2)}%
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <LocalInput 
                      type="number" 
                      value={monthlyOpts.manualHoursParcial !== undefined && monthlyOpts.manualHoursParcial !== null ? String(monthlyOpts.manualHoursParcial) : ''}
                      onChange={(val) => {
                        const num = val === '' ? undefined : parseFloat(val);
                        saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualHoursParcial: num });
                      }}
                      className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-black text-purple-700 outline-none focus:ring-2 focus:ring-purple-400/30 touch-manipulation"
                      placeholder="Introducir horas..."
                    />
                    <div className="px-3.5 py-2.5 bg-purple-600 text-white rounded-xl flex items-center justify-center font-black text-sm min-h-[44px] shrink-0">h</div>
                    {(monthlyOpts.manualHoursParcial !== undefined && monthlyOpts.manualHoursParcial !== null) && (
                      <button
                        type="button"
                        onClick={() => {
                          saveMonthlyOptions(currentMonth, { ...monthlyOpts, manualHoursParcial: undefined });
                        }}
                        className="px-3 py-2 bg-rose-50 text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all flex items-center justify-center font-black text-xs active:scale-95 cursor-pointer gap-1 min-h-[44px] touch-manipulation"
                        title="Limpiar horas manuales"
                      >
                        <Trash2 size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Limpiar</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    )}

      {/* Ajustes y Descuentos Manuales Section */}
      {payrollMode === 'monthly' && (
        <section className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div 
            onClick={() => setIsAjustesExpanded(!isAjustesExpanded)} 
            className="w-full p-3.5 flex items-center justify-between group transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                <MinusCircle size={14} />
              </div>
              <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-tight">AJUSTES Y DESCUENTOS</h3>
            </div>
            <div className={cn("p-1 rounded-lg transition-all", isAjustesExpanded ? "bg-azul-blue text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200")}>
              <ChevronDown size={14} />
            </div>
          </div>

          <AnimatePresence>
            {isAjustesExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="px-4 pb-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                  {/* Concepto a Abonar (Atrasos) */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Concepto a Abonar (€)</label>
                    <div className="relative">
                      <LocalInput
                        type="number"
                        value={monthlyOpts.atrasos || ''}
                        onChange={(val) => saveMonthlyOptions(currentMonth, { ...monthlyOpts, atrasos: val })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-black text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/20 touch-manipulation"
                        placeholder="0.00"
                      />
                      <Plus size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>

                  {/* Impuntualidad/Absent */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Impuntualidad/Absent (Horas)</label>
                      {prevMonthAusenciaHours > 0 && (
                        <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50">
                          {prevMonthAusenciaHours}h aus. en {safeFormat(prevMonth, 'MMMM', { locale: es })}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <LocalInput
                        type="number"
                        value={monthlyOpts.impuntualidad || ''}
                        onChange={(val) => saveMonthlyOptions(currentMonth, { ...monthlyOpts, impuntualidad: val })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/20 touch-manipulation"
                        placeholder={prevMonthAusenciaHours > 0 ? `${prevMonthAusenciaHours} (por ausencia)` : "0.00"}
                      />
                      <Clock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>

                  {/* Descuento Directo */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descuento de Dinero (€)</label>
                    <div className="relative">
                      <LocalInput
                        type="number"
                        value={monthlyOpts.descuentoDinero || ''}
                        onChange={(val) => saveMonthlyOptions(currentMonth, { ...monthlyOpts, descuentoDinero: val })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/20 touch-manipulation"
                        placeholder="0.00"
                      />
                      <AlertCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>

                  {/* Descuento Otro (Préstamos, etc.) */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Otro (Préstamos/etc.) (€)</label>
                    <div className="relative">
                      <LocalInput
                        type="number"
                        value={monthlyOpts.descuentoOtro || ''}
                        onChange={(val) => {
                          const currentEndDate = monthlyOpts.descuentoOtroEndDate ?? settings.prestamo?.endDate ?? '';
                          saveMonthlyOptions(currentMonth, { ...monthlyOpts, descuentoOtro: val, descuentoOtroEndDate: currentEndDate });
                          updateSettings({
                            ...settings,
                            prestamo: {
                              amount: val,
                              endDate: currentEndDate
                            }
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/20 touch-manipulation"
                        placeholder="0.00"
                      />
                      <Wallet size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>

                    {/* Fecha de fin del cobro del préstamo */}
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between px-0.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Calendar size={10} className="text-slate-400 shrink-0" />
                          <span>Fin del cobro</span>
                        </label>
                        {(monthlyOpts.descuentoOtroEndDate || settings.prestamo?.endDate) && (
                          <button
                            type="button"
                            onClick={() => {
                              saveMonthlyOptions(currentMonth, { ...monthlyOpts, descuentoOtroEndDate: '' });
                              updateSettings({
                                ...settings,
                                prestamo: {
                                  amount: monthlyOpts.descuentoOtro || settings.prestamo?.amount || '',
                                  endDate: ''
                                }
                              });
                            }}
                            className="text-[8px] font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer min-h-[30px] flex items-center px-1"
                            title="Quitar fecha límite de fin"
                          >
                            Quitar
                          </button>
                        )}
                      </div>

                      <input
                        type="date"
                        value={monthlyOpts.descuentoOtroEndDate || settings.prestamo?.endDate || ''}
                        onChange={(e) => {
                          const endVal = e.target.value;
                          saveMonthlyOptions(currentMonth, { ...monthlyOpts, descuentoOtroEndDate: endVal });
                          updateSettings({
                            ...settings,
                            prestamo: {
                              amount: monthlyOpts.descuentoOtro || settings.prestamo?.amount || '',
                              endDate: endVal
                            }
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer touch-manipulation"
                      />

                      {/* Indicador de estado del cobro */}
                      {(() => {
                        const activeEndDate = monthlyOpts.descuentoOtroEndDate || settings.prestamo?.endDate;
                        if (!activeEndDate) return null;
                        const isExpired = isDateAfterLoanEnd(currentMonth, activeEndDate);
                        let formattedEnd = activeEndDate;
                        try {
                          const parsedEnd = parseISO(activeEndDate);
                          if (isValid(parsedEnd)) {
                            formattedEnd = safeFormat(parsedEnd, 'dd/MM/yyyy', { locale: es });
                          }
                        } catch {}

                        return isExpired ? (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded-lg text-[8px] font-black text-rose-600 uppercase tracking-tight">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span className="truncate">Cobro finalizado ({formattedEnd})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[8px] font-black text-emerald-600 uppercase tracking-tight">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="truncate">Activo hasta {formattedEnd}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Cuota Sindical */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cuota Sindical (€)</label>
                    <div className="relative">
                      <LocalInput
                        type="number"
                        value={settings.cuotaSindical || ''}
                        onChange={(val) => updateSettings({ ...settings, cuotaSindical: parseFloat(val) || 0 })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/20 touch-manipulation"
                        placeholder="0.00"
                      />
                      <Users size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Sección de Anotaciones de la Nómina */}
      {payrollMode === 'monthly' && (
        <section className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div 
            onClick={() => setIsAnotacionesExpanded(!isAnotacionesExpanded)} 
            className="w-full p-3.5 flex items-center justify-between group transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl transition-all",
                monthlyOpts.notes?.trim() 
                  ? "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white" 
                  : "bg-slate-500/10 text-slate-500 group-hover:bg-slate-500 group-hover:text-white"
              )}>
                <Edit2 size={14} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-tight">Anotaciones de la Nómina</h3>
                {monthlyOpts.notes?.trim() && (
                  <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-tight leading-none animate-pulse">
                    Importante
                  </span>
                )}
              </div>
            </div>
            <div className={cn("p-1 rounded-lg transition-all", isAnotacionesExpanded ? "bg-azul-blue text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200")}>
              <ChevronDown size={14} />
            </div>
          </div>

          <AnimatePresence>
            {isAnotacionesExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="px-4 pb-4 overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  <div className="relative">
                    <textarea
                      value={monthlyOpts.notes || ''}
                      onChange={(e) => saveMonthlyOptions(currentMonth, { ...monthlyOpts, notes: e.target.value })}
                      className="w-full min-h-[120px] max-h-[250px] bg-slate-50 border border-slate-150 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 placeholder-slate-400 resize-y transition-all"
                      placeholder="Escribe aquí cualquier recordatorio, observación o anotación sobre la nómina de este mes (ej. falta por cobrar 2 madrugues, horas de más, descuentan de menos este mes...)"
                    />
                    {monthlyOpts.notes?.trim() && (
                      <button
                        onClick={() => saveMonthlyOptions(currentMonth, { ...monthlyOpts, notes: '' })}
                        className="absolute right-3 bottom-4 px-2.5 py-1 bg-slate-150 hover:bg-rose-50 hover:text-rose-500 text-slate-500 text-[10px] font-black uppercase rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={10} />
                        Borrar
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    Las notas se asocian de forma exclusiva a {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })} y se guardan automáticamente.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}



      {/* Historial de Nóminas Guardadas */}
      <section className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div 
          onClick={() => setIsSavedPayrollsExpanded(!isSavedPayrollsExpanded)}
          className="w-full p-3.5 flex items-center justify-between group transition-colors hover:bg-slate-50 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <PieChart size={14} />
            </div>
            <h3 className="text-sm font-black text-black dark:text-white uppercase tracking-tight">NÓMINAS GUARDADAS</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("p-1 rounded-lg transition-all", isSavedPayrollsExpanded ? "bg-azul-blue text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200")}>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isSavedPayrollsExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4">
              <div className="space-y-3 pt-1">
                {(settings.savedPayrolls || [])
                  .filter((p: SavedPayroll) => p.monthKey === currentMonthKey || p.monthKey === `${currentMonthKey}-extra` || p.monthKey.startsWith(`${currentMonthKey}-`))
                  .map((payroll: SavedPayroll) => (
                    <div key={payroll.id} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                      <div 
                        onClick={() => setExpandedPayrollId(expandedPayrollId === payroll.id ? null : payroll.id)}
                        className="w-full text-left p-4 flex justify-between items-center bg-white cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-xl transition-all", expandedPayrollId === payroll.id ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-500")}>
                            <Wallet size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{safeFormat(parseISO(payroll.saveDate), 'dd/MM/yyyy HH:mm')}</span>
                              {(() => {
                                const isVacation = payroll.monthKey.endsWith('-vacaciones') || payroll.devengos?.some((d: any) => d.isVacationVariable);
                                const isExtra = isExtraPayroll(payroll);
                                return (
                                  <span className={cn(
                                    "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider",
                                    isVacation
                                      ? "bg-emerald-700 text-white border border-emerald-700"
                                      : isExtra 
                                        ? "bg-[#1a365d] text-white border border-[#1a365d]" 
                                        : "bg-emerald-600 text-white border border-emerald-600"
                                  )}>
                                    {isVacation ? 'Var. Vacaciones' : isExtra ? 'Paga Extra' : 'Mensual'}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-sm font-black text-emerald-600">{formatCurrency(payroll.totals.liquido)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportMonthlyPayrollPdf(payroll);
                            }} 
                            className="p-2 text-slate-400 hover:text-azul-blue dark:hover:text-sky-400 transition-colors cursor-pointer"
                            title="Descargar esta nómina guardada en PDF"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSavedPayroll(payroll.id);
                            }} 
                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Eliminar nómina guardada"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className={cn("p-1 transition-transform", expandedPayrollId === payroll.id ? "rotate-180" : "")}>
                            <ChevronDown size={16} className="text-slate-300" />
                          </div>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {expandedPayrollId === payroll.id && (
                          <motion.div 
                            initial={{ height: 0 }} 
                            animate={{ height: 'auto' }} 
                            exit={{ height: 0 }} 
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 space-y-4">
                              <div className="grid grid-cols-2 gap-2 pt-4">
                                <div className="bg-white/60 p-3 rounded-xl">
                                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Bruto</span>
                                  <span className="text-xs font-black text-emerald-600">{formatCurrency(payroll.totals.totalDevengado)}</span>
                                </div>
                                <div className="bg-white/60 p-3 rounded-xl">
                                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Deducciones</span>
                                  <span className="text-xs font-black text-rose-600">-{formatCurrency(payroll.totals.totalDeducciones)}</span>
                                </div>
                                <div className="bg-white/60 p-3 rounded-xl col-span-2">
                                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Base Contingencias Comunes</span>
                                  <span className="text-xs font-black text-azul-blue">{formatCurrency(payroll.totals.baseCotizacion ?? 0)}</span>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Devengos</span>
                                <div className="bg-white/40 rounded-xl p-2 space-y-1">
                                  {payroll.devengos.filter(d => d.value !== 0).map((d, i) => (
                                    <div key={i} className="flex justify-between items-center text-[11px]">
                                      <span className="font-black text-slate-800 uppercase">{d.name}</span>
                                      <span className={cn("font-black", d.value < 0 ? "text-rose-600" : "text-slate-700")}>{formatCurrency(d.value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Deducciones</span>
                                <div className="bg-white/40 rounded-xl p-2 space-y-1">
                                  {payroll.deducciones.filter(d => d.value !== 0).map((d, i) => (
                                    <div key={i} className="flex justify-between items-center text-[11px]">
                                      <span className="font-black text-slate-800 uppercase">{d.name} ({d.rate}%)</span>
                                      <span className="font-black text-rose-500">-{formatCurrency(d.value)}</span>
                                    </div>
                                  ))}
                                  {payroll.conceptosADescontar?.filter(c => c.value !== 0).map((c, i) => (
                                    <div key={i} className="flex justify-between items-center text-[11px]">
                                      <span className="font-black text-slate-800 uppercase">{c.name}</span>
                                      <span className="font-black text-rose-500">{formatCurrency(c.value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {payroll.notes && (
                                <div className="space-y-1">
                                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Anotaciones</span>
                                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-800 whitespace-pre-line">
                                    {payroll.notes}
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => exportMonthlyPayrollPdf(payroll)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-azul-blue hover:bg-azul-blue/90 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-98"
                              >
                                <Download size={15} />
                                Descargar Recibo y Hoja de Turnos en PDF
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                {!(settings.savedPayrolls || []).some((p: SavedPayroll) => p.monthKey === currentMonthKey || p.monthKey === `${currentMonthKey}-extra`) && (
                  <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest italic">No hay nóminas guardadas para este mes.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Comparison Modal Overlay */}
      <AnimatePresence>
        {isComparisonModalOpen && detailedComparison && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden" data-modal-active="true">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsComparisonModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-azul-blue text-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <ArrowLeftRight size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight">Comparativa Detallada</h3>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsComparisonModalOpen(false)} 
                  className="p-2 sm:p-3 hover:bg-white/20 rounded-2xl transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Devengos Comparativa */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-2">Devengos Brutos</h4>
                  <div className="space-y-1.5">
                    {detailedComparison.devengoComparison.map((item, idx) => {
                      const nameLower = item.name.toLowerCase();
                      const isHiddenQtyConcept = 
                        nameLower.includes('salario base') ||
                        nameLower.includes('parcial') ||
                        nameLower.includes('turnicidad') ||
                        nameLower.includes('multitasking') ||
                        nameLower.includes('productividad') ||
                        nameLower.includes('teamleader') ||
                        nameLower.includes('jornada irregular') ||
                        nameLower.includes('pp extra') ||
                        nameLower.includes('ajuste de jornada');

                      const showPdfQtyInfo = !isHiddenQtyConcept && item.pdfValue > 0 && item.pdfQty !== undefined && item.pdfQty !== null && String(item.pdfQty).trim() !== '' && String(item.pdfQty).trim() !== '0';
                      const showAppQtyInfo = !isHiddenQtyConcept && item.appValue > 0 && item.appQty !== undefined && item.appQty !== null && String(item.appQty).trim() !== '' && String(item.appQty).trim() !== '0';
                      
                      const hasQtyDiffItem = (() => {
                        if (item.pdfValue <= 0 || item.appValue <= 0) return false;
                        const pQ = item.pdfQty !== undefined && item.pdfQty !== null && String(item.pdfQty).trim() !== '' && String(item.pdfQty).trim() !== '0';
                        const aQ = item.appQty !== undefined && item.appQty !== null && String(item.appQty).trim() !== '' && String(item.appQty).trim() !== '0';
                        if (pQ !== aQ) {
                          if (item.name.toLowerCase().includes('base') || item.name.toLowerCase().includes('pp extra')) {
                            return false;
                          }
                          return true;
                        }
                        if (pQ && aQ) {
                          const pQVal = parseFloat(String(item.pdfQty).replace(',', '.'));
                          const aQVal = parseFloat(String(item.appQty).replace(',', '.'));
                          if (!isNaN(pQVal) && !isNaN(aQVal)) {
                            return Math.abs(pQVal - aQVal) > 0.01;
                          }
                          return String(item.pdfQty).trim() !== String(item.appQty).trim();
                        }
                        return false;
                      })();

                      const hasPriceDiffItem = (() => {
                        if (item.pdfValue <= 0 || item.appValue <= 0) return false;
                        const pP = item.pdfPrice !== undefined && item.pdfPrice !== null && item.pdfPrice !== 0;
                        const aP = item.appPrice !== undefined && item.appPrice !== null && item.appPrice !== 0;
                        if (pP !== aP) return true;
                        if (pP && aP) {
                          const pPVal = typeof item.pdfPrice === 'number' ? item.pdfPrice : parseFloat(String(item.pdfPrice).replace(',', '.'));
                          const aPVal = typeof item.appPrice === 'number' ? item.appPrice : parseFloat(String(item.appPrice).replace(',', '.'));
                          if (!isNaN(pPVal) && !isNaN(aPVal)) {
                            return Math.abs(pPVal - aPVal) > 0.02;
                          }
                        }
                        return false;
                      })();

                      return (
                        <div key={idx} className="bg-slate-50 rounded-xl px-3 py-2 flex justify-between items-center border border-slate-100">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-[10px] font-black text-slate-700 uppercase leading-tight">{item.name}</p>
                          </div>
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="text-right min-w-[60px]">
                              <span className="block text-[7px] font-black text-rose-500 uppercase leading-none mb-1">PDF</span>
                              <span className="text-[11px] font-black text-slate-400">{formatCurrency(item.pdfValue)}</span>
                              {showPdfQtyInfo && (
                                <span className="block text-[8px] mt-0.5 leading-none font-medium">
                                  <span className={hasQtyDiffItem ? "text-rose-500 font-bold" : "text-slate-400"}>
                                    {item.pdfQty}
                                  </span>
                                  <span className="text-slate-400"> x </span>
                                  <span className={hasPriceDiffItem ? "text-rose-500 font-bold" : "text-slate-400"}>
                                    {formatCurrency(item.pdfPrice ?? 0)}
                                  </span>
                                </span>
                              )}
                            </div>
                            <div className="text-right min-w-[60px]">
                              <span className="block text-[7px] font-black text-azul-blue uppercase leading-none mb-1">APP</span>
                              <span className="text-[11px] font-black text-slate-700">{formatCurrency(item.appValue)}</span>
                              {showAppQtyInfo && (
                                <span className="block text-[8px] mt-0.5 leading-none font-medium">
                                  <span className={hasQtyDiffItem ? "text-rose-500 font-bold" : "text-slate-705"}>
                                    {item.appQty}
                                  </span>
                                  <span className="text-slate-400"> x </span>
                                  <span className={hasPriceDiffItem ? "text-rose-500 font-bold" : "text-slate-705"}>
                                    {formatCurrency(item.appPrice ?? 0)}
                                  </span>
                                </span>
                              )}
                            </div>
                            <div className="text-right min-w-[75px]">
                              <span className="block text-[7px] font-black text-slate-400 uppercase leading-none mb-1">DIFF</span>
                              <span className={cn("text-[11px] font-black flex items-center justify-end gap-1", Math.abs(item.diff) <= 0.05 ? "text-emerald-500" : "text-rose-500")}>
                                {Math.abs(item.diff) <= 0.05 ? <Check size={12} strokeWidth={4} /> : (item.diff > 0 ? "+" : "")}
                                {Math.abs(item.diff) <= 0.05 ? "0,00€" : `${formatNumber(item.diff, 2)}€`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Deducciones Comparativa */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-2">Deducciones e IRPF</h4>
                  <div className="space-y-1.5">
                    {detailedComparison.deduccionComparison.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-xl px-3 py-2 flex justify-between items-center border border-slate-100">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-[10px] font-black text-slate-700 uppercase leading-tight">{item.name}</p>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="text-right min-w-[60px]">
                            <span className="block text-[7px] font-black text-rose-500 uppercase leading-none mb-1">PDF</span>
                            <span className="text-[11px] font-black text-slate-400">{formatCurrency(item.pdfValue)}</span>
                            {item.pdfValue > 0 && item.pdfRate !== undefined && item.pdfRate !== null && item.pdfRate > 0 && (
                              <span className="block text-[8px] text-slate-400 font-medium mt-0.5 leading-none">
                                {formatNumber(item.pdfRate, 2)}%
                              </span>
                            )}
                          </div>
                          <div className="text-right min-w-[60px]">
                            <span className="block text-[7px] font-black text-azul-blue uppercase leading-none mb-1">APP</span>
                            <span className="text-[11px] font-black text-slate-700">{formatCurrency(item.appValue)}</span>
                            {item.appValue > 0 && item.appRate !== undefined && item.appRate !== null && item.appRate > 0 && (
                              <span className="block text-[8px] text-slate-500 font-medium mt-0.5 leading-none">
                                {formatNumber(item.appRate, 2)}%
                              </span>
                            )}
                          </div>
                          <div className="text-right min-w-[75px]">
                            <span className="block text-[7px] font-black text-slate-400 uppercase leading-none mb-1">DIFF</span>
                            <span className={cn("text-[11px] font-black flex items-center justify-end gap-1", Math.abs(item.diff) <= 0.05 ? "text-emerald-500" : "text-rose-500")}>
                              {Math.abs(item.diff) <= 0.05 ? <Check size={12} strokeWidth={4} /> : (item.diff > 0 ? "+" : "")}
                              {Math.abs(item.diff) <= 0.05 ? "0,00€" : `${formatNumber(item.diff, 2)}€`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100">
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Bruto APP</span>
                  <span className="text-lg font-black text-slate-700">{formatCurrency(detailedComparison.totals.appDevengos)}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100">
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Diferencia Final</span>
                  <span className={cn("text-lg font-black", Math.abs(liquido - uploadedPayroll.data.liquido) <= 0.05 ? "text-emerald-500" : "text-rose-500")}>
                    {formatNumber(liquido - uploadedPayroll.data.liquido, 2)} €
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modals de confirmación */}
      <ConfirmModal
        isOpen={isDeleteUploadedConfirmOpen}
        onClose={() => setIsDeleteUploadedConfirmOpen(false)}
        onConfirm={() => {
          updateSettings({ 
            ...settings, 
            uploadedPayrolls: (settings.uploadedPayrolls || []).filter((p: UploadedPayroll) => p.monthKey !== currentMonthKey) 
          });
        }}
        title="¿Eliminar Nómina PDF?"
        message="Se eliminarán los datos extraídos de la nómina PDF para este mes. Podrás volver a subirla cuando quieras."
      />

      <ConfirmModal
        isOpen={!!payrollToDelete}
        onClose={() => setPayrollToDelete(null)}
        onConfirm={() => {
          if (payrollToDelete) {
            const updatedPayrolls = settings.savedPayrolls.filter((p: SavedPayroll) => p.id !== payrollToDelete);
            updateSettings({ ...settings, savedPayrolls: updatedPayrolls });
          }
        }}
        title="¿Eliminar del Historial?"
        message="Esta acción no se puede deshacer y la nómina guardada desaparecerá del historial permanentemente."
      />

      {/* Upload Modal (similar to captures) */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-modal-active="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isUploading) {
                  setIsUploadModalOpen(false);
                  setStagedFiles([]);
                }
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center"
            >
              <div className="space-y-1 mb-6">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight uppercase">Subir Nómina</h3>
                <p className="text-xs font-bold text-slate-400">PDF o Imagen</p>
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
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-md group/item bg-slate-100 flex items-center justify-center text-center">
                          {file.type === 'application/pdf' ? (
                            <FileText size={40} className="text-azul-blue" />
                          ) : (
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Preview ${idx}`}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
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
                      <Upload size={40} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-4">Selecciona archivos o arrastra aquí</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 w-full space-y-4">
                {uploadError && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-2 text-rose-600 text-left">
                    <AlertCircle size={14} className="shrink-0" />
                    <p className="text-[11px] font-bold leading-normal text-rose-700">{uploadError}</p>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    if (stagedFiles.length > 0) {
                      handleUploadPayroll();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={isUploading}
                  className={cn(
                    "w-full rounded-2xl py-4 font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-azul-blue/20 flex items-center justify-center gap-2",
                    stagedFiles.length > 0 ? "bg-azul-blue text-white hover:bg-azul-blue/90" : "bg-azul-blue/10 text-azul-blue"
                  )}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    stagedFiles.length > 0 ? 'Analizar Nómina' : 'Seleccionar Archivos'
                  )}
                </button>
                
                <p className="text-[9px] font-black text-slate-400 leading-relaxed px-4 uppercase">
                  Puedes subir el PDF original o una foto clara de tu nómina.
                </p>
              </div>

              <button
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    setStagedFiles([]);
                    setUploadError(null);
                  }
                }}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 transition-colors"
                disabled={isUploading}
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PayrollReviewModal
        isOpen={!!pendingReviewPayroll}
        monthLabel={safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}
        extractedData={pendingReviewPayroll?.data ?? null}
        isRetrying={isRetryingReview}
        formatCurrency={formatCurrency}
        onRetry={handleRetryReviewAnalysis}
        onConfirmSave={() => {
          if (pendingReviewPayroll) {
            persistUploadedPayroll(pendingReviewPayroll.data);
          }
        }}
        onCancel={() => {
          if (!isRetryingReview) {
            setPendingReviewPayroll(null);
          }
        }}
      />
    </div>
  );
};
