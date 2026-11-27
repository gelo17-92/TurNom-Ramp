import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  Briefcase, 
  Zap, 
  Clock, 
  Calendar as CalendarIcon, 
  Plus, 
  X, 
  Umbrella, 
  TrendingUp,
  FileText,
  ChevronDown,
  HelpCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  Check,
  Award,
  Lock,
  ArrowRight
} from 'lucide-react';
import { parseISO, differenceInDays, addYears, addDays, eachDayOfInterval, isAfter, startOfDay, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, SharedQuadrantInfo } from '../types';
import { LocalInput } from './LocalInput';
import { ConfirmModal } from './ConfirmModal';
import { DateRangePickerModal } from './DateRangePickerModal';
import { safeFormat } from '../utils';
import { TutorialModal, TutorialStep } from './TutorialModal';
import { PuntuacionVacacionesSection, calculateVacationScoreForYear } from './PuntuacionVacacionesSection';
import { AddVacationsModal } from './AddVacationsModal';
import { useScrollLock } from '../hooks/useScrollLock';

interface ConfiguracionTabProps {
  settings: any;
  shifts: any[];
  updateSettings: (settings: any) => void;
  updateShift: (shift: any) => void;
  updateShifts: (shifts: any[]) => void;
  handleResetData: () => void;
  activeSharedOwner?: SharedQuadrantInfo | null;
}

export const ConfiguracionTab = ({
  settings,
  shifts,
  updateSettings,
  updateShift,
  updateShifts,
  handleResetData,
  activeSharedOwner
}: ConfiguracionTabProps) => {
  const isLocked = !!activeSharedOwner?.isLocked;
  const [newHoliday, setNewHoliday] = useState('');
  const [isAddVacationsModalOpen, setIsAddVacationsModalOpen] = useState(false);
  const [vacationStart, setVacationStart] = useState('');
  const [vacationEnd, setVacationEnd] = useState('');
  const [singleVacation, setSingleVacation] = useState('');
  const [vacationMode, setVacationMode] = useState<'single' | 'range'>('range');
  const [frozenStart, setFrozenStart] = useState('');
  const [frozenEnd, setFrozenEnd] = useState('');
  const [isFrozenOpen, setIsFrozenOpen] = useState(false);
  const [rangePickerConfig, setRangePickerConfig] = useState<{
    type: 'vacation' | 'frozen' | null;
    initialStep: 'start' | 'end';
  }>({ type: null, initialStep: 'start' });

  type ConfigSectionKey = 'contract' | 'progression' | 'frozen' | 'holidays' | 'vacations' | 'vacation_score';
  const [activeSectionModal, setActiveSectionModal] = useState<ConfigSectionKey | null>(null);

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [frozenToDelete, setFrozenToDelete] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialInitialStep, setTutorialInitialStep] = useState(0);
  const [isFixedHolidaysOpen, setIsFixedHolidaysOpen] = useState(false);

  useScrollLock(activeSectionModal !== null);

  useEffect(() => {
    if (!activeSectionModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isAddVacationsModalOpen || rangePickerConfig.type !== null || frozenToDelete !== null || isResetConfirmOpen || showTutorial) {
        return;
      }
      setActiveSectionModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSectionModal, isAddVacationsModalOpen, rangePickerConfig.type, frozenToDelete, isResetConfirmOpen, showTutorial]);

  const currentYear = new Date().getFullYear();
  const currentYearScore = useMemo(
    () => calculateVacationScoreForYear(currentYear, settings.vacations || [], settings.holidays || []),
    [currentYear, settings.vacations, settings.holidays, activeSectionModal]
  );

  // Group by year states and memoized data
  const [expandedHolidayYears, setExpandedHolidayYears] = useState<Record<number, boolean>>({});
  const [expandedVacationYears, setExpandedVacationYears] = useState<Record<number, boolean>>({});

  const holidaysByYear = React.useMemo(() => {
    const groups: Record<number, string[]> = {};
    (settings.holidays || []).forEach((h: string) => {
      const d = parseISO(h);
      if (isValid(d)) {
        const year = d.getFullYear();
        if (!groups[year]) {
          groups[year] = [];
        }
        groups[year].push(h);
      }
    });
    Object.keys(groups).forEach(y => {
      groups[Number(y)].sort((a, b) => a.localeCompare(b));
    });
    return groups;
  }, [settings.holidays]);

  const vacationsByYear = React.useMemo(() => {
    const groups: Record<number, string[]> = {};
    const allVacationDates = new Set<string>();

    (settings.vacations || []).forEach((v: string) => {
      allVacationDates.add(v);
    });

    (shifts || []).forEach((s) => {
      if (s.type === 'Vacaciones') {
        allVacationDates.add(s.date);
      }
    });

    Array.from(allVacationDates).forEach((v: string) => {
      const d = parseISO(v);
      if (isValid(d)) {
        const year = d.getFullYear();
        if (!groups[year]) {
          groups[year] = [];
        }
        groups[year].push(v);
      }
    });

    Object.keys(groups).forEach(y => {
      groups[Number(y)].sort((a, b) => a.localeCompare(b));
    });
    return groups;
  }, [settings.vacations, shifts]);

  // Sync vacations from shifts to settings on mount/update so everything is perfectly aligned
  React.useEffect(() => {
    const shiftVacationDates = (shifts || [])
      .filter(s => s.type === 'Vacaciones')
      .map(s => s.date);
    
    if (shiftVacationDates.length === 0) return;

    const missingVacations = shiftVacationDates.filter(d => !settings.vacations.includes(d));
    if (missingVacations.length > 0) {
      const merged = Array.from(new Set([...settings.vacations, ...shiftVacationDates])).sort();
      updateSettings({
        ...settings,
        vacations: merged
      });
    }
  }, [shifts, settings.vacations, settings, updateSettings]);

  const isHolidayYearExpanded = (year: number) => {
    return !!expandedHolidayYears[year];
  };

  const toggleHolidayYear = (year: number) => {
    setExpandedHolidayYears(prev => ({
      ...prev,
      [year]: !isHolidayYearExpanded(year)
    }));
  };

  const isVacationYearExpanded = (year: number) => {
    return !!expandedVacationYears[year];
  };

  const toggleVacationYear = (year: number) => {
    setExpandedVacationYears(prev => ({
      ...prev,
      [year]: !isVacationYearExpanded(year)
    }));
  };

  useEffect(() => {
    if (activeSectionModal === 'holidays') {
      const years = Object.keys(holidaysByYear).map(Number);
      if (years.length > 0) {
        const targetYear = holidaysByYear[currentYear] ? currentYear : Math.max(...years);
        setExpandedHolidayYears(prev => (prev[targetYear] ? prev : { ...prev, [targetYear]: true }));
      }
    } else if (activeSectionModal === 'vacations') {
      const years = Object.keys(vacationsByYear).map(Number);
      if (years.length > 0) {
        const targetYear = vacationsByYear[currentYear] ? currentYear : Math.max(...years);
        setExpandedVacationYears(prev => (prev[targetYear] ? prev : { ...prev, [targetYear]: true }));
      }
    }
  }, [activeSectionModal, currentYear, holidaysByYear, vacationsByYear]);

  const fixedHolidaysList = [
    { name: 'Año Nuevo', date: '1 Enero' },
    { name: 'Reyes Magos', date: '6 Enero' },
    { name: 'San José', date: '19 Marzo' },
    { name: 'Día del Trabajo', date: '1 Mayo' },
    { name: 'San Juan', date: '24 Junio' },
    { name: 'Asunción de la Virgen', date: '15 Agosto' },
    { name: 'Día de la C. Valenciana', date: '9 Octubre' },
    { name: 'Fiesta Nacional de España', date: '12 Octubre' },
    { name: 'Todos los Santos', date: '1 Noviembre' },
    { name: 'Día de la Constitución', date: '6 Diciembre' },
    { name: 'Inmaculada Concepción', date: '8 Diciembre' },
    { name: 'Navidad', date: '25 Diciembre' }
  ];

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Tipo de Contrato",
      badge: "Configuración",
      icon: <Briefcase size={22} />,
      color: "text-azul-blue",
      bg: "bg-azul-blue/10",
      description: "Escoge tu colectivo (Rampa o Pasaje) para sincronizar las tablas salariales, selecciona tu tipo de contrato (Completo o Parcial) para activar sus pluses y ajusta si tienes 12 o 14 pagas anuales."
    },
    {
      title: "Progresión de Nivel o Antigüedad",
      badge: "Antigüedad",
      icon: <TrendingUp size={22} />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      description: "Especifica tú antigüedad de contratación en la empresa. El sistema estima de forma automática tú nivel salarial y la fecha exacta de la próxima progresión, o te permite ajustarlos manualmente."
    },
    {
      title: "Congelación Progresión",
      badge: "Excedencias / Suspensiones",
      icon: <Clock size={22} />,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      description: "Añade períodos en los que tu progresión de nivel haya estado congelada (por ejemplo excedencias o suspensiones). Esos días se descuentan automáticamente al calcular tu próximo salto de nivel."
    },
    {
      title: "Festivos",
      badge: "Festivos",
      icon: <CalendarIcon size={22} />,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      description: "Define las fechas festivas durante el año y consulta los festivos fijos de convenio. El sistema los añade automáticamente al calendario de turnos."
    },
    {
      title: "Vacaciones",
      badge: "Vacaciones",
      icon: <Umbrella size={22} />,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      description: "Añade períodos de vacaciones por tramos de fechas o días sueltos. Los días asignados se sincronizarán directamente con tu cuadrante del calendario."
    },
    {
      title: "Puntuación de vacaciones",
      badge: "Puntuación",
      icon: <Award size={22} />,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      description: "Calcula y consulta la puntuación media de tus vacaciones asignadas según los baremos anuales. Puedes personalizar los períodos puntuables, puntos por quincena/mes y el divisor de cálculo anual."
    }
  ];

  const calculateLevelInfo = (seniorityVal: string, frozenPeriods: any[]) => {
    const seniority = parseISO(seniorityVal);
    if (!isValid(seniority)) {
      return { calculatedLevel: 1, nextDate: new Date() };
    }
    const today = startOfDay(new Date());
    
    let totalFrozenDays = 0;
    if (frozenPeriods && Array.isArray(frozenPeriods)) {
      frozenPeriods.forEach((period: any) => {
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

    const getMilestoneDate = (yearsToAdd: number) =>
      startOfDay(addDays(addYears(seniority, yearsToAdd), totalFrozenDays));

    const dateLvl2 = getMilestoneDate(1);
    const dateLvl3 = getMilestoneDate(4);
    const dateLvl4 = getMilestoneDate(6);
    const dateLvl5 = getMilestoneDate(8);
    const dateLvl6 = getMilestoneDate(10);
    const dateLvl7 = getMilestoneDate(12);

    let calculatedLevel = 1;
    let nextDate = dateLvl2;

    if (today >= dateLvl7) {
      calculatedLevel = 7;
      nextDate = addYears(seniority, 100);
    } else if (today >= dateLvl6) {
      calculatedLevel = 6;
      nextDate = dateLvl7;
    } else if (today >= dateLvl5) {
      calculatedLevel = 5;
      nextDate = dateLvl6;
    } else if (today >= dateLvl4) {
      calculatedLevel = 4;
      nextDate = dateLvl5;
    } else if (today >= dateLvl3) {
      calculatedLevel = 3;
      nextDate = dateLvl4;
    } else if (today >= dateLvl2) {
      calculatedLevel = 2;
      nextDate = dateLvl3;
    } else {
      calculatedLevel = 1;
      nextDate = dateLvl2;
    }

    return { calculatedLevel, nextDate };
  };

  const getNextDateForLevel = (seniorityVal: string, lvl: number, frozenPeriods: any[]): Date => {
    const seniority = parseISO(seniorityVal);
    if (!isValid(seniority)) return new Date();
    const today = startOfDay(new Date());
    let totalFrozenDays = 0;
    if (frozenPeriods && Array.isArray(frozenPeriods)) {
      frozenPeriods.forEach((period: any) => {
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
    const yearsMap: Record<number, number> = { 1: 1, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12 };
    const yearsToAdd = yearsMap[lvl] ?? 100;
    return startOfDay(addDays(addYears(seniority, yearsToAdd), totalFrozenDays));
  };

  React.useEffect(() => {
    if (settings.manualLevelProgression || !settings.seniorityDate) return;
    const { calculatedLevel, nextDate } = calculateLevelInfo(settings.seniorityDate, settings.frozenPeriods || []);
    const expectedNextIso = safeFormat(nextDate, 'yyyy-MM-dd');
    if (settings.currentLevel !== calculatedLevel || settings.nextLevelDate !== expectedNextIso) {
      updateSettings({
        ...settings,
        currentLevel: calculatedLevel,
        selectedLevel: calculatedLevel,
        nextLevelDate: expectedNextIso
      });
    }
  }, [settings.manualLevelProgression, settings.seniorityDate, settings.frozenPeriods]);

  const addFrozenPeriod = () => {
    if (!frozenStart || !frozenEnd) return;
    const start = parseISO(frozenStart);
    const end = parseISO(frozenEnd);
    if (isAfter(start, end)) return;

    const newPeriod = { start: frozenStart, end: frozenEnd };
    const updatedFrozen = [...(settings.frozenPeriods || []), newPeriod].sort((a, b) => a.start.localeCompare(b.start));
    
    if (settings.manualLevelProgression) {
      updateSettings({
        ...settings,
        frozenPeriods: updatedFrozen
      });
    } else {
      const { calculatedLevel, nextDate } = calculateLevelInfo(settings.seniorityDate, updatedFrozen);
      updateSettings({ 
        ...settings, 
        frozenPeriods: updatedFrozen,
        currentLevel: calculatedLevel,
        selectedLevel: calculatedLevel,
        nextLevelDate: safeFormat(nextDate, 'yyyy-MM-dd')
      });
    }
    setFrozenStart('');
    setFrozenEnd('');
  };

  const removeFrozenPeriod = (index: number) => {
    const updatedFrozen = settings.frozenPeriods.filter((_: any, i: number) => i !== index);
    if (settings.manualLevelProgression) {
      updateSettings({
        ...settings,
        frozenPeriods: updatedFrozen
      });
    } else {
      const { calculatedLevel, nextDate } = calculateLevelInfo(settings.seniorityDate, updatedFrozen);
      updateSettings({ 
        ...settings, 
        frozenPeriods: updatedFrozen,
        currentLevel: calculatedLevel,
        selectedLevel: calculatedLevel,
        nextLevelDate: safeFormat(nextDate, 'yyyy-MM-dd')
      });
    }
  };

  const handleToggleManualProgression = (checked: boolean) => {
    if (checked) {
      updateSettings({
        ...settings,
        manualLevelProgression: true
      });
    } else {
      const { calculatedLevel, nextDate } = calculateLevelInfo(settings.seniorityDate, settings.frozenPeriods || []);
      updateSettings({
        ...settings,
        manualLevelProgression: false,
        currentLevel: calculatedLevel,
        selectedLevel: calculatedLevel,
        nextLevelDate: safeFormat(nextDate, 'yyyy-MM-dd')
      });
    }
  };

  const handleSelectManualLevel = (lvl: number) => {
    const suggestedNext = lvl >= 7 ? '' : safeFormat(getNextDateForLevel(settings.seniorityDate, lvl, settings.frozenPeriods || []), 'yyyy-MM-dd');
    updateSettings({
      ...settings,
      manualLevelProgression: true,
      currentLevel: lvl,
      selectedLevel: lvl,
      nextLevelDate: suggestedNext
    });
  };

  const handleManualNextLevelDate = (val: string) => {
    updateSettings({
      ...settings,
      manualLevelProgression: true,
      nextLevelDate: val
    });
  };

  const handleSetMaxLevel = () => {
    updateSettings({
      ...settings,
      manualLevelProgression: true,
      currentLevel: 7,
      selectedLevel: 7,
      nextLevelDate: ''
    });
  };

  const handleRecalculateSuggestedDate = () => {
    const nextDate = getNextDateForLevel(settings.seniorityDate, settings.currentLevel, settings.frozenPeriods || []);
    updateSettings({
      ...settings,
      nextLevelDate: safeFormat(nextDate, 'yyyy-MM-dd')
    });
  };

  const addHoliday = () => {
    if (newHoliday && !settings.holidays.includes(newHoliday)) {
      updateSettings({ ...settings, holidays: [...settings.holidays, newHoliday].sort() });
      const addedYear = new Date(parseISO(newHoliday)).getFullYear();
      setExpandedHolidayYears(prev => ({ ...prev, [addedYear]: true }));
      setNewHoliday('');
    }
  };

  const removeHoliday = (date: string) => {
    updateSettings({ ...settings, holidays: settings.holidays.filter((h: string) => h !== date) });
  };

  const addVacationRange = () => {
    if (!vacationStart || !vacationEnd) return;

    const start = parseISO(vacationStart);
    const end = parseISO(vacationEnd);

    if (isAfter(start, end)) {
      return;
    }

    const interval = eachDayOfInterval({ start, end });
    const newDates = interval.map(date => safeFormat(date, 'yyyy-MM-dd'));
    
    // Filter out dates that are already in vacations
    const uniqueNewDates = newDates.filter(date => !settings.vacations.includes(date));
    
    if (uniqueNewDates.length === 0) {
      setVacationStart('');
      setVacationEnd('');
      return;
    }

    const updatedVacations = [...settings.vacations, ...uniqueNewDates].sort();
    updateSettings({ ...settings, vacations: updatedVacations });

    // Expand newly added years
    const addedYears = uniqueNewDates.map(date => new Date(parseISO(date)).getFullYear());
    const uniqueYears = Array.from(new Set(addedYears));
    setExpandedVacationYears(prev => {
      const copy = { ...prev };
      uniqueYears.forEach(yr => {
        copy[yr] = true;
      });
      return copy;
    });

    // Sync with shifts
    const shiftsToUpdate = uniqueNewDates.map(date => {
      const existingShift = shifts.find(s => s.date === date);
      if (existingShift) {
        return { 
          ...existingShift, 
          type: 'Vacaciones' as const,
          shifts: (existingShift.shifts && existingShift.shifts.length > 0) ? existingShift.shifts : [{ start: '', end: '' }],
          extraShifts: existingShift.extraShifts || []
        };
      } else {
        return {
          date,
          type: 'Vacaciones' as const,
          shifts: [{ start: '', end: '' }],
          perentorias: { day: 0, night: 0 },
          complementarias: { day: 0, night: 0 },
          extraShifts: []
        };
      }
    });

    updateShifts(shiftsToUpdate);
    setVacationStart('');
    setVacationEnd('');
  };

  const addSingleVacation = () => {
    if (!singleVacation) return;
    if (settings.vacations.includes(singleVacation)) {
      setSingleVacation('');
      return;
    }

    const updatedVacations = [...settings.vacations, singleVacation].sort();
    updateSettings({ ...settings, vacations: updatedVacations });

    const addedYear = new Date(parseISO(singleVacation)).getFullYear();
    setExpandedVacationYears(prev => ({ ...prev, [addedYear]: true }));

    const existingShift = shifts.find(s => s.date === singleVacation);
    const updatedShift = existingShift 
      ? { 
          ...existingShift, 
          type: 'Vacaciones' as const,
          shifts: (existingShift.shifts && existingShift.shifts.length > 0) ? existingShift.shifts : [{ start: '', end: '' }],
          extraShifts: existingShift.extraShifts || []
        }
      : {
          date: singleVacation,
          type: 'Vacaciones' as const,
          shifts: [{ start: '', end: '' }],
          perentorias: { day: 0, night: 0 },
          complementarias: { day: 0, night: 0 },
          extraShifts: []
        };

    updateShift(updatedShift);
    setSingleVacation('');
  };

  const removeVacation = (date: string) => {
    updateSettings({ ...settings, vacations: settings.vacations.filter((v: string) => v !== date) });
    // Sync with shifts: if it was marked as Vacaciones, revert to Laboral
    const existingShift = shifts.find(s => s.date === date);
    if (existingShift && existingShift.type === 'Vacaciones') {
      updateShift({ ...existingShift, type: 'Laboral' });
    }
  };

  const frozenCount = settings.frozenPeriods?.length || 0;
  const activeFrozenPeriod = useMemo(() => {
    if (!Array.isArray(settings.frozenPeriods) || settings.frozenPeriods.length === 0) return null;
    const today = startOfDay(new Date());
    return settings.frozenPeriods.find((p: any) => {
      if (!p?.start || !p?.end) return false;
      const start = parseISO(p.start);
      const end = parseISO(p.end);
      if (!isValid(start) || !isValid(end)) return false;
      const startDay = startOfDay(start);
      const endDay = startOfDay(end);
      return today >= startDay && today <= endDay;
    }) || null;
  }, [settings.frozenPeriods]);

  const progressionBarPct = useMemo(() => {
    const lvl = Number(settings.currentLevel) || 1;
    if (lvl >= 7) return 100;
    const today = startOfDay(new Date());
    const seniority = settings.seniorityDate ? parseISO(settings.seniorityDate) : null;
    const nextDate = settings.nextLevelDate ? parseISO(settings.nextLevelDate) : null;

    if (seniority && isValid(seniority) && nextDate && isValid(nextDate)) {
      const startDate = lvl <= 1
        ? startOfDay(seniority)
        : getNextDateForLevel(settings.seniorityDate, lvl - 1, settings.frozenPeriods || []);
      const endDate = startOfDay(nextDate);
      const totalSpan = differenceInDays(endDate, startDate);
      if (totalSpan > 0) {
        const elapsed = differenceInDays(today, startDate);
        const rawPct = Math.round((elapsed / totalSpan) * 100);
        return Math.max(6, Math.min(100, rawPct));
      }
    }
    return Math.round((lvl / 7) * 100);
  }, [settings.currentLevel, settings.seniorityDate, settings.nextLevelDate, settings.frozenPeriods]);

  const activeColectivo: 'rampa' | 'pasaje' = settings.colectivoConvenio === 'pasaje' ? 'pasaje' : 'rampa';
  const activeColectivoLabel = activeColectivo === 'pasaje' ? 'Pasaje' : 'Rampa';

  const sectionMeta: Record<ConfigSectionKey, {
    title: string;
    subtitle: string;
    accentBar: string;
    headerBg: string;
    headerIconBg: string;
    icon: React.ReactNode;
    tutorialIndex: number;
    related?: {
      key: ConfigSectionKey;
      label: string;
      icon: React.ReactNode;
      pillClass: string;
    };
  }> = {
    contract: {
      title: 'Tipo de Contrato',
      subtitle: `${activeColectivoLabel} · ${settings.contractType}${settings.contractType === 'Completo' && settings.isSubrogado ? ' · Subrogado' : ''} · ${settings.pagas} pagas`,
      accentBar: 'from-azul-blue via-sky-500 to-azul-blue',
      headerBg: 'bg-sky-50/70 dark:bg-sky-950/25',
      headerIconBg: 'bg-azul-blue text-white shadow-azul-blue/30',
      icon: <FileText size={20} />,
      tutorialIndex: 0,
    },
    progression: {
      title: 'Progresión de Nivel',
      subtitle: `Nivel ${settings.currentLevel} de 7${settings.manualLevelProgression ? ' · Manual' : ''}`,
      accentBar: 'from-amber-500 via-yellow-500 to-amber-600',
      headerBg: 'bg-amber-50/70 dark:bg-amber-950/25',
      headerIconBg: 'bg-amber-500 text-white shadow-amber-500/30',
      icon: <TrendingUp size={20} />,
      tutorialIndex: 1,
      related: {
        key: 'frozen',
        label: `Congelación (${frozenCount})`,
        icon: <Clock size={13} />,
        pillClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50',
      },
    },
    frozen: {
      title: 'Congelación Progresión',
      subtitle: `${frozenCount} ${frozenCount === 1 ? 'tramo registrado' : 'tramos registrados'}`,
      accentBar: 'from-rose-500 via-pink-500 to-rose-600',
      headerBg: 'bg-rose-50/70 dark:bg-rose-950/25',
      headerIconBg: 'bg-rose-600 text-white shadow-rose-600/30',
      icon: <Clock size={20} />,
      tutorialIndex: 2,
      related: {
        key: 'progression',
        label: `Progresión (Niv. ${settings.currentLevel})`,
        icon: <TrendingUp size={13} />,
        pillClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50',
      },
    },
    holidays: {
      title: 'Festivos',
      subtitle: `${settings.holidays.length} ${settings.holidays.length === 1 ? 'día festivo' : 'días festivos'}`,
      accentBar: 'from-emerald-500 via-teal-500 to-emerald-600',
      headerBg: 'bg-emerald-50/70 dark:bg-emerald-950/25',
      headerIconBg: 'bg-emerald-600 text-white shadow-emerald-600/30',
      icon: <CalendarIcon size={20} />,
      tutorialIndex: 3,
    },
    vacations: {
      title: 'Vacaciones',
      subtitle: `${settings.vacations.length} ${settings.vacations.length === 1 ? 'día asignado' : 'días asignados'}`,
      accentBar: 'from-amber-400 via-yellow-400 to-amber-500',
      headerBg: 'bg-yellow-50/80 dark:bg-yellow-950/25',
      headerIconBg: 'bg-azul-yellow text-azul-blue shadow-amber-400/30',
      icon: <Umbrella size={20} />,
      tutorialIndex: 4,
      related: {
        key: 'vacation_score',
        label: `Puntuación (${currentYearScore.finalScore.toFixed(2)} pts)`,
        icon: <Award size={13} />,
        pillClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/50',
      },
    },
    vacation_score: {
      title: 'Puntuación Vacaciones',
      subtitle: `${currentYearScore.finalScore.toFixed(2)} pts en ${currentYear}`,
      accentBar: 'from-purple-500 via-indigo-500 to-purple-600',
      headerBg: 'bg-purple-50/70 dark:bg-purple-950/25',
      headerIconBg: 'bg-purple-600 text-white shadow-purple-600/30',
      icon: <Award size={20} />,
      tutorialIndex: 5,
      related: {
        key: 'vacations',
        label: `Vacaciones (${settings.vacations.length}d)`,
        icon: <Umbrella size={13} />,
        pillClass: 'bg-yellow-50 dark:bg-yellow-950/40 text-amber-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/60 hover:bg-yellow-100 dark:hover:bg-yellow-900/50',
      },
    },
  };

  return (
    <div className="px-1 min-[360px]:px-1.5 sm:px-3 md:px-6 space-y-6 sm:space-y-8 pb-32 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pt-4 sm:pt-6">
      {isLocked && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-center gap-3 text-amber-800 dark:text-amber-200 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
            <Lock size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-100">
              Edición Bloqueada por el Titular
            </h4>
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              {activeSharedOwner?.ownerName || 'El titular'} ha bloqueado los permisos de edición para este cuadrante compartido. Los ajustes de configuración están en modo solo lectura.
            </p>
          </div>
        </div>
      )}

      {/* Cuadrícula de botones en 2 columnas (estilo Ajustes del Calendario) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto select-none">
        {/* 1. Tipo de Contrato */}
        <button
          type="button"
          onClick={() => setActiveSectionModal('contract')}
          className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs min-h-[135px] sm:min-h-[155px] group bg-sky-50/70 dark:bg-sky-950/25 border-sky-200 dark:border-sky-800/60 hover:border-sky-400"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-xs text-white transition-transform group-hover:scale-105 shrink-0 bg-azul-blue">
            <FileText size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
            Tipo de Contrato
          </span>
          <div className="px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border bg-sky-500/15 border-sky-500/30 text-azul-blue dark:text-sky-300">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-azul-blue dark:bg-sky-400" />
            <span>
              {activeColectivoLabel} · {settings.contractType}
              {settings.contractType === 'Completo' && settings.isSubrogado ? ' · SUB' : ''} · {settings.pagas}p
            </span>
          </div>
        </button>

        {/* 2. Progresión de Nivel */}
        <button
          type="button"
          onClick={() => setActiveSectionModal('progression')}
          className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs min-h-[135px] sm:min-h-[155px] group bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/60 hover:border-amber-400"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-xs text-white transition-transform group-hover:scale-105 shrink-0 bg-amber-500">
            <TrendingUp size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
            Progresión de Nivel
          </span>
          <div className="w-full max-w-[160px] flex items-center gap-2 px-1">
            <span className="text-[10px] sm:text-[11px] font-black text-amber-700 dark:text-amber-300 tabular-nums shrink-0 leading-none">
              {settings.currentLevel}
            </span>
            <div className="flex-1 h-2 bg-amber-500/20 dark:bg-amber-900/40 rounded-full overflow-hidden border border-amber-500/30">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${progressionBarPct}%` }}
              />
            </div>
            <span className="text-[10px] sm:text-[11px] font-black text-amber-700/70 dark:text-amber-300/70 tabular-nums shrink-0 leading-none">
              {settings.currentLevel >= 7 ? 'MAX' : settings.currentLevel + 1}
            </span>
          </div>
        </button>

        {/* 3. Congelación Progresión */}
        <button
          type="button"
          onClick={() => setActiveSectionModal('frozen')}
          className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs min-h-[135px] sm:min-h-[155px] group bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 hover:border-rose-400"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-xs text-white transition-transform group-hover:scale-105 shrink-0 bg-rose-600">
            <Clock size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
            Congelación Progresión
          </span>
          {activeFrozenPeriod && (
            <div className="px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-rose-500" />
              <span>
                {safeFormat(parseISO(activeFrozenPeriod.start), 'dd/MM/yy')} - {safeFormat(parseISO(activeFrozenPeriod.end), 'dd/MM/yy')}
              </span>
            </div>
          )}
        </button>

        {/* 4. Festivos */}
        <button
          type="button"
          onClick={() => setActiveSectionModal('holidays')}
          className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs min-h-[135px] sm:min-h-[155px] group bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-400"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-xs text-white transition-transform group-hover:scale-105 shrink-0 bg-emerald-500">
            <CalendarIcon size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
            Festivos
          </span>
        </button>

        {/* 5. Vacaciones */}
        <button
          type="button"
          onClick={() => setActiveSectionModal('vacations')}
          className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs min-h-[135px] sm:min-h-[155px] group bg-yellow-50/80 dark:bg-yellow-950/25 border-yellow-300 dark:border-yellow-700/60 hover:border-yellow-400"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-xs text-azul-blue transition-transform group-hover:scale-105 shrink-0 bg-azul-yellow">
            <Umbrella size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
            Vacaciones
          </span>
        </button>

        {/* 6. Puntuación Vacaciones */}
        <button
          type="button"
          onClick={() => setActiveSectionModal('vacation_score')}
          className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center text-center gap-2.5 shadow-xs min-h-[135px] sm:min-h-[155px] group bg-purple-50/60 dark:bg-purple-950/25 border-purple-200 dark:border-purple-800/50 hover:border-purple-400"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-xs text-white transition-transform group-hover:scale-105 shrink-0 bg-purple-600">
            <Award size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">
            Puntuación Vacaciones
          </span>
        </button>
      </div>

      {/* Guía de Configuración y Restablecer al final */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-2">
        <button
          onClick={() => {
            setTutorialInitialStep(0);
            setShowTutorial(!showTutorial);
          }}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md border cursor-pointer",
            showTutorial 
              ? "bg-azul-blue text-white border-azul-blue" 
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750"
          )}
        >
          <HelpCircle size={15} className={showTutorial ? "animate-bounce" : ""} />
          <span>Guía de uso</span>
        </button>

        {!isLocked && (
          <button 
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white px-5 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-md border border-rose-200 cursor-pointer"
          >
            <Trash2 size={14} />
            <span className="uppercase tracking-widest">Borrar Todo</span>
          </button>
        )}
      </div>

      {/* Ventana Flotante Unificada (Bottom Sheet en móvil, Modal centrado en escritorio) */}
      <AnimatePresence>
        {activeSectionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setActiveSectionModal(null)}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-t-[2rem] rounded-b-none sm:rounded-[2.25rem] shadow-2xl border border-b-0 sm:border-b border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] text-left"
            >
              {/* Barra superior de acento en escritorio / Asa de arrastre en móvil */}
              <div className={cn("hidden sm:block h-1 bg-gradient-to-r shrink-0", sectionMeta[activeSectionModal].accentBar)} />
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0 bg-white dark:bg-slate-900">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Cabecera Única del Modal */}
              <div className={cn("px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5 shrink-0", sectionMeta[activeSectionModal].headerBg)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("p-2 sm:p-2.5 rounded-2xl shadow-md shrink-0", sectionMeta[activeSectionModal].headerIconBg)}>
                    {sectionMeta[activeSectionModal].icon}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                      {sectionMeta[activeSectionModal].title}
                    </h2>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {sectionMeta[activeSectionModal].subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isLocked && (
                    <span className="hidden xs:inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                      <Lock size={11} /> Lectura
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTutorialInitialStep(sectionMeta[activeSectionModal].tutorialIndex);
                      setShowTutorial(true);
                    }}
                    className="p-2 rounded-full text-slate-400 hover:text-azul-blue hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-azul-yellow transition-all cursor-pointer active:scale-95"
                    title="Ayuda de esta sección"
                    aria-label="Ayuda de esta sección"
                  >
                    <HelpCircle size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSectionModal(null)}
                    className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer active:scale-95"
                    aria-label="Cerrar ajustes"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Cuerpo Desplazable Integrado (sin tarjeta duplicada) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className={cn(isLocked && "pointer-events-none opacity-65 select-none")}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSectionModal}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                    >
                      {activeSectionModal === 'contract' && (
                        <section id="tipo-contrato-section" className="bg-azul-blue p-5 sm:p-6 modal-embedded-section !rounded-none !border-0 !shadow-none relative overflow-hidden space-y-5 text-white flex flex-col justify-between">
                          <div className="relative z-10 space-y-4">
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Colectivo (Tablas Salariales)</label>
                              <div className="flex p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                {([
                                  { id: 'rampa', label: 'Rampa' },
                                  { id: 'pasaje', label: 'Pasaje' },
                                ] as const).map((col) => (
                                  <button
                                    key={col.id}
                                    type="button"
                                    onClick={() => updateSettings({
                                      ...settings,
                                      colectivoConvenio: col.id,
                                    })}
                                    className={cn(
                                      "flex-1 py-2.5 rounded-xl transition-all duration-300 font-black text-xs uppercase tracking-widest cursor-pointer",
                                      activeColectivo === col.id
                                        ? (col.id === 'rampa' ? "bg-white text-azul-blue shadow-md" : "bg-azul-yellow text-azul-blue shadow-md")
                                        : "text-white/50 hover:text-white"
                                    )}
                                  >
                                    {col.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Jornada</label>
                              <div className="flex p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                {['Completo', 'Parcial'].map(type => (
                                  <button 
                                    key={type}
                                    type="button"
                                    onClick={() => updateSettings({ 
                                      ...settings, 
                                      contractType: type,
                                      isSubrogado: type === 'Parcial' ? false : settings.isSubrogado
                                    })}
                                    className={cn(
                                      "flex-1 py-2.5 rounded-xl transition-all duration-300 font-black text-xs uppercase tracking-widest cursor-pointer",
                                      settings.contractType === type 
                                        ? (type === 'Completo' ? "bg-white text-azul-blue shadow-md" : "bg-azul-yellow text-azul-blue shadow-md")
                                        : "text-white/50 hover:text-white"
                                    )}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {settings.contractType === 'Completo' && (
                              <div className="flex flex-col gap-2 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Estado de Subrogación</label>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const nextIsSubrogado = !settings.isSubrogado;
                                    updateSettings({
                                      ...settings,
                                      isSubrogado: nextIsSubrogado,
                                      expandedTablasSections: {
                                        convenio: !nextIsSubrogado,
                                        subrogados: nextIsSubrogado
                                      }
                                    });
                                  }}
                                  className={cn(
                                    "w-full py-2.5 rounded-xl transition-all duration-300 font-black text-xs uppercase tracking-widest border flex items-center justify-center gap-2 cursor-pointer",
                                    settings.isSubrogado 
                                      ? "bg-azul-yellow text-azul-blue border-azul-yellow shadow-md" 
                                      : "bg-white/10 border-white/10 text-white/50 hover:text-white hover:bg-white/20"
                                  )}
                                >
                                  <Zap size={14} className={cn(settings.isSubrogado ? "fill-current" : "")} />
                                  {settings.isSubrogado ? 'SUBROGADO ACTIVADO' : 'ACTIVAR SUBROGADO'}
                                </button>
                              </div>
                            )}

                            <div className="flex flex-col gap-2 pt-1">
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Número de Pagas</label>
                              <div className="flex gap-2">
                                {[12, 14].map(p => (
                                  <button 
                                    key={p}
                                    type="button"
                                    onClick={() => updateSettings({ ...settings, pagas: p as 12 | 14 })}
                                    className={cn(
                                      "flex-1 py-2 rounded-xl transition-all duration-300 font-black text-[11px] uppercase tracking-widest border cursor-pointer",
                                      settings.pagas === p 
                                        ? "bg-white/20 border-white/30 text-white shadow-sm" 
                                        : "bg-transparent border-white/10 text-white/40 hover:text-white/70"
                                    )}
                                  >
                                    {p} Pagas
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                          <div className="absolute -left-10 -top-10 w-40 h-40 bg-azul-yellow/20 rounded-full blur-3xl" />
                        </section>
                      )}

                      {activeSectionModal === 'progression' && (
                        <section id="progresion-nivel-section" className="bg-azul-blue p-5 sm:p-6 modal-embedded-section !rounded-none !border-0 !shadow-none relative overflow-hidden space-y-5 text-white flex flex-col justify-between">
                          <div className="relative z-10 space-y-5">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1">Fecha Antigüedad de Contrato</label>
                                {settings.manualLevelProgression && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleManualProgression(false)}
                                    className="text-[9px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white/80 px-2.5 py-1 rounded-xl border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Restaurar cálculo automático por antigüedad"
                                  >
                                    <RefreshCw size={11} className="text-azul-yellow" />
                                    Restaurar Auto
                                  </button>
                                )}
                              </div>
                              <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-azul-yellow transition-colors">
                                  <CalendarIcon size={18} />
                                </div>
                                <LocalInput 
                                  type="date" 
                                  value={settings.seniorityDate}
                                onChange={(val) => {
                                  if (settings.manualLevelProgression) {
                                    const nextDate = getNextDateForLevel(val, settings.currentLevel, settings.frozenPeriods || []);
                                    updateSettings({
                                      ...settings,
                                      seniorityDate: val,
                                      nextLevelDate: settings.currentLevel >= 7 ? '' : safeFormat(nextDate, 'yyyy-MM-dd')
                                    });
                                  } else {
                                    const { calculatedLevel, nextDate } = calculateLevelInfo(val, settings.frozenPeriods || []);
                                    updateSettings({ 
                                      ...settings, 
                                      seniorityDate: val,
                                      currentLevel: calculatedLevel,
                                      selectedLevel: calculatedLevel,
                                      nextLevelDate: safeFormat(nextDate, 'yyyy-MM-dd')
                                    });
                                  }
                                }}
                                className="w-full bg-white/10 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-4 focus:ring-white/10 focus:border-white/20 outline-none transition-all font-black text-white"
                              />
                            </div>
                          </div>

                        {/* Resumen Visual */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-white/10 space-y-6">
                          <div className="flex justify-between items-center">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-azul-yellow uppercase tracking-widest">Nivel Actual</span>
                                {settings.manualLevelProgression && (
                                  <span className="text-[8px] font-bold bg-white/20 text-white/90 px-1.5 py-0.2 rounded">Manual</span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-white tracking-tighter">{settings.currentLevel}</span>
                                <span className="text-sm font-bold text-white/40 uppercase tracking-widest">de 7</span>
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="text-[10px] font-black text-azul-yellow uppercase tracking-widest">Próximo Salto</span>
                              <div className="text-sm font-black text-white bg-white/10 px-4 py-2 rounded-xl shadow-sm border border-white/10 inline-block">
                                {settings.currentLevel >= 7 ? 'Nivel Máximo' : (settings.nextLevelDate ? safeFormat(parseISO(settings.nextLevelDate), 'dd MMM yyyy', { locale: es }) : 'Nivel Máximo')}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="h-4 bg-white/10 rounded-full overflow-hidden border border-white/10 p-1 shadow-inner">
                              <div 
                                className="h-full bg-azul-yellow rounded-full transition-all duration-1000 ease-out shadow-lg shadow-azul-yellow/20 relative"
                                style={{ width: `${(settings.currentLevel / 7) * 100}%` }}
                              >
                                <div className="absolute top-0 right-0 h-full w-4 bg-white/20 skew-x-12"></div>
                              </div>
                            </div>
                            
                            <div className="flex justify-between px-1">
                              {[1, 2, 3, 4, 5, 6, 7].map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => handleSelectManualLevel(lvl)}
                                  className="flex flex-col items-center gap-2 group cursor-pointer"
                                  title={`Seleccionar Nivel ${lvl}`}
                                >
                                  <div className={cn(
                                    "w-2.5 h-2.5 rounded-full transition-all duration-500 group-hover:scale-125",
                                    lvl <= settings.currentLevel ? "bg-azul-yellow shadow-sm shadow-azul-yellow/20" : "bg-white/20"
                                  )} />
                                  <span className={cn(
                                    "text-[8px] font-black transition-colors",
                                    lvl <= settings.currentLevel ? "text-azul-yellow" : "text-white/30 group-hover:text-white/70"
                                  )}>{lvl}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Casilla de Selección Manual */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/10 space-y-4">
                          <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none">
                            <div className="relative flex items-center mt-0.5 sm:mt-0">
                              <input
                                type="checkbox"
                                id="manual-progression-checkbox"
                                checked={!!settings.manualLevelProgression}
                                onChange={(e) => handleToggleManualProgression(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={cn(
                                "w-5 h-5 rounded-lg border flex items-center justify-center transition-all",
                                settings.manualLevelProgression 
                                  ? "bg-azul-yellow border-azul-yellow text-azul-blue shadow-md shadow-azul-yellow/30" 
                                  : "bg-white/20 border-white/30 text-transparent"
                              )}>
                                <Check size={14} className="stroke-[3]" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-white">Elegir nivel actual y próximo salto manualmente</span>
                                {settings.manualLevelProgression && (
                                  <span className="text-[8px] font-black bg-azul-yellow text-azul-blue px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                                    MANUAL
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-white/60 mt-0.5">
                                {settings.manualLevelProgression 
                                  ? "Ajusta directamente el nivel y la fecha del salto con las casillas inferiores."
                                  : "Activa esta casilla para fijar manualmente el nivel y la fecha sin depender del cálculo por antigüedad."}
                              </p>
                            </div>
                          </label>

                          {settings.manualLevelProgression && (
                            <div className="pt-4 border-t border-white/10 space-y-5 animate-in fade-in duration-300">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-black text-azul-yellow uppercase tracking-widest flex items-center gap-1.5">
                                    <Sliders size={12} />
                                    Casilla Nivel Actual
                                  </label>
                                  <span className="text-[10px] font-black text-white bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                                    NIVEL {settings.currentLevel} DE 7
                                  </span>
                                </div>
                                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                                  {[1, 2, 3, 4, 5, 6, 7].map((lvl) => {
                                    const isActive = lvl === settings.currentLevel;
                                    return (
                                      <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => handleSelectManualLevel(lvl)}
                                        className={cn(
                                          "py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95",
                                          isActive
                                            ? "bg-azul-yellow text-azul-blue shadow-lg shadow-azul-yellow/20 scale-105 ring-2 ring-white/50"
                                            : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                                        )}
                                      >
                                        <span>{lvl}</span>
                                        <span className={cn("text-[7px] uppercase tracking-tighter", isActive ? "text-azul-blue font-black" : "text-white/40")}>Niv</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-black text-azul-yellow uppercase tracking-widest flex items-center gap-1.5">
                                    <CalendarIcon size={12} />
                                    Casilla Fecha Próximo Salto
                                  </label>
                                  {settings.currentLevel < 7 && (
                                    <button
                                      type="button"
                                      onClick={handleRecalculateSuggestedDate}
                                      className="text-[9px] font-black text-white/70 hover:text-white underline transition-colors"
                                    >
                                      Calcular sugerida
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-azul-yellow transition-colors">
                                      <CalendarIcon size={16} />
                                    </div>
                                    <LocalInput
                                      type="date"
                                      value={settings.nextLevelDate || ''}
                                      onChange={handleManualNextLevelDate}
                                      className="w-full bg-white/10 border border-white/10 rounded-2xl pl-11 pr-3 py-2.5 focus:ring-4 focus:ring-white/10 focus:border-white/20 outline-none transition-all font-black text-xs text-white"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleSetMaxLevel}
                                    className={cn(
                                      "px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-2",
                                      settings.currentLevel >= 7 || !settings.nextLevelDate
                                        ? "bg-white/20 border-white/30 text-white"
                                        : "bg-white/10 border-white/10 text-white/80 hover:bg-white/15"
                                    )}
                                  >
                                    <Sparkles size={13} className="text-azul-yellow" />
                                    {settings.currentLevel >= 7 ? 'Nivel 7 (Máximo)' : 'Marcar Nivel Máximo'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                      <div className="absolute -left-10 -top-10 w-40 h-40 bg-azul-yellow/20 rounded-full blur-3xl" />
                    </section>
                  )}

                  {activeSectionModal === 'frozen' && (
                    <section className="bg-black p-5 sm:p-6 modal-embedded-section !rounded-none !border-0 !shadow-none relative overflow-hidden space-y-4 text-white">
                      <div className="relative z-10 space-y-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-white/50 uppercase tracking-widest ml-1">Fecha de Inicio</label>
                              <button
                                type="button"
                                onClick={() => setRangePickerConfig({ type: 'frozen', initialStep: 'start' })}
                                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 hover:border-rose-600/60 focus:ring-2 focus:ring-rose-600/50 focus:border-rose-600 outline-none transition-all font-bold text-xs text-white flex items-center justify-between cursor-pointer text-left"
                              >
                                <span className={cn(!frozenStart && "text-white/40")}>
                                  {frozenStart && isValid(parseISO(frozenStart))
                                    ? safeFormat(parseISO(frozenStart), 'dd/MM/yyyy')
                                    : 'dd/mm/aaaa'}
                                </span>
                                <CalendarIcon size={14} className="text-rose-500 shrink-0" />
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-white/50 uppercase tracking-widest ml-1">Fecha de Fin</label>
                              <button
                                type="button"
                                onClick={() => setRangePickerConfig({ type: 'frozen', initialStep: frozenStart ? 'end' : 'start' })}
                                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 hover:border-rose-600/60 focus:ring-2 focus:ring-rose-600/50 focus:border-rose-600 outline-none transition-all font-bold text-xs text-white flex items-center justify-between cursor-pointer text-left"
                              >
                                <span className={cn(!frozenEnd && "text-white/40")}>
                                  {frozenEnd && isValid(parseISO(frozenEnd))
                                    ? safeFormat(parseISO(frozenEnd), 'dd/MM/yyyy')
                                    : 'dd/mm/aaaa'}
                                </span>
                                <CalendarIcon size={14} className="text-rose-500 shrink-0" />
                              </button>
                            </div>
                          </div>
                          <button 
                            onClick={addFrozenPeriod}
                            disabled={!frozenStart || !frozenEnd}
                            className="w-full bg-rose-600 text-white py-3 rounded-xl hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2 group/btn cursor-pointer"
                          >
                            <Plus size={14} className="group-hover/btn:rotate-90 transition-transform duration-300" />
                            <span className="font-black uppercase text-[10px] tracking-[0.15em]">Añadir Tramo</span>
                          </button>

                          <div className="space-y-2 pt-1">
                            {settings.frozenPeriods?.length > 0 ? (
                              settings.frozenPeriods.map((period: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 group hover:border-white/20 transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="text-[11px] font-black text-white/90">
                                      {isValid(parseISO(period.start)) && isValid(parseISO(period.end)) 
                                        ? `${safeFormat(parseISO(period.start), 'dd/MM/yy')} - ${safeFormat(parseISO(period.end), 'dd/MM/yy')}`
                                        : 'Periodo Inválido'
                                      }
                                    </div>
                                    <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">
                                      {isValid(parseISO(period.start)) && isValid(parseISO(period.end)) 
                                        ? `(${differenceInDays(parseISO(period.end), parseISO(period.start)) + 1} d)`
                                        : ''
                                      }
                                    </span>
                                  </div>
                                  <button 
                                    onClick={() => setFrozenToDelete(idx)}
                                    className="p-1.5 text-white/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="w-full py-6 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Sin periodos registrados</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {activeSectionModal === 'holidays' && (
                    <section id="festivos-section" className="bg-emerald-50/30 p-5 sm:p-6 modal-embedded-section !rounded-none !border-0 !shadow-none relative overflow-hidden space-y-5 flex flex-col text-slate-900">
                      <div className="relative z-10 flex gap-2">
                        <input 
                          type="date" 
                          value={newHoliday}
                          onChange={(e) => setNewHoliday(e.target.value)}
                          className="flex-1 bg-white border border-emerald-100 rounded-2xl px-4 py-3 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-bold text-slate-700 shadow-sm"
                        />
                        <button 
                          onClick={addHoliday}
                          className="bg-emerald-500 text-white p-3 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                        >
                          <Plus size={20} />
                        </button>
                      </div>

                      <div className="relative z-10 flex-1 overflow-y-auto max-h-[320px] pr-1 custom-scrollbar space-y-3">
                        {settings.holidays.length === 0 ? (
                          <div className="w-full py-8 flex flex-col items-center justify-center bg-white/50 rounded-3xl border border-dashed border-emerald-200">
                            <CalendarIcon size={24} className="text-emerald-300 mb-2" />
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Sin festivos</p>
                          </div>
                        ) : (
                          Object.keys(holidaysByYear).map(Number).sort((a, b) => b - a).map((year) => {
                            const items = holidaysByYear[year];
                            const expanded = isHolidayYearExpanded(year);
                            return (
                              <div key={year} className="border border-emerald-100/60 rounded-2xl bg-white/40 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => toggleHolidayYear(year)}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-white/60 hover:bg-emerald-50/50 transition-colors"
                                >
                                  <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                                    📅 Año {year} <span className="text-[9px] font-bold text-emerald-600/70 ml-1">({items.length} {items.length === 1 ? 'día' : 'días'})</span>
                                  </span>
                                  <ChevronDown 
                                    size={14} 
                                    className={cn("transition-transform duration-300 text-emerald-600", expanded ? "rotate-180" : "")} 
                                  />
                                </button>
                                
                                <AnimatePresence initial={false}>
                                  {expanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <div className="p-3 border-t border-emerald-100/40 flex flex-wrap gap-2 bg-white/20">
                                        {items.map((h: string) => (
                                          <div key={h} className="group flex items-center gap-2 bg-white text-emerald-700 pl-3 pr-1.5 py-1.5 rounded-xl text-[11px] font-black border border-emerald-100 hover:border-emerald-500/20 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm">
                                            {safeFormat(parseISO(h), 'dd MMM', { locale: es })}
                                            <button 
                                              onClick={() => removeHoliday(h)} 
                                              className="p-1 rounded-lg hover:bg-rose-100 hover:text-rose-600 transition-colors"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Desplegable de Festivos Fijos */}
                      <div className="relative z-10 border-t border-emerald-100/50 pt-3">
                        <button
                          type="button"
                          onClick={() => setIsFixedHolidaysOpen(!isFixedHolidaysOpen)}
                          className="w-full flex items-center justify-between text-[11px] font-black text-emerald-700/85 uppercase tracking-wide hover:text-emerald-800 transition-colors py-1.5 select-none"
                        >
                          <span className="flex items-center gap-1.5 font-bold">📂 Festivos Fijos</span>
                          <ChevronDown 
                            size={14} 
                            className={cn("transition-transform duration-300 text-emerald-600", isFixedHolidaysOpen ? "rotate-180" : "")} 
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {isFixedHolidaysOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div id="festivos-fijos-box" className="bg-white/70 rounded-2xl p-3 border border-emerald-100/40 space-y-2 mt-2">
                                <p className="font-black uppercase tracking-wide text-[9px] text-emerald-600/70 leading-normal">
                                  Días añadidos de forma fija anualmente (excepto si son Domingo):
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
                                  {fixedHolidaysList.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1 text-[11px] text-slate-700 font-extrabold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                      <span className="text-emerald-800 font-black shrink-0">{item.date}</span>
                                      <span className="text-slate-400 font-bold text-[9px] truncate">({item.name})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                      <div className="absolute -left-10 -top-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
                    </section>
                  )}

                  {activeSectionModal === 'vacations' && (
                    <section id="vacaciones-section" className="bg-azul-yellow p-5 sm:p-6 modal-embedded-section !rounded-none !border-0 !shadow-none relative overflow-hidden space-y-5 flex flex-col text-azul-blue">
                      <div id="vacaciones-action-box" className="relative z-10 flex flex-col sm:flex-row gap-2.5">
                        <button 
                          type="button"
                          onClick={() => setIsAddVacationsModalOpen(true)}
                          className="flex-1 bg-azul-blue text-white py-3.5 px-5 rounded-2xl hover:bg-azul-blue/90 transition-all shadow-xl shadow-azul-blue/20 active:scale-[0.98] flex items-center justify-center gap-3 group cursor-pointer"
                        >
                          <div className="p-1.5 bg-white/20 rounded-xl group-hover:rotate-90 transition-transform duration-500">
                            <Plus size={18} className="stroke-[2.5]" />
                          </div>
                          <span className="font-black uppercase text-xs sm:text-sm tracking-[0.18em]">Añadir Vacaciones</span>
                        </button>
                        {settings.vacations.length > 0 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const datesToClear = [...settings.vacations];
                              updateSettings({ ...settings, vacations: [] });
                              const shiftsToRevert = shifts
                                .filter(s => datesToClear.includes(s.date) && s.type === 'Vacaciones')
                                .map(s => ({ ...s, type: 'Laboral' }));
                              updateShifts(shiftsToRevert);
                            }}
                            className="px-4 py-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-widest transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                          >
                            <Trash2 size={13} />
                            <span>Limpiar Todo</span>
                          </button>
                        )}
                      </div>

                      <div className="relative z-10 flex-1 overflow-y-auto max-h-[340px] pr-1 custom-scrollbar space-y-3">
                        {settings.vacations.length === 0 ? (
                          <div className="w-full py-8 flex flex-col items-center justify-center bg-white/20 rounded-3xl border border-dashed border-white/30">
                            <Umbrella size={24} className="text-white/40 mb-2" />
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Sin vacaciones</p>
                          </div>
                        ) : (
                          Object.keys(vacationsByYear).map(Number).sort((a, b) => b - a).map((year) => {
                            const items = vacationsByYear[year];
                            const expanded = isVacationYearExpanded(year);
                            return (
                              <div key={year} className="border border-white/20 rounded-2xl bg-white/20 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => toggleVacationYear(year)}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-white/30 hover:bg-white/40 transition-colors"
                                >
                                  <span className="text-[11px] font-black text-azul-blue uppercase tracking-wider">
                                    🌴 Año {year} <span className="text-[9px] font-bold text-azul-blue/70 ml-1">({items.length} {items.length === 1 ? 'día' : 'días'})</span>
                                  </span>
                                  <ChevronDown 
                                    size={14} 
                                    className={cn("transition-transform duration-300 text-azul-blue", expanded ? "rotate-180" : "")} 
                                  />
                                </button>
                                
                                <AnimatePresence initial={false}>
                                  {expanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <div className="p-3 border-t border-white/10 flex flex-wrap gap-2 bg-white/10">
                                        {items.map((v: string) => (
                                          <div key={v} className="group flex items-center gap-2 bg-white text-azul-blue pl-3 pr-1.5 py-1.5 rounded-xl text-[11px] font-black border border-white/30 hover:bg-azul-blue hover:text-white transition-all shadow-sm">
                                            {safeFormat(parseISO(v), 'dd MMM', { locale: es })}
                                            <button 
                                              onClick={() => removeVacation(v)} 
                                              className="p-1 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                      <div className="absolute -left-10 -top-10 w-40 h-40 bg-azul-blue/10 rounded-full blur-3xl" />
                    </section>
                  )}

                  {activeSectionModal === 'vacation_score' && (
                    <PuntuacionVacacionesSection
                      settings={settings}
                      shifts={shifts}
                      hideHeader
                      className="modal-embedded-section !rounded-none !border-0 !shadow-none !p-5 sm:!p-6"
                    />
                  )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Pie Fijo con Navegación Relacionada (si aplica) y Botón Listo */}
              {(() => {
                const relatedSection = sectionMeta[activeSectionModal].related;
                return (
                  <div className={cn(
                    "px-4 sm:px-6 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center gap-2.5 shrink-0",
                    relatedSection ? "justify-between" : "justify-end"
                  )}>
                    {relatedSection && (
                      <button
                        type="button"
                        onClick={() => setActiveSectionModal(relatedSection.key)}
                        className={cn(
                          "px-3 py-2 rounded-xl border text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer truncate",
                          relatedSection.pillClass
                        )}
                        title={`Ir a ${relatedSection.label}`}
                      >
                        {relatedSection.icon}
                        <span className="truncate">{relatedSection.label}</span>
                        <ArrowRight size={12} className="shrink-0 opacity-75" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveSectionModal(null)}
                      className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer shrink-0"
                    >
                      <Check size={14} className="stroke-[3]" />
                      <span>Listo</span>
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial Modal Overlay */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        title="Configuración Laboral"
        subtitle="Guía de uso"
        steps={tutorialSteps}
        initialStep={tutorialInitialStep}
      />

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          handleResetData();
          setIsResetConfirmOpen(false);
        }}
        title="¿Borrar todos los datos?"
        message="Esta acción eliminará todos tus turnos, nóminas subidas, vacaciones y configuraciones personalizadas. Los datos no se podrán recuperar."
      />

      <ConfirmModal
        isOpen={frozenToDelete !== null}
        onClose={() => setFrozenToDelete(null)}
        onConfirm={() => {
          if (frozenToDelete !== null) {
            removeFrozenPeriod(frozenToDelete);
          }
          setFrozenToDelete(null);
        }}
        title="¿Eliminar periodo?"
        message="¿Estás seguro de que quieres eliminar este periodo de congelación de la progresión?"
      />

      <DateRangePickerModal
        isOpen={rangePickerConfig.type !== null}
        onClose={() => setRangePickerConfig({ type: null, initialStep: 'start' })}
        startDate={rangePickerConfig.type === 'frozen' ? frozenStart : vacationStart}
        endDate={rangePickerConfig.type === 'frozen' ? frozenEnd : vacationEnd}
        initialStep={rangePickerConfig.initialStep}
        title={rangePickerConfig.type === 'frozen' ? 'Tramo de Congelación' : 'Tramo de Vacaciones'}
        subtitle="Marca el inicio y el fin en el calendario"
        accentColor={rangePickerConfig.type === 'frozen' ? 'rose' : 'blue'}
        onChangeRange={(start, end) => {
          if (rangePickerConfig.type === 'frozen') {
            setFrozenStart(start);
            setFrozenEnd(end);
          } else if (rangePickerConfig.type === 'vacation') {
            setVacationStart(start);
            setVacationEnd(end);
          }
        }}
      />

      {/* Modal flotante Añadir Vacaciones con Cuadrante de Rotaciones y Selección de Días/Tramos */}
      <AddVacationsModal
        isOpen={isAddVacationsModalOpen}
        onClose={() => setIsAddVacationsModalOpen(false)}
        settings={settings}
        shifts={shifts}
        updateSettings={updateSettings}
        updateShifts={updateShifts}
        updateShift={updateShift}
      />
    </div>
  );
};
