import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Wrench, 
  TrendingUp, 
  ArrowLeftRight, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  Info,
  BookOpen,
  Search,
  FileText,
  Percent,
  X,
  Plus,
  Stethoscope,
  ShieldAlert,
  Briefcase,
  Calculator,
  Copy,
  Check,
  Pencil
} from 'lucide-react';
import { CustomRotationModal } from './CustomRotationModal';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  isSunday, 
  isToday,
  isSameMonth,
  setYear,
  setMonth,
  parseISO,
  isValid,
  isAfter,
  differenceInCalendarDays,
  addDays,
  startOfYear
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ShiftEntry, ShiftType, cn, DayShift, Settings, YearlyLevels, YearlyPluses, MixedRotationConfig } from '../types';
import { safeFormat, getShiftDuration, formatCurrency, getStatsForShifts, calculateLevelMetrics, getCounterConfigForYear, getCounterConfigForDate, getRotationShift, loadSavedMixedRotation, formatMixedRotationShortLabel } from '../utils';
import { MonthPickerModal } from './MonthPickerModal';
import { DateRangePickerModal } from './DateRangePickerModal';
import { useScrollLock } from '../hooks/useScrollLock';
import { CONVENIO_DATA, Chapter, Article } from '../data/convenioData';

const highlightText = (text: string, highlight: string) => {
  if (!highlight.trim()) {
    return <>{text}</>;
  }
  const escapedHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedHighlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-250 text-slate-900 font-bold px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

// Componente para firma digital interactiva por trazos de canvas
const SignaturePad: React.FC<{
  onSave: (dataUrl: string | null) => void;
  defaultValue?: string | null;
  placeholder: string;
}> = ({ onSave, defaultValue, placeholder }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (defaultValue) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHasSigned(true);
      };
      img.src = defaultValue;
    }
  }, [defaultValue]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    onSave(null);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-wide mb-1.5 select-none">{placeholder}</span>
      <div className="relative border-2 border-slate-950 bg-white rounded-lg overflow-hidden w-full max-w-[280px] h-[100px] shadow-sm select-none">
        <canvas
          ref={canvasRef}
          width={280}
          height={100}
          className="w-full h-full cursor-crosshair touch-none bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSigned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-transparent">
            Firma aquí
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clearCanvas}
        className="mt-1 pb-1 text-[9px] font-black uppercase text-rose-500 hover:text-rose-700 tracking-wider cursor-pointer"
      >
        Limpiar Firma
      </button>
    </div>
  );
};

// Rotation shift calculation is centralized in ../utils (getRotationShift)

const getSpanishDateParts = (dateStr: string) => {
  if (!dateStr) return { day: '___', month: '___________', year: '202_' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { day: '___', month: '___________', year: '202_' };
    const day = String(d.getDate());
    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const month = monthNames[d.getMonth()];
    const year = String(d.getFullYear());
    return { day, month, year };
  } catch (e) {
    return { day: '___', month: '___________', year: '202_' };
  }
};

interface HerramientasTabProps {
  formatNumber: (num: number, decimals?: number) => string;
  shifts: DayShift[];
  user?: any;
  settings?: Settings;
  levels?: YearlyLevels;
  pluses?: YearlyPluses;
  updateSettings?: (s: Settings) => void;
  updateShift?: (shift: DayShift) => void;
  updateShifts?: (shifts: DayShift[]) => void;
}

export const HerramientasTab: React.FC<HerramientasTabProps> = ({ formatNumber, shifts, user, settings, levels, pluses, updateSettings, updateShift, updateShifts }) => {
  // states for tools and rotation calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const saved = localStorage.getItem('rotationCurrentMonth');
    return saved ? new Date(saved) : new Date(2026, 0, 1);
  });
  const [cycleType, setCycleType] = useState<'6x3' | '4x4' | string>(() => {
    const saved = localStorage.getItem('rotationCycleType');
    return saved || '6x3';
  });
  const [isCustomRotationModalOpen, setIsCustomRotationModalOpen] = useState(false);
  const [customModalInitialMode, setCustomModalInitialMode] = useState<'simple' | 'mixed'>('simple');
  const [mixedConfig, setMixedConfig] = useState<MixedRotationConfig>(() => loadSavedMixedRotation(settings, currentMonth));

  useEffect(() => {
    setMixedConfig(loadSavedMixedRotation(settings, currentMonth));
  }, [settings?.mixedRotation, settings?.calendarRotation?.mixedConfig]);

  const hasSavedMixed = Boolean(
    settings?.mixedRotation ||
    settings?.calendarRotation?.mixedConfig ||
    (() => {
      try {
        return Boolean(localStorage.getItem('mixedRotationConfig'));
      } catch {
        return false;
      }
    })()
  );

  const customWorkDays = settings?.customRotation?.workDays || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).workDays || 5;
    } catch (e) {}
    return 5;
  })();

  const customFreeDays = settings?.customRotation?.freeDays || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).freeDays || 2;
    } catch (e) {}
    return 2;
  })();

  const customFirstFreeDay = settings?.customRotation?.firstFreeDay || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).firstFreeDay || 1;
    } catch (e) {}
    return 1;
  })();

  const customAnchorDate = settings?.customRotation?.anchorDate || (() => {
    try {
      const saved = localStorage.getItem('customRotationConfig');
      if (saved) return JSON.parse(saved).anchorDate;
    } catch (e) {}
    return undefined;
  })();

  const availableRotations = useMemo(() => {
    if (cycleType === '6x3') return [1, 2, 3];
    if (cycleType === '4x4') return [1, 2, 3, 4];
    if (cycleType === 'mixed') return [1, 2, 3];
    const totalCycle = customWorkDays + customFreeDays;
    const maxRot = Math.max(2, Math.min(4, Math.floor(totalCycle / Math.max(1, customFreeDays)) || 2));
    return Array.from({ length: maxRot }, (_, i) => i + 1);
  }, [cycleType, customWorkDays, customFreeDays]);

  const handleSaveCustomRotation = (w: number, f: number, freeDay: number, anchorDate: string) => {
    const newCycle = `${w}x${f}`;
    setCycleType(newCycle);
    const newConfig = { workDays: w, freeDays: f, firstFreeDay: freeDay, anchorDate };
    if (updateSettings && settings) {
      updateSettings({
        ...settings,
        customRotation: newConfig,
        calendarRotation: {
          enabled: settings.calendarRotation?.enabled ?? false,
          effectiveFromMonth: settings.calendarRotation?.effectiveFromMonth || safeFormat(currentMonth, 'yyyy-MM'),
          ...settings.calendarRotation,
          type: newCycle,
          workDays: w,
          freeDays: f,
          anchorDate,
          firstFreeDay: freeDay,
        }
      });
    }
    try {
      localStorage.setItem('customRotationConfig', JSON.stringify(newConfig));
      localStorage.setItem('rotationCycleType', newCycle);
    } catch (e) {}
  };

  const handleSaveMixedRotation = (newMixed: MixedRotationConfig) => {
    setMixedConfig(newMixed);
    setCycleType('mixed');
    if (updateSettings && settings) {
      updateSettings({
        ...settings,
        mixedRotation: newMixed,
        calendarRotation: {
          enabled: settings.calendarRotation?.enabled ?? false,
          effectiveFromMonth: settings.calendarRotation?.effectiveFromMonth || safeFormat(currentMonth, 'yyyy-MM'),
          ...settings.calendarRotation,
          type: 'mixed',
          anchorDate: newMixed.firstAnchorDate,
          firstFreeDay: newMixed.firstFreeDay || 1,
          mixedConfig: newMixed,
        }
      });
    }
    try {
      localStorage.setItem('mixedRotationConfig', JSON.stringify(newMixed));
      localStorage.setItem('rotationCycleType', 'mixed');
    } catch (e) {}
  };
  const [selectedRotation, setSelectedRotation] = useState<number>(() => {
    const saved = localStorage.getItem('selectedRotation');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= 4) {
        return parsed;
      }
    }
    return 1;
  });
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('isCalendarExpanded');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('rotationCurrentMonth', currentMonth.toISOString());
  }, [currentMonth]);

  useEffect(() => {
    localStorage.setItem('rotationCycleType', cycleType);
  }, [cycleType]);

  useEffect(() => {
    localStorage.setItem('selectedRotation', String(selectedRotation));
  }, [selectedRotation]);

  useEffect(() => {
    if (!availableRotations.includes(selectedRotation)) {
      setSelectedRotation(1);
    }
  }, [availableRotations, selectedRotation]);

  useEffect(() => {
    localStorage.setItem('isCalendarExpanded', String(isCalendarExpanded));
  }, [isCalendarExpanded]);
  
  // Touch gestures for calendar horizontal swipes
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const lastWheelTime = React.useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) {
      // Swipe left -> Next month
      setCurrentMonth(prev => addMonths(prev, 1));
    } else if (distance < -minSwipeDistance) {
      // Swipe right -> Previous month
      setCurrentMonth(prev => subMonths(prev, 1));
    }
  };

  // Mouse wheel or trackpad horizontal swipe
  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaX || (e.shiftKey ? e.deltaY : 0);
    if (Math.abs(delta) < 15) return;
    
    const now = Date.now();
    // Throttle wheel updates so the months don't spin uncontrollably
    if (now - lastWheelTime.current < 450) return;
    
    if (delta > 15) {
      setCurrentMonth(prev => addMonths(prev, 1));
      lastWheelTime.current = now;
    } else if (delta < -15) {
      setCurrentMonth(prev => subMonths(prev, 1));
      lastWheelTime.current = now;
    }
  };

  // States for I Convenio Azul Handling
  const [isConvenioExpanded, setIsConvenioExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('isConvenioExpanded');
    return saved !== null ? saved === 'true' : false;
  });
  const [convenioQuery, setConvenioQuery] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<(Article & { chapterTitle: string }) | null>(null);

  // States for Conversor de Horas Perentorias
  const [isPerentExpanded, setIsPerentExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('isPerentExpanded');
    return saved !== null ? saved === 'true' : false;
  });
  const [isTurnosExpanded, setIsTurnosExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('isTurnosExpanded');
    return saved !== null ? saved === 'true' : false;
  });
  const [isIrpfRecommenderExpanded, setIsIrpfRecommenderExpanded] = useState<boolean>(false);

  // Estados para Calculadora de Finiquito / Liquidación
  const [isFiniquitoExpanded, setIsFiniquitoExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('isFiniquitoExpanded');
    return saved !== null ? saved === 'true' : false;
  });
  useEffect(() => {
    localStorage.setItem('isFiniquitoExpanded', String(isFiniquitoExpanded));
  }, [isFiniquitoExpanded]);

  const [finiquitoStartDate, setFiniquitoStartDate] = useState<string>(() => {
    return localStorage.getItem('finiquitoStartDate') || '2025-06-01';
  });
  useEffect(() => {
    localStorage.setItem('finiquitoStartDate', finiquitoStartDate);
  }, [finiquitoStartDate]);

  const [finiquitoEndDate, setFiniquitoEndDate] = useState<string>(() => {
    return localStorage.getItem('finiquitoEndDate') || safeFormat(new Date(), 'yyyy-MM-dd');
  });
  useEffect(() => {
    localStorage.setItem('finiquitoEndDate', finiquitoEndDate);
  }, [finiquitoEndDate]);

  const [finiquitoCause, setFiniquitoCause] = useState<'temporal' | 'improcedente' | 'objetivo' | 'voluntaria'>(() => {
    return (localStorage.getItem('finiquitoCause') as any) || 'temporal';
  });
  useEffect(() => {
    localStorage.setItem('finiquitoCause', finiquitoCause);
  }, [finiquitoCause]);

  const defaultBaseSalary = useMemo(() => {
    if (levels && settings) {
      const year = new Date().getFullYear();
      const yearLevels = levels[year] || levels[2026] || levels[Object.keys(levels)[0] as any];
      const levelRow = yearLevels?.find((l: any) => l.level === (settings.level || 1));
      if (levelRow) return levelRow.baseSalary || 1250;
    }
    return 1250;
  }, [levels, settings]);

  const [finiquitoBaseSalary, setFiniquitoBaseSalary] = useState<string>(() => {
    return localStorage.getItem('finiquitoBaseSalary') || '';
  });
  const [finiquitoPluses, setFiniquitoPluses] = useState<string>(() => {
    return localStorage.getItem('finiquitoPluses') || '150';
  });
  const [finiquitoPagasExtras, setFiniquitoPagasExtras] = useState<12 | 14>(() => {
    return settings?.pagas === 14 ? 14 : 12;
  });
  const [finiquitoVacationDaysAnnual, setFiniquitoVacationDaysAnnual] = useState<number>(30);
  const [finiquitoVacationDaysTaken, setFiniquitoVacationDaysTaken] = useState<string>('0');
  const [finiquitoDaysWorkedMonth, setFiniquitoDaysWorkedMonth] = useState<string>('');
  const [finiquitoNoticeDays, setFiniquitoNoticeDays] = useState<string>('0');
  const [finiquitoIrpf, setFiniquitoIrpf] = useState<string>(() => {
    return String(settings?.irpf || 15);
  });
  const [finiquitoCopied, setFiniquitoCopied] = useState<boolean>(false);

  const finiquitoResult = useMemo(() => {
    const sDate = parseISO(finiquitoStartDate);
    const eDate = parseISO(finiquitoEndDate);

    const isValidRange = isValid(sDate) && isValid(eDate) && !isAfter(sDate, eDate);
    if (!isValidRange) {
      return {
        isValid: false,
        totalDays: 0,
        totalMonths: 0,
        totalYearsStr: '0 meses',
        salarioDiario: 0,
        salarioDiaMes: 0,
        mesFinImporte: 0,
        diasMes: 0,
        vacacionesImporte: 0,
        diasVacacionesPendientes: 0,
        diasVacacionesDevengados: 0,
        pagasExtrasImporte: 0,
        indemnizacionImporte: 0,
        indemnizacionDias: 0,
        preavisoImporte: 0,
        totalBruto: 0,
        deduccionSS: 0,
        retencionIRPF: 0,
        totalDeducciones: 0,
        totalLiquido: 0,
      };
    }

    const totalDays = differenceInCalendarDays(eDate, sDate) + 1;
    const totalMonths = Math.ceil(totalDays / 30.4166);
    const yearsNum = Math.floor(totalDays / 365);
    const remMonths = Math.floor((totalDays % 365) / 30.4166);
    const totalYearsStr = yearsNum > 0 ? `${yearsNum} año${yearsNum > 1 ? 's' : ''} y ${remMonths} mes${remMonths !== 1 ? 'es' : ''}` : `${totalMonths} mes${totalMonths !== 1 ? 'es' : ''}`;

    const baseSal = parseFloat(finiquitoBaseSalary) || defaultBaseSalary;
    const plusesSal = parseFloat(finiquitoPluses) || 0;
    const monthlyTotal = baseSal + plusesSal;

    const annualTotal = finiquitoPagasExtras === 14 ? (monthlyTotal * 12) + (2 * baseSal) : (monthlyTotal * 12);
    const salarioDiario = annualTotal / 365;
    const salarioDiaMes = monthlyTotal / 30;

    const diasMesFinalInput = parseInt(finiquitoDaysWorkedMonth, 10);
    const diasMes = !isNaN(diasMesFinalInput) && diasMesFinalInput > 0 ? diasMesFinalInput : eDate.getDate();
    const mesFinImporte = Math.round(diasMes * salarioDiaMes * 100) / 100;

    const yearStart = startOfYear(eDate);
    const devStart = isAfter(sDate, yearStart) ? sDate : yearStart;
    const daysInYear = Math.max(1, differenceInCalendarDays(eDate, devStart) + 1);
    const diasVacacionesDevengados = Math.round(((daysInYear / 365) * finiquitoVacationDaysAnnual) * 10) / 10;
    const diasTomados = parseFloat(finiquitoVacationDaysTaken) || 0;
    const diasVacacionesPendientes = Math.max(0, Math.round((diasVacacionesDevengados - diasTomados) * 10) / 10);
    const vacacionesImporte = Math.round(diasVacacionesPendientes * salarioDiario * 100) / 100;

    let pagasExtrasImporte = 0;
    if (finiquitoPagasExtras === 14) {
      const eMonth = eDate.getMonth();
      const isFirstSemester = eMonth <= 5;
      if (isFirstSemester) {
        const daysInSem = differenceInCalendarDays(eDate, devStart) + 1;
        pagasExtrasImporte = Math.round(((daysInSem / 181) * baseSal) * 100) / 100;
      } else {
        const jul1 = new Date(eDate.getFullYear(), 6, 1);
        const devJul = isAfter(sDate, jul1) ? sDate : jul1;
        const daysInSem2 = Math.max(1, differenceInCalendarDays(eDate, devJul) + 1);
        pagasExtrasImporte = Math.round(((daysInSem2 / 184) * baseSal) * 100) / 100;
      }
    }

    let indemnizacionDias = 0;
    let indemnizacionImporte = 0;
    if (finiquitoCause === 'temporal') {
      indemnizacionDias = Math.round(((totalDays / 365) * 12) * 10) / 10;
      indemnizacionImporte = Math.round(indemnizacionDias * salarioDiario * 100) / 100;
    } else if (finiquitoCause === 'improcedente') {
      const diasRaw = (totalDays / 365) * 33;
      indemnizacionDias = Math.round(Math.min(720, diasRaw) * 10) / 10;
      indemnizacionImporte = Math.round(indemnizacionDias * salarioDiario * 100) / 100;
    } else if (finiquitoCause === 'objetivo') {
      const diasRaw = (totalDays / 365) * 20;
      indemnizacionDias = Math.round(Math.min(360, diasRaw) * 10) / 10;
      indemnizacionImporte = Math.round(indemnizacionDias * salarioDiario * 100) / 100;
    } else {
      indemnizacionDias = 0;
      indemnizacionImporte = 0;
    }

    const noticeDaysVal = parseFloat(finiquitoNoticeDays) || 0;
    const preavisoImporte = Math.round(noticeDaysVal * salarioDiario * 100) / 100;

    const totalBruto = Math.round((mesFinImporte + vacacionesImporte + pagasExtrasImporte + indemnizacionImporte + preavisoImporte) * 100) / 100;

    const baseSS = mesFinImporte + vacacionesImporte + pagasExtrasImporte;
    const ssRate = 0.0647;
    const deduccionSS = Math.round(baseSS * ssRate * 100) / 100;

    let baseIrpf = mesFinImporte + vacacionesImporte + pagasExtrasImporte + preavisoImporte;
    if (finiquitoCause === 'temporal') {
      baseIrpf += indemnizacionImporte;
    }
    const irpfRate = (parseFloat(finiquitoIrpf) || 15) / 100;
    const retencionIRPF = Math.round(Math.max(0, baseIrpf) * irpfRate * 100) / 100;

    const totalDeducciones = Math.round((deduccionSS + retencionIRPF) * 100) / 100;
    const totalLiquido = Math.round((totalBruto - totalDeducciones) * 100) / 100;

    return {
      isValid: true,
      totalDays,
      totalMonths,
      totalYearsStr,
      salarioDiario,
      salarioDiaMes,
      mesFinImporte,
      diasMes,
      vacacionesImporte,
      diasVacacionesPendientes,
      diasVacacionesDevengados,
      pagasExtrasImporte,
      indemnizacionImporte,
      indemnizacionDias,
      preavisoImporte,
      totalBruto,
      deduccionSS,
      retencionIRPF,
      totalDeducciones,
      totalLiquido,
    };
  }, [
    finiquitoStartDate,
    finiquitoEndDate,
    finiquitoCause,
    finiquitoBaseSalary,
    defaultBaseSalary,
    finiquitoPluses,
    finiquitoPagasExtras,
    finiquitoVacationDaysAnnual,
    finiquitoVacationDaysTaken,
    finiquitoDaysWorkedMonth,
    finiquitoNoticeDays,
    finiquitoIrpf,
  ]);

  const [irpfCalcMode, setIrpfCalcMode] = useState<'auto' | 'manual'>('auto');
  const [irpfManualGross, setIrpfManualGross] = useState<string>('');
  const [irpfChildrenCount, setIrpfChildrenCount] = useState<number>(0);
  const [irpfCalcYear, setIrpfCalcYear] = useState<number>(new Date().getFullYear());
  const [irpfAppliedSuccess, setIrpfAppliedSuccess] = useState<boolean>(false);

  const irpfRecommendation = useMemo(() => {
    const year = irpfCalcYear;
    const defaultLevels = [
      { nivel: 1, anual: 19343.52 },
      { nivel: 2, anual: 22907.89 },
      { nivel: 3, anual: 23596.68 },
      { nivel: 4, anual: 24068.48 },
      { nivel: 5, anual: 24540.55 },
      { nivel: 6, anual: 25522.17 },
      { nivel: 7, anual: 26543.06 },
    ];
    const yearLevels = levels?.[year] || levels?.[Object.keys(levels || {}).map(Number).sort((a, b) => b - a)[0]] || defaultLevels;
    const activeLvl = settings?.currentLevel || 1;
    const lvlObj = yearLevels.find(l => l.nivel === activeLvl) || yearLevels[0];
    const subAnual = settings?.isSubrogado ? (settings?.subrogadoBaseSalaries?.[year] || 0) : 0;
    const baseAnualFull = subAnual > 0 ? subAnual : lvlObj.anual;
    const metrics = calculateLevelMetrics(baseAnualFull, settings?.pagas || 14);

    // Check saved payrolls for this year
    const savedInYear = (settings?.savedPayrolls || []).filter(p => p.monthKey.startsWith(`${year}-`));
    
    // Calculate shifts stats in year by month
    const yearShifts = shifts.filter(s => s.date.startsWith(`${year}-`));
    const yearPluses = pluses?.[year] || pluses?.[Object.keys(pluses || {}).map(Number).sort((a, b) => b - a)[0]] || {};

    let estimatedAnnualGross = baseAnualFull;
    let avgContractPct = 100;
    let estimatedAnnualVariables = 0;

    if (savedInYear.length > 0) {
      // Average monthly gross from saved payrolls and extrapolate for remaining months
      const totalSavedGross = savedInYear.reduce((acc, p) => acc + (p.totals?.totalDevengado || 0), 0);
      const avgMonthlyGross = totalSavedGross / savedInYear.length;
      const monthsMultiplier = settings?.pagas === 14 ? 14 : 12;
      estimatedAnnualGross = avgMonthlyGross * (settings?.pagas === 14 ? 12 : 12) + (settings?.pagas === 14 ? (baseAnualFull / 14) * 2 : 0);
      estimatedAnnualVariables = Math.max(0, estimatedAnnualGross - baseAnualFull);
    } else {
      // Estimate from shifts recorded in the year
      const monthsWithShifts = new Set(yearShifts.filter(s => s.shifts.some(sh => sh.start && sh.end)).map(s => s.date.substring(0, 7)));
      const activeMonthsCount = Math.max(1, monthsWithShifts.size);

      if (yearShifts.length > 0) {
        const yearCounterCfg = getCounterConfigForYear(settings, year);
        const yearStats = getStatsForShifts(
          yearShifts,
          settings?.holidays || [],
          settings?.vacations || [],
          settings?.contractType || 'Completo',
          false,
          shifts,
          yearCounterCfg.period,
          yearCounterCfg.targets['Nocturnas'] || 0,
          yearPluses['Nocturnas'],
          yearCounterCfg.targets['Madrugue'] || 0,
          yearPluses['Madrugue'],
          new Date(year, 0, 1),
          settings?.isSubrogado,
          yearCounterCfg.targets,
          yearPluses
        );

        if (settings?.contractType === 'Parcial') {
          const avgMonthlyHours = yearStats.monthlyHours / activeMonthsCount;
          avgContractPct = Math.min(100, Math.max(25, (avgMonthlyHours / 155.63) * 100));
        }

        const varNocturnas = (yearStats.nightHours + yearStats.nightHoursSub) * (yearPluses['Nocturnas']?.value || 1.69);
        const varMadrugues = (yearStats.madrugues + yearStats.madruguesSub) * (yearPluses['Madrugue']?.value || 6.74);
        const varDomingos = (yearStats.sundays + yearStats.sundaysSub) * (yearPluses['Domingo']?.value || 2.94);
        const varFestivos = (yearStats.festivos + yearStats.festivosSub) * (yearPluses['Festivo']?.value || 2.99);
        const varTransporte = (yearStats.transport + yearStats.transportSub) * (yearPluses['Transporte']?.value || 2.97);
        const varManutencion = (yearStats.manutencion + yearStats.manutencionSub) * (yearPluses['Manutención']?.value || 6.74);
        const varExtra = (yearStats.perentDay + yearStats.perentNight) * metrics.perentoria +
                         (yearStats.complDay + yearStats.complNight) * (settings?.complementariasPrice || metrics.complementaria);

        const recordedVars = varNocturnas + varMadrugues + varDomingos + varFestivos + varTransporte + varManutencion + varExtra;
        estimatedAnnualVariables = (recordedVars / activeMonthsCount) * 11; // ~11 working months + 1 vacation month
      }

      const effectiveBaseAnual = settings?.contractType === 'Parcial'
        ? baseAnualFull * (avgContractPct / 100)
        : baseAnualFull;

      estimatedAnnualGross = effectiveBaseAnual + estimatedAnnualVariables;
    }

    const grossToUse = irpfCalcMode === 'manual' && parseFloat(irpfManualGross) > 0
      ? parseFloat(irpfManualGross)
      : Math.round(estimatedAnnualGross * 100) / 100;

    // Spanish AEAT IRPF Withholding Calculation
    const ssRate = ((settings?.rateContingencias || 4.7) + (settings?.rateDesempleo || 1.55) + (settings?.rateFormacion || 0.1) + (settings?.rateEquidad || 0.15)) / 100;
    const ssDeduction = grossToUse * ssRate;
    const otherWorkExpenses = 2000; // Art. 19 LIRPF
    const netWorkIncome = Math.max(0, grossToUse - ssDeduction - otherWorkExpenses);

    // Art. 20 LIRPF reduction for lower/medium work income
    let art20Reduction = 0;
    if (netWorkIncome <= 14852) {
      art20Reduction = 7302;
    } else if (netWorkIncome < 19747.5) {
      art20Reduction = Math.max(0, 7302 - 1.4915 * (netWorkIncome - 14852));
    }

    const baseLiquidable = Math.max(0, netWorkIncome - art20Reduction);

    // Personal and family minimum (Art. 57 & 58 LIRPF)
    let personalMinimum = 5550;
    if (irpfChildrenCount === 1) personalMinimum += 2400;
    else if (irpfChildrenCount === 2) personalMinimum += 2400 + 2700;
    else if (irpfChildrenCount >= 3) personalMinimum += 2400 + 2700 + 4000;

    const computeScaleTax = (amount: number) => {
      if (amount <= 0) return 0;
      const brackets = [
        { limit: 12450, rate: 0.19 },
        { limit: 20200, rate: 0.24 },
        { limit: 35200, rate: 0.30 },
        { limit: 60000, rate: 0.37 },
        { limit: 300000, rate: 0.45 },
        { limit: Infinity, rate: 0.47 },
      ];
      let tax = 0;
      let prevLimit = 0;
      for (const b of brackets) {
        if (amount > prevLimit) {
          const taxableInBracket = Math.min(amount, b.limit) - prevLimit;
          tax += taxableInBracket * b.rate;
          prevLimit = b.limit;
        } else {
          break;
        }
      }
      return tax;
    };

    const quotaBase = computeScaleTax(baseLiquidable);
    const quotaMinimum = computeScaleTax(personalMinimum);
    let annualTaxQuota = Math.max(0, quotaBase - quotaMinimum);

    // Exempt threshold check (generally ~15.876€ with 0 children)
    const exemptLimit = irpfChildrenCount === 0 ? 15876 : (irpfChildrenCount === 1 ? 17644 : 19262);
    if (grossToUse <= exemptLimit) {
      annualTaxQuota = 0;
    }

    const exactIrpfPct = grossToUse > 0 ? Math.max(2, Math.round((annualTaxQuota / grossToUse) * 100 * 10) / 10) : 2;
    const exactOrZeroPct = grossToUse <= exemptLimit ? 2 : exactIrpfPct;
    const safeIrpfPct = Math.min(45, Math.ceil((exactOrZeroPct + 0.5) * 2) / 2);

    const currentConfiguredIrpf = settings?.irpf ?? 12;
    const currentAnnualWithholding = grossToUse * (currentConfiguredIrpf / 100);
    const optimalAnnualWithholding = grossToUse * (exactOrZeroPct / 100);
    const diffEuros = Math.round(currentAnnualWithholding - optimalAnnualWithholding);

    return {
      grossToUse,
      baseAnualFull,
      estimatedAnnualVariables,
      ssDeduction,
      exactIrpfPct: exactOrZeroPct,
      safeIrpfPct,
      currentConfiguredIrpf,
      annualTaxQuota: optimalAnnualWithholding,
      diffEuros,
      savedMonthsCount: savedInYear.length,
    };
  }, [irpfCalcYear, irpfCalcMode, irpfManualGross, irpfChildrenCount, levels, pluses, settings, shifts]);

  useEffect(() => {
    localStorage.setItem('isConvenioExpanded', String(isConvenioExpanded));
  }, [isConvenioExpanded]);

  useEffect(() => {
    localStorage.setItem('isPerentExpanded', String(isPerentExpanded));
  }, [isPerentExpanded]);

  useEffect(() => {
    localStorage.setItem('isTurnosExpanded', String(isTurnosExpanded));
  }, [isTurnosExpanded]);

  const [perentInput, setPerentInput] = useState<string>(() => {
    return localStorage.getItem('perentInput') || '';
  });

  useEffect(() => {
    localStorage.setItem('perentInput', perentInput);
  }, [perentInput]);

  // States for Cambio de Turnos (horas x horas)
  const [comparisonA, setComparisonA] = useState<ShiftEntry[]>(() => {
    const saved = localStorage.getItem('comparisonA');
    try {
      return saved ? JSON.parse(saved) : [{ start: '', end: '' }];
    } catch {
      return [{ start: '', end: '' }];
    }
  });

  const [comparisonB, setComparisonB] = useState<ShiftEntry[]>(() => {
    const saved = localStorage.getItem('comparisonB');
    try {
      return saved ? JSON.parse(saved) : [{ start: '', end: '' }];
    } catch {
      return [{ start: '', end: '' }];
    }
  });

  useEffect(() => {
    localStorage.setItem('comparisonA', JSON.stringify(comparisonA));
  }, [comparisonA]);

  useEffect(() => {
    localStorage.setItem('comparisonB', JSON.stringify(comparisonB));
  }, [comparisonB]);

  // States for Solicitudes section
  const [isSolicitudesExpanded, setIsSolicitudesExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('isSolicitudesExpanded');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('isSolicitudesExpanded', String(isSolicitudesExpanded));
  }, [isSolicitudesExpanded]);

  const [isCambioTurnoModalOpen, setIsCambioTurnoModalOpen] = useState<boolean>(false);

  const [isIrpfModalOpen, setIsIrpfModalOpen] = useState<boolean>(false);
  const [activeIrpfTab, setActiveIrpfTab] = useState<'formulario' | 'vista'>('formulario');

  const [isPpExtraModalOpen, setIsPpExtraModalOpen] = useState<boolean>(false);
  const [activePpExtraTab, setActivePpExtraTab] = useState<'formulario' | 'vista'>('formulario');

  // States for Baja IT section
  const [isBajaItExpanded, setIsBajaItExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('isBajaItExpanded');
    return saved !== null ? saved === 'true' : false;
  });
  useEffect(() => {
    localStorage.setItem('isBajaItExpanded', String(isBajaItExpanded));
  }, [isBajaItExpanded]);

  // Selección entre Baja por Enfermedad Común y Baja Laboral (Accidente de Trabajo)
  const [bajaType, setBajaType] = useState<'comun' | 'laboral'>(() => {
    const saved = localStorage.getItem('bajaType');
    return saved === 'laboral' ? 'laboral' : 'comun';
  });
  useEffect(() => {
    localStorage.setItem('bajaType', bajaType);
  }, [bajaType]);

  const [bajaInputMode, setBajaInputMode] = useState<'single' | 'range'>('range');
  const [bajaSingleDate, setBajaSingleDate] = useState<string>('');
  const [bajaRangeStart, setBajaRangeStart] = useState<string>('');
  const [bajaRangeEnd, setBajaRangeEnd] = useState<string>('');
  const [bajaRangePickerStep, setBajaRangePickerStep] = useState<'start' | 'end' | null>(null);
  const [selectedBajaTramoId, setSelectedBajaTramoId] = useState<string>('auto');
  const [bajaCustomDays, setBajaCustomDays] = useState<string>('15');
  const [bajaRefMonth, setBajaRefMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [bajaDataSource, setBajaDataSource] = useState<'app' | 'manual'>('app');
  const [bajaManualBase1, setBajaManualBase1] = useState<string>('');
  const [bajaManualBase2, setBajaManualBase2] = useState<string>('');
  const [bajaManualBase3, setBajaManualBase3] = useState<string>('');

  // Mejoras: Retención IRPF personalizada para cálculo neto, Horas Extras anuales para Contingencias Profesionales, copia y fecha inicio simulación
  const [bajaCustomIrpf, setBajaCustomIrpf] = useState<string>(() => {
    return settings?.irpf !== undefined && settings?.irpf !== null ? String(settings.irpf) : '15';
  });
  useEffect(() => {
    if (settings?.irpf !== undefined && settings?.irpf !== null) {
      setBajaCustomIrpf(String(settings.irpf));
    }
  }, [settings?.irpf]);

  const [bajaHorasExtrasAnuales, setBajaHorasExtrasAnuales] = useState<string>('0');
  const [bajaCopied, setBajaCopied] = useState<boolean>(false);
  const [bajaCustomStartDate, setBajaCustomStartDate] = useState<string>(() => safeFormat(new Date(), 'yyyy-MM-dd'));

  // Group all shifts marked as 'Baja IT' into contiguous tramos
  const bajaItDates = useMemo(() => {
    return shifts
      .filter(s => s.type === 'Baja IT' && s.date)
      .map(s => s.date)
      .sort();
  }, [shifts]);

  const bajaItTramos = useMemo(() => {
    if (bajaItDates.length === 0) return [];
    const tramos: { id: string; start: string; end: string; dates: string[]; daysCount: number }[] = [];
    let currentDates: string[] = [bajaItDates[0]];

    for (let i = 1; i < bajaItDates.length; i++) {
      const prevDate = parseISO(bajaItDates[i - 1]);
      const currDate = parseISO(bajaItDates[i]);
      if (isValid(prevDate) && isValid(currDate) && differenceInCalendarDays(currDate, prevDate) === 1) {
        currentDates.push(bajaItDates[i]);
      } else {
        const start = currentDates[0];
        const end = currentDates[currentDates.length - 1];
        tramos.push({
          id: `${start}_${end}`,
          start,
          end,
          dates: [...currentDates],
          daysCount: currentDates.length,
        });
        currentDates = [bajaItDates[i]];
      }
    }
    if (currentDates.length > 0) {
      const start = currentDates[0];
      const end = currentDates[currentDates.length - 1];
      tramos.push({
        id: `${start}_${end}`,
        start,
        end,
        dates: [...currentDates],
        daysCount: currentDates.length,
      });
    }
    return tramos;
  }, [bajaItDates]);

  const activeBajaTramo = useMemo(() => {
    if (selectedBajaTramoId === 'custom') return null;
    if (bajaItTramos.length === 0) return null;
    if (selectedBajaTramoId === 'auto') {
      return bajaItTramos[bajaItTramos.length - 1];
    }
    return bajaItTramos.find(t => t.id === selectedBajaTramoId) || bajaItTramos[bajaItTramos.length - 1];
  }, [bajaItTramos, selectedBajaTramoId]);

  useEffect(() => {
    if (activeBajaTramo) {
      const parsedStart = parseISO(activeBajaTramo.start);
      if (isValid(parsedStart)) {
        setBajaRefMonth(startOfMonth(parsedStart));
      }
    }
  }, [activeBajaTramo?.id]);

  const handleAddSingleBajaIt = () => {
    if (!bajaSingleDate || !updateShift) return;
    const existing = shifts.find(s => s.date === bajaSingleDate);
    const updated: DayShift = existing
      ? {
          ...existing,
          type: 'Baja IT',
        }
      : {
          date: bajaSingleDate,
          type: 'Baja IT',
          shifts: [{ start: '', end: '' }],
          extraShifts: [],
          perentorias: { day: 0, night: 0 },
          complementarias: { day: 0, night: 0 },
        };
    updateShift(updated);
    setSelectedBajaTramoId('auto');
    setBajaSingleDate('');
  };

  const handleAddRangeBajaIt = () => {
    if (!bajaRangeStart || !bajaRangeEnd || !updateShifts) return;
    const start = parseISO(bajaRangeStart);
    const end = parseISO(bajaRangeEnd);
    if (!isValid(start) || !isValid(end) || isAfter(start, end)) return;

    const intervalDates = eachDayOfInterval({ start, end }).map(d => safeFormat(d, 'yyyy-MM-dd'));
    const toUpdate: DayShift[] = intervalDates.map(date => {
      const existing = shifts.find(s => s.date === date);
      return existing
        ? {
            ...existing,
            type: 'Baja IT',
          }
        : {
            date,
            type: 'Baja IT',
            shifts: [{ start: '', end: '' }],
            extraShifts: [],
            perentorias: { day: 0, night: 0 },
            complementarias: { day: 0, night: 0 },
          };
    });
    updateShifts(toUpdate);
    setSelectedBajaTramoId(`${bajaRangeStart}_${bajaRangeEnd}`);
    setBajaRangeStart('');
    setBajaRangeEnd('');
  };

  const handleRemoveBajaDates = (datesToRemove: string[]) => {
    if (!updateShifts || datesToRemove.length === 0) return;
    const reverted = shifts
      .filter(s => datesToRemove.includes(s.date) && s.type === 'Baja IT')
      .map(s => ({
        ...s,
        type: (settings?.vacations?.includes(s.date) ? 'Vacaciones' : 'Laboral') as ShiftType,
      }));
    if (reverted.length > 0) {
      updateShifts(reverted);
    }
  };

  // Helper to obtain the Base de Contingencias Comunes (BCCC) of a given month from the app
  const getAppMonthBCCC = (targetMonth: Date): { monthKey: string; label: string; base: number; source: string; daysInMonth: number } => {
    const monthKey = safeFormat(targetMonth, 'yyyy-MM');
    const rawLabel = safeFormat(targetMonth, 'MMMM yyyy', { locale: es });
    const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : monthKey;
    const daysInMonth = endOfMonth(targetMonth).getDate();

    // 1. Check savedPayrolls first
    const savedPayroll = (settings?.savedPayrolls || []).find(p => p.monthKey === monthKey);
    if (savedPayroll && savedPayroll.totals?.baseCotizacion > 0) {
      return {
        monthKey,
        label,
        base: Math.round(savedPayroll.totals.baseCotizacion * 100) / 100,
        source: 'Nómina guardada',
        daysInMonth,
      };
    }

    // 2. Check uploadedPayrolls (PDF)
    const uploadedPayroll = (settings?.uploadedPayrolls || []).find(p => p.monthKey === monthKey);
    if (uploadedPayroll && uploadedPayroll.data?.deducciones?.length) {
      const ccDed =
        uploadedPayroll.data.deducciones.find(d => d.concepto?.toLowerCase().includes('contingencias comunes')) ||
        uploadedPayroll.data.deducciones.find(d => d.base > 0);
      if (ccDed && ccDed.base > 0) {
        return {
          monthKey,
          label,
          base: Math.round(ccDed.base * 100) / 100,
          source: 'Nómina PDF',
          daysInMonth,
        };
      }
    }

    // 3. Calculate from shifts and settings in the app (same formula as PayrollSection)
    const year = targetMonth.getFullYear();
    const defaultLevels = [
      { nivel: 1, anual: 19343.52 },
      { nivel: 2, anual: 22907.89 },
      { nivel: 3, anual: 23596.68 },
      { nivel: 4, anual: 24068.48 },
      { nivel: 5, anual: 24540.55 },
      { nivel: 6, anual: 25522.17 },
      { nivel: 7, anual: 26543.06 },
    ];
    const yearLevels = levels?.[year] || levels?.[Object.keys(levels || {}).map(Number).sort((a, b) => b - a)[0]] || defaultLevels;
    const yearPluses = pluses?.[year] || pluses?.[Object.keys(pluses || {}).map(Number).sort((a, b) => b - a)[0]] || {};
    const mOpts = settings?.monthlyOptions?.[monthKey];

    let activeLvl = mOpts?.manualLevel || settings?.currentLevel || 1;
    if (!mOpts?.manualLevel && settings?.nextLevelDate) {
      const nextDate = startOfMonth(parseISO(settings.nextLevelDate));
      if (isValid(nextDate) && startOfMonth(targetMonth) >= nextDate) {
        activeLvl = Math.min(7, (settings?.currentLevel || 1) + 1);
      }
    }

    const lvlObj = yearLevels.find(l => l.nivel === activeLvl) || yearLevels[0];
    const subAnual = settings?.isSubrogado ? (settings?.subrogadoBaseSalaries?.[year] || 0) : 0;
    const baseAnual = subAnual > 0 ? subAnual : lvlObj.anual;
    const metrics = calculateLevelMetrics(baseAnual, settings?.pagas || 14);

    const getExtendedShifts = (mDate: Date) => {
      const s = startOfMonth(mDate);
      const dayBeforeStr = safeFormat(addDays(s, -1), 'yyyy-MM-dd');
      return shifts.filter(sh => isSameMonth(parseISO(sh.date), mDate) || sh.date === dayBeforeStr);
    };

    const currMonthShifts = getExtendedShifts(targetMonth);
    const prevMonthDate = subMonths(targetMonth, 1);
    const prevMonthShifts = getExtendedShifts(prevMonthDate);

    const currCounterCfg = getCounterConfigForDate(settings, targetMonth);
    const prevCounterCfg = getCounterConfigForDate(settings, prevMonthDate);

    const currStats = getStatsForShifts(
      currMonthShifts,
      settings?.holidays || [],
      settings?.vacations || [],
      settings?.contractType || 'Completo',
      false,
      shifts,
      currCounterCfg.period,
      currCounterCfg.targets['Nocturnas'] || 0,
      yearPluses['Nocturnas'],
      currCounterCfg.targets['Madrugue'] || 0,
      yearPluses['Madrugue'],
      targetMonth,
      settings?.isSubrogado,
      currCounterCfg.targets,
      yearPluses
    );

    const prevStats = getStatsForShifts(
      prevMonthShifts,
      settings?.holidays || [],
      settings?.vacations || [],
      settings?.contractType || 'Completo',
      false,
      shifts,
      prevCounterCfg.period,
      prevCounterCfg.targets['Nocturnas'] || 0,
      yearPluses['Nocturnas'],
      prevCounterCfg.targets['Madrugue'] || 0,
      yearPluses['Madrugue'],
      prevMonthDate,
      settings?.isSubrogado,
      prevCounterCfg.targets,
      yearPluses
    );

    const isParcial = settings?.contractType === 'Parcial';
    const hasManualHours = isParcial && !!mOpts?.useManualHours;
    const effectivePct = (hasManualHours && mOpts?.manualHoursParcial !== undefined && mOpts?.manualHoursParcial !== null)
      ? (mOpts.manualHoursParcial / 155.63) * 100
      : currStats.effectivePercentage;

    const salarioBase = !isParcial
      ? (mOpts?.useManualBaseSalary && mOpts?.manualBaseSalary ? mOpts.manualBaseSalary : metrics.mensual)
      : metrics.mensual * (Math.min(100, effectivePct) / 100);

    const extraPct = isParcial && effectivePct > 100 ? effectivePct - 100 : 0;
    const ajusteJornada = metrics.mensual * (extraPct / 100);
    const ppExtra = salarioBase / 6;

    const valPlus = (name: string, qty: number) => {
      const cfg = yearPluses[name];
      if (!cfg || !cfg.enabled || qty <= 0) return 0;
      return qty * cfg.value;
    };

    const variablesPrevMonth =
      valPlus('Jornada Fraccionada < 4h', prevStats.splitLess4 + prevStats.splitLess4Sub) +
      valPlus('Jornada Fraccionada >= 4h', prevStats.split4to7 + prevStats.split4to7Sub) +
      valPlus('Jornada Fraccionada >= 7h', prevStats.splitPlus7 + prevStats.splitPlus7Sub) +
      valPlus('Transporte', prevStats.transport + prevStats.transportSub) +
      valPlus('Manutención', prevStats.manutencion + prevStats.manutencionSub) +
      valPlus('Madrugue', prevStats.madrugues + prevStats.madruguesSub) +
      valPlus('Festivo', prevStats.festivos + prevStats.festivosSub) +
      valPlus('Domingo', prevStats.sundays + prevStats.sundaysSub) +
      valPlus('Nocturnas', prevStats.nightHours + prevStats.nightHoursSub) +
      valPlus('Tiempo Parcial - Discontinuo', isParcial ? effectivePct / 100 : 0) +
      prevStats.perentDay * metrics.perentoria +
      prevStats.perentNight * (metrics.perentoria + (yearPluses['Nocturnas']?.value || 0)) +
      prevStats.complDay * (settings?.complementariasPrice || metrics.complementaria) +
      prevStats.complNight * ((settings?.complementariasPrice || metrics.complementaria) + (yearPluses['Nocturnas']?.value || 0));

    const computedBCCC = Math.round((salarioBase + ajusteJornada + variablesPrevMonth + ppExtra) * 100) / 100;

    return {
      monthKey,
      label,
      base: computedBCCC,
      source: 'Calculada en la app',
      daysInMonth,
    };
  };

  const bajaCalculation = useMemo(() => {
    const contractType = settings?.contractType || 'Completo';
    const isParcial = contractType === 'Parcial';

    const m1 = getAppMonthBCCC(subMonths(bajaRefMonth, 1));
    const m2 = getAppMonthBCCC(subMonths(bajaRefMonth, 2));
    const m3 = getAppMonthBCCC(subMonths(bajaRefMonth, 3));

    const usedBase1 = bajaDataSource === 'manual' ? (parseFloat(bajaManualBase1) || 0) : m1.base;
    const usedBase2 = bajaDataSource === 'manual' ? (parseFloat(bajaManualBase2) || 0) : m2.base;
    const usedBase3 = bajaDataSource === 'manual' ? (parseFloat(bajaManualBase3) || 0) : m3.base;

    // Contrato Completo: Base CC del mes anterior / 30
    // Contrato Parcial: Media de las Bases CC de los 3 meses anteriores / 30 (suma de las 3 bases / 90)
    const monthlyReferenceBase = isParcial
      ? (usedBase1 + usedBase2 + usedBase3) / 3
      : usedBase1;

    // Base Reguladora Diaria ordinaria
    const baseReguladoraOrdinariaDiaria = monthlyReferenceBase / 30;

    // Mejora 1: En Baja Laboral (Accidente de Trabajo/Enfermedad Profesional - Art. 173 LGSS),
    // la Base Reguladora incluye el promedio diario de horas extras realizadas en los 12 meses anteriores (÷ 365 días).
    const horasExtrasAnualesVal = bajaType === 'laboral' ? Math.max(0, parseFloat(bajaHorasExtrasAnuales) || 0) : 0;
    const horasExtrasPromedioDiario = horasExtrasAnualesVal > 0 ? (horasExtrasAnualesVal / 365) : 0;
    const baseReguladoraDiaria = baseReguladoraOrdinariaDiaria + horasExtrasPromedioDiario;

    const totalDays = activeBajaTramo
      ? activeBajaTramo.daysCount
      : Math.max(0, parseInt(bajaCustomDays, 10) || 0);

    let brackets: any[] = [];
    let totalPrestacion = 0;
    let totalPrestacionLegal = 0;
    let totalComplementoEmpresa = 0;

    if (bajaType === 'laboral') {
      // -----------------------------------------------------------------------------------
      // BAJA LABORAL (Accidente de Trabajo / Enfermedad Profesional - Contingencias Profesionales)
      // -----------------------------------------------------------------------------------
      // 1. Prestación Legal Seguridad Social / Mutua: 75% de la Base Reguladora desde el primer día
      //    siguiente al accidente hasta el alta médica (Art. 173 LGSS).
      const rateMutua = baseReguladoraDiaria * 0.75;
      const totalMutua = totalDays * rateMutua;
      totalPrestacionLegal = totalMutua;

      // 2. Complemento I Convenio Colectivo Azul Handling (Art. 60):
      //    "En accidente de trabajo o enfermedad profesional se complementa hasta el 100% del salario fijo desde el 1.er día."
      //    Por tanto, la empresa aporta el 25% restante para alcanzar el 100% íntegro.
      const rateComplemento = baseReguladoraDiaria * 0.25;
      const totalComplemento = totalDays * rateComplemento;
      totalComplementoEmpresa = totalComplemento;

      // 3. Total percibido garantizado con el Convenio (100% de la Base Reguladora):
      const rateTotal100 = baseReguladoraDiaria * 1.00;
      const total100 = totalDays * rateTotal100;
      totalPrestacion = total100;

      brackets = [
        {
          id: 'dia-accidente',
          label: 'Día del Accidente',
          sublabel: 'Día del siniestro: jornada laboral íntegra a cargo de la empresa',
          pct: 100,
          dailyAmount: baseReguladoraDiaria,
          daysInBracket: totalDays > 0 ? 1 : 0,
          totalAmount: totalDays > 0 ? baseReguladoraDiaria : 0,
          payer: 'Abona la Empresa (Jornada ordinaria)',
        },
        {
          id: 'mutua-75',
          label: 'Prestación Mutua / INSS',
          sublabel: 'Del día 1º al alta médica (75% de la Base Reguladora legal)',
          pct: 75,
          dailyAmount: rateMutua,
          daysInBracket: totalDays,
          totalAmount: totalMutua,
          payer: 'Abona Mutua / INSS',
        },
        {
          id: 'convenio-25',
          label: 'Complemento Empresa (Art. 60)',
          sublabel: '+25% complemento de empresa hasta el 100% del salario fijo',
          pct: 25,
          dailyAmount: rateComplemento,
          daysInBracket: totalDays,
          totalAmount: totalComplemento,
          payer: 'Abona la Empresa (Convenio)',
        },
        {
          id: 'total-100',
          label: 'Total Percibido (100% Convenio)',
          sublabel: 'Retribución completa garantizada desde el 1.er día sin carencia',
          pct: 100,
          dailyAmount: rateTotal100,
          daysInBracket: totalDays,
          totalAmount: total100,
          payer: 'Mutua (75%) + Empresa (25%)',
        },
      ];
    } else {
      // -----------------------------------------------------------------------------------
      // BAJA POR ENFERMEDAD COMÚN / ACCIDENTE NO LABORAL (Contingencias Comunes)
      // -----------------------------------------------------------------------------------
      // Tramo 1: Días 1 al 3 (máx 3 días) -> 0% (sin prestación)
      // Tramo 2: Días 4 al 15 (máx 12 días) -> 60% (a cargo de la empresa)
      // Tramo 3: Días 16 al 20 (máx 5 días) -> 60% (a cargo del INSS/Mutua)
      // Tramo 4: Día 21 en adelante -> 75% (a cargo del INSS/Mutua)
      const daysTramo1 = Math.min(3, Math.max(0, totalDays));
      const daysTramo2 = Math.min(12, Math.max(0, totalDays - 3));
      const daysTramo3 = Math.min(5, Math.max(0, totalDays - 15));
      const daysTramo4 = Math.max(0, totalDays - 20);

      const rateTramo1 = 0;
      const rateTramo2 = baseReguladoraDiaria * 0.60;
      const rateTramo3 = baseReguladoraDiaria * 0.60;
      const rateTramo4 = baseReguladoraDiaria * 0.75;

      const totalTramo1 = daysTramo1 * rateTramo1;
      const totalTramo2 = daysTramo2 * rateTramo2;
      const totalTramo3 = daysTramo3 * rateTramo3;
      const totalTramo4 = daysTramo4 * rateTramo4;

      totalPrestacion = totalTramo1 + totalTramo2 + totalTramo3 + totalTramo4;
      totalPrestacionLegal = totalPrestacion;
      totalComplementoEmpresa = 0;

      brackets = [
        {
          id: '1-3',
          label: 'Días 1º al 3º',
          sublabel: 'Primeros 3 días de baja (Sin prestación legal)',
          pct: 0,
          dailyAmount: rateTramo1,
          daysInBracket: daysTramo1,
          totalAmount: totalTramo1,
          payer: 'No remunerado',
        },
        {
          id: '4-15',
          label: 'Días 4º al 15º',
          sublabel: 'Del 4º al 15º día de baja (máx. 12 días)',
          pct: 60,
          dailyAmount: rateTramo2,
          daysInBracket: daysTramo2,
          totalAmount: totalTramo2,
          payer: 'Abona la Empresa',
        },
        {
          id: '16-20',
          label: 'Días 16º al 20º',
          sublabel: 'Del 16º al 20º día de baja (máx. 5 días)',
          pct: 60,
          dailyAmount: rateTramo3,
          daysInBracket: daysTramo3,
          totalAmount: totalTramo3,
          payer: 'Abona INSS / Mutua',
        },
        {
          id: '21+',
          label: 'Día 21º en adelante',
          sublabel: 'A partir del 21º día de baja (+ compl. Convenio Art. 60 desde día 40º)',
          pct: 75,
          dailyAmount: rateTramo4,
          daysInBracket: daysTramo4,
          totalAmount: totalTramo4,
          payer: 'Abona INSS / Mutua',
        },
      ];
    }

    // Mejora 2: Desglose y distribución por meses naturales / nóminas de la baja
    let datesList: string[] = [];
    if (activeBajaTramo && activeBajaTramo.dates && activeBajaTramo.dates.length > 0) {
      datesList = [...activeBajaTramo.dates];
    } else {
      const parsedStart = parseISO(bajaCustomStartDate);
      const validStart = isValid(parsedStart) ? parsedStart : bajaRefMonth;
      datesList = [];
      for (let i = 0; i < totalDays; i++) {
        datesList.push(safeFormat(addDays(validStart, i), 'yyyy-MM-dd'));
      }
    }

    const irpfPct = Math.max(0, Math.min(100, parseFloat(bajaCustomIrpf) || 0));
    const irpfRate = irpfPct / 100;
    const ssRate = 0.0647; // 6,47% cuota obrera Seguridad Social (4,70% Contingencias Comunes + 1,55% Desempleo + 0,10% FP + 0,12% MEI)

    const monthGroups: Record<string, { monthKey: string; label: string; daysCount: number; dayIndices: number[] }> = {};
    datesList.forEach((dStr, index) => {
      const parsed = parseISO(dStr);
      if (isValid(parsed)) {
        const mKey = safeFormat(parsed, 'yyyy-MM');
        if (!monthGroups[mKey]) {
          monthGroups[mKey] = {
            monthKey: mKey,
            label: safeFormat(parsed, 'MMMM yyyy', { locale: es }),
            daysCount: 0,
            dayIndices: [],
          };
        }
        monthGroups[mKey].daysCount++;
        monthGroups[mKey].dayIndices.push(index + 1);
      }
    });

    const monthlyBreakdown = Object.values(monthGroups).map(mg => {
      let mGross = 0;
      let mMutua = 0;
      let mEmpresa = 0;

      if (bajaType === 'laboral') {
        mGross = mg.daysCount * baseReguladoraDiaria;
        mMutua = mg.daysCount * (baseReguladoraDiaria * 0.75);
        mEmpresa = mg.daysCount * (baseReguladoraDiaria * 0.25);
      } else {
        mg.dayIndices.forEach(dayNum => {
          if (dayNum <= 3) {
            // Sin prestación
          } else if (dayNum <= 15) {
            mGross += baseReguladoraDiaria * 0.60;
            mEmpresa += baseReguladoraDiaria * 0.60;
          } else if (dayNum <= 20) {
            mGross += baseReguladoraDiaria * 0.60;
            mMutua += baseReguladoraDiaria * 0.60;
          } else {
            mGross += baseReguladoraDiaria * 0.75;
            mMutua += baseReguladoraDiaria * 0.75;
          }
        });
      }

      const mIrpf = mGross * irpfRate;
      const mSS = (baseReguladoraDiaria * mg.daysCount) * ssRate;
      const mNet = Math.max(0, mGross - mIrpf - mSS);

      return {
        monthKey: mg.monthKey,
        label: mg.label,
        daysCount: mg.daysCount,
        gross: mGross,
        mutua: mMutua,
        empresa: mEmpresa,
        irpf: mIrpf,
        ss: mSS,
        net: mNet,
      };
    });

    // Mejora 3: Cálculo del impacto neto estimado (Líquido a percibir tras IRPF y cuota obrera SS)
    const totalIrpf = totalPrestacion * irpfRate;
    const totalSS = (baseReguladoraDiaria * totalDays) * ssRate;
    const totalNeto = Math.max(0, totalPrestacion - totalIrpf - totalSS);

    return {
      bajaType,
      contractType,
      isParcial,
      monthsData: [m1, m2, m3],
      usedBases: [usedBase1, usedBase2, usedBase3],
      monthlyReferenceBase,
      baseReguladoraOrdinariaDiaria,
      horasExtrasAnualesVal,
      horasExtrasPromedioDiario,
      baseReguladoraDiaria,
      totalDays,
      brackets,
      totalPrestacion,
      totalPrestacionLegal,
      totalComplementoEmpresa,
      irpfPct,
      irpfRate,
      ssRate,
      totalIrpf,
      totalSS,
      totalNeto,
      monthlyBreakdown,
    };
  }, [
    bajaType,
    settings,
    shifts,
    levels,
    pluses,
    bajaRefMonth,
    bajaDataSource,
    bajaManualBase1,
    bajaManualBase2,
    bajaManualBase3,
    bajaHorasExtrasAnuales,
    bajaCustomIrpf,
    bajaCustomStartDate,
    activeBajaTramo,
    bajaCustomDays,
  ]);

  // Mejora 4: Copiar ficha e informe detallado de la baja al portapapeles
  const handleCopyBajaSummary = () => {
    const isLaboral = bajaType === 'laboral';
    const datesStr = activeBajaTramo
      ? `${safeFormat(parseISO(activeBajaTramo.start), 'dd/MM/yyyy')} al ${safeFormat(parseISO(activeBajaTramo.end), 'dd/MM/yyyy')}`
      : `${bajaCalculation.totalDays} días`;

    let text = `📋 INFORME ESTIMADO DE BAJA - AZUL HANDLING\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• Tipo de contingencia: ${isLaboral ? 'Baja Laboral (Accidente de Trabajo / Enf. Profesional)' : 'Baja por Enfermedad Común (Contingencias Comunes)'}\n`;
    text += `• Período de baja: ${datesStr} (${bajaCalculation.totalDays} ${bajaCalculation.totalDays === 1 ? 'día' : 'días'})\n`;
    text += `• Tipo de contrato: Jornada ${bajaCalculation.contractType}\n`;
    text += `• Base Reguladora Diaria: ${formatCurrency(bajaCalculation.baseReguladoraDiaria)} / día\n`;
    if (isLaboral && bajaCalculation.horasExtrasAnualesVal > 0) {
      text += `  └ Base Ordinaria: ${formatCurrency(bajaCalculation.baseReguladoraOrdinariaDiaria)}/día + Promedio H.Extras: ${formatCurrency(bajaCalculation.horasExtrasPromedioDiario)}/día\n`;
    }
    text += `\n💰 DESGLOSE DE PAGADORES (BRUTO):\n`;
    if (isLaboral) {
      text += `• Prestación Mutua (75%): ${formatCurrency(bajaCalculation.totalPrestacionLegal)}\n`;
      text += `• Compl. Convenio Empresa (25% - Art. 60): ${formatCurrency(bajaCalculation.totalComplementoEmpresa)}\n`;
      text += `• Total Percibido (100% Convenio): ${formatCurrency(bajaCalculation.totalPrestacion)}\n`;
    } else {
      bajaCalculation.brackets.forEach((b: any) => {
        if (b.daysInBracket > 0) {
          text += `• ${b.label} (${b.pct}% BR - ${b.payer}): ${formatCurrency(b.totalAmount)} (${b.daysInBracket} días)\n`;
        }
      });
      text += `• Total Prestación Bruta: ${formatCurrency(bajaCalculation.totalPrestacion)}\n`;
    }

    if (bajaCalculation.monthlyBreakdown.length > 1) {
      text += `\n📅 DISTRIBUCIÓN POR NÓMINAS / MESES:\n`;
      bajaCalculation.monthlyBreakdown.forEach((mb: any) => {
        text += `• ${mb.label.toUpperCase()} (${mb.daysCount} días): Bruto ${formatCurrency(mb.gross)} | Neto est. ${formatCurrency(mb.net)}\n`;
      });
    }

    text += `\n🧾 ESTIMACIÓN LÍQUIDA NETA A PERCIBIR:\n`;
    text += `• Bruto Total: ${formatCurrency(bajaCalculation.totalPrestacion)}\n`;
    text += `• Retención IRPF est. (${bajaCalculation.irpfPct}%): -${formatCurrency(bajaCalculation.totalIrpf)}\n`;
    text += `• Cuota Seguridad Social est. (6,47%): -${formatCurrency(bajaCalculation.totalSS)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💵 LÍQUIDO NETO ESTIMADO EN CUENTA: ${formatCurrency(bajaCalculation.totalNeto)}\n`;
    text += `(Cálculo estimativo conforme al I Convenio Colectivo de Azul Handling y legislación vigente)\n`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setBajaCopied(true);
        setTimeout(() => setBajaCopied(false), 2500);
      }).catch(() => {
        setBajaCopied(true);
        setTimeout(() => setBajaCopied(false), 2500);
      });
    } else {
      setBajaCopied(true);
      setTimeout(() => setBajaCopied(false), 2500);
    }
  };

  const isAnyModalActive = !!(isCambioTurnoModalOpen || isIrpfModalOpen || isPpExtraModalOpen || selectedChapter || selectedArticle || isMonthPickerOpen || bajaRangePickerStep !== null);
  useScrollLock(isAnyModalActive);

  // Form states for "Cambio PP Extra"
  const [ppExtraCiudad, setPpExtraCiudad] = useState<string>(() => {
    return localStorage.getItem('ppExtraCiudad') || '';
  });
  const [ppExtraFechaFirma, setPpExtraFechaFirma] = useState<string>(() => {
    return localStorage.getItem('ppExtraFechaFirma') || new Date().toISOString().split('T')[0];
  });
  const [ppExtraNombre, setPpExtraNombre] = useState<string>(() => {
    return localStorage.getItem('ppExtraNombre') || '';
  });
  const [ppExtraDni, setPpExtraDni] = useState<string>(() => {
    return localStorage.getItem('ppExtraDni') || '';
  });
  const [ppExtraAnioNatural, setPpExtraAnioNatural] = useState<string>(() => {
    return localStorage.getItem('ppExtraAnioNatural') || String(new Date().getFullYear());
  });
  const [ppExtraPagas, setPpExtraPagas] = useState<string>(() => {
    return localStorage.getItem('ppExtraPagas') || '14';
  });
  const [ppExtraSignature, setPpExtraSignature] = useState<string | null>(() => {
    return localStorage.getItem('ppExtraSignature') || null;
  });

  // Form states for "Cambio de IRPF"
  const [irpfCiudad, setIrpfCiudad] = useState<string>(() => {
    return localStorage.getItem('irpfCiudad') || '';
  });
  const [irpfFechaFirma, setIrpfFechaFirma] = useState<string>(() => {
    return localStorage.getItem('irpfFechaFirma') || new Date().toISOString().split('T')[0];
  });
  const [irpfNombre, setIrpfNombre] = useState<string>(() => {
    return localStorage.getItem('irpfNombre') || '';
  });
  const [irpfNif, setIrpfNif] = useState<string>(() => {
    return localStorage.getItem('irpfNif') || '';
  });
  const [irpfCategoria, setIrpfCategoria] = useState<string>(() => {
    return localStorage.getItem('irpfCategoria') || '';
  });
  const [irpfCentro, setIrpfCentro] = useState<string>(() => {
    return localStorage.getItem('irpfCentro') || '';
  });
  const [irpfEmpresa, setIrpfEmpresa] = useState<string>(() => {
    return localStorage.getItem('irpfEmpresa') || 'Azul Handling';
  });
  const [irpfFechaEfectiva, setIrpfFechaEfectiva] = useState<string>(() => {
    return localStorage.getItem('irpfFechaEfectiva') || new Date().toISOString().split('T')[0];
  });
  const [irpfPorcentaje, setIrpfPorcentaje] = useState<string>(() => {
    return localStorage.getItem('irpfPorcentaje') || '';
  });
  const [irpfSignature, setIrpfSignature] = useState<string | null>(() => {
    return localStorage.getItem('irpfSignature') || null;
  });

  // Form states for "Cambio de turno"
  const [formType, setFormType] = useState<'pasaje' | 'rampa'>(() => {
    const saved = localStorage.getItem('formType');
    return (saved === 'pasaje' || saved === 'rampa' ? saved : 'pasaje');
  });
  const [formFechaSolicitud, setFormFechaSolicitud] = useState<string>(() => {
    return localStorage.getItem('formFechaSolicitud') || new Date().toISOString().split('T')[0];
  });
  const [formSolicitanteNombre, setFormSolicitanteNombre] = useState<string>(() => {
    return localStorage.getItem('formSolicitanteNombre') || '';
  });
  const [formAceptaNombre, setFormAceptaNombre] = useState<string>(() => {
    return localStorage.getItem('formAceptaNombre') || '';
  });
  const [formMotivo, setFormMotivo] = useState<string>(() => {
    return localStorage.getItem('formMotivo') || '';
  });

  // For DIA/S Y TURNO/S QUE SE CAMBIAN (Input fields):
  const [formCambioFecha, setFormCambioFecha] = useState<string>(() => {
    return localStorage.getItem('formCambioFecha') || '';
  });
  const [formCambioHoraInicio, setFormCambioHoraInicio] = useState<string>(() => {
    return localStorage.getItem('formCambioHoraInicio') || '';
  });
  const [formCambioHoraFin, setFormCambioHoraFin] = useState<string>(() => {
    return localStorage.getItem('formCambioHoraFin') || '';
  });
  const [formCambioTurno, setFormCambioTurno] = useState<string>(() => {
    return localStorage.getItem('formCambioTurno') || '';
  });
  const [formCambioDetails, setFormCambioDetails] = useState<string>(() => {
    return localStorage.getItem('formCambioDetails') || '';
  });

  // For DIA Y HORAS SOLICITADAS:
  const [formSolicitadoFecha, setFormSolicitadoFecha] = useState<string>(() => {
    return localStorage.getItem('formSolicitadoFecha') || '';
  });
  const [formSolicitadoHoraInicio, setFormSolicitadoHoraInicio] = useState<string>(() => {
    return localStorage.getItem('formSolicitadoHoraInicio') || '';
  });
  const [formSolicitadoHoraFin, setFormSolicitadoHoraFin] = useState<string>(() => {
    return localStorage.getItem('formSolicitadoHoraFin') || '';
  });
  const [formSolicitadoDetails, setFormSolicitadoDetails] = useState<string>(() => {
    return localStorage.getItem('formSolicitadoDetails') || '';
  });

  // Signatures states:
  const [signatureSolicitante, setSignatureSolicitante] = useState<string | null>(() => {
    return localStorage.getItem('signatureSolicitante') || null;
  });
  const [signatureAcepta, setSignatureAcepta] = useState<string | null>(() => {
    return localStorage.getItem('signatureAcepta') || null;
  });

  useEffect(() => {
    localStorage.setItem('formType', formType);
    localStorage.setItem('formFechaSolicitud', formFechaSolicitud);
    localStorage.setItem('formSolicitanteNombre', formSolicitanteNombre);
    localStorage.setItem('formAceptaNombre', formAceptaNombre);
    localStorage.setItem('formMotivo', formMotivo);
    localStorage.setItem('formCambioFecha', formCambioFecha);
    localStorage.setItem('formCambioHoraInicio', formCambioHoraInicio);
    localStorage.setItem('formCambioHoraFin', formCambioHoraFin);
    localStorage.setItem('formCambioTurno', formCambioTurno);
    localStorage.setItem('formCambioDetails', formCambioDetails);
    localStorage.setItem('formSolicitadoFecha', formSolicitadoFecha);
    localStorage.setItem('formSolicitadoHoraInicio', formSolicitadoHoraInicio);
    localStorage.setItem('formSolicitadoHoraFin', formSolicitadoHoraFin);
    localStorage.setItem('formSolicitadoDetails', formSolicitadoDetails);
    if (signatureSolicitante) localStorage.setItem('signatureSolicitante', signatureSolicitante);
    else localStorage.removeItem('signatureSolicitante');
    if (signatureAcepta) localStorage.setItem('signatureAcepta', signatureAcepta);
    else localStorage.removeItem('signatureAcepta');
  }, [
    formType,
    formFechaSolicitud,
    formSolicitanteNombre,
    formAceptaNombre,
    formMotivo,
    formCambioFecha,
    formCambioHoraInicio,
    formCambioHoraFin,
    formCambioTurno,
    formCambioDetails,
    formSolicitadoFecha,
    formSolicitadoHoraInicio,
    formSolicitadoHoraFin,
    formSolicitadoDetails,
    signatureSolicitante,
    signatureAcepta
  ]);

  useEffect(() => {
    localStorage.setItem('irpfCiudad', irpfCiudad);
    localStorage.setItem('irpfFechaFirma', irpfFechaFirma);
    localStorage.setItem('irpfNombre', irpfNombre);
    localStorage.setItem('irpfNif', irpfNif);
    localStorage.setItem('irpfCategoria', irpfCategoria);
    localStorage.setItem('irpfCentro', irpfCentro);
    localStorage.setItem('irpfEmpresa', irpfEmpresa);
    localStorage.setItem('irpfFechaEfectiva', irpfFechaEfectiva);
    localStorage.setItem('irpfPorcentaje', irpfPorcentaje);
    if (irpfSignature) localStorage.setItem('irpfSignature', irpfSignature);
    else localStorage.removeItem('irpfSignature');
  }, [
    irpfCiudad,
    irpfFechaFirma,
    irpfNombre,
    irpfNif,
    irpfCategoria,
    irpfCentro,
    irpfEmpresa,
    irpfFechaEfectiva,
    irpfPorcentaje,
    irpfSignature
  ]);

  // Keep Centro de Trabajo synchronized with Ciudad of signature
  useEffect(() => {
    setIrpfCentro(irpfCiudad);
  }, [irpfCiudad]);

  const handleClearIrpfForm = () => {
    setIrpfCiudad('');
    setIrpfFechaFirma(new Date().toISOString().split('T')[0]);
    setIrpfNombre('');
    setIrpfNif('');
    setIrpfCategoria('');
    setIrpfCentro('');
    setIrpfEmpresa('Azul Handling');
    setIrpfFechaEfectiva(new Date().toISOString().split('T')[0]);
    setIrpfPorcentaje('');
    setIrpfSignature(null);
    localStorage.removeItem('irpfSignature');
  };

  useEffect(() => {
    localStorage.setItem('ppExtraCiudad', ppExtraCiudad);
    localStorage.setItem('ppExtraFechaFirma', ppExtraFechaFirma);
    localStorage.setItem('ppExtraNombre', ppExtraNombre);
    localStorage.setItem('ppExtraDni', ppExtraDni);
    localStorage.setItem('ppExtraAnioNatural', ppExtraAnioNatural);
    localStorage.setItem('ppExtraPagas', ppExtraPagas);
    if (ppExtraSignature) localStorage.setItem('ppExtraSignature', ppExtraSignature);
    else localStorage.removeItem('ppExtraSignature');
  }, [
    ppExtraCiudad,
    ppExtraFechaFirma,
    ppExtraNombre,
    ppExtraDni,
    ppExtraAnioNatural,
    ppExtraPagas,
    ppExtraSignature
  ]);

  const handleClearPpExtraForm = () => {
    setPpExtraCiudad('');
    setPpExtraFechaFirma(new Date().toISOString().split('T')[0]);
    setPpExtraNombre('');
    setPpExtraDni('');
    setPpExtraAnioNatural(String(new Date().getFullYear()));
    setPpExtraPagas('14');
    setPpExtraSignature(null);
    localStorage.removeItem('ppExtraSignature');
  };

  const handleClearForm = () => {
    setFormType('pasaje');
    setFormFechaSolicitud(new Date().toISOString().split('T')[0]);
    setFormSolicitanteNombre('');
    setFormAceptaNombre('');
    setFormMotivo('');
    setFormCambioFecha('');
    setFormCambioHoraInicio('');
    setFormCambioHoraFin('');
    setFormCambioTurno('');
    setFormCambioDetails('');
    setFormSolicitadoFecha('');
    setFormSolicitadoHoraInicio('');
    setFormSolicitadoHoraFin('');
    setFormSolicitadoDetails('');
    setSignatureSolicitante(null);
    setSignatureAcepta(null);
    localStorage.removeItem('signatureSolicitante');
    localStorage.removeItem('signatureAcepta');
  };

  const updateCambioDetails = (date: string, start: string, end: string) => {
    if (!date) return;
    let timePart = '';
    if (start && end) {
      timePart = ` de ${start} a ${end}`;
    } else if (start) {
      timePart = ` de ${start}`;
    } else {
      timePart = ` (LIBRE)`;
    }
    setFormCambioDetails(`${formatDateES(date)}${timePart}`);
  };

  const handleCambioFechaChange = (dateVal: string) => {
    setFormCambioFecha(dateVal);
    if (!dateVal) return;
    
    // Find registered shift from the calendar 'shifts' array
    const matchedShift = shifts.find(s => {
      if (!s.date) return false;
      return s.date.substring(0, 10) === dateVal;
    });

    if (matchedShift) {
      if (matchedShift.shifts && matchedShift.shifts.length > 0) {
        // Shift has tramos
        const first = matchedShift.shifts[0];
        setFormCambioHoraInicio(first.start || '');
        setFormCambioHoraFin(first.end || '');
        setFormCambioTurno(`${matchedShift.type} (${first.start} - ${first.end})`);
        updateCambioDetails(dateVal, first.start || '', first.end || '');
      } else {
        // Shift has NO tramos (Libre, Vacaciones, etc.)
        setFormCambioHoraInicio('');
        setFormCambioHoraFin('');
        setFormCambioTurno(matchedShift.type);
        const details = `${formatDateES(dateVal)} (${matchedShift.type.toUpperCase()})`;
        setFormCambioDetails(details);
      }
    } else {
      // No shift in calendar, update with current fields
      setFormCambioHoraInicio('');
      setFormCambioHoraFin('');
      updateCambioDetails(dateVal, '', '');
    }
  };

  const handleCambioHoraInicioChange = (val: string) => {
    setFormCambioHoraInicio(val);
    updateCambioDetails(formCambioFecha, val, formCambioHoraFin);
  };

  const handleCambioHoraFinChange = (val: string) => {
    setFormCambioHoraFin(val);
    updateCambioDetails(formCambioFecha, formCambioHoraInicio, val);
  };

  const updateSolicitadoDetails = (date: string, start: string, end: string) => {
    if (!date) return;
    let timePart = '';
    if (start && end) {
      timePart = ` de ${start} a ${end}`;
    } else if (start) {
      timePart = ` de ${start}`;
    } else {
      timePart = ` (LIBRE)`;
    }
    setFormSolicitadoDetails(`${formatDateES(date)}${timePart}`);
  };

  const handleSolicitadoFechaChange = (dateVal: string) => {
    setFormSolicitadoFecha(dateVal);
    updateSolicitadoDetails(dateVal, formSolicitadoHoraInicio, formSolicitadoHoraFin);
  };

  const handleSolicitadoHoraInicioChange = (val: string) => {
    setFormSolicitadoHoraInicio(val);
    updateSolicitadoDetails(formSolicitadoFecha, val, formSolicitadoHoraFin);
  };

  const handleSolicitadoHoraFinChange = (val: string) => {
    setFormSolicitadoHoraFin(val);
    updateSolicitadoDetails(formSolicitadoFecha, formSolicitadoHoraInicio, val);
  };

  const [activeFormTab, setActiveFormTab] = useState<'formulario' | 'vista'>('formulario');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Helper to format Date string to DD/MM/YYYY local representation
  const formatDateES = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const viewYear = currentMonth.getFullYear();

  // Precedence helper
  const formatCompensar = (hours: number) => {
    const totalMinutes = Math.round(hours * 1.75 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}min`;
  };

  // Days list for active monthly calendar view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate annual stats for Y=viewYear
  const annualStats = useMemo(() => {
    const result: Record<number, { L: number; work: number }> = {
      1: { L: 0, work: 0 },
      2: { L: 0, work: 0 },
      3: { L: 0, work: 0 },
      4: { L: 0, work: 0 },
    };

    const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap(viewYear) ? 366 : 365;

    for (let d = 0; d < daysInYear; d++) {
      const date = new Date(viewYear, 0, 1 + d);
      for (const r of [1, 2, 3, 4]) {
        const s = getRotationShift(date, r, cycleType, { 
          workDays: customWorkDays, 
          freeDays: customFreeDays,
          anchorDate: customAnchorDate,
          firstFreeDay: customFirstFreeDay,
          mixedConfig,
        });
        if (s === 'L') result[r].L++; else result[r].work++;
      }
    }
    return result;
  }, [viewYear, cycleType, customWorkDays, customFreeDays, customAnchorDate, customFirstFreeDay, mixedConfig]);

  // Filtered articles from the convenio based on search query
  const filteredArticles = useMemo(() => {
    if (!convenioQuery.trim()) return [];
    const query = convenioQuery.toLowerCase().trim();
    const results: (Article & { chapterId: string; chapterTitle: string })[] = [];
    
    for (const ch of CONVENIO_DATA) {
      for (const art of ch.articles) {
        const titleMatch = art.title.toLowerCase().includes(query);
        const contentMatch = art.content.toLowerCase().includes(query);
        const chapterMatch = ch.title.toLowerCase().includes(query);
        const articleNumMatch = `articulo ${art.num}`.includes(query) || `artículo ${art.num}`.includes(query);
        
        if (titleMatch || contentMatch || chapterMatch || articleNumMatch) {
          results.push({
            ...art,
            chapterId: ch.id,
            chapterTitle: ch.title,
          });
        }
      }
    }
    return results;
  }, [convenioQuery]);

  const isAdmin = Boolean(user && user.email && ['gelo.mm92@gmail.com', 'angel2martinez92@gmail.com'].includes(user.email.toLowerCase().trim()));

  return (
    <div className="px-1 min-[360px]:px-1.5 sm:px-3 md:px-6 space-y-8 animate-fade-in pb-12 max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto w-full">
      {/* SECCIONES DISTRIBUIDAS EN DOS COLUMNAS EN ESCRITORIO / PC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* SECCIÓN 1: CALENDARIO DE ROTACIONES DE TRABAJO */}
        <div id="calendario-rotaciones-card" className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-fit">
        
        {/* Header de la Sección clickable y con flecha */}
        <div 
          onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
          className="flex items-center justify-between gap-4 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-[#e6f9f3] text-[#059669] dark:bg-emerald-950/50 dark:text-emerald-400 dark:border dark:border-emerald-800/60 rounded-2xl shadow-sm transition-colors duration-200 group-hover:bg-[#d1f5e9] dark:group-hover:bg-emerald-900/60">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">CALENDARIO DE ROTACIONES</h2>
            </div>
          </div>
          <div className="p-2 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300 rounded-xl transition-all duration-200 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 group-hover:text-slate-800 dark:group-hover:text-white">
            <ChevronDown 
              size={20} 
              className={cn("transition-transform duration-300 ease-out", isCalendarExpanded ? "rotate-180" : "rotate-0")} 
            />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isCalendarExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: "1.5rem" }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden space-y-6"
            >
              {/* Segmented Control para Tipo de Ciclo con Botón Lápiz */}
              <div className="space-y-2 max-w-md mx-auto w-full select-none">
                <div className="flex items-center justify-center gap-2 w-full">
                  <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-full p-1 flex-1 select-none gap-0.5">
                    {(['6x3', '4x4'] as const).map((cycle) => {
                      const isSel = cycleType === cycle;
                      return (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => {
                            setCycleType(cycle);
                            if (cycle === '6x3' && selectedRotation === 4) {
                              setSelectedRotation(1);
                            }
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
                      const customLabel = `${customWorkDays}X${customFreeDays}`;
                      const isSel = cycleType === 'custom' || cycleType === `${customWorkDays}x${customFreeDays}`;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setCycleType(`${customWorkDays}x${customFreeDays}`);
                          }}
                          className={cn(
                            "flex-1 py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                            isSel 
                              ? "bg-[#0f172a] dark:bg-slate-800 text-white dark:text-white shadow-md shadow-slate-950/15 dark:border dark:border-slate-700"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                        >
                          {customLabel}
                        </button>
                      );
                    })()}
                    {/* Botón de rotación mixta */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasSavedMixed) {
                          setCustomModalInitialMode('mixed');
                          setIsCustomRotationModalOpen(true);
                        } else {
                          setCycleType('mixed');
                        }
                      }}
                      className={cn(
                        "flex-1 py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300 cursor-pointer text-center",
                        cycleType === 'mixed'
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                      title="Rotación mixta (ej. 5x2 y después 6x3)"
                    >
                      MIXTA
                    </button>
                  </div>

                  {/* Botón (lápiz) para definir ciclos personalizados o mixtos */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomModalInitialMode(cycleType === 'mixed' ? 'mixed' : 'simple');
                      setIsCustomRotationModalOpen(true);
                    }}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-azul-blue dark:hover:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title="Definir ciclo de rotación personalizado o mixto"
                    aria-label="Definir ciclo de rotación personalizado o mixto"
                  >
                    <Pencil size={15} className="stroke-[2.5]" />
                  </button>
                </div>

                {cycleType === 'mixed' && (
                  <div className="flex items-center justify-between gap-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl px-3.5 py-2 text-[10.5px]">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200">
                      Mixta: <strong>{formatMixedRotationShortLabel(mixedConfig)}</strong>
                      {mixedConfig.mode === 'by_date' && mixedConfig.switchDate
                        ? ` · Desde ${safeFormat(parseISO(mixedConfig.switchDate), 'dd/MM/yyyy')}`
                        : ' · Ciclo alterno'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomModalInitialMode('mixed');
                        setIsCustomRotationModalOpen(true);
                      }}
                      className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer shrink-0"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>

              {/* Segmented Control para Rotaciones */}
              <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-full p-1 max-w-md mx-auto w-full select-none gap-0.5">
                {availableRotations.map((rot) => {
                  const isSel = selectedRotation === rot;
                  return (
                    <button
                      key={rot}
                      type="button"
                      onClick={() => setSelectedRotation(rot)}
                      className={cn(
                        "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-wider transition-all duration-300",
                        isSel 
                          ? "bg-[#0f172a] dark:bg-slate-800 text-white dark:text-white shadow-sm dark:border dark:border-slate-700"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      ROTACIÓN {rot}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-100/80 dark:border-slate-800/80 my-4" />

              {/* Cuadrícula del Calendario Visual del Mes (Sin bordes, Ultra-moderno) */}
              <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                className="touch-pan-y relative select-none py-2"
              >
                
                {/* Título de Mes Centrado con Flechas Unidas (Igual que Turnos y Nómina) */}
                <div className="flex justify-center items-center gap-2 mb-6 select-none">
                  <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full p-1 w-full max-w-[280px] sm:max-w-[320px] justify-between shadow-xs">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                      className="p-2 sm:p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-all duration-200 cursor-pointer active:scale-95"
                      title="Mes anterior"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsMonthPickerOpen(true)}
                      className="px-2 sm:px-4 py-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-all active:scale-95 flex items-center justify-center flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="font-black text-[#0f172a] dark:text-white uppercase tracking-tight leading-none text-xs sm:text-sm truncate w-full text-center">
                        {safeFormat(currentMonth, 'MMMM yyyy', { locale: es })}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                      className="p-2 sm:p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-all duration-200 cursor-pointer active:scale-95"
                      title="Mes siguiente"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {!isSameMonth(currentMonth, new Date()) && (
                      <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        type="button"
                        onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                        className="pointer-events-auto flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-azul-blue shadow-md shadow-azul-blue/5 rounded-full border border-azul-blue transition-all hover:bg-azul-blue/5 dark:hover:bg-azul-blue/20 active:scale-95 shrink-0 select-none font-black leading-none w-10 h-10 cursor-pointer"
                        title="Volver al mes actual"
                      >
                        <span className="leading-none text-[14px]">📅</span>
                        <span className="text-[6.5px] font-black tracking-tighter leading-none mt-0.5">HOY</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Días de la Semana */}
                <div className="grid grid-cols-7 text-center pb-2 mb-2 select-none">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((dayName) => (
                    <span key={dayName} className="text-xs font-extrabold text-slate-400/80 dark:text-slate-400 uppercase tracking-widest">
                      {dayName}
                    </span>
                  ))}
                </div>

                {/* Días del Mes */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                  {/* Espacios vacíos del principio del mes */}
                  {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square flex items-center justify-center text-transparent" />
                  ))}
                  
                  {/* Días con turnos de rotación */}
                  {days.map((day) => {
                    const shift = getRotationShift(day, selectedRotation, cycleType, { 
                      workDays: customWorkDays, 
                      freeDays: customFreeDays,
                      anchorDate: customAnchorDate,
                      firstFreeDay: customFirstFreeDay,
                      mixedConfig,
                    });
                    const isTodayDay = isToday(day);
                    const dayIso = safeFormat(day, 'yyyy-MM-dd');
                    
                    const dayMonth = day.getMonth(); // 0-11
                    const dayDate = day.getDate(); // 1-31
                    const isFixedHoliday = !isSunday(day) && (
                      (dayMonth === 0 && dayDate === 1) ||   // 1 Enero
                      (dayMonth === 0 && dayDate === 6) ||   // 6 Enero
                      (dayMonth === 2 && dayDate === 19) ||  // 19 Marzo
                      (dayMonth === 4 && dayDate === 1) ||   // 1 Mayo
                      (dayMonth === 5 && dayDate === 24) ||  // 24 Junio
                      (dayMonth === 7 && dayDate === 15) ||  // 15 Agosto
                      (dayMonth === 9 && dayDate === 9) ||   // 9 Octubre
                      (dayMonth === 9 && dayDate === 12) ||  // 12 Octubre
                      (dayMonth === 10 && dayDate === 1) ||  // 1 Noviembre
                      (dayMonth === 11 && dayDate === 6) ||  // 6 Diciembre
                      (dayMonth === 11 && dayDate === 8) ||  // 8 Diciembre
                      (dayMonth === 11 && dayDate === 25)    // 25 Diciembre
                    );
                    const isUserHoliday = settings?.holidays ? settings.holidays.includes(dayIso) : false;
                    const isFestivo = isFixedHoliday || isUserHoliday;

                    const isVacation = Boolean(
                      (settings?.vacations && settings.vacations.includes(dayIso)) ||
                      (shifts && shifts.some(s => s.date === dayIso && s.type === 'Vacaciones'))
                    );

                    // Color styles for shift cells matching the design image precisely with dark mode contrast
                    let cellClass = "";
                    let numClass = "";
                    
                    if (isVacation) {
                      cellClass = "bg-[#facc15] dark:bg-yellow-400 border border-yellow-500/40 dark:border-yellow-300/50 shadow-sm hover:bg-[#eab308] dark:hover:bg-yellow-300";
                      numClass = "text-[#0f274a] dark:text-[#0b1b36] font-black";
                    } else if (shift === 'L') {
                      cellClass = "bg-[#10b981] dark:bg-emerald-600/90 border border-[#059669]/20 dark:border-emerald-500/50 text-white shadow-sm hover:bg-[#09aa77] dark:hover:bg-emerald-500";
                      numClass = "text-white font-black";
                    } else if (shift === 'M') {
                      cellClass = "bg-[#ebf3ff] dark:bg-blue-950/70 border border-[#dbeafe] dark:border-blue-700/60 text-[#1e40af] dark:text-blue-200 hover:bg-[#dbeafe] dark:hover:bg-blue-900/60";
                      numClass = "text-[#1e40af] dark:text-blue-100 font-black";
                    } else if (shift === 'T') {
                      cellClass = "bg-[#fffbeb] dark:bg-amber-950/70 border border-[#fef3c7] dark:border-amber-700/60 text-[#b45309] dark:text-amber-200 hover:bg-[#fef3c7] dark:hover:bg-amber-900/60";
                      numClass = "text-[#b45309] dark:text-amber-100 font-black";
                    }

                    return (
                      <div 
                        key={day.toISOString()}
                        className={cn(
                          "aspect-square rounded-[1.25rem] flex items-center justify-center transition-all duration-300 hover:scale-[1.03] select-none relative shadow-sm",
                          cellClass,
                          isTodayDay && "ring-2 ring-inset ring-blue-600 animate-pulse scale-[1.04]",
                          isFestivo && "ring-1 ring-inset ring-rose-400/50 dark:ring-rose-400/80"
                        )}
                      >
                        {isFestivo && !isVacation ? (
                          <span className="text-[11px] sm:text-xs font-black w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full border-2 border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-400 dark:bg-rose-950/90 dark:text-rose-100 dark:shadow-[0_0_8px_rgba(244,63,94,0.45)] shadow-xs leading-none shrink-0 font-black">
                            {day.getDate()}
                          </span>
                        ) : (
                          <span className={cn("text-xs sm:text-base font-black leading-none", numClass)}>
                            {day.getDate()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Leyenda de Colores */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6 select-none bg-slate-50 dark:bg-slate-950/80 border border-slate-100 dark:border-slate-800 p-3 sm:p-3.5 rounded-[2rem]">
                  <div className="px-3 sm:px-4 py-1.5 rounded-xl bg-[#ebf3ff] dark:bg-blue-950/70 border border-[#dbeafe] dark:border-blue-700/60 flex items-center justify-center shadow-xs">
                    <span className="text-[10px] sm:text-xs font-black text-[#1e40af] dark:text-blue-200 uppercase tracking-widest">Mañana</span>
                  </div>
                  <div className="px-3 sm:px-4 py-1.5 rounded-xl bg-[#fffbeb] dark:bg-amber-950/70 border border-[#fef3c7] dark:border-amber-700/60 flex items-center justify-center shadow-xs">
                    <span className="text-[10px] sm:text-xs font-black text-[#b45309] dark:text-amber-200 uppercase tracking-widest">Tarde</span>
                  </div>
                  <div className="px-3 sm:px-4 py-1.5 rounded-xl bg-[#10b981] dark:bg-emerald-600/90 border border-[#059669]/20 dark:border-emerald-500/60 flex items-center justify-center shadow-xs">
                    <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-widest">Libre</span>
                  </div>
                  <div className="px-3 sm:px-4 py-1.5 rounded-xl bg-[#facc15] dark:bg-yellow-400 border border-yellow-500/40 dark:border-yellow-300/50 flex items-center justify-center shadow-xs">
                    <span className="text-[10px] sm:text-xs font-black text-[#0f274a] dark:text-[#0b1b36] uppercase tracking-widest">Vacaciones</span>
                  </div>
                </div>

                {/* Estadísticas Anuales Integradas en el Card */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left select-none">
                  <div>
                    <h4 className="text-xs font-black text-[#0f172a] dark:text-white uppercase tracking-wider">Estadísticas Anuales {viewYear}</h4>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest leading-none mt-0.5">Resumen de rotación {selectedRotation}</p>
                  </div>
                  <div className="flex gap-4 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-initial bg-[#059669]/5 dark:bg-emerald-950/40 rounded-2xl px-4 py-2 border border-[#059669]/10 dark:border-emerald-800/50 flex flex-col items-center sm:items-start min-w-[100px]">
                      <span className="text-[9px] font-bold text-[#059669] dark:text-emerald-300 uppercase tracking-widest leading-none">Libranzas</span>
                      <span className="text-sm sm:text-base font-black text-[#059669] dark:text-emerald-300 mt-1">{annualStats[selectedRotation].L} días</span>
                    </div>
                    <div className="flex-1 sm:flex-initial bg-slate-50 dark:bg-slate-950/60 rounded-2xl px-4 py-2 border border-transparent dark:border-slate-800 flex flex-col items-center sm:items-start min-w-[100px]">
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Trabajados</span>
                      <span className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-200 mt-1">{annualStats[selectedRotation].work} días</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SECCIÓN: I CONVENIO AZUL HANDLING */}
      <div id="convenio-card" className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-fit">
        
        {/* Header de la Sección clickable y con flecha */}
        <div 
          onClick={() => setIsConvenioExpanded(!isConvenioExpanded)}
          className="flex items-center justify-between gap-4 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded-2xl shadow-sm transition-colors duration-200 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">I Convenio Azul Handling</h2>
            </div>
          </div>
          <div className="p-2 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl transition-all duration-200 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 group-hover:text-slate-800 dark:group-hover:text-white">
            <ChevronDown 
              size={20} 
              className={cn("transition-transform duration-300 ease-out", isConvenioExpanded ? "rotate-180" : "rotate-0")} 
            />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isConvenioExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: "1.5rem" }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden space-y-6"
            >
              {/* Search Bar inside Convenio */}
              <div className="relative max-w-lg mx-auto w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input
                  id="convenio-search"
                  type="text"
                  value={convenioQuery}
                  onChange={(e) => setConvenioQuery(e.target.value)}
                  placeholder="Buscar artículo, capítulo o palabra clave..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
                />
                {convenioQuery && (
                  <button
                    id="clear-convenio-search"
                    onClick={() => setConvenioQuery('')}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Grid of Results / Chapters */}
              {convenioQuery.trim() !== '' ? (
                // Search Results
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                    RESULTADOS DE BÚSQUEDA ({filteredArticles.length})
                  </h4>
                  {filteredArticles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1 pb-1">
                      {filteredArticles.map((art) => (
                        <div
                          key={`${art.chapterId}-${art.num}`}
                          onClick={() => setSelectedArticle({ ...art, chapterTitle: art.chapterTitle })}
                          className="convenio-article-item p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-sm"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
                              {art.chapterId}
                            </span>
                            <span className="text-slate-300 font-bold">•</span>
                            <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider">
                              Artículo {art.num}
                            </span>
                          </div>
                          <h5 className="text-sm font-extrabold text-[#0f172a] truncate mb-1">
                            {highlightText(art.title, convenioQuery)}
                          </h5>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {highlightText(art.content, convenioQuery)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-sm font-bold">No se encontraron artículos con esa palabra.</p>
                      <p className="text-xs">Prueba con otro término como "salario", "jornada", "vacaciones" o "faltas".</p>
                    </div>
                  )}
                </div>
              ) : (
                // Chapters List (Default State)
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-2">
                    Capítulos del Convenio
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {CONVENIO_DATA.map((ch) => (
                      <button
                        key={ch.id}
                        id={`btn-${ch.id.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={() => setSelectedChapter(ch)}
                        className="convenio-chapter-btn p-3.5 bg-slate-50/60 hover:bg-[#e6f2ff] hover:text-blue-800 border border-slate-200/50 rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between h-24 group"
                      >
                        <div>
                          <span className="text-[9px] font-extrabold text-blue-600 group-hover:text-blue-700 uppercase tracking-widest mb-1 block">
                            {ch.id.toUpperCase()}
                          </span>
                          <h4 className="text-sm font-black text-slate-800 group-hover:text-blue-900 uppercase tracking-wide line-clamp-2 leading-snug">
                            {ch.title}
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 self-end">
                          {ch.articles.length} artículos →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Conversor de Horas Perentorias */}
      <div id="conversor-horas-card" className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-fit">
        <div 
          onClick={() => setIsPerentExpanded(!isPerentExpanded)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 rounded-2xl">
              <TrendingUp size={20} />
            </div>
            <div className="text-left">
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">Conversor de Horas Perentorias</h3>
            </div>
          </div>
          <div className="p-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            <ChevronDown className={cn("h-5 w-5 text-slate-500 dark:text-slate-300 transition-transform duration-300", isPerentExpanded ? "rotate-180" : "")} />
          </div>
        </div>
        
        <AnimatePresence initial={false}>
          {isPerentExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 16 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="w-full">
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-widest mb-1.5 leading-tight">H. Perentorias</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.25"
                      value={perentInput}
                      onChange={(e) => setPerentInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50/60 hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-black text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-200"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">h</span>
                  </div>
                </div>
                
                <div className="w-full bg-purple-50/60 dark:bg-purple-950/30 rounded-xl p-3 border border-purple-100 dark:border-purple-800/50 flex flex-col justify-center min-h-[58px]">
                  <label className="block text-[10px] font-black text-purple-400 dark:text-purple-300 uppercase tracking-widest mb-1 leading-tight">Compensar (x1.75)</label>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-purple-600 dark:text-purple-300">
                      {formatCompensar(parseFloat(perentInput) || 0)}
                    </span>
                    <span className="text-[10px] font-bold text-purple-400 dark:text-purple-300">h</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cambio de Turnos Section */}
      <div id="comprobar-horas-card" className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-fit">
        <div 
          onClick={() => setIsTurnosExpanded(!isTurnosExpanded)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 rounded-2xl">
              <ArrowLeftRight size={20} />
            </div>
            <div className="text-left">
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">Comprobar Horas x Horas</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {isTurnosExpanded && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setComparisonA([{ start: '', end: '' }]);
                    setComparisonB([{ start: '', end: '' }]);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors group cursor-pointer animate-fade-in"
                >
                  <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Limpiar</span>
                </motion.button>
              )}
            </AnimatePresence>
            <div className="p-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
              <ChevronDown className={cn("h-5 w-5 text-slate-500 dark:text-slate-300 transition-transform duration-300", isTurnosExpanded ? "rotate-180" : "")} />
            </div>
          </div>
        </div>

          <AnimatePresence initial={false}>
            {isTurnosExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden space-y-4 pt-3 border-t border-slate-100"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Turno A */}
                  <div className="space-y-3 p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 hover:border-purple-400 transition-all duration-200">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TURNO A</span>
                      <span className="text-xs font-black text-purple-600">
                        {formatNumber(comparisonA.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0))}h
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {comparisonA.map((sh, idx) => (
                        <div key={idx} className="flex gap-1.5 items-center">
                          <input
                            type="time"
                            value={sh.start}
                            onChange={(e) => {
                              const newA = [...comparisonA];
                              newA[idx].start = e.target.value;
                              setComparisonA(newA);
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-purple-400 focus:bg-white outline-none text-center font-sans tracking-wide hover:border-purple-300 transition-all"
                          />
                          <span className="text-slate-300 font-bold">-</span>
                          <input
                            type="time"
                            value={sh.end}
                            onChange={(e) => {
                              const newA = [...comparisonA];
                              newA[idx].end = e.target.value;
                              setComparisonA(newA);
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-purple-400 focus:bg-white outline-none text-center font-sans tracking-wide hover:border-purple-300 transition-all"
                          />
                          {comparisonA.length > 1 && (
                            <button
                              onClick={() => setComparisonA(comparisonA.filter((_, i) => i !== idx))}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setComparisonA([...comparisonA, { start: '', end: '' }])}
                        className="w-full py-1.5 border border-dashed border-slate-250 rounded-lg text-[9px] font-black text-slate-400 hover:border-purple-400 hover:text-purple-600 hover:bg-white transition-colors cursor-pointer"
                      >
                        + TRAMO
                      </button>
                    </div>
                  </div>

                  {/* Turno B */}
                  <div className="space-y-3 p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 hover:border-purple-400 transition-all duration-200">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TURNO B</span>
                      <span className="text-xs font-black text-purple-600">
                        {formatNumber(comparisonB.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0))}h
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {comparisonB.map((sh, idx) => (
                        <div key={idx} className="flex gap-1.5 items-center">
                          <input
                            type="time"
                            value={sh.start}
                            onChange={(e) => {
                              const newB = [...comparisonB];
                              newB[idx].start = e.target.value;
                              setComparisonB(newB);
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-purple-400 focus:bg-white outline-none text-center font-sans tracking-wide hover:border-purple-300 transition-all"
                          />
                          <span className="text-slate-300 font-bold">-</span>
                          <input
                            type="time"
                            value={sh.end}
                            onChange={(e) => {
                              const newB = [...comparisonB];
                              newB[idx].end = e.target.value;
                              setComparisonB(newB);
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-purple-400 focus:bg-white outline-none text-center font-sans tracking-wide hover:border-purple-300 transition-all"
                          />
                          {comparisonB.length > 1 && (
                            <button
                              onClick={() => setComparisonB(comparisonB.filter((_, i) => i !== idx))}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setComparisonB([...comparisonB, { start: '', end: '' }])}
                        className="w-full py-1.5 border border-dashed border-slate-250 rounded-lg text-[9px] font-black text-slate-400 hover:border-purple-400 hover:text-purple-600 hover:bg-white transition-colors cursor-pointer"
                      >
                        + TRAMO
                      </button>
                    </div>
                  </div>
                </div>

                {/* Difference */}
                <div className="pt-3 border-t border-slate-100 flex flex-col items-center gap-1.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Diferencia</span>
                  <div className={cn(
                    "text-lg font-black px-4 py-1.5 rounded-xl transition-all",
                    (() => {
                      const totalA = comparisonA.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                      const totalB = comparisonB.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                      const diff = totalA - totalB;
                      if (diff === 0) return "bg-slate-50 text-slate-400";
                      return diff > 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100";
                    })()
                  )}>
                    {(() => {
                      const totalA = comparisonA.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                      const totalB = comparisonB.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                      const diff = totalA - totalB;
                      return `${diff > 0 ? '+' : ''}${formatNumber(diff)}h`;
                    })()}
                  </div>
                  <p className="text-[10px] font-bold text-slate-450 italic text-center leading-tight">
                    {(() => {
                      const totalA = comparisonA.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                      const totalB = comparisonB.reduce((acc, s) => acc + getShiftDuration(s.start, s.end), 0);
                      const diff = totalA - totalB;
                      if (diff === 0) return "Los turnos están equilibrados.";
                      if (diff > 0) return `El Turno A tiene ${formatNumber(diff)}h más que el Turno B.`;
                      return `El Turno B tiene ${formatNumber(Math.abs(diff))}h más que el Turno A.`;
                    })()}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Baja IT Section */}
        <div id="baja-laboral-card" className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-fit col-span-1">
          <div
            onClick={() => setIsBajaItExpanded(!isBajaItExpanded)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2.5">
              <div id="baja-laboral-icon" className="baja-icon-box p-2.5 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-transparent dark:border-rose-400 rounded-2xl shadow-sm">
                <Stethoscope size={20} />
              </div>
              <div className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">
                    Baja laboral/Enfermedad común
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
                    En pruebas
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bajaItDates.length > 0 && (
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:border dark:border-slate-700 text-[10px] font-black uppercase tracking-wider">
                  {bajaItDates.length} {bajaItDates.length === 1 ? 'día en Turnos' : 'días en Turnos'}
                </span>
              )}
              <div className="p-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
                <ChevronDown className={cn("h-5 w-5 text-slate-500 dark:text-slate-300 transition-transform duration-300", isBajaItExpanded ? "rotate-180" : "")} />
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isBajaItExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800"
              >
                {/* Cartel informativo de fase de prueba */}
                <div className="bg-amber-50/90 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-900/50 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                  <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 leading-snug">
                    <span className="font-black uppercase tracking-wider block text-[9.5px] text-amber-700 dark:text-amber-400 mb-0.5">
                      Sección en fase de prueba
                    </span>
                    Esta sección se encuentra actualmente en fase de prueba y los importes resultantes son orientativos y pueden no ser correctos.
                  </p>
                </div>

                {/* SELECTOR DE TIPO DE BAJA: BAJA LABORAL vs ENFERMEDAD COMÚN */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                        Tipo de Contingencia
                      </span>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        Selecciona el tipo de baja a calcular
                      </h4>
                    </div>
                    <span className={cn(
                      "px-2.5 py-1 rounded-xl text-[9.5px] font-black uppercase tracking-wider border",
                      bajaType === 'laboral'
                        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60"
                        : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60"
                    )}>
                      {bajaType === 'laboral' ? 'Contingencias Profesionales (100% Convenio)' : 'Contingencias Comunes (Tramos Ley)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setBajaType('comun')}
                      className={cn(
                        "py-3 px-4 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3.5",
                        bajaType === 'comun'
                          ? "bg-slate-900 dark:bg-slate-800 text-white shadow-sm dark:border dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      )}
                    >
                      <div className={cn("p-2.5 rounded-xl shrink-0 transition-colors", bajaType === 'comun' ? "bg-white/10 text-white" : "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400")}>
                        <Stethoscope size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-tight">Baja por Enfermedad Común</div>
                        <div className={cn("text-[10px] font-bold truncate", bajaType === 'comun' ? "text-slate-300" : "text-slate-400 dark:text-slate-500")}>
                          Accidente no laboral • Tramos 0%, 60% y 75% BR
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBajaType('laboral')}
                      className={cn(
                        "py-3 px-4 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3.5",
                        bajaType === 'laboral'
                          ? "bg-slate-900 dark:bg-slate-800 text-white shadow-sm dark:border dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      )}
                    >
                      <div className={cn("p-2.5 rounded-xl shrink-0 transition-colors", bajaType === 'laboral' ? "bg-amber-400/20 text-amber-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400")}>
                        <ShieldAlert size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-tight">Baja Laboral (Accidente de Trabajo)</div>
                        <div className={cn("text-[10px] font-bold truncate", bajaType === 'laboral' ? "text-slate-300" : "text-slate-400 dark:text-slate-500")}>
                          Enf. profesional • 75% Mutua + 25% Convenio (100%)
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* BLOQUE 1: MARCAR DÍAS SUELTOS O TRAMOS DE BAJA IT EN LA PESTAÑA TURNOS */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={15} className="text-rose-500" />
                        Marcar Días o Tramos de Baja IT en Turnos
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        Los días o tramos añadidos aquí se muestran automáticamente como <span className="font-black text-slate-700 dark:text-slate-200">Baja IT</span> en la pestaña Turnos.
                      </p>
                    </div>
                    {bajaItDates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBajaDates(bajaItDates)}
                        className="flex items-center gap-1 px-2.5 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        <Trash2 size={13} />
                        Limpiar Todo
                      </button>
                    )}
                  </div>

                  {/* Selector Día Suelto vs Tramo / Rango */}
                  <div className="flex p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 max-w-sm">
                    <button
                      type="button"
                      onClick={() => setBajaInputMode('single')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                        bajaInputMode === 'single'
                          ? "bg-slate-900 dark:bg-slate-800 text-white shadow-xs dark:border dark:border-slate-700"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      Día Suelto
                    </button>
                    <button
                      type="button"
                      onClick={() => setBajaInputMode('range')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                        bajaInputMode === 'range'
                          ? "bg-slate-900 dark:bg-slate-800 text-white shadow-xs dark:border dark:border-slate-700"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      Tramo / Rango
                    </button>
                  </div>

                  {bajaInputMode === 'range' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                          Fecha de Inicio de Baja
                        </label>
                        <button
                          type="button"
                          onClick={() => setBajaRangePickerStep('start')}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs font-black text-slate-800 dark:text-white flex items-center justify-between cursor-pointer"
                        >
                          <span className={cn(!bajaRangeStart && "text-slate-400 dark:text-slate-500 font-bold")}>
                            {bajaRangeStart && isValid(parseISO(bajaRangeStart))
                              ? safeFormat(parseISO(bajaRangeStart), 'dd/MM/yyyy')
                              : 'dd/mm/aaaa'}
                          </span>
                          <Calendar size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                          Fecha de Fin / Alta
                        </label>
                        <button
                          type="button"
                          onClick={() => setBajaRangePickerStep(bajaRangeStart ? 'end' : 'start')}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs font-black text-slate-800 dark:text-white flex items-center justify-between cursor-pointer"
                        >
                          <span className={cn(!bajaRangeEnd && "text-slate-400 dark:text-slate-500 font-bold")}>
                            {bajaRangeEnd && isValid(parseISO(bajaRangeEnd))
                              ? safeFormat(parseISO(bajaRangeEnd), 'dd/MM/yyyy')
                              : 'dd/mm/aaaa'}
                          </span>
                          <Calendar size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddRangeBajaIt}
                        disabled={!bajaRangeStart || !bajaRangeEnd}
                        className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border dark:border-slate-700 text-white py-2.5 px-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer h-[42px]"
                      >
                        <Plus size={15} />
                        <span>Añadir Tramo a Turnos</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                          Seleccionar Día de Baja IT
                        </label>
                        <input
                          type="date"
                          value={bajaSingleDate}
                          onChange={(e) => setBajaSingleDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSingleBajaIt}
                        disabled={!bajaSingleDate}
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border dark:border-slate-700 text-white py-2.5 px-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer h-[42px]"
                      >
                        <Plus size={15} />
                        <span>Añadir Día a Turnos</span>
                      </button>
                    </div>
                  )}

                  {/* Lista de tramos / días de Baja IT activos en Turnos */}
                  {bajaItTramos.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          Bajas registradas en Turnos (pulsa una para calcular su prestación)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bajaItTramos.map((tramo) => {
                          const isSelected = activeBajaTramo?.id === tramo.id && selectedBajaTramoId !== 'custom';
                          const labelText =
                            tramo.daysCount === 1
                              ? safeFormat(parseISO(tramo.start), 'dd MMM yyyy', { locale: es })
                              : `${safeFormat(parseISO(tramo.start), 'dd MMM', { locale: es })} - ${safeFormat(parseISO(tramo.end), 'dd MMM yyyy', { locale: es })}`;
                          return (
                            <div
                              key={tramo.id}
                              onClick={() => setSelectedBajaTramoId(tramo.id)}
                              className={cn(
                                "group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer",
                                isSelected
                                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700 shadow-sm"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:border-slate-700"
                              )}
                            >
                              <span>{labelText}</span>
                              <span
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded-md font-black",
                                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                )}
                              >
                                {tramo.daysCount} {tramo.daysCount === 1 ? 'día' : 'días'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveBajaDates(tramo.dates);
                                }}
                                className={cn(
                                  "p-1 rounded-lg transition-colors",
                                  isSelected
                                    ? "text-white/70 hover:bg-rose-500 hover:text-white"
                                    : "text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                )}
                                title="Quitar Baja IT de Turnos"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setSelectedBajaTramoId('custom')}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer",
                            selectedBajaTramoId === 'custom'
                              ? "bg-azul-blue text-white border-azul-blue shadow-xs"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:border-slate-700"
                          )}
                        >
                          Simular otros días
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl p-3 border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        No hay días marcados como <span className="font-black text-slate-600 dark:text-slate-300">Baja IT</span> en el calendario de Turnos. Añade un día o tramo arriba para reflejarlo en Turnos o simula los días abajo.
                      </p>
                    </div>
                  )}
                </div>

                {/* BLOQUE 2: CONFIGURACIÓN DEL CÁLCULO SEGÚN CONTRATO Y ORIGEN DE LAS BASES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tipo de Contrato (según Configuración) */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Contrato en Configuración
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-slate-800 dark:text-white uppercase">
                        Jornada {bajaCalculation.contractType === 'Completo' ? 'Completa' : 'Parcial'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-azul-blue/10 dark:bg-azul-blue/20 text-azul-blue text-[9px] font-black uppercase">
                        {bajaCalculation.isParcial ? 'Media 3 nóminas' : '1 nómina ant.'}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 mt-1 leading-tight">
                      {bajaCalculation.isParcial
                        ? 'Requiere la media de las BCCC de los 3 meses anteriores a la baja.'
                        : 'Requiere la BCCC del mes inmediatamente anterior a la baja.'}
                    </span>
                  </div>

                  {/* Mes de inicio de la Baja y Días a calcular */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Mes de la Baja
                      </label>
                      <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase">
                        {bajaCalculation.totalDays} {bajaCalculation.totalDays === 1 ? 'día' : 'días'} de baja
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200/80 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setBajaRefMonth(prev => subMonths(prev, 1))}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase">
                        {safeFormat(bajaRefMonth, 'MMM yyyy', { locale: es })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBajaRefMonth(prev => addMonths(prev, 1))}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    {(!activeBajaTramo || selectedBajaTramoId === 'custom') && (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Días a simular:</span>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={bajaCustomDays}
                          onChange={(e) => setBajaCustomDays(e.target.value)}
                          className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-black text-center text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-azul-blue/30"
                        />
                      </div>
                    )}
                  </div>

                  {/* Origen de Datos: Nóminas de la App vs Manual */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                      Origen de Bases de Cotización
                    </label>
                    <div className="grid grid-cols-2 bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200/80 dark:border-slate-800 gap-1">
                      <button
                        type="button"
                        onClick={() => setBajaDataSource('app')}
                        className={cn(
                          "py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                          bajaDataSource === 'app'
                            ? "bg-azul-blue text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                      >
                        Nóminas App
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBajaDataSource('manual');
                          if (!bajaManualBase1) setBajaManualBase1(String(bajaCalculation.monthsData[0].base));
                          if (!bajaManualBase2) setBajaManualBase2(String(bajaCalculation.monthsData[1].base));
                          if (!bajaManualBase3) setBajaManualBase3(String(bajaCalculation.monthsData[2].base));
                        }}
                        className={cn(
                          "py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                          bajaDataSource === 'manual'
                            ? "bg-azul-blue text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                      >
                        Manual
                      </button>
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 mt-1 leading-tight">
                      {bajaDataSource === 'app'
                        ? 'Toma la Base de Contingencias Comunes de tus nóminas en la app.'
                        : 'Introduce manualmente la(s) Base(s) de Contingencias Comunes.'}
                    </span>
                  </div>
                </div>

                {/* BLOQUE 3: BASES DE COTIZACIÓN Y BASE REGULADORA DIARIA */}
                <div className="bg-slate-50/60 dark:bg-slate-950/60 p-4 rounded-3xl border border-slate-200/70 dark:border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Calculator size={15} className="text-azul-blue" />
                      {bajaType === 'laboral'
                        ? 'Base de Contingencias Profesionales (BCP) y Horas Extras'
                        : bajaCalculation.isParcial
                          ? 'Bases de Contingencias Comunes (3 Meses Anteriores)'
                          : 'Base de Contingencias Comunes (Mes Anterior)'}
                    </h4>
                    <span className="text-[10px] font-black text-azul-blue bg-azul-blue/10 dark:bg-azul-blue/20 px-2.5 py-1 rounded-xl uppercase">
                      Base Reguladora: {formatCurrency(bajaCalculation.baseReguladoraDiaria)} / día
                    </span>
                  </div>

                  {bajaCalculation.isParcial ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[0, 1, 2].map((idx) => {
                        const mInfo = bajaCalculation.monthsData[idx];
                        const manualVal = idx === 0 ? bajaManualBase1 : idx === 1 ? bajaManualBase2 : bajaManualBase3;
                        const setManualVal = idx === 0 ? setBajaManualBase1 : idx === 1 ? setBajaManualBase2 : setBajaManualBase3;
                        return (
                          <div key={mInfo.monthKey} className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">
                                {mInfo.label}
                              </span>
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {bajaDataSource === 'manual' ? 'Manual' : mInfo.source}
                              </span>
                            </div>
                            {bajaDataSource === 'manual' ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={manualVal}
                                  onChange={(e) => setManualVal(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-azul-blue/20"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 dark:text-slate-500">€</span>
                              </div>
                            ) : (
                              <div className="text-lg font-black text-slate-800 dark:text-white">
                                {formatCurrency(mInfo.base)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">
                            Mes anterior ({bajaCalculation.monthsData[0].label})
                          </span>
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {bajaDataSource === 'manual' ? 'Manual' : bajaCalculation.monthsData[0].source}
                          </span>
                        </div>
                        {bajaDataSource === 'manual' ? (
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={bajaManualBase1}
                              onChange={(e) => setBajaManualBase1(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-azul-blue/20"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 dark:text-slate-500">€</span>
                          </div>
                        ) : (
                          <div className="text-lg font-black text-slate-800 dark:text-white">
                            {formatCurrency(bajaCalculation.monthsData[0].base)}
                          </div>
                        )}
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-center">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          Base Reguladora Ordinaria ({bajaCalculation.contractType === 'Completo' ? '30 días' : 'Media'})
                        </span>
                        <span className="text-sm font-black text-slate-800 dark:text-white mt-1">
                          {formatCurrency(bajaCalculation.monthlyReferenceBase)} ÷ 30 ={' '}
                          <span className="text-azul-blue">{formatCurrency(bajaCalculation.baseReguladoraOrdinariaDiaria)}/día</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Mejora 1: Inclusión de Horas Extras anuales en la Base Reguladora de Baja Laboral */}
                  {bajaType === 'laboral' && (
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-amber-200/90 dark:border-amber-800/60 shadow-2xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                            <Briefcase size={13} className="text-amber-600 dark:text-amber-400" />
                            Horas Extras cotizadas en los 12 meses anteriores (Art. 173 LGSS)
                          </span>
                          <p className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 leading-tight">
                            En accidente laboral se suma a la base ordinaria el promedio anual de horas extras (importe anual ÷ 365 días).
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Total H.Extras:</span>
                          <div className="relative w-28">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bajaHorasExtrasAnuales}
                              onChange={(e) => setBajaHorasExtrasAnuales(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-black text-right text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400 dark:text-slate-500">€</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                        <span className="font-bold text-slate-500 dark:text-slate-400">
                          Base Ordinaria ({formatCurrency(bajaCalculation.baseReguladoraOrdinariaDiaria)}/d) + Promedio H.Extras ({formatCurrency(bajaCalculation.horasExtrasPromedioDiario)}/d)
                        </span>
                        <span className="font-black text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60">
                          Base Reguladora Diaria Definitiva: {formatCurrency(bajaCalculation.baseReguladoraDiaria)} / día
                        </span>
                      </div>
                    </div>
                  )}

                  {bajaCalculation.isParcial && (
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400">
                        Media de las 3 nóminas anteriores:{' '}
                        <span className="font-black text-slate-800 dark:text-white">{formatCurrency(bajaCalculation.monthlyReferenceBase)} / mes</span>
                      </span>
                      <span className="font-bold text-slate-500 dark:text-slate-400">
                        Base Reguladora Diaria (÷ 30):{' '}
                        <span className="font-black text-azul-blue">{formatCurrency(bajaCalculation.baseReguladoraDiaria)} / día</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* BLOQUE 4: DESGLOSE DE LOS TRAMOS DE LA BAJA Y % DE COBRO */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      {bajaType === 'laboral' ? 'Desglose de Prestación por Baja Laboral' : 'Desglose por Tramos de Baja IT y % de Cobro'}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {bajaType === 'laboral' ? 'Contingencias Profesionales (Accidente de Trabajo / Enf. Profesional)' : 'Contingencias Comunes (Enfermedad Común / Acc. No Laboral)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {bajaCalculation.brackets.map((b) => {
                      const hasDays = b.daysInBracket > 0;
                      return (
                        <div
                          key={b.id}
                          className={cn(
                            "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3",
                            hasDays
                              ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-xs"
                              : "bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60 opacity-75"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-800 dark:text-white uppercase">
                                {b.label}
                              </span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                  b.pct === 0
                                    ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    : b.pct === 25
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                                      : b.pct === 60 || b.pct === 75
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                )}
                              >
                                {b.pct}% BR
                              </span>
                            </div>
                            <p className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 leading-tight">
                              {b.sublabel}
                            </p>
                            <span className="inline-block text-[8.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {b.payer}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              <span>Importe diario ({b.pct}%):</span>
                              <span className="font-black text-slate-700 dark:text-slate-200">{formatCurrency(b.dailyAmount)}/día</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              <span>Días en este concepto:</span>
                              <span className="font-black text-slate-800 dark:text-white">{b.daysInBracket} {b.daysInBracket === 1 ? 'día' : 'días'}</span>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Subtotal</span>
                              <span className={cn("text-base font-black", hasDays && b.totalAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                                {formatCurrency(b.totalAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Nota Art. 60 I Convenio Azul Handling según tipo de baja */}
                  {bajaType === 'laboral' ? (
                    <div className="bg-amber-50/70 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-900/50 rounded-2xl p-3 flex items-start gap-2.5">
                      <ShieldAlert size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                        <span className="font-black text-amber-700 dark:text-amber-400 uppercase">I Convenio Colectivo Azul Handling (Art. 60 - Accidente Laboral):</span>{' '}
                        En accidente de trabajo o enfermedad profesional la empresa complementa la prestación económica de la Mutua/Seguridad Social hasta el <span className="font-black text-slate-800 dark:text-white">100% del salario fijo desde el 1.er día</span> de la baja médica. Asimismo, el día en que ocurre el accidente laboral la empresa debe abonar el salario ordinario íntegro como día de trabajo normal.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-blue-50/60 border border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/50 rounded-2xl p-3 flex items-start gap-2.5">
                      <Info size={15} className="text-azul-blue dark:text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                        <span className="font-black text-azul-blue dark:text-blue-400 uppercase">Complemento I Convenio Azul Handling (Art. 60):</span>{' '}
                        En enfermedad común, la empresa complementa hasta el <span className="font-black text-slate-800 dark:text-white">85% del salario fijo</span> a partir del <span className="font-black text-slate-800 dark:text-white">día 40º</span> de baja, y hasta el <span className="font-black text-slate-800 dark:text-white">100% del salario fijo</span> a partir del <span className="font-black text-slate-800 dark:text-white">día 75º</span>. En accidente de trabajo o enfermedad profesional se complementa hasta el <span className="font-black text-slate-800 dark:text-white">100% del salario fijo</span> desde el 1.er día.
                      </p>
                    </div>
                  )}
                </div>

                {/* MEJORA 2: DESGLOSE Y DISTRIBUCIÓN POR MESES NATURALES / NÓMINAS */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={15} className="text-azul-blue" />
                        Distribución por Nóminas / Meses de la Baja
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        Importe imputable a cada nómina mensual según los días naturales transcurridos en cada mes.
                      </p>
                    </div>

                    {selectedBajaTramoId === 'custom' && (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase">Inicio simulación:</span>
                        <input
                          type="date"
                          value={bajaCustomStartDate}
                          onChange={(e) => setBajaCustomStartDate(e.target.value)}
                          className="text-[11px] font-black text-slate-800 dark:text-white bg-transparent outline-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bajaCalculation.monthlyBreakdown.map((mb) => (
                      <div key={mb.monthKey} className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-black text-slate-800 dark:text-white uppercase">
                            {mb.label}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-azul-blue/10 dark:bg-azul-blue/20 text-azul-blue uppercase">
                            {mb.daysCount} {mb.daysCount === 1 ? 'día' : 'días'}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-slate-600 dark:text-slate-300 font-bold">
                            <span>Prestación Bruta:</span>
                            <span className="font-black text-slate-800 dark:text-white">{formatCurrency(mb.gross)}</span>
                          </div>
                          {bajaType === 'laboral' && (
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                              <span>Mutua (75%) / Empresa (25%):</span>
                              <span className="font-black text-slate-600 dark:text-slate-300">
                                {formatCurrency(mb.mutua)} / {formatCurrency(mb.empresa)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-400 dark:text-slate-500 font-bold text-[10px]">
                            <span>IRPF ({bajaCalculation.irpfPct}%) + SS (6,47%):</span>
                            <span className="font-bold text-rose-500 dark:text-rose-400">
                              -{formatCurrency(mb.irpf + mb.ss)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-800 font-black">
                            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Neto Nómina:</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(mb.net)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BLOQUE 5: RESUMEN TOTAL, IMPACTO NETO ESTIMADO Y COPIAR INFORME */}
                <div className="bg-slate-900 dark:bg-slate-950 dark:border dark:border-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
                  {/* Cabecera del resumen */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 dark:border-slate-800 pb-4">
                    <div className="space-y-1">
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-amber-400 block">
                        Resumen Económico Estimado de la {bajaType === 'laboral' ? 'Baja Laboral' : 'Baja por Enfermedad Común'}
                      </span>
                      <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-white">
                        {activeBajaTramo
                          ? `Tramo: ${safeFormat(parseISO(activeBajaTramo.start), 'dd/MM/yyyy')} al ${safeFormat(parseISO(activeBajaTramo.end), 'dd/MM/yyyy')} (${bajaCalculation.totalDays} días)`
                          : `Simulación calculada para ${bajaCalculation.totalDays} días naturales de baja`}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-300 dark:text-slate-400">
                        Base Reguladora: <span className="text-white font-black">{formatCurrency(bajaCalculation.baseReguladoraDiaria)}/día</span> • Contrato <span className="text-white font-black">{bajaCalculation.contractType}</span>
                        {bajaType === 'laboral' && bajaCalculation.horasExtrasAnualesVal > 0 && (
                          <span className="text-amber-300 ml-1">
                            (incluye +{formatCurrency(bajaCalculation.horasExtrasPromedioDiario)}/día por horas extras anuales)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Botón Copiar Resumen (Mejora 4) */}
                    <button
                      type="button"
                      onClick={handleCopyBajaSummary}
                      className={cn(
                        "self-start sm:self-center px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 shrink-0",
                        bajaCopied
                          ? "bg-emerald-500 text-white"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40"
                      )}
                    >
                      {bajaCopied ? (
                        <>
                          <Check size={14} className="text-white" />
                          <span>¡Resumen Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} className="text-amber-400" />
                          <span>Copiar Resumen de la Baja</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Cuadrícula de Totales: Bruto, Retenciones y Líquido Neto Estimado (Mejora 3) */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Bruto Total */}
                    <div className="bg-white/5 dark:bg-slate-900/90 border border-white/10 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        {bajaType === 'laboral' ? 'Total Bruto (100% Convenio)' : 'Total Prestación Bruta'}
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {formatCurrency(bajaCalculation.totalPrestacion)}
                      </div>
                      {bajaType === 'laboral' && (
                        <div className="text-[9.5px] font-bold text-slate-300 dark:text-slate-400">
                          Mutua 75%: <span className="text-white font-black">{formatCurrency(bajaCalculation.totalPrestacionLegal)}</span>
                          <br />
                          Empresa 25%: <span className="text-white font-black">{formatCurrency(bajaCalculation.totalComplementoEmpresa)}</span>
                        </div>
                      )}
                    </div>

                    {/* Retención IRPF (ajustable) */}
                    <div className="bg-white/5 dark:bg-slate-900/90 border border-white/10 dark:border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Retención IRPF Est.
                        </span>
                        <div className="flex items-center gap-1 bg-white/10 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            value={bajaCustomIrpf}
                            onChange={(e) => setBajaCustomIrpf(e.target.value)}
                            className="w-8 text-[10px] font-black text-amber-300 bg-transparent text-right outline-none"
                          />
                          <span className="text-[9px] font-bold text-slate-300">%</span>
                        </div>
                      </div>
                      <div className="text-xl font-black text-rose-300 dark:text-rose-400 tracking-tight">
                        -{formatCurrency(bajaCalculation.totalIrpf)}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 block">
                        Tributación estimada en nómina
                      </span>
                    </div>

                    {/* Cuota Seguridad Social */}
                    <div className="bg-white/5 dark:bg-slate-900/90 border border-white/10 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        Cuota Obrera Seg. Social (6,47%)
                      </span>
                      <div className="text-xl font-black text-rose-300 dark:text-rose-400 tracking-tight">
                        -{formatCurrency(bajaCalculation.totalSS)}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 block">
                        CC 4,70% + Desempleo 1,55% + FP + MEI
                      </span>
                    </div>

                    {/* Líquido Neto Estimado */}
                    <div className="bg-emerald-500/15 border border-emerald-400/40 dark:bg-emerald-950/40 dark:border-emerald-600/50 rounded-2xl p-3.5 space-y-1 flex flex-col justify-between">
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-emerald-300 block">
                        Líquido Neto Estimado
                      </span>
                      <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                        {formatCurrency(bajaCalculation.totalNeto)}
                      </div>
                      <span className="text-[9px] font-bold text-emerald-200/80 block">
                        Importe estimado a recibir en banco
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recomendador de IRPF Anual (por defecto recogido) */}
        <div id="irpf-recommender-card" className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-fit col-span-1">
          <div 
            onClick={() => setIsIrpfRecommenderExpanded(!isIrpfRecommenderExpanded)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2.5">
              <div id="irpf-recommender-icon" className="irpf-icon-box p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-transparent dark:border-emerald-400 rounded-2xl shadow-sm">
                <Percent size={20} />
              </div>
              <div className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">
                    Recomendador de IRPF Anual
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
                    En pruebas
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60 text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                Óptimo: {formatNumber(irpfRecommendation.exactIrpfPct, 1)}%
              </span>
              <div className="p-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
                <ChevronDown className={cn("h-5 w-5 text-slate-500 dark:text-slate-300 transition-transform duration-300", isIrpfRecommenderExpanded ? "rotate-180" : "")} />
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isIrpfRecommenderExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden space-y-5 pt-4 border-t border-slate-100 dark:border-slate-800"
              >
                {/* Mensaje informativo de fase de prueba */}
                <div className="bg-amber-50/90 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-900/50 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
                  <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 leading-snug">
                    <span className="font-black uppercase tracking-wider block text-[9.5px] text-amber-700 dark:text-amber-400 mb-0.5">
                      Sección en fase de prueba
                    </span>
                    Esta calculadora ofrece una estimación orientativa del tipo de retención anual. Los resultados pueden variar según circunstancias personales o deducciones autonómicas adicionales.
                  </p>
                </div>

                {/* Controles Superiores: Año, Modo Automático/Manual y Descendientes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Selector de Año */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                      Año Fiscal
                    </label>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200/80 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIrpfCalcYear(prev => prev - 1)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span className="text-xs font-black text-slate-800 dark:text-white">{irpfCalcYear}</span>
                      <button
                        type="button"
                        onClick={() => setIrpfCalcYear(prev => prev + 1)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Modo de cálculo */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                      Origen del Bruto Anual
                    </label>
                    <div className="grid grid-cols-2 bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200/80 dark:border-slate-800 gap-1">
                      <button
                        type="button"
                        onClick={() => setIrpfCalcMode('auto')}
                        className={cn(
                          "py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                          irpfCalcMode === 'auto'
                            ? "bg-azul-blue text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                      >
                        Automático
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIrpfCalcMode('manual');
                          if (!irpfManualGross) {
                            setIrpfManualGross(String(Math.round(irpfRecommendation.grossToUse)));
                          }
                        }}
                        className={cn(
                          "py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                          irpfCalcMode === 'manual'
                            ? "bg-azul-blue text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  {/* Hijos / Descendientes */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                      Hijos a cargo (Mínimo Familiar)
                    </label>
                    <div className="grid grid-cols-4 bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200/80 dark:border-slate-800 gap-1">
                      {[0, 1, 2, 3].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setIrpfChildrenCount(cnt)}
                          className={cn(
                            "py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer",
                            irpfChildrenCount === cnt
                              ? "bg-emerald-500 text-white shadow-xs"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                          )}
                        >
                          {cnt === 3 ? '3+' : cnt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Input de Bruto Anual si está en modo Manual, o Desglose si está en Automático */}
                {irpfCalcMode === 'manual' ? (
                  <div className="bg-slate-50/80 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Salario Bruto Anual Estimado (€)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="100"
                        value={irpfManualGross}
                        onChange={(e) => setIrpfManualGross(e.target.value)}
                        placeholder="Ej. 26500"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 dark:text-slate-500">€/año</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/60 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Bruto Anual Estimado
                      </span>
                      <span className="text-base font-black text-slate-800 dark:text-white">
                        {formatCurrency(irpfRecommendation.grossToUse)}
                      </span>
                      <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        Nivel {settings?.currentLevel || 1} ({settings?.contractType || 'Completo'})
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Variables Estimadas / Año
                      </span>
                      <span className="text-base font-black text-azul-blue">
                        +{formatCurrency(irpfRecommendation.estimatedAnnualVariables)}
                      </span>
                      <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        {irpfRecommendation.savedMonthsCount > 0
                          ? `Basado en ${irpfRecommendation.savedMonthsCount} nómina(s) guardada(s)`
                          : 'Proyección según tus turnos'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Retención Anual Estimada
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(irpfRecommendation.annualTaxQuota)}
                      </span>
                      <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        Seg. Social deducible: {formatCurrency(irpfRecommendation.ssDeduction)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tarjetas de Resultado de IRPF */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tu IRPF actual */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Tu IRPF Actual (Configuración)
                    </span>
                    <div className="my-1.5 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-800 dark:text-white">
                        {formatNumber(irpfRecommendation.currentConfiguredIrpf, 2)}%
                      </span>
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
                      Retienes ~{formatCurrency(irpfRecommendation.grossToUse * (irpfRecommendation.currentConfiguredIrpf / 100))}/año
                    </span>
                  </div>

                  {/* IRPF Óptimo AEAT */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                        IRPF Óptimo Estimado
                      </span>
                      <span className="text-[8px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">
                        Exacto
                      </span>
                    </div>
                    <div className="my-1.5 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                        {formatNumber(irpfRecommendation.exactIrpfPct, 1)}%
                      </span>
                    </div>
                    {updateSettings && settings && (
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ ...settings, irpf: irpfRecommendation.exactIrpfPct });
                          setIrpfAppliedSuccess(true);
                          setTimeout(() => setIrpfAppliedSuccess(false), 2500);
                        }}
                        className="mt-1 w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                      >
                        Aplicar {formatNumber(irpfRecommendation.exactIrpfPct, 1)}% en Configuración
                      </button>
                    )}
                  </div>

                  {/* IRPF Conservador (Sin sustos) */}
                  <div className="p-4 rounded-2xl bg-azul-blue/5 dark:bg-azul-blue/10 border border-azul-blue/20 dark:border-blue-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-azul-blue dark:text-blue-400 uppercase tracking-widest">
                        Recomendado Conservador
                      </span>
                      <span className="text-[8px] font-black bg-azul-blue text-white px-2 py-0.5 rounded-full uppercase">
                        Seguro
                      </span>
                    </div>
                    <div className="my-1.5 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-azul-blue dark:text-blue-400">
                        {formatNumber(irpfRecommendation.safeIrpfPct, 1)}%
                      </span>
                    </div>
                    {updateSettings && settings && (
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ ...settings, irpf: irpfRecommendation.safeIrpfPct });
                          setIrpfAppliedSuccess(true);
                          setTimeout(() => setIrpfAppliedSuccess(false), 2500);
                        }}
                        className="mt-1 w-full py-1.5 rounded-xl bg-azul-blue hover:bg-azul-blue/90 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                      >
                        Aplicar {formatNumber(irpfRecommendation.safeIrpfPct, 1)}% en Configuración
                      </button>
                    )}
                  </div>
                </div>

                {/* Diagnóstico / Aviso comparativo */}
                <div className={cn(
                  "p-3.5 rounded-2xl border flex items-start gap-3",
                  irpfRecommendation.currentConfiguredIrpf < irpfRecommendation.exactIrpfPct - 0.3
                    ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
                    : "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200"
                )}>
                  <Info size={18} className={cn(
                    "shrink-0 mt-0.5",
                    irpfRecommendation.currentConfiguredIrpf < irpfRecommendation.exactIrpfPct - 0.3
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )} />
                  <div className="text-[11px] font-bold leading-snug space-y-1">
                    {irpfRecommendation.currentConfiguredIrpf < irpfRecommendation.exactIrpfPct - 0.3 ? (
                      <p>
                        Tu IRPF actual (<span className="font-black">{formatNumber(irpfRecommendation.currentConfiguredIrpf, 2)}%</span>) está por debajo del óptimo estimado (<span className="font-black">{formatNumber(irpfRecommendation.exactIrpfPct, 1)}%</span>). Con este ritmo, podrías tener una diferencia de unos <span className="font-black underline">{formatCurrency(Math.abs(irpfRecommendation.diffEuros))}</span> a pagar en la Declaración de la Renta si tienes obligación de declarar.
                      </p>
                    ) : (
                      <p>
                        Tu IRPF actual (<span className="font-black">{formatNumber(irpfRecommendation.currentConfiguredIrpf, 2)}%</span>) cubre de forma segura la retención anual estimada (<span className="font-black">{formatNumber(irpfRecommendation.exactIrpfPct, 1)}%</span>), con un margen estimado a tu favor de <span className="font-black">{formatCurrency(Math.max(0, irpfRecommendation.diffEuros))}</span>/año.
                      </p>
                    )}
                    {irpfAppliedSuccess && (
                      <p className="text-emerald-700 dark:text-emerald-400 font-black uppercase text-[10px]">
                        ✓ Se ha actualizado tu % de IRPF en Configuración correctamente.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Calculadora de Finiquito / Liquidación */}
        <div id="finiquito-card" className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 h-fit col-span-1">
          <div 
            onClick={() => setIsFiniquitoExpanded(!isFiniquitoExpanded)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2.5">
              <div id="finiquito-icon" className="finiquito-icon-box p-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-transparent dark:border-indigo-400 rounded-2xl shadow-sm">
                <Calculator size={20} />
              </div>
              <div className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">
                    Calculadora de Finiquito / Liquidación
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
                    En pruebas
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">
                {finiquitoResult.totalLiquido > 0 ? formatCurrency(finiquitoResult.totalLiquido) : 'Simulador'}
              </span>
              <div className="p-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
                <ChevronDown className={cn("h-5 w-5 text-slate-500 dark:text-slate-300 transition-transform duration-300", isFiniquitoExpanded ? "rotate-180" : "")} />
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isFiniquitoExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 24 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden space-y-6 pt-2"
              >
                {/* 1. Selector de Causa de Extinción */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Causa o Motivo de Extinción del Contrato
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'temporal', label: 'Fin de Contrato', sub: '12 días/año (Temporal)' },
                      { id: 'improcedente', label: 'Despido Improc.', sub: '33 días/año (Máx 24m)' },
                      { id: 'objetivo', label: 'Despido Objetivo', sub: '20 días/año (Máx 12m)' },
                      { id: 'voluntaria', label: 'Baja Voluntaria', sub: '0 días (Dimisión)' }
                    ].map(c => {
                      const isSel = finiquitoCause === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFiniquitoCause(c.id as any)}
                          className={cn(
                            "p-3 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer flex flex-col justify-between",
                            isSel
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          <span className="text-xs font-black uppercase tracking-tight block">{c.label}</span>
                          <span className={cn("text-[8.5px] font-bold block mt-0.5", isSel ? "text-indigo-200" : "text-slate-400")}>
                            {c.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Parámetros del Contrato y Salario */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Fecha Inicio (Antigüedad)
                    </label>
                    <input
                      type="date"
                      value={finiquitoStartDate}
                      onChange={(e) => setFiniquitoStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Fecha Fin de Contrato (Cese)
                    </label>
                    <input
                      type="date"
                      value={finiquitoEndDate}
                      onChange={(e) => setFiniquitoEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Salario Base Mensual (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Defecto: ${defaultBaseSalary}€`}
                      value={finiquitoBaseSalary}
                      onChange={(e) => setFiniquitoBaseSalary(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Pluses Fijos Habituales (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={finiquitoPluses}
                      onChange={(e) => setFiniquitoPluses(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Pagas Extraordinarias
                    </label>
                    <select
                      value={finiquitoPagasExtras}
                      onChange={(e) => setFiniquitoPagasExtras(Number(e.target.value) as 12 | 14)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={14}>14 Pagas (Verano y Navidad no prorrateadas)</option>
                      <option value={12}>12 Pagas (Pagas prorrateadas cada mes)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Días Vacaciones Disfrutados este año
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={finiquitoVacationDaysTaken}
                      onChange={(e) => setFiniquitoVacationDaysTaken(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Días Trabajados Mes Cese
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder={`Auto (${finiquitoResult.diasMes} días)`}
                      value={finiquitoDaysWorkedMonth}
                      onChange={(e) => setFiniquitoDaysWorkedMonth(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Retención IRPF (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={finiquitoIrpf}
                      onChange={(e) => setFiniquitoIrpf(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 3. Tarjetas Resumen de Resultados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Líquido Neto */}
                  <div className="p-4 rounded-3xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 flex flex-col justify-between sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
                        Líquido Total Estimado a Percibir
                      </span>
                      <span className="text-[8px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full uppercase">
                        Neto Banco
                      </span>
                    </div>
                    <div className="my-2">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight">
                        {formatCurrency(finiquitoResult.totalLiquido)}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-100">
                      Antigüedad calculada: {finiquitoResult.totalYearsStr} ({finiquitoResult.totalDays} días naturales)
                    </span>
                  </div>

                  {/* Total Bruto */}
                  <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                    <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">
                      Total Devengado (Bruto)
                    </span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white my-1">
                      {formatCurrency(finiquitoResult.totalBruto)}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      Salario diario: {formatCurrency(finiquitoResult.salarioDiario)}/día
                    </span>
                  </div>

                  {/* Deducciones */}
                  <div className="p-4 rounded-3xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex flex-col justify-between">
                    <span className="text-[9.5px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                      Total Deducciones
                    </span>
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400 my-1">
                      -{formatCurrency(finiquitoResult.totalDeducciones)}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                      Seg. Social ({formatCurrency(finiquitoResult.deduccionSS)}) + IRPF ({formatCurrency(finiquitoResult.retencionIRPF)})
                    </span>
                  </div>
                </div>

                {/* 4. Desglose pormenorizado de conceptos */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Desglose Concepto por Concepto
                  </span>
                  <div className="bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {/* Días trabajados del mes */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-800 dark:text-slate-100 uppercase block">
                          1. Días trabajados en el mes del cese
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {finiquitoResult.diasMes} días × {formatCurrency(finiquitoResult.salarioDiaMes)}/día mensual
                        </span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
                        {formatCurrency(finiquitoResult.mesFinImporte)}
                      </span>
                    </div>

                    {/* Vacaciones no disfrutadas */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-800 dark:text-slate-100 uppercase block">
                          2. Vacaciones devengadas y no disfrutadas
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {finiquitoResult.diasVacacionesPendientes} días pendientes ({finiquitoResult.diasVacacionesDevengados} devengados − {finiquitoVacationDaysTaken} disfrutados) × {formatCurrency(finiquitoResult.salarioDiario)}/día
                        </span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
                        {formatCurrency(finiquitoResult.vacacionesImporte)}
                      </span>
                    </div>

                    {/* Pagas extras */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-800 dark:text-slate-100 uppercase block">
                          3. Pagas extraordinarias proporcionales
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {finiquitoPagasExtras === 14 ? 'Parte proporcional devengada de paga extra de verano/navidad' : 'Ya prorrateadas en el salario mensual habitual (12 pagas)'}
                        </span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
                        {formatCurrency(finiquitoResult.pagasExtrasImporte)}
                      </span>
                    </div>

                    {/* Indemnización */}
                    <div className="p-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-black text-slate-800 dark:text-slate-100 uppercase block">
                          4. Indemnización por cese ({finiquitoCause === 'temporal' ? 'Fin de Contrato 12d/año' : finiquitoCause === 'improcedente' ? 'Despido Improcedente 33d/año' : finiquitoCause === 'objetivo' ? 'Despido Objetivo 20d/año' : 'Baja Voluntaria'})
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {finiquitoResult.indemnizacionDias > 0 
                            ? `${finiquitoResult.indemnizacionDias} días de salario reconocidos (${finiquitoResult.totalYearsStr}) × ${formatCurrency(finiquitoResult.salarioDiario)}/día`
                            : 'La baja voluntaria o dimisión no genera derecho a indemnización legal'}
                        </span>
                      </div>
                      <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        {formatCurrency(finiquitoResult.indemnizacionImporte)}
                      </span>
                    </div>

                    {/* Deducciones */}
                    <div className="p-3.5 flex items-center justify-between bg-rose-50/20 dark:bg-rose-950/10">
                      <div>
                        <span className="font-black text-rose-700 dark:text-rose-400 uppercase block">
                          5. Retenciones y Deducciones de Nómina
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Cotización Seguridad Social (~6.47%): {formatCurrency(finiquitoResult.deduccionSS)} • Retención IRPF ({finiquitoIrpf}%): {formatCurrency(finiquitoResult.retencionIRPF)}
                        </span>
                      </div>
                      <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                        -{formatCurrency(finiquitoResult.totalDeducciones)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botón copiar y nota legal */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <p className="text-[9px] text-slate-400 leading-tight">
                    * Estimación orientativa calculada según el Estatuto de los Trabajadores y el Convenio de Handling. En despido legal o fin de contrato temporal, la indemnización legal está exenta de cotización a la Seguridad Social.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy = `SIMULACIÓN DE FINIQUITO / LIQUIDACIÓN:
• Causa: ${finiquitoCause.toUpperCase()}
• Antigüedad: ${finiquitoStartDate} a ${finiquitoEndDate} (${finiquitoResult.totalYearsStr})
• Salario mes en curso (${finiquitoResult.diasMes} días): ${formatCurrency(finiquitoResult.mesFinImporte)}
• Vacaciones pendientes (${finiquitoResult.diasVacacionesPendientes} días): ${formatCurrency(finiquitoResult.vacacionesImporte)}
• Pagas extras proporcionales: ${formatCurrency(finiquitoResult.pagasExtrasImporte)}
• Indemnización por cese (${finiquitoResult.indemnizacionDias} días): ${formatCurrency(finiquitoResult.indemnizacionImporte)}
------------------------------------
• TOTAL BRUTO: ${formatCurrency(finiquitoResult.totalBruto)}
• TOTAL DEDUCCIONES (SS e IRPF): -${formatCurrency(finiquitoResult.totalDeducciones)}
====================================
• LÍQUIDO A PERCIBIR (NETO BANCO): ${formatCurrency(finiquitoResult.totalLiquido)}`;
                      navigator.clipboard.writeText(textToCopy);
                      setFiniquitoCopied(true);
                      setTimeout(() => setFiniquitoCopied(false), 2500);
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    {finiquitoCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {finiquitoCopied ? '¡Copiado!' : 'Copiar Desglose'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Month Picker Modal */}
      <MonthPickerModal 
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        currentMonth={currentMonth}
        onSelectMonth={setCurrentMonth}
      />

      {/* Chapter Details Modal */}
      <AnimatePresence>
        {selectedChapter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 shadow-2xl" data-modal-active="true">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedChapter(null)}
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative border border-slate-100/80 overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    {selectedChapter.id.toUpperCase()}
                  </span>
                  <h3 className="text-lg sm:text-2xl font-black text-slate-800 uppercase tracking-tight">
                    {selectedChapter.title}
                  </h3>
                </div>
                <button
                  id="close-chapter-modal-btn"
                  onClick={() => setSelectedChapter(null)}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-850 rounded-xl transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content block: List of Articles */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                {selectedChapter.articles.map((art) => (
                  <div key={art.num} className="space-y-4 border-b border-slate-55 pb-6 last:border-0 last:pb-0">
                    <h4 className="text-xs sm:text-sm font-black text-blue-900 bg-blue-50/50 border border-blue-100/35 px-4 py-2 rounded-xl w-fit leading-none uppercase tracking-wide">
                      Artículo {art.num}. {highlightText(art.title, convenioQuery)}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-650 leading-relaxed font-normal whitespace-pre-wrap pl-1">
                      {highlightText(art.content, convenioQuery)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t border-slate-50 bg-slate-50/20 flex justify-end">
                <button
                  id="close-chapter-modal-footer-btn"
                  onClick={() => setSelectedChapter(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-full font-black text-xs uppercase tracking-widest transition-colors shadow-sm active:scale-98 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Article Details Modal (for Search result clicks) */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 shadow-2xl" data-modal-active="true">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative border border-slate-100/80 overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/30">
                    {selectedArticle.chapterTitle.toUpperCase()}
                  </span>
                  <h3 className="text-base sm:text-xl font-black text-slate-800 uppercase tracking-tight mt-1.5 font-sans">
                    Artículo {selectedArticle.num}. {highlightText(selectedArticle.title, convenioQuery)}
                  </h3>
                </div>
                <button
                  id="close-article-modal-btn"
                  onClick={() => setSelectedArticle(null)}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-850 rounded-xl transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <p className="text-xs sm:text-sm text-slate-650 leading-relaxed font-normal whitespace-pre-wrap">
                  {highlightText(selectedArticle.content, convenioQuery)}
                </p>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t border-slate-50 bg-slate-50/20 flex justify-end">
                <button
                  id="close-article-modal-footer-btn"
                  onClick={() => setSelectedArticle(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-full font-black text-xs uppercase tracking-widest transition-colors shadow-sm active:scale-98 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* SECCIÓN CAMBIO IRPF: MODAL Y PDF IMPRESO  */}
      {/* ========================================== */}

      {/* Hidden off-screen template for Cambio IRPF high-fidelity PDF rendering */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div 
          id="pdf-irpf-template" 
          className="p-16 flex flex-col justify-between font-sans relative"
          style={{ width: '794px', height: '1122px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#000000' }}
        >
          {/* Main Content */}
          <div>
            {/* Header section (logo + contact) */}
            <div className="flex justify-between items-start mb-12">
              {/* Logo block */}
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M 16,14 C 18,10 22,10 24,14 C 26,18 22,22 18,20 C 16,19 15,16 16,14 Z M 16,21 C 12,31 10,41 18,52 C 25,62 34,70 42,76 C 37,61 31,48 24,35 C 21,30 18,25 16,21 Z M 20,18 C 34,18 49,14 65,10 C 70,8 72,11 66,15 C 52,22 38,28 23,30 C 20,30 19,20 20,18 Z M 23,34 C 34,36 45,34 56,30 C 60,28 61,31 56,34 C 45,39 34,41 24,40 C 22,40 22,35 23,34 Z M 25,44 C 33,47 41,45 49,41 C 52,39 53,42 49,45 C 41,49 33,50 26,48 C 24,48 24,44 25,44 Z M 27,53 C 33,56 39,54 44,50 C 47,48 48,51 44,54 C 39,58 33,59 28,57 C 26,57 26,54 27,53 Z" 
                        fill="#efbc06" 
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-3xl font-black tracking-tight leading-none uppercase font-sans" style={{ color: '#004e89' }}>
                      AZUL
                    </span>
                    <span className="text-[11px] font-black tracking-[0.15em] uppercase leading-none mt-1 font-sans" style={{ color: '#004e89' }}>
                      HANDLING
                    </span>
                  </div>
                </div>
                <div className="font-black text-[7.5px] uppercase tracking-widest px-2.5 py-1 mt-1 rounded-xs leading-none whitespace-nowrap text-center font-sans w-full max-w-[215px]" style={{ backgroundColor: '#efbc06', color: '#004e89' }}>
                  HERE TO HELP, HERE TO CARE!
                </div>
              </div>

              {/* Right-aligned header information */}
              <div className="text-right" style={{ color: '#1e293b' }}>
                <p className="font-extrabold text-[12px] uppercase tracking-wide leading-tight" style={{ color: '#020617' }}>Azul Handling</p>
                <p className="text-[10px] mt-2 font-medium leading-none" style={{ color: '#64748b' }}>Calle Migdia 37, 2 A</p>
              </div>
            </div>

            {/* Subheader info block that is slightly separate */}
            <div className="flex justify-between items-start mb-16 text-xs font-sans">
              <div className="text-left" style={{ color: '#64748b' }}>
                <p className="text-[10px] font-medium leading-none">17002 Gerona España</p>
              </div>
              <div className="text-right" style={{ color: '#64748b' }}>
                <p className="text-[10px] font-medium leading-none">Web-site: www.azulhandling.com</p>
              </div>
            </div>

            {/* Date alignment on right side */}
            <div className="text-right mb-16 text-sm font-sans pr-4" style={{ color: '#000000' }}>
              {(() => {
                const parts = getSpanishDateParts(irpfFechaFirma);
                return (
                  <span>
                    <span className="font-bold underline px-1">{irpfCiudad || '_________'}</span>, a <span className="font-bold underline px-1">{parts.day || '__'}</span> de <span className="font-bold underline px-1">{parts.month || '______'}</span> de <span className="font-bold underline px-1">{parts.year || '202_'}</span>
                  </span>
                );
              })()}
            </div>

            {/* Main Body with precise text & underlining formatting */}
            <div className="text-left text-sm leading-[2.5] font-sans px-4 mt-20" style={{ color: '#000000', textAlign: 'justify' }}>
              {(() => {
                const partsEfectiva = getSpanishDateParts(irpfFechaEfectiva);
                return (
                  <p>
                    Yo, <span className="font-bold underline px-2 inline-block min-w-[250px] text-center">{irpfNombre || '___________________________________'}</span> con NIF/NIE N. <span className="font-bold underline px-2 inline-block min-w-[120px] text-center">{irpfNif || '___________________'}</span> y con la categoría laboral de <span className="font-bold underline px-2 inline-block min-w-[180px] text-center">{irpfCategoria || '______________________'}</span>, en el centro de trabajo de <span className="font-bold underline px-2 inline-block min-w-[120px] text-center">{irpfCentro || '_________________'}</span> solicito a mi empresa <span className="font-bold underline px-2 inline-block min-w-[120px] text-center">{irpfEmpresa || '_________'}</span> que a partir de <span className="font-bold underline px-1 inline-block min-w-[30px] text-center">{partsEfectiva.day}</span> de <span className="font-bold underline px-2 inline-block min-w-[100px] text-center">{partsEfectiva.month}</span> de <span className="font-bold underline px-1 inline-block min-w-[50px] text-center">{partsEfectiva.year}</span> me sea aplicada una retención de <span className="font-bold underline px-2 inline-block min-w-[40px] text-center">{irpfPorcentaje || '___'}</span> % en mi recibo de salarios.
                  </p>
                );
              })()}
            </div>

            {/* Signature section */}
            <div className="mt-28 text-left font-sans px-4">
              <p className="font-bold text-sm" style={{ color: '#000000' }}>Firmado:</p>
              
              <div className="h-32 w-64 my-4 flex items-center justify-center relative">
                {irpfSignature ? (
                  <img src={irpfSignature} className="max-h-full max-w-full object-contain animate-none" alt="Firma digital" />
                ) : (
                  <div className="w-full h-full border border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400 italic">
                    Sin firma digital
                  </div>
                )}
              </div>

              <div className="mt-8">
                <p className="font-bold text-xs uppercase tracking-wide" style={{ color: '#000000' }}>NIF/DNI/NIE</p>
                <p className="font-bold text-sm mt-1 text-slate-800">{irpfNif || '___________________'}</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* SECCIÓN CAMBIO PP EXTRA: MODAL Y PDF IMPRESO */}
      {/* ========================================== */}

      {/* Hidden off-screen template for Cambio PP Extra high-fidelity PDF rendering */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div 
          id="pdf-pp-extra-template" 
          className="p-16 flex flex-col justify-between font-sans relative"
          style={{ width: '794px', height: '1122px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#000000' }}
        >
          {/* Main Content */}
          <div>
            {/* Header section (logo + contact) */}
            <div className="flex justify-between items-start mb-12">
              {/* Logo block */}
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M 16,14 C 18,10 22,10 24,14 C 26,18 22,22 18,20 C 16,19 15,16 16,14 Z M 16,21 C 12,31 10,41 18,52 C 25,62 34,70 42,76 C 37,61 31,48 24,35 C 21,30 18,25 16,21 Z M 20,18 C 34,18 49,14 65,10 C 70,8 72,11 66,15 C 52,22 38,28 23,30 C 20,30 19,20 20,18 Z M 23,34 C 34,36 45,34 56,30 C 60,28 61,31 56,34 C 45,39 34,41 24,40 C 22,40 22,35 23,34 Z M 25,44 C 33,47 41,45 49,41 C 52,39 53,42 49,45 C 41,49 33,50 26,48 C 24,48 24,44 25,44 Z M 27,53 C 33,56 39,54 44,50 C 47,48 48,51 44,54 C 39,58 33,59 28,57 C 26,57 26,54 27,53 Z" 
                        fill="#efbc06" 
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-3xl font-black tracking-tight leading-none uppercase font-sans" style={{ color: '#004e89' }}>
                      AZUL
                    </span>
                    <span className="text-[11px] font-black tracking-[0.15em] uppercase leading-none mt-1 font-sans" style={{ color: '#004e89' }}>
                      HANDLING
                    </span>
                  </div>
                </div>
                <div className="font-black text-[7.5px] uppercase tracking-widest px-2.5 py-1 mt-1 rounded-xs leading-none whitespace-nowrap text-center font-sans w-full max-w-[215px]" style={{ backgroundColor: '#efbc06', color: '#004e89' }}>
                  HERE TO HELP, HERE TO CARE!
                </div>
              </div>

              {/* Right-aligned header information */}
              <div className="text-right" style={{ color: '#1e293b' }}>
                <p className="font-extrabold text-[12px] uppercase tracking-wide leading-tight" style={{ color: '#020617' }}>Azul Handling</p>
                <p className="text-[10px] mt-2 font-medium leading-none" style={{ color: '#64748b' }}>Calle Migdia 37, 2 A</p>
              </div>
            </div>

            {/* Subheader info block */}
            <div className="flex justify-between items-start mb-14 text-xs font-sans">
              <div className="text-left" style={{ color: '#64748b' }}>
                <p className="text-[10px] font-medium leading-none">17002 Gerona España</p>
              </div>
              <div className="text-right" style={{ color: '#64748b' }}>
                <p className="text-[10px] font-medium leading-none">Web-site: www.azulhandling.com</p>
              </div>
            </div>

            {/* Title Section (Centered and underlined) */}
            <div className="text-center mt-12 mb-10 px-4">
              <h1 className="text-base sm:text-lg font-black tracking-wide uppercase font-sans border-b border-black inline-block pb-1" style={{ color: '#000000', borderWidth: '1.5px' }}>
                SOLICITUD CAMBIO PERIODICIDAD DE PAGO DE NOMINA
              </h1>
            </div>

            {/* Privado y Confidencial aligned to the right */}
            <div className="text-right mb-12 px-4">
              <p className="font-bold italic text-sm text-black">
                Privado y Confidencial
              </p>
            </div>

            {/* Ciudad and Date alignment on left side */}
            <div className="text-left mb-10 text-sm font-sans px-4 text-black">
              {(() => {
                const parts = getSpanishDateParts(ppExtraFechaFirma);
                return (
                  <p className="font-bold">
                    En <span className="font-bold underline px-1">{ppExtraCiudad || '_________'}</span>, a <span className="font-bold underline px-1">{parts.day || '__'}</span> de <span className="font-bold underline px-1">{parts.month || '______'}</span> de <span className="font-bold underline px-1">{parts.year || '202_'}</span>
                  </p>
                );
              })()}
            </div>

            {/* Attention to: RRHH of Azul Handling Spain Ltd Sucursal España */}
            <div className="text-left mb-12 text-sm font-sans px-4 text-black font-bold">
              A/A: RRHH de AZUL HANDLING SPAIN LTD SUCURSAL ESPAÑA
            </div>

            {/* Main Body with precise text & underlining formatting */}
            <div className="text-left text-[13.5px] leading-[2.5] font-sans px-4 mt-12 text-black" style={{ textAlign: 'justify' }}>
              <p>
                Por la presente, yo <span className="font-bold underline px-2 inline-block min-w-[280px] text-center">{ppExtraNombre || '___________________________________'}</span> con DNI/NIE <span className="font-bold underline px-2 inline-block min-w-[130px] text-center">{ppExtraDni || '___________________'}</span>, solicito para todo el año natural 20<span className="font-bold underline px-2 inline-block min-w-[35px] text-center">{ppExtraAnioNatural ? ppExtraAnioNatural.slice(-2) : '__'}</span>, el pago de mi nómina fraccionado en <span className="font-bold underline px-2">[{ppExtraPagas}]</span> pagas.
              </p>
            </div>

            {/* Valediction */}
            <div className="text-left text-sm font-sans px-4 mt-12 text-black font-medium">
              Atentamente,
            </div>

            {/* Signature section */}
            <div className="mt-16 text-left font-sans px-4">
              <p className="font-bold text-xs uppercase tracking-wider text-black">Firma persona trabajadora:</p>
              
              <div className="h-28 w-56 my-3 flex items-center justify-center relative">
                {ppExtraSignature ? (
                  <img src={ppExtraSignature} className="max-h-full max-w-full object-contain animate-none" alt="Firma digital" />
                ) : (
                  <div className="w-full h-full border border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400 italic">
                    Sin firma digital
                  </div>
                )}
              </div>

              <div className="mt-6">
                <p className="font-bold text-sm text-black">
                  D./Dña. <span className="font-bold underline px-2 inline-block min-w-[220px]">{ppExtraNombre || '_________________________________'}</span>
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* SECCIÓN CAMBIO DE TURNO: MODAL Y PDF IMPRESO */}
      {/* ========================================== */}

      {/* Hidden off-screen template for high-fidelity PDF rendering */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div 
          id="pdf-cambio-turno-template" 
          className="p-14 flex flex-col justify-between font-sans relative"
          style={{ width: '794px', height: '1122px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#000000' }}
        >
          {/* Main Top Content */}
          <div>
            {/* Header / Logo section */}
            <div className="flex justify-between items-start mb-8">
              {/* Logo block */}
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path 
                        d="M 16,14 C 18,10 22,10 24,14 C 26,18 22,22 18,20 C 16,19 15,16 16,14 Z M 16,21 C 12,31 10,41 18,52 C 25,62 34,70 42,76 C 37,61 31,48 24,35 C 21,30 18,25 16,21 Z M 20,18 C 34,18 49,14 65,10 C 70,8 72,11 66,15 C 52,22 38,28 23,30 C 20,30 19,20 20,18 Z M 23,34 C 34,36 45,34 56,30 C 60,28 61,31 56,34 C 45,39 34,41 24,40 C 22,40 22,35 23,34 Z M 25,44 C 33,47 41,45 49,41 C 52,39 53,42 49,45 C 41,49 33,50 26,48 C 24,48 24,44 25,44 Z M 27,53 C 33,56 39,54 44,50 C 47,48 48,51 44,54 C 39,58 33,59 28,57 C 26,57 26,54 27,53 Z" 
                        fill="#efbc06" 
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-3xl font-black tracking-tight leading-none uppercase font-sans" style={{ color: '#004e89' }}>
                      AZUL
                    </span>
                    <span className="text-[11px] font-black tracking-[0.15em] uppercase leading-none mt-1 font-sans" style={{ color: '#004e89' }}>
                      HANDLING
                    </span>
                  </div>
                </div>
                <div className="font-black text-[7.5px] uppercase tracking-widest px-2.5 py-1 mt-1 rounded-xs leading-none whitespace-nowrap text-center font-sans w-full max-w-[215px]" style={{ backgroundColor: '#efbc06', color: '#004e89' }}>
                  HERE TO HELP, HERE TO CARE!
                </div>
              </div>

              {/* Right-aligned contact info */}
              <div className="text-right" style={{ color: '#1e293b' }}>
                <p className="font-extrabold text-[12px] uppercase tracking-wide leading-tight" style={{ color: '#020617' }}>Azul Handling</p>
                <p className="text-[10px] mt-2 font-medium leading-none" style={{ color: '#64748b' }}>Calle Migdia 37, 2 A</p>
                <p className="text-[10px] mt-1 font-medium leading-none" style={{ color: '#64748b' }}>17002 Gerona España</p>
                <p className="text-[10px] mt-1 font-medium leading-none" style={{ color: '#64748b' }}>Web-site: www.azulhandling.com</p>
              </div>
            </div>

            {/* Checked Boxes and Solicitante Date row */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-6 text-[11px] font-bold" style={{ color: '#0f172a' }}>
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-widest text-[10px] font-extrabold" style={{ color: '#0f172a' }}>Pasaje</span>
                  <div className="w-5 h-5 border flex items-center justify-center font-black" style={{ borderColor: '#020617', backgroundColor: '#ffffff' }}>
                    {(formType === 'pasaje' || formType === 'ambos') && '✓'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-widest text-[10px] font-extrabold" style={{ color: '#0f172a' }}>Rampa</span>
                  <div className="w-5 h-5 border flex items-center justify-center font-black" style={{ borderColor: '#020617', backgroundColor: '#ffffff' }}>
                    {(formType === 'rampa' || formType === 'ambos') && '✓'}
                  </div>
                </div>
              </div>

              {/* Date of request */}
              <div className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: '#0f172a' }}>
                <span className="uppercase tracking-widest text-[10px]" style={{ color: '#0f172a' }}>Fecha:</span>
                <span className="font-bold px-3 pb-0.5 min-w-[120px] text-center" style={{ borderBottom: '1px solid #94a3b8', color: '#1e293b' }}>
                  {formatDateES(formFechaSolicitud)}
                </span>
              </div>
            </div>

            {/* Cursive tagline */}
            <div className="text-left mb-6">
              <p className="text-[10px] italic font-medium" style={{ color: '#475569' }}>(Copia para la empresa)</p>
            </div>

            {/* Applicant Employee Name */}
            <div className="mb-6 text-left">
              <p className="font-extrabold text-[10px] uppercase tracking-wider" style={{ color: '#0f172a' }}>NOMBRE DEL/LA SOLICITANTE:</p>
              <p className="font-extrabold text-[13px] uppercase tracking-wide mt-1.5 pb-1 min-h-[22px]" style={{ borderBottom: '1px solid #94a3b8', color: '#1e293b' }}>
                {formSolicitanteNombre || ' '}
              </p>
            </div>

            {/* Columns Layout: DIA/S Y TURNO/S QUE SE CAMBIAN VS DIA Y HORAS SOLICITADAS */}
            <div className="grid grid-cols-2 gap-8 mb-6 text-left">
              <div>
                <p className="font-extrabold text-[10.5px] uppercase tracking-wider leading-snug" style={{ color: '#0f172a' }}>DIA/S Y TURNO/S QUE SE CAMBIAN:</p>
                <p className="font-bold text-xs uppercase tracking-wide mt-2 pb-1.5 min-h-[25px]" style={{ borderBottom: '1px solid #94a3b8', color: '#1e293b' }}>
                  {formCambioDetails || ' '}
                </p>
              </div>
              <div>
                <p className="font-extrabold text-[10.5px] uppercase tracking-wider leading-snug" style={{ color: '#0f172a' }}>DIA Y HORAS SOLICITADAS:</p>
                <p className="font-bold text-xs uppercase tracking-wide mt-2 pb-1.5 min-h-[25px]" style={{ borderBottom: '1px solid #94a3b8', color: '#1e293b' }}>
                  {formSolicitadoDetails || ' '}
                </p>
              </div>
            </div>

            {/* Accepting Employee Name */}
            <div className="mb-6 text-left">
              <p className="font-extrabold text-[10px] uppercase tracking-wider font-sans" style={{ color: '#0f172a' }}>NOMBRE DEL/LA EMPLEADO/A QUE ACEPTA EL CAMBIO:</p>
              <p className="font-extrabold text-[13px] uppercase tracking-wide mt-1.5 pb-1 min-h-[22px]" style={{ borderBottom: '1px solid #94a3b8', color: '#1e293b' }}>
                {formAceptaNombre || ' '}
              </p>
            </div>

            {/* Motivo row */}
            <div className="mb-8 text-left flex items-baseline gap-2">
              <span className="font-extrabold text-[10px] uppercase tracking-wider whitespace-nowrap" style={{ color: '#0f172a' }}>MOTIVO DE LA SOLICITUD:</span>
              <span className="flex-1 font-semibold text-xs uppercase tracking-wide pb-0.5 min-h-[20px]" style={{ borderBottom: '1px solid #94a3b8', color: '#334155' }}>
                {formMotivo || ' '}
              </span>
            </div>

            {/* Disclaimer paragraph */}
            <p className="text-[9.5px] text-justify leading-relaxed font-normal select-none italic" style={{ color: '#64748b' }}>
              (Sólo se tendrán en consideración aquellas solicitudes con un mínimo de 4 días de antelación, salvo autorización previa del/la Station Manager, o en su defecto, Jefe/a de Pasaje/Rampa. El hecho de haber rellenado la solicitud no significa la aprobación de la misma. El/La empleado/a que acepta el cambio de turno tiene que formar parte del mismo departamento/ejercer las mismas funciones).
            </p>
          </div>

          {/* Bottom signatures and footer spacer */}
          <div>
            <div className="grid grid-cols-2 gap-16 text-center mb-4">
              <div className="flex flex-col items-center">
                <p className="font-extrabold text-[10.5px] uppercase tracking-wider mb-2" style={{ color: '#0f172a' }}>Firma solicitante</p>
                <div className="w-full max-w-[200px] h-[75px] flex items-center justify-center overflow-hidden" style={{ border: '1px solid #020617', backgroundColor: '#ffffff' }}>
                  {signatureSolicitante ? (
                    <img src={signatureSolicitante} className="max-w-full max-h-full object-contain" alt="Firma solicitante" />
                  ) : (
                    <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: '#cbd5e1' }}>Sin firmar</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <p className="font-extrabold text-[10.5px] uppercase tracking-wider mb-2" style={{ color: '#0f172a' }}>Firma empleado/a</p>
                <div className="w-full max-w-[200px] h-[75px] flex items-center justify-center overflow-hidden" style={{ border: '1px solid #020617', backgroundColor: '#ffffff' }}>
                  {signatureAcepta ? (
                    <img src={signatureAcepta} className="max-w-full max-h-full object-contain" alt="Firma empleado" />
                  ) : (
                    <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: '#cbd5e1' }}>Sin firmar</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom physical line */}
            <div className="mt-10 w-full" style={{ borderTop: '1px solid #020617' }}></div>
          </div>
        </div>
      </div>

      {/* Cambio de Turno Modal */}
      <AnimatePresence>
        {isAdmin && isCambioTurnoModalOpen && (
          <div id="cambio-turno-modal" className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 shadow-2xl" data-modal-active="true">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCambioTurnoModalOpen(false)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-50 rounded-none sm:rounded-[2.5rem] w-full max-w-7xl h-full sm:h-[90vh] flex flex-col shadow-2xl relative border border-slate-200/80 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-xs">
                <div>
                  <h3 className="text-base sm:text-xl font-black text-slate-800 uppercase tracking-tight mt-1 font-sans">
                    Cambio de Turno — Azul Handling
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-limpiar-form"
                    onClick={handleClearForm}
                    className="p-2 sm:p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer mr-1"
                    title="Limpiar campos"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    id="btn-cerrar-modal"
                    onClick={() => setIsCambioTurnoModalOpen(false)}
                    className="p-2 sm:p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Mobile Tab Switcher */}
              <div className="lg:hidden flex border-b border-slate-200 bg-white p-2">
                <button
                  id="form-tab-formulario"
                  onClick={() => setActiveFormTab('formulario')}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    activeFormTab === 'formulario' 
                      ? "bg-blue-50 text-blue-700 font-extrabold" 
                      : "text-slate-505"
                  )}
                >
                  Formulario
                </button>
                <button
                  id="form-tab-vista"
                  onClick={() => setActiveFormTab('vista')}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    activeFormTab === 'vista' 
                      ? "bg-blue-50 text-blue-700 font-extrabold" 
                      : "text-slate-505"
                  )}
                >
                  Vista Justificante
                </button>
              </div>

              {/* Dual Pane Outer Group */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                {/* Left controls pane (Form inputs) */}
                <div 
                  className={cn(
                    "lg:col-span-5 h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-white border-r border-slate-250/50",
                    activeFormTab === 'formulario' ? "block" : "hidden lg:block"
                  )}
                >
                  {/* Personal info section */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Información General
                    </h4>
                    
                    {/* Checkboxes: Pasaje / Rampa */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Departamento de Solicitud</label>
                      <div className="flex gap-2">
                        {(['pasaje', 'rampa'] as const).map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => setFormType(dept)}
                            className={cn(
                              "flex-1 py-4 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer",
                              formType === dept 
                                ? "bg-[#004e89] border-[#004e89] text-white shadow-md shadow-blue-900/15" 
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fecha de la solicitud */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Fecha del documento</label>
                      <input
                        type="date"
                        value={formFechaSolicitud}
                        onChange={(e) => setFormFechaSolicitud(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all"
                      />
                    </div>

                    {/* Nombre solicitante */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Nombre del solicitante</label>
                      <input
                        id="input-solicitante-nombre"
                        type="text"
                        value={formSolicitanteNombre}
                        onChange={(e) => setFormSolicitanteNombre(e.target.value)}
                        placeholder="Ej. Juan Pérez García"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
                      />
                    </div>

                    {/* Nombre aceptante */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Empleado/a que acepta el cambio</label>
                      <input
                        id="input-acepta-nombre"
                        type="text"
                        value={formAceptaNombre}
                        onChange={(e) => setFormAceptaNombre(e.target.value)}
                        placeholder="Ej. María López Moreno"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  {/* Shifts and Dates layout */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Tramitación Horaria
                    </h4>

                    {/* Column 1: Dia y Turno que se cambia */}
                    <div className="p-3 bg-slate-50/60 rounded-2xl border border-slate-150/45 space-y-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Día y Turno a cambiar
                      </span>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Seleccionar Fecha</label>
                          <input
                            id="input-cambio-fecha"
                            type="date"
                            value={formCambioFecha}
                            onChange={(e) => handleCambioFechaChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none animate-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Hora Entrada</label>
                            <input
                              id="input-cambio-inicio"
                              type="time"
                              value={formCambioHoraInicio}
                              onChange={(e) => handleCambioHoraInicioChange(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none text-center animate-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Hora Salida</label>
                            <input
                              id="input-cambio-fin"
                              type="time"
                              value={formCambioHoraFin}
                              onChange={(e) => handleCambioHoraFinChange(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none text-center animate-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Texto Final en Impreso (Editable)</label>
                          <textarea
                            id="input-cambio-details"
                            value={formCambioDetails}
                            onChange={(e) => setFormCambioDetails(e.target.value)}
                            className="w-full h-14 bg-slate-100/50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:bg-white transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Dia y Horas Solicitadas */}
                    <div className="p-3 bg-slate-50/60 rounded-2xl border border-slate-150/45 space-y-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Día y Horas Solicitadas
                      </span>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Seleccionar Fecha</label>
                          <input
                            id="input-solicitado-fecha"
                            type="date"
                            value={formSolicitadoFecha}
                            onChange={(e) => handleSolicitadoFechaChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none animate-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Hora Entrada</label>
                            <input
                              id="input-solicitado-inicio"
                              type="time"
                              value={formSolicitadoHoraInicio}
                              onChange={(e) => handleSolicitadoHoraInicioChange(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none text-center animate-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Hora Salida</label>
                            <input
                              id="input-solicitado-fin"
                              type="time"
                              value={formSolicitadoHoraFin}
                              onChange={(e) => handleSolicitadoHoraFinChange(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none text-center animate-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9.5px] font-medium text-slate-450 uppercase tracking-wide mb-1">Texto Final en Impreso (Editable)</label>
                          <textarea
                            id="input-solicitado-details"
                            value={formSolicitadoDetails}
                            onChange={(e) => setFormSolicitadoDetails(e.target.value)}
                            className="w-full h-14 bg-slate-100/50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:bg-white transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Motivo de la solicitud */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Motivo de la solicitud</label>
                    <input
                      id="input-motivo"
                      type="text"
                      value={formMotivo}
                      onChange={(e) => setFormMotivo(e.target.value)}
                      placeholder="Ej. Cambio voluntario mutuo / Conciliación"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>

                  {/* Siganature Pads layout */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Firmas Digitales
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      {/* Signature 1 */}
                      <SignaturePad 
                        placeholder="Firma Empleado Solicitante"
                        defaultValue={signatureSolicitante}
                        onSave={(dataUrl) => setSignatureSolicitante(dataUrl)}
                      />
                      {/* Signature 2 */}
                      <SignaturePad 
                        placeholder="Firma Empleado Aceptante"
                        defaultValue={signatureAcepta}
                        onSave={(dataUrl) => setSignatureAcepta(dataUrl)}
                      />
                    </div>
                  </div>
                </div>

                {/* Right preview pane (Justificante physical paper) */}
                <div 
                  className={cn(
                    "lg:col-span-7 h-full overflow-y-auto p-4 sm:p-6 flex flex-col items-center bg-slate-100 justify-start",
                    activeFormTab === 'vista' ? "flex" : "hidden lg:flex"
                  )}
                >
                  <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-4 hidden lg:block select-none font-sans">
                    Vista previa en tiempo real — Impreso A4 Oficial
                  </p>
                  
                  {/* Miniature paper container */}
                  <div className="bg-white p-8 sm:p-10 shadow-2xl shadow-slate-300/40 rounded-xl max-w-[620px] w-full border border-slate-200/50 flex flex-col justify-between aspect-[1/1.414] text-black">
                    {/* Page Content block */}
                    <div className="space-y-4">
                      {/* Logo and branding header */}
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col items-start gap-1 scale-90 sm:scale-100 origin-top-left">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-11 flex items-center justify-center">
                              <svg className="w-full h-full" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path 
                                  d="M 16,14 C 18,10 22,10 24,14 C 26,18 22,22 18,20 C 16,19 15,16 16,14 Z M 16,21 C 12,31 10,41 18,52 C 25,62 34,70 42,76 C 37,61 31,48 24,35 C 21,30 18,25 16,21 Z M 20,18 C 34,18 49,14 65,10 C 70,8 72,11 66,15 C 52,22 38,28 23,30 C 20,30 19,20 20,18 Z M 23,34 C 34,36 45,34 56,30 C 60,28 61,31 56,34 C 45,39 34,41 24,40 C 22,40 22,35 23,34 Z M 25,44 C 33,47 41,45 49,41 C 52,39 53,42 49,45 C 41,49 33,50 26,48 C 24,48 24,44 25,44 Z M 27,53 C 33,56 39,54 44,50 C 47,48 48,51 44,54 C 39,58 33,59 28,57 C 26,57 26,54 27,53 Z" 
                                  fill="#efbc06" 
                                />
                              </svg>
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-2xl font-black tracking-tight text-[#004e89] leading-none uppercase font-sans">AZUL</span>
                              <span className="text-[9px] font-black tracking-[0.15em] text-[#004e89] uppercase leading-none mt-0.5 font-sans">HANDLING</span>
                            </div>
                          </div>
                          <div className="bg-[#efbc06] text-[#004e89] font-black text-[6px] uppercase tracking-widest px-2 py-1 mt-0.5 rounded-xs leading-none whitespace-nowrap text-center font-sans w-full max-w-[170px]">
                            HERE TO HELP, HERE TO CARE!
                          </div>
                        </div>

                        {/* Right headers */}
                        <div className="text-right text-[8px] text-slate-500 scale-90 sm:scale-100 origin-top-right">
                          <p className="font-extrabold text-[#0f172a] uppercase leading-none text-[9px] mb-1">Azul Handling</p>
                          <p className="leading-tight">Calle Migdia 37, 2 A</p>
                          <p className="leading-tight">17002 Gerona España</p>
                          <p className="leading-tight">www.azulhandling.com</p>
                        </div>
                      </div>

                      {/* Tick boxes row */}
                      <div className="flex justify-between items-center bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span className="uppercase text-[8px] tracking-wide font-extrabold">Pasaje</span>
                            <div className="w-3.5 h-3.5 border border-slate-950 flex items-center justify-center font-bold bg-white text-[9px]">
                              {(formType === 'pasaje' || formType === 'ambos') && '✓'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="uppercase text-[8px] tracking-wide font-extrabold">Rampa</span>
                            <div className="w-3.5 h-3.5 border border-slate-950 flex items-center justify-center font-bold bg-white text-[9px]">
                              {(formType === 'rampa' || formType === 'ambos') && '✓'}
                            </div>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="text-[9px] font-extrabold text-slate-700 flex items-center gap-1">
                          <span className="uppercase text-[8px]">Fecha:</span>
                          <span className="border-b border-slate-350 px-2 font-bold text-slate-900 pb-0.5">
                            {formatDateES(formFechaSolicitud) || '___/___/______'}
                          </span>
                        </div>
                      </div>

                      {/* Empresa copy */}
                      <p className="text-[7.5px] italic text-slate-400 text-left font-medium">
                        (Copia para la empresa)
                      </p>

                      {/* Fields layout */}
                      <div className="space-y-3.5 text-left text-[9px]">
                        <div>
                          <p className="font-extrabold text-[#0f172a] text-[8px] uppercase tracking-wide">Nombre del/la Solicitante:</p>
                          <p className="border-b border-slate-205 font-bold text-slate-800 uppercase mt-1 min-h-[16px] pb-0.5 text-[10px] tracking-wide">
                            {formSolicitanteNombre || ' '}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-extrabold text-[#0f172a] text-[7.5px] uppercase tracking-wide">Día/s y Turno/s que se cambian:</p>
                            <p className="border-b border-slate-205 font-medium text-slate-700 uppercase mt-1 min-h-[16px] pb-0.5 text-[8.5px] tracking-wide">
                              {formCambioDetails || ' '}
                            </p>
                          </div>
                          <div>
                            <p className="font-extrabold text-[#0f172a] text-[7.5px] uppercase tracking-wide">Día y Horas Solicitadas:</p>
                            <p className="border-b border-slate-205 font-medium text-slate-700 uppercase mt-1 min-h-[16px] pb-0.5 text-[8.5px] tracking-wide">
                              {formSolicitadoDetails || ' '}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="font-extrabold text-[#0f172a] text-[8px] uppercase tracking-wide font-sans">Nombre del/la Empleado/a que acepta el cambio:</p>
                          <p className="border-b border-slate-205 font-bold text-slate-800 uppercase mt-1 min-h-[16px] pb-0.5 text-[10px] tracking-wide">
                            {formAceptaNombre || ' '}
                          </p>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          <span className="font-extrabold text-[#0f172a] text-[8px] uppercase tracking-wide whitespace-nowrap">Motivo de la solicitud:</span>
                          <span className="border-b border-slate-205 flex-1 font-semibold text-slate-700 uppercase min-h-[14px] pb-0.2">
                            {formMotivo || ' '}
                          </span>
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <p className="text-[7.5px] text-justify leading-relaxed text-slate-450 italic mt-3 font-normal select-none">
                        (Sólo se tendrán en consideración aquellas solicitudes con un mínimo de 4 días de antelación, salvo autorización previa del/la Station Manager, o en su defecto, Jefe/a de Pasaje/Rampa. El hecho de haber rellenado la solicitud no significa la aprobación de la misma. El/La empleado/a que acepta el cambio de turno tiene que formar parte del mismo departamento/ejercer las mismas funciones).
                      </p>
                    </div>

                    {/* Bottom signatures preview */}
                    <div className="grid grid-cols-2 gap-8 text-center pt-3 mt-4">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-[#0f172a] text-[8px] uppercase tracking-wide mb-1">Firma solicitante</span>
                        <div className="border border-slate-900 w-full max-w-[130px] h-[45px] bg-white flex items-center justify-center overflow-hidden rounded-xs">
                          {signatureSolicitante ? (
                            <img src={signatureSolicitante} className="max-w-full max-h-full object-contain col-span-1 animate-none" alt="Firma" />
                          ) : (
                            <span className="text-[7px] text-slate-300 uppercase font-black tracking-widest leading-none">Sin firmar</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-[#0f172a] text-[8px] uppercase tracking-wide mb-1 flex-row font-sans">Firma empleado/a</span>
                        <div className="border border-slate-900 w-full max-w-[130px] h-[45px] bg-white flex items-center justify-center overflow-hidden rounded-xs">
                          {signatureAcepta ? (
                            <img src={signatureAcepta} className="max-w-full max-h-full object-contain col-span-1 animate-none" alt="Firma" />
                          ) : (
                            <span className="text-[7px] text-slate-300 uppercase font-black tracking-widest leading-none">Sin firmar</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer bar */}
              <div className="p-4 sm:p-6 border-t border-slate-200 bg-white flex justify-between items-center gap-4">
                <p className="text-[10px] font-medium text-slate-400 tracking-wide uppercase hidden sm:block select-none font-sans">
                  Azul Handling — Coordinación de Turnos
                </p>
                <div className="flex gap-3 w-full sm:w-auto font-sans">
                  <button
                    id="btn-descargar-pdf"
                    onClick={async () => {
                      setIsGeneratingPdf(true);
                      const element = document.getElementById('pdf-cambio-turno-template');
                      if (!element) {
                        setIsGeneratingPdf(false);
                        return;
                      }

                      // Small delay to ensure signatures are pre-rendered
                      await new Promise(resolve => setTimeout(resolve, 350));

                      // Backup stylesheets to prevent html2canvas oklch/oklab crash
                      const styleElements = Array.from(document.querySelectorAll('style'));
                      const originalStyleTexts = styleElements.map(el => el.textContent || '');
                      const disabledLinks: HTMLLinkElement[] = [];

                      try {
                        // Modify <style> elements: replace modern unsupported color functions with safe hex fallbacks
                        styleElements.forEach(el => {
                          if (el.textContent && (
                            el.textContent.includes('oklch') || 
                            el.textContent.includes('oklab') || 
                            el.textContent.includes('color-mix') || 
                            el.textContent.includes('light-dark')
                          )) {
                            let cleaned = el.textContent;
                            cleaned = cleaned.replace(/oklch\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/oklab\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/color-mix\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/light-dark\([^)]+\)/gi, '#1e293b');
                            el.textContent = cleaned;
                          }
                        });

                        // Temporarily disable link stylesheets that contain oklch/oklab/color-mix/light-dark to prevent crashes
                        const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
                        linkElements.forEach(link => {
                          try {
                            const sheet = link.sheet;
                            if (sheet) {
                              let hasUnsupported = false;
                              for (let i = 0; i < sheet.cssRules.length; i++) {
                                const text = sheet.cssRules[i].cssText;
                                if (
                                  text.includes('oklch') || 
                                  text.includes('oklab') || 
                                  text.includes('color-mix') || 
                                  text.includes('light-dark')
                                ) {
                                  hasUnsupported = true;
                                  break;
                                }
                              }
                              if (hasUnsupported) {
                                link.disabled = true;
                                disabledLinks.push(link);
                              }
                            }
                          } catch (e) {
                            // Cross-origin CSS access restrictions can happen on foreign link sheets, ignore safely
                          }
                        });
                      } catch (e) {
                        console.warn("Could not pre-process stylesheets: ", e);
                      }

                      try {
                        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                          import('html2canvas'),
                          import('jspdf'),
                        ]);
                        const canvas = await html2canvas(element, {
                          scale: 2.5, // High printing clarity
                          useCORS: true,
                          logging: false,
                          backgroundColor: '#ffffff'
                        });
                        
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        
                        const imgWidth = 210; // A4 size width in mm
                        const pageHeight = 297; // A4 size height in mm
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        
                        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                        pdf.save(`Solicitud_Cambio_Turno_${formFechaSolicitud || 'documento'}.pdf`);
                      } catch (error) {
                        console.error("Error generating PDF:", error);
                      } finally {
                        // Restore stylesheets
                        try {
                          styleElements.forEach((el, index) => {
                            el.textContent = originalStyleTexts[index];
                          });
                          disabledLinks.forEach(link => {
                            link.disabled = false;
                          });
                        } catch (e) {
                          console.error("Error restoring stylesheets", e);
                        }
                        setIsGeneratingPdf(false);
                      }
                    }}
                    disabled={isGeneratingPdf || !formSolicitanteNombre}
                    className="flex-1 sm:flex-none px-6 py-3 bg-[#004e89] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed hover:bg-blue-800 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-md hover:scale-101 active:scale-99 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <span className="animate-spin text-sm">⌛</span> GENERANDO...
                      </>
                    ) : (
                      <>
                        DESCARGAR PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsCambioTurnoModalOpen(false)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-black text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-99"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cambio IRPF Modal */}
      <AnimatePresence>
        {isAdmin && isIrpfModalOpen && (
          <div id="irpf-modal" className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 shadow-2xl" data-modal-active="true">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsIrpfModalOpen(false)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-50 rounded-none sm:rounded-[2.5rem] w-full max-w-7xl h-full sm:h-[90vh] flex flex-col shadow-2xl relative border border-slate-200/80 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-xs">
                <div>
                  <h3 className="text-base sm:text-xl font-black text-slate-800 uppercase tracking-tight mt-1 font-sans">
                    Cambio IRPF — Azul Handling
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-limpiar-irpf-form"
                    onClick={handleClearIrpfForm}
                    className="p-2 sm:p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer mr-1"
                    title="Limpiar campos"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    id="btn-cerrar-irpf-modal"
                    onClick={() => setIsIrpfModalOpen(false)}
                    className="p-2 sm:p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Mobile Tab Switcher */}
              <div className="lg:hidden flex border-b border-slate-200 bg-white p-2">
                <button
                  id="irpf-tab-formulario"
                  onClick={() => setActiveIrpfTab('formulario')}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    activeIrpfTab === 'formulario' 
                      ? "bg-blue-50 text-blue-700 font-extrabold" 
                      : "text-slate-500"
                  )}
                >
                  Formulario
                </button>
                <button
                  id="irpf-tab-vista"
                  onClick={() => setActiveIrpfTab('vista')}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    activeIrpfTab === 'vista' 
                      ? "bg-blue-50 text-blue-700 font-extrabold" 
                      : "text-slate-500"
                  )}
                >
                  Vista Justificante
                </button>
              </div>

              {/* Dual Pane Outer Group */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                {/* Left controls pane (Form inputs) */}
                <div 
                  className={cn(
                    "lg:col-span-5 h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-white border-r border-slate-250/50",
                    activeIrpfTab === 'formulario' ? "block" : "hidden lg:block"
                  )}
                >
                  {/* General info section */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Información General
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Ciudad de la firma</label>
                        <input
                          type="text"
                          value={irpfCiudad}
                          onChange={(e) => setIrpfCiudad(e.target.value)}
                          placeholder="Alicante"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Fecha del documento</label>
                        <input
                          type="date"
                          value={irpfFechaFirma}
                          onChange={(e) => setIrpfFechaFirma(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Datos Trabajador section */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Datos del/la Trabajador/a
                    </h4>
                    
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Nombre y Apellidos (Yo)</label>
                      <input
                        type="text"
                        value={irpfNombre}
                        onChange={(e) => setIrpfNombre(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">NIF / NIE</label>
                        <input
                          type="text"
                          value={irpfNif}
                          onChange={(e) => setIrpfNif(e.target.value)}
                          placeholder="12345678A"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Categoría Laboral</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIrpfCategoria('Rampa')}
                            className={cn(
                              "py-2 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl border text-center transition-all cursor-pointer",
                              irpfCategoria === 'Rampa'
                                ? "bg-blue-50 border-blue-400 text-blue-700 shadow-xs"
                                : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            Rampa
                          </button>
                          <button
                            type="button"
                            onClick={() => setIrpfCategoria('Pasaje')}
                            className={cn(
                              "py-2 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl border text-center transition-all cursor-pointer",
                              irpfCategoria === 'Pasaje'
                                ? "bg-blue-50 border-blue-400 text-blue-700 shadow-xs"
                                : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            Pasaje
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Centro de Trabajo</label>
                      <input
                        type="text"
                        value={irpfCentro}
                        readOnly
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 outline-none cursor-not-allowed"
                        title="Se rellena automáticamente con la ciudad de la firma"
                      />
                      <p className="text-[9px] font-semibold text-slate-400 mt-1">
                        * Se auto-completa automáticamente con la ciudad de la firma ({irpfCiudad || 'no especificada'}).
                      </p>
                    </div>
                  </div>

                  {/* Datos Solicitud section */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Datos de la Solicitud
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Fecha de Aplicación</label>
                        <input
                          type="date"
                          value={irpfFechaEfectiva}
                          onChange={(e) => setIrpfFechaEfectiva(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Retención de IRPF (%)</label>
                        <input
                          type="number"
                          value={irpfPorcentaje}
                          onChange={(e) => setIrpfPorcentaje(e.target.value)}
                          placeholder="Ej: 15"
                          min="0"
                          max="100"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Firma Digital
                    </h4>
                    
                    <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex justify-center">
                      <SignaturePad
                        onSave={(dataUrl) => setIrpfSignature(dataUrl)}
                        defaultValue={irpfSignature}
                        placeholder="Firma del/la Solicitante"
                      />
                    </div>
                  </div>
                </div>

                {/* Right visual pane (Live A4 document preview) */}
                <div 
                  className={cn(
                    "lg:col-span-7 h-full overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-100/50 select-none",
                    activeIrpfTab === 'vista' ? "block" : "hidden lg:flex"
                  )}
                >
                  <div 
                    className="bg-white shadow-lg border border-slate-200/60 p-12 sm:p-14 text-slate-900 rounded-2xl aspect-[1/1.41] w-full max-w-[680px] h-fit font-sans flex flex-col justify-between"
                    style={{ fontSize: '11px', lineHeight: '1.8' }}
                  >
                    <div>
                      {/* Logo & Header */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-8 flex items-center justify-center">
                              <svg className="w-full h-full" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path 
                                  d="M 16,14 C 18,10 22,10 24,14 C 26,18 22,22 18,20 C 16,19 15,16 16,14 Z M 16,21 C 12,31 10,41 18,52 C 25,62 34,70 42,76 C 37,61 31,48 24,35 C 21,30 18,25 16,21 Z M 20,18 C 34,18 49,14 65,10 C 70,8 72,11 66,15 C 52,22 38,28 23,30 C 20,30 19,20 20,18 Z M 23,34 C 34,36 45,34 56,30 C 60,28 61,31 56,34 C 45,39 34,41 24,40 C 22,40 22,35 23,34 Z M 25,44 C 33,47 41,45 49,41 C 52,39 53,42 49,45 C 41,49 33,50 26,48 C 24,48 24,44 25,44 Z M 27,53 C 33,56 39,54 44,50 C 47,48 48,51 44,54 C 39,58 33,59 28,57 C 26,57 26,54 27,53 Z" 
                                  fill="#efbc06" 
                                />
                              </svg>
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-lg font-black tracking-tight leading-none uppercase text-[#004e89]">
                                AZUL
                              </span>
                              <span className="text-[7px] font-black tracking-[0.15em] uppercase leading-none mt-0.5 text-[#004e89]">
                                HANDLING
                              </span>
                            </div>
                          </div>
                          <div className="font-black text-[5px] uppercase tracking-widest px-1.5 py-0.5 mt-0.5 rounded-xs leading-none whitespace-nowrap text-center bg-[#efbc06] text-[#004e89] w-full max-w-[140px]">
                            HERE TO HELP, HERE TO CARE!
                          </div>
                        </div>

                        <div className="text-right text-[8px] text-slate-800">
                          <p className="font-extrabold uppercase leading-tight text-slate-950">Azul Handling</p>
                          <p className="mt-1 font-medium leading-none text-slate-500">Calle Migdia 37, 2 A</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-start mb-6 text-[8px] text-slate-400">
                        <div>17002 Gerona España</div>
                        <div>Web-site: www.azulhandling.com</div>
                      </div>

                      {/* Date */}
                      <div className="text-right mb-6 text-[9px] text-slate-900 font-medium">
                        {(() => {
                          const parts = getSpanishDateParts(irpfFechaFirma);
                          return (
                            <span>
                              <span className="font-bold underline px-0.5">{irpfCiudad || '_________'}</span>, a <span className="font-bold underline px-0.5">{parts.day || '__'}</span> de <span className="font-bold underline px-0.5">{parts.month || '______'}</span> de <span className="font-bold underline px-0.5">{parts.year || '202_'}</span>
                            </span>
                          );
                        })()}
                      </div>

                      {/* Document Body */}
                      <div className="text-justify text-[9px] leading-[2.2] text-slate-900 mt-10">
                        {(() => {
                          const partsEfectiva = getSpanishDateParts(irpfFechaEfectiva);
                          return (
                            <p>
                              Yo, <span className="font-bold underline px-1.5 inline-block min-w-[120px] text-center text-slate-950">{irpfNombre || '___________________________________'}</span> con NIF/NIE N. <span className="font-bold underline px-1 inline-block min-w-[70px] text-center text-slate-950">{irpfNif || '___________________'}</span> y con la categoría laboral de <span className="font-bold underline px-1.5 inline-block min-w-[100px] text-center text-slate-950">{irpfCategoria || '______________________'}</span>, en el centro de trabajo de <span className="font-bold underline px-1 inline-block min-w-[70px] text-center text-slate-950">{irpfCentro || '_________________'}</span> solicito a mi empresa <span className="font-bold underline px-1 inline-block min-w-[70px] text-center text-slate-950">{irpfEmpresa || '_________'}</span> que a partir de <span className="font-bold underline px-0.5 inline-block min-w-[15px] text-center text-slate-950">{partsEfectiva.day}</span> de <span className="font-bold underline px-1 inline-block min-w-[50px] text-center text-slate-950">{partsEfectiva.month}</span> de <span className="font-bold underline px-0.5 inline-block min-w-[25px] text-center text-slate-950">{partsEfectiva.year}</span> me sea aplicada una retención de <span className="font-bold underline px-1 inline-block min-w-[20px] text-center text-slate-950">{irpfPorcentaje || '___'}</span> % en mi recibo de salarios.
                            </p>
                          );
                        })()}
                      </div>

                      {/* Signatures */}
                      <div className="mt-14 text-left">
                        <p className="font-bold text-[9px] text-slate-900">Firmado:</p>
                        <div className="h-20 w-44 my-2 border border-dashed border-slate-150 rounded flex items-center justify-center bg-slate-50/40 relative overflow-hidden">
                          {irpfSignature ? (
                            <img src={irpfSignature} className="max-h-full max-w-full object-contain animate-none" alt="Firma" />
                          ) : (
                            <span className="text-[7px] text-slate-350 font-bold uppercase tracking-widest">Sin firma</span>
                          )}
                        </div>
                        <div className="mt-4">
                          <p className="font-bold text-[7px] text-slate-400 uppercase tracking-wide">NIF/DNI/NIE</p>
                          <p className="font-bold text-[9px] mt-0.5 text-slate-900">{irpfNif || '___________________'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer bar */}
              <div className="p-4 sm:p-6 border-t border-slate-200 bg-white flex justify-between items-center gap-4">
                <p className="text-[10px] font-medium text-slate-400 tracking-wide uppercase hidden sm:block select-none font-sans">
                  Azul Handling — Solicitudes de IRPF
                </p>
                <div className="flex gap-3 w-full sm:w-auto font-sans">
                  <button
                    id="btn-descargar-irpf-pdf"
                    onClick={async () => {
                      setIsGeneratingPdf(true);
                      const element = document.getElementById('pdf-irpf-template');
                      if (!element) {
                        setIsGeneratingPdf(false);
                        return;
                      }

                      await new Promise(resolve => setTimeout(resolve, 350));

                      const styleElements = Array.from(document.querySelectorAll('style'));
                      const originalStyleTexts = styleElements.map(el => el.textContent || '');
                      const disabledLinks: HTMLLinkElement[] = [];

                      try {
                        styleElements.forEach(el => {
                          if (el.textContent && (
                            el.textContent.includes('oklch') || 
                            el.textContent.includes('oklab') || 
                            el.textContent.includes('color-mix') || 
                            el.textContent.includes('light-dark')
                          )) {
                            let cleaned = el.textContent;
                            cleaned = cleaned.replace(/oklch\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/oklab\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/color-mix\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/light-dark\([^)]+\)/gi, '#1e293b');
                            el.textContent = cleaned;
                          }
                        });

                        const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
                        linkElements.forEach(link => {
                          try {
                            const sheet = link.sheet;
                            if (sheet) {
                              let hasUnsupported = false;
                              for (let i = 0; i < sheet.cssRules.length; i++) {
                                const text = sheet.cssRules[i].cssText;
                                if (
                                  text.includes('oklch') || 
                                  text.includes('oklab') || 
                                  text.includes('color-mix') || 
                                  text.includes('light-dark')
                                ) {
                                  hasUnsupported = true;
                                  break;
                                }
                              }
                              if (hasUnsupported) {
                                link.disabled = true;
                                disabledLinks.push(link);
                              }
                            }
                          } catch (e) {
                          }
                        });
                      } catch (e) {
                        console.warn("Could not pre-process stylesheets: ", e);
                      }

                      try {
                        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                          import('html2canvas'),
                          import('jspdf'),
                        ]);
                        const canvas = await html2canvas(element, {
                          scale: 2.5,
                          useCORS: true,
                          logging: false,
                          backgroundColor: '#ffffff'
                        });
                        
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        
                        const imgWidth = 210;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        
                        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                        pdf.save(`Solicitud_Cambio_IRPF_${irpfNombre.replace(/\s+/g, '_') || 'documento'}.pdf`);
                      } catch (error) {
                        console.error("Error generating PDF:", error);
                      } finally {
                        try {
                          styleElements.forEach((el, index) => {
                            el.textContent = originalStyleTexts[index];
                          });
                          disabledLinks.forEach(link => {
                            link.disabled = false;
                          });
                        } catch (e) {
                          console.error("Error restoring stylesheets", e);
                        }
                        setIsGeneratingPdf(false);
                      }
                    }}
                    disabled={isGeneratingPdf || !irpfNombre || !irpfNif}
                    className="flex-1 sm:flex-none px-6 py-3 bg-[#004e89] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed hover:bg-blue-800 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-md hover:scale-101 active:scale-99 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <span className="animate-spin text-sm">⌛</span> GENERANDO...
                      </>
                    ) : (
                      <>
                        DESCARGAR PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsIrpfModalOpen(false)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-black text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-99"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cambio PP Extra Modal */}
      <AnimatePresence>
        {isAdmin && isPpExtraModalOpen && (
          <div id="pp-extra-modal" className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 shadow-2xl" data-modal-active="true">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPpExtraModalOpen(false)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-50 rounded-none sm:rounded-[2.5rem] w-full max-w-7xl h-full sm:h-[90vh] flex flex-col shadow-2xl relative border border-slate-200/80 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-xs">
                <div>
                  <h3 className="text-base sm:text-xl font-black text-slate-800 uppercase tracking-tight mt-1 font-sans">
                    Cambio PP Extra — Azul Handling
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-limpiar-pp-extra-form"
                    onClick={handleClearPpExtraForm}
                    className="p-2 sm:p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer mr-1"
                    title="Limpiar campos"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    id="btn-cerrar-pp-extra-modal"
                    onClick={() => setIsPpExtraModalOpen(false)}
                    className="p-2 sm:p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    title="Cerrar ventana"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Mobile tabs for switching between form editor and PDF preview */}
              <div className="flex lg:hidden bg-white border-b border-slate-200 p-2 font-sans">
                <button
                  onClick={() => setActivePpExtraTab('formulario')}
                  className={cn(
                    "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                    activePpExtraTab === 'formulario' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  Formulario
                </button>
                <button
                  onClick={() => setActivePpExtraTab('vista')}
                  className={cn(
                    "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                    activePpExtraTab === 'vista' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  Vista Justificante
                </button>
              </div>

              {/* Main Contents Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden h-full">
                {/* Left interactive form (Scrollable) */}
                <div 
                  className={cn(
                    "lg:col-span-5 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 border-r border-slate-200/50 font-sans",
                    activePpExtraTab === 'formulario' ? "block" : "hidden lg:block"
                  )}
                >
                  {/* Field group */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest pb-1.5 border-b border-slate-100">
                      Datos del Solicitante
                    </h4>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Nombre y Apellidos</label>
                        <input
                          type="text"
                          value={ppExtraNombre}
                          onChange={(e) => setPpExtraNombre(e.target.value)}
                          placeholder="Ej: Juan Pérez Gómez"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">DNI / NIE</label>
                        <input
                          type="text"
                          value={ppExtraDni}
                          onChange={(e) => setPpExtraDni(e.target.value)}
                          placeholder="Ej: 12345678Z"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Periodicity group */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-455 uppercase tracking-widest pb-1.5 border-b border-slate-100">
                      Periodicidad de Nómina
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPpExtraPagas('14')}
                        className={cn(
                          "flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all cursor-pointer",
                          ppExtraPagas === '14'
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-base font-black">14 Pagas</span>
                        <span className="text-[9px] font-semibold text-slate-450 mt-1">Extras de verano y navidad</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPpExtraPagas('12')}
                        className={cn(
                          "flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all cursor-pointer",
                          ppExtraPagas === '12'
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-base font-black">12 Pagas</span>
                        <span className="text-[9px] font-semibold text-slate-450 mt-1">Mensuales prorrateadas</span>
                      </button>
                    </div>
                  </div>

                  {/* Year / Application parameters */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-455 uppercase tracking-widest pb-1.5 border-b border-slate-100">
                      Parámetros de Aplicación
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Año Natural</label>
                        <input
                          type="text"
                          value={ppExtraAnioNatural}
                          onChange={(e) => setPpExtraAnioNatural(e.target.value)}
                          placeholder="Ej: 2026"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Ciudad de Firma</label>
                        <input
                          type="text"
                          value={ppExtraCiudad}
                          onChange={(e) => setPpExtraCiudad(e.target.value)}
                          placeholder="Alicante"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Fecha de la Firma</label>
                      <input
                        type="date"
                        value={ppExtraFechaFirma}
                        onChange={(e) => setPpExtraFechaFirma(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      Firma Digital
                    </h4>
                    
                    <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 flex justify-center">
                      <SignaturePad
                        onSave={(dataUrl) => setPpExtraSignature(dataUrl)}
                        defaultValue={ppExtraSignature}
                        placeholder="Firma de la Persona Trabajadora"
                      />
                    </div>
                  </div>
                </div>

                {/* Right visual pane (Live A4 document preview) */}
                <div 
                  className={cn(
                    "lg:col-span-7 h-full overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-100/50 select-none",
                    activePpExtraTab === 'vista' ? "block" : "hidden lg:flex"
                  )}
                >
                  <div 
                    className="bg-white shadow-lg border border-slate-200/60 p-12 sm:p-14 text-slate-900 rounded-2xl aspect-[1/1.41] w-full max-w-[680px] h-fit font-sans flex flex-col justify-between"
                    style={{ fontSize: '11px', lineHeight: '1.8' }}
                  >
                    <div>
                      {/* Logo & Header */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-8 flex items-center justify-center">
                              <svg className="w-full h-full" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path 
                                  d="M 16,14 C 18,10 22,10 24,14 C 26,18 22,22 18,20 C 16,19 15,16 16,14 Z M 16,21 C 12,31 10,41 18,52 C 25,62 34,70 42,76 C 37,61 31,48 24,35 C 21,30 18,25 16,21 Z M 20,18 C 34,18 49,14 65,10 C 70,8 72,11 66,15 C 52,22 38,28 23,30 C 20,30 19,20 20,18 Z M 23,34 C 34,36 45,34 56,30 C 60,28 61,31 56,34 C 45,39 34,41 24,40 C 22,40 22,35 23,34 Z M 25,44 C 33,47 41,45 49,41 C 52,39 53,42 49,45 C 41,49 33,50 26,48 C 24,48 24,44 25,44 Z M 27,53 C 33,56 39,54 44,50 C 47,48 48,51 44,54 C 39,58 33,59 28,57 C 26,57 26,54 27,53 Z" 
                                  fill="#efbc06" 
                                />
                              </svg>
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-lg font-black tracking-tight leading-none uppercase text-[#004e89]">
                                AZUL
                              </span>
                              <span className="text-[7px] font-black tracking-[0.15em] uppercase leading-none mt-0.5 text-[#004e89]">
                                HANDLING
                              </span>
                            </div>
                          </div>
                          <div className="font-black text-[5px] uppercase tracking-widest px-1.5 py-0.5 mt-0.5 rounded-xs leading-none whitespace-nowrap text-center bg-[#efbc06] text-[#004e89] w-full max-w-[140px]">
                            HERE TO HELP, HERE TO CARE!
                          </div>
                        </div>

                        <div className="text-right text-[8px] text-slate-800">
                          <p className="font-extrabold uppercase leading-tight text-slate-950">Azul Handling</p>
                          <p className="mt-1 font-medium leading-none text-slate-500">Calle Migdia 37, 2 A</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-start mb-6 text-[8px] text-slate-400">
                        <div>17002 Gerona España</div>
                        <div>Web-site: www.azulhandling.com</div>
                      </div>

                      {/* Centered Document Title */}
                      <div className="text-center my-6">
                        <h2 className="text-[10px] font-black uppercase tracking-wide border-b border-black inline-block pb-0.5 leading-none">
                          SOLICITUD CAMBIO PERIODICIDAD DE PAGO DE NOMINA
                        </h2>
                      </div>

                      {/* Confidential indicator on right */}
                      <div className="text-right mb-4">
                        <p className="font-bold italic text-[9px] text-slate-950">Privado y Confidencial</p>
                      </div>

                      {/* Date and Place */}
                      <div className="text-left mb-6 text-[9px] text-slate-900 font-medium">
                        {(() => {
                          const parts = getSpanishDateParts(ppExtraFechaFirma);
                          return (
                            <span>
                              En <span className="font-bold underline px-0.5">{ppExtraCiudad || '_________'}</span>, a <span className="font-bold underline px-0.5">{parts.day || '__'}</span> de <span className="font-bold underline px-0.5">{parts.month || '______'}</span> de <span className="font-bold underline px-0.5">{parts.year || '202_'}</span>
                            </span>
                          );
                        })()}
                      </div>

                      {/* Attention of */}
                      <div className="text-left mb-6 text-[9px] text-slate-900 font-bold">
                        A/A: RRHH de AZUL HANDLING SPAIN LTD SUCURSAL ESPAÑA
                      </div>

                      {/* Document Body */}
                      <div className="text-justify text-[9px] leading-[2.2] text-slate-900 mt-6">
                        <p>
                          Por la presente, yo <span className="font-bold underline px-1.5 inline-block min-w-[150px] text-center text-slate-950">{ppExtraNombre || '___________________________________'}</span> con DNI/NIE <span className="font-bold underline px-1 inline-block min-w-[70px] text-center text-slate-950">{ppExtraDni || '___________________'}</span>, solicito para todo el año natural 20<span className="font-bold underline px-1 inline-block min-w-[20px] text-center text-slate-950">{ppExtraAnioNatural ? ppExtraAnioNatural.slice(-2) : '__'}</span>, el pago de mi nómina fraccionado en <span className="font-bold underline px-1">[{ppExtraPagas}]</span> pagas.
                        </p>
                      </div>

                      <div className="text-left mt-6 text-[9px] text-slate-900">
                        Atentamente,
                      </div>

                      {/* Signatures */}
                      <div className="mt-10 text-left">
                        <p className="font-bold text-[9px] text-slate-900">Firma persona trabajadora:</p>
                        <div className="h-16 w-36 my-1.5 border border-dashed border-slate-150 rounded flex items-center justify-center bg-slate-50/40 relative overflow-hidden">
                          {ppExtraSignature ? (
                            <img src={ppExtraSignature} className="max-h-full max-w-full object-contain animate-none" alt="Firma" />
                          ) : (
                            <span className="text-[7px] text-slate-350 font-bold uppercase tracking-widest">Sin firma</span>
                          )}
                        </div>
                        <div className="mt-3">
                          <p className="font-bold text-[9px] mt-0.5 text-slate-900">
                            D./Dña. <span className="font-bold underline px-1">{ppExtraNombre || '_________________________'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer bar */}
              <div className="p-4 sm:p-6 border-t border-slate-200 bg-white flex justify-between items-center gap-4">
                <p className="text-[10px] font-medium text-slate-400 tracking-wide uppercase hidden sm:block select-none font-sans">
                  Azul Handling — Solicitud de Periodicidad de Pago
                </p>
                <div className="flex gap-3 w-full sm:w-auto font-sans">
                  <button
                    id="btn-descargar-pp-extra-pdf"
                    onClick={async () => {
                      setIsGeneratingPdf(true);
                      const element = document.getElementById('pdf-pp-extra-template');
                      if (!element) {
                        setIsGeneratingPdf(false);
                        return;
                      }

                      await new Promise(resolve => setTimeout(resolve, 350));

                      const styleElements = Array.from(document.querySelectorAll('style'));
                      const originalStyleTexts = styleElements.map(el => el.textContent || '');
                      const disabledLinks: HTMLLinkElement[] = [];

                      try {
                        styleElements.forEach(el => {
                          if (el.textContent && (
                            el.textContent.includes('oklch') || 
                            el.textContent.includes('oklab') || 
                            el.textContent.includes('color-mix') || 
                            el.textContent.includes('light-dark')
                          )) {
                            let cleaned = el.textContent;
                            cleaned = cleaned.replace(/oklch\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/oklab\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/color-mix\([^)]+\)/gi, '#1e293b');
                            cleaned = cleaned.replace(/light-dark\([^)]+\)/gi, '#1e293b');
                            el.textContent = cleaned;
                          }
                        });

                        const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
                        linkElements.forEach(link => {
                          try {
                            const sheet = link.sheet;
                            if (sheet) {
                              let hasUnsupported = false;
                              for (let i = 0; i < sheet.cssRules.length; i++) {
                                const text = sheet.cssRules[i].cssText;
                                if (
                                  text.includes('oklch') || 
                                  text.includes('oklab') || 
                                  text.includes('color-mix') || 
                                  text.includes('light-dark')
                                ) {
                                  hasUnsupported = true;
                                  break;
                                }
                              }
                              if (hasUnsupported) {
                                link.disabled = true;
                                disabledLinks.push(link);
                              }
                            }
                          } catch (e) {
                          }
                        });
                      } catch (e) {
                        console.warn("Could not pre-process stylesheets: ", e);
                      }

                      try {
                        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                          import('html2canvas'),
                          import('jspdf'),
                        ]);
                        const canvas = await html2canvas(element, {
                          scale: 2.5,
                          useCORS: true,
                          logging: false,
                          backgroundColor: '#ffffff'
                        });
                        
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        
                        const imgWidth = 210;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        
                        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                        pdf.save(`Solicitud_Cambio_PP_Extra_${ppExtraNombre.replace(/\s+/g, '_') || 'documento'}.pdf`);
                      } catch (error) {
                        console.error("Error generating PDF:", error);
                      } finally {
                        try {
                          styleElements.forEach((el, index) => {
                            el.textContent = originalStyleTexts[index];
                          });
                          disabledLinks.forEach(link => {
                            link.disabled = false;
                          });
                        } catch (e) {
                          console.error("Error restoring stylesheets", e);
                        }
                        setIsGeneratingPdf(false);
                      }
                    }}
                    disabled={isGeneratingPdf || !ppExtraNombre || !ppExtraDni}
                    className="flex-1 sm:flex-none px-6 py-3 bg-[#004e89] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed hover:bg-blue-800 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-md hover:scale-101 active:scale-99 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <span className="animate-spin text-sm">⌛</span> GENERANDO...
                      </>
                    ) : (
                      <>
                        DESCARGAR PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsPpExtraModalOpen(false)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-black text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-99"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DateRangePickerModal
        isOpen={bajaRangePickerStep !== null}
        onClose={() => setBajaRangePickerStep(null)}
        startDate={bajaRangeStart}
        endDate={bajaRangeEnd}
        initialStep={bajaRangePickerStep || 'start'}
        title="Tramo de Baja (Laboral / Enfermedad Común)"
        subtitle="Marca el inicio y el fin de la baja en el calendario"
        accentColor="rose"
        onChangeRange={(start, end) => {
          setBajaRangeStart(start);
          setBajaRangeEnd(end);
        }}
      />

      {/* Modal para definir ciclo de rotación personalizado o mixto (lápiz) */}
      <CustomRotationModal
        isOpen={isCustomRotationModalOpen}
        onClose={() => setIsCustomRotationModalOpen(false)}
        initialWorkDays={customWorkDays}
        initialFreeDays={customFreeDays}
        initialFirstFreeDay={customFirstFreeDay}
        initialMode={customModalInitialMode}
        initialMixedConfig={mixedConfig}
        currentMonth={currentMonth}
        onSave={handleSaveCustomRotation}
        onSaveMixed={handleSaveMixedRotation}
      />

    </div>
  );
};
