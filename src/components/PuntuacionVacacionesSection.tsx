import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Umbrella,
  Sliders,
  Check,
  Edit2,
  Save,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, Settings, DayShift } from '../types';
import { safeFormat } from '../utils';

export interface VacationScorePeriod {
  id: string;
  name: string;
  startMMDD: string; // MM-DD
  endMMDD: string;   // MM-DD
  points: number;
}

export interface VacationYearScoreConfig {
  divisor?: number;
  customDivisorEnabled?: boolean;
  holidayBonusEnabled: boolean;
  holidayBonusPoints: number;
  periods: VacationScorePeriod[];
}

export interface MonthMeta {
  monthIndex: number;
  monthStr: string;
  name: string;
  daysInMonth: number;
}

export const MONTHS_LIST: MonthMeta[] = [
  { monthIndex: 1, monthStr: '01', name: 'Enero', daysInMonth: 31 },
  { monthIndex: 2, monthStr: '02', name: 'Febrero', daysInMonth: 29 },
  { monthIndex: 3, monthStr: '03', name: 'Marzo', daysInMonth: 31 },
  { monthIndex: 4, monthStr: '04', name: 'Abril', daysInMonth: 30 },
  { monthIndex: 5, monthStr: '05', name: 'Mayo', daysInMonth: 31 },
  { monthIndex: 6, monthStr: '06', name: 'Junio', daysInMonth: 30 },
  { monthIndex: 7, monthStr: '07', name: 'Julio', daysInMonth: 31 },
  { monthIndex: 8, monthStr: '08', name: 'Agosto', daysInMonth: 31 },
  { monthIndex: 9, monthStr: '09', name: 'Septiembre', daysInMonth: 30 },
  { monthIndex: 10, monthStr: '10', name: 'Octubre', daysInMonth: 31 },
  { monthIndex: 11, monthStr: '11', name: 'Noviembre', daysInMonth: 30 },
  { monthIndex: 12, monthStr: '12', name: 'Diciembre', daysInMonth: 31 },
];

export const formatPeriodName = (startDay: number, endDay: number, monthName: string, daysInMonth: number): string => {
  if (startDay === 1 && endDay === daysInMonth) {
    return monthName;
  }
  return `${startDay} - ${endDay} ${monthName}`;
};

export const DEFAULT_VACATION_PERIODS: VacationScorePeriod[] = [
  { id: 'jan_1', name: '1 - 7 Enero', startMMDD: '01-01', endMMDD: '01-07', points: 8 },
  { id: 'jan_2', name: '8 - 31 Enero', startMMDD: '01-08', endMMDD: '01-31', points: 0 },
  { id: 'feb', name: 'Febrero', startMMDD: '02-01', endMMDD: '02-29', points: 0 },
  { id: 'mar', name: 'Marzo', startMMDD: '03-01', endMMDD: '03-31', points: 2 },
  { id: 'apr', name: 'Abril', startMMDD: '04-01', endMMDD: '04-30', points: 4 },
  { id: 'may', name: 'Mayo', startMMDD: '05-01', endMMDD: '05-31', points: 5 },
  { id: 'jun', name: 'Junio', startMMDD: '06-01', endMMDD: '06-30', points: 7 },
  { id: 'jul', name: 'Julio', startMMDD: '07-01', endMMDD: '07-31', points: 9 },
  { id: 'aug', name: 'Agosto', startMMDD: '08-01', endMMDD: '08-31', points: 10 },
  { id: 'sep_1', name: '1 - 15 Septiembre', startMMDD: '09-01', endMMDD: '09-15', points: 8 },
  { id: 'sep_2', name: '16 - 30 Septiembre', startMMDD: '09-16', endMMDD: '09-30', points: 7 },
  { id: 'oct', name: 'Octubre', startMMDD: '10-01', endMMDD: '10-31', points: 0 },
  { id: 'nov', name: 'Noviembre', startMMDD: '11-01', endMMDD: '11-30', points: 0 },
  { id: 'dec_1', name: '1 - 15 Diciembre', startMMDD: '12-01', endMMDD: '12-15', points: 3 },
  { id: 'dec_2', name: '16 - 31 Diciembre', startMMDD: '12-16', endMMDD: '12-31', points: 8 },
];

export const getDefaultYearScoreConfig = (year: number): VacationYearScoreConfig => ({
  divisor: 21,
  customDivisorEnabled: false,
  holidayBonusEnabled: year >= 2026,
  holidayBonusPoints: 4,
  periods: DEFAULT_VACATION_PERIODS.map(p => ({ ...p })),
});

export function calculateVacationScoreForYear(
  year: number,
  vacations: string[] = [],
  holidays: string[] = []
): { finalScore: number; totalPoints: number; totalVacationDays: number } {
  let config = getDefaultYearScoreConfig(year);
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('vacation_scores_by_year') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[year]) {
        config = parsed[year];
      }
    }
  } catch {}

  const yearVacations = (vacations || [])
    .filter((v: string) => v && v.startsWith(`${year}-`))
    .sort();

  const holidaysSet = new Set(holidays || []);

  const totalPoints = yearVacations.reduce((sum, dateStr) => {
    const mmdd = dateStr.slice(5, 10);
    const period = config.periods.find(p => mmdd >= p.startMMDD && mmdd <= p.endMMDD);
    const basePoints = period ? Number(period.points) || 0 : 0;

    const isSpringWindow = mmdd >= '03-22' && mmdd <= '05-06';
    const isNotMay1 = mmdd !== '05-01';
    const isHoliday = holidaysSet.has(dateStr);
    const bonusApplies = Boolean(
      config.holidayBonusEnabled &&
      year >= 2026 &&
      isSpringWindow &&
      isNotMay1 &&
      isHoliday
    );
    const bonusPoints = bonusApplies ? (Number(config.holidayBonusPoints) || 0) : 0;
    return sum + basePoints + bonusPoints;
  }, 0);

  const isCustomDivisor = Boolean(config.customDivisorEnabled);
  const totalVacationDays = yearVacations.length;
  const effectiveDivisor = isCustomDivisor
    ? (Number(config.divisor) && Number(config.divisor) > 0 ? Number(config.divisor) : 1)
    : totalVacationDays;

  const finalScore = effectiveDivisor > 0 ? totalPoints / effectiveDivisor : 0;

  return { finalScore, totalPoints, totalVacationDays };
}

interface PuntuacionVacacionesSectionProps {
  settings: Settings;
  shifts?: DayShift[];
  hideHeader?: boolean;
  className?: string;
}

export const PuntuacionVacacionesSection: React.FC<PuntuacionVacacionesSectionProps> = ({
  settings,
  hideHeader = false,
  className,
}) => {
  // Estado desplegado / recogido general de la sección (por defecto false/recogido)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isVacationScoresExpanded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('isVacationScoresExpanded', String(isExpanded));
    } catch (e) {
      console.warn(e);
    }
  }, [isExpanded]);

  // Estados desplegables individuales de las subsecciones (por defecto recogidos / false)
  const [isBonusExpanded, setIsBonusExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isVacationBonusExpanded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('isVacationBonusExpanded', String(isBonusExpanded));
    } catch (e) {
      console.warn(e);
    }
  }, [isBonusExpanded]);

  const [isPeriodsExpanded, setIsPeriodsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isVacationPeriodsExpanded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('isVacationPeriodsExpanded', String(isPeriodsExpanded));
    } catch (e) {
      console.warn(e);
    }
  }, [isPeriodsExpanded]);

  const [isDaysExpanded, setIsDaysExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isVacationDaysExpanded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('isVacationDaysExpanded', String(isDaysExpanded));
    } catch (e) {
      console.warn(e);
    }
  }, [isDaysExpanded]);

  // Año activo para la puntuación de vacaciones
  const [scoreYear, setScoreYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('vacation_score_active_year');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
      }
    } catch (e) {
      console.warn(e);
    }
    return new Date().getFullYear();
  });

  useEffect(() => {
    try {
      localStorage.setItem('vacation_score_active_year', String(scoreYear));
    } catch (e) {
      console.warn(e);
    }
  }, [scoreYear]);

  // Almacén de configuraciones por año
  const [scoresByYear, setScoresByYear] = useState<{ [year: number]: VacationYearScoreConfig }>(() => {
    try {
      const raw = localStorage.getItem('vacation_scores_by_year');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn(e);
    }
    return {};
  });

  const updateYearConfig = (year: number, updater: (prev: VacationYearScoreConfig) => VacationYearScoreConfig) => {
    setScoresByYear(prev => {
      const current = prev[year] || getDefaultYearScoreConfig(year);
      const updated = updater(current);
      const nextState = { ...prev, [year]: updated };
      try {
        localStorage.setItem('vacation_scores_by_year', JSON.stringify(nextState));
      } catch (e) {
        console.warn(e);
      }
      return nextState;
    });
  };

  const handleResetCurrentYear = () => {
    setScoresByYear(prev => {
      const nextState = { ...prev, [scoreYear]: getDefaultYearScoreConfig(scoreYear) };
      try {
        localStorage.setItem('vacation_scores_by_year', JSON.stringify(nextState));
      } catch (e) {
        console.warn(e);
      }
      return nextState;
    });
  };

  // Configuración vigente para el año seleccionado
  const currentConfig: VacationYearScoreConfig = useMemo(() => {
    return scoresByYear[scoreYear] || getDefaultYearScoreConfig(scoreYear);
  }, [scoresByYear, scoreYear]);

  // Estados para la edición de períodos
  const [isEditingPeriods, setIsEditingPeriods] = useState<boolean>(false);
  const [draftPeriods, setDraftPeriods] = useState<VacationScorePeriod[]>([]);
  const [periodsFeedback, setPeriodsFeedback] = useState<string | null>(null);

  const handleStartEditPeriods = () => {
    setDraftPeriods(JSON.parse(JSON.stringify(currentConfig.periods)));
    setIsEditingPeriods(true);
    setPeriodsFeedback(null);
  };

  const handleSaveDraftPeriods = () => {
    const sorted = [...draftPeriods].sort((a, b) => a.startMMDD.localeCompare(b.startMMDD));
    updateYearConfig(scoreYear, prev => ({
      ...prev,
      periods: sorted,
    }));
    setIsEditingPeriods(false);
    setPeriodsFeedback('Períodos y puntuaciones guardados correctamente.');
    setTimeout(() => setPeriodsFeedback(null), 3500);
  };

  const handleResetPeriods = () => {
    const defaults = DEFAULT_VACATION_PERIODS.map(p => ({ ...p }));
    if (isEditingPeriods) {
      setDraftPeriods(defaults);
    } else {
      updateYearConfig(scoreYear, prev => ({
        ...prev,
        periods: defaults,
      }));
    }
    setPeriodsFeedback('Períodos restablecidos a los valores oficiales por defecto.');
    setTimeout(() => setPeriodsFeedback(null), 3500);
  };

  const handleCancelEditPeriods = () => {
    setIsEditingPeriods(false);
    setDraftPeriods([]);
    setPeriodsFeedback(null);
  };

  const applyMonthPreset = (m: MonthMeta, preset: 'full' | 'half' | 'week') => {
    setDraftPeriods(prev => {
      const others = prev.filter(p => !p.startMMDD.startsWith(`${m.monthStr}-`));
      const currentMonthP = prev.filter(p => p.startMMDD.startsWith(`${m.monthStr}-`));
      const firstPts = currentMonthP[0]?.points ?? 0;
      const secondPts = currentMonthP[1]?.points ?? firstPts;

      let newPeriods: VacationScorePeriod[] = [];
      const timestamp = Date.now();

      if (preset === 'full') {
        newPeriods = [{
          id: `${m.name.toLowerCase()}_full_${timestamp}`,
          name: m.name,
          startMMDD: `${m.monthStr}-01`,
          endMMDD: `${m.monthStr}-${String(m.daysInMonth).padStart(2, '0')}`,
          points: firstPts,
        }];
      } else if (preset === 'half') {
        newPeriods = [
          {
            id: `${m.name.toLowerCase()}_q1_${timestamp}`,
            name: `1 - 15 ${m.name}`,
            startMMDD: `${m.monthStr}-01`,
            endMMDD: `${m.monthStr}-15`,
            points: firstPts,
          },
          {
            id: `${m.name.toLowerCase()}_q2_${timestamp + 1}`,
            name: `16 - ${m.daysInMonth} ${m.name}`,
            startMMDD: `${m.monthStr}-16`,
            endMMDD: `${m.monthStr}-${String(m.daysInMonth).padStart(2, '0')}`,
            points: secondPts,
          },
        ];
      } else if (preset === 'week') {
        newPeriods = [
          {
            id: `${m.name.toLowerCase()}_w1_${timestamp}`,
            name: `1 - 7 ${m.name}`,
            startMMDD: `${m.monthStr}-01`,
            endMMDD: `${m.monthStr}-07`,
            points: firstPts || 8,
          },
          {
            id: `${m.name.toLowerCase()}_w2_${timestamp + 1}`,
            name: `8 - ${m.daysInMonth} ${m.name}`,
            startMMDD: `${m.monthStr}-08`,
            endMMDD: `${m.monthStr}-${String(m.daysInMonth).padStart(2, '0')}`,
            points: secondPts || 0,
          },
        ];
      }

      return [...others, ...newPeriods].sort((a, b) => a.startMMDD.localeCompare(b.startMMDD));
    });
  };

  const handlePeriodDayChange = (
    periodId: string, 
    field: 'start' | 'end', 
    valStr: string, 
    m: MonthMeta
  ) => {
    const num = parseInt(valStr, 10);
    if (isNaN(num)) return;
    const clamped = Math.max(1, Math.min(m.daysInMonth, num));

    setDraftPeriods(prev => prev.map(p => {
      if (p.id !== periodId) return p;
      let sDay = parseInt(p.startMMDD.slice(3, 5), 10) || 1;
      let eDay = parseInt(p.endMMDD.slice(3, 5), 10) || m.daysInMonth;

      if (field === 'start') {
        sDay = clamped;
        if (sDay > eDay) eDay = sDay;
      } else {
        eDay = clamped;
        if (eDay < sDay) sDay = eDay;
      }

      const startMMDD = `${m.monthStr}-${String(sDay).padStart(2, '0')}`;
      const endMMDD = `${m.monthStr}-${String(eDay).padStart(2, '0')}`;
      const name = formatPeriodName(sDay, eDay, m.name, m.daysInMonth);

      return {
        ...p,
        startMMDD,
        endMMDD,
        name,
      };
    }));
  };

  const handlePeriodPointsChange = (periodId: string, valStr: string) => {
    const num = parseFloat(valStr);
    const points = isNaN(num) ? 0 : Math.max(0, num);
    setDraftPeriods(prev => prev.map(p => p.id === periodId ? { ...p, points } : p));
  };

  const handleAddPeriodToMonth = (m: MonthMeta) => {
    setDraftPeriods(prev => {
      const monthP = prev.filter(p => p.startMMDD.startsWith(`${m.monthStr}-`));
      const lastP = monthP[monthP.length - 1];
      let sDay = 1;
      if (lastP) {
        const lastEDay = parseInt(lastP.endMMDD.slice(3, 5), 10) || 1;
        sDay = Math.min(m.daysInMonth, lastEDay + 1);
      }
      const eDay = m.daysInMonth;
      const newP: VacationScorePeriod = {
        id: `${m.name.toLowerCase()}_${Date.now()}`,
        name: formatPeriodName(sDay, eDay, m.name, m.daysInMonth),
        startMMDD: `${m.monthStr}-${String(sDay).padStart(2, '0')}`,
        endMMDD: `${m.monthStr}-${String(eDay).padStart(2, '0')}`,
        points: 0,
      };
      return [...prev, newP].sort((a, b) => a.startMMDD.localeCompare(b.startMMDD));
    });
  };

  const handleRemovePeriod = (periodId: string, m: MonthMeta) => {
    setDraftPeriods(prev => {
      const monthP = prev.filter(p => p.startMMDD.startsWith(`${m.monthStr}-`));
      if (monthP.length <= 1) return prev;
      return prev.filter(p => p.id !== periodId);
    });
  };

  // Días de vacaciones registrados para scoreYear
  const yearVacations = useMemo(() => {
    return (settings.vacations || [])
      .filter((v: string) => v.startsWith(`${scoreYear}-`))
      .sort();
  }, [settings.vacations, scoreYear]);

  // Desglose de cada día de vacaciones de scoreYear con sus puntos base y bonus
  const vacationDetails = useMemo(() => {
    const holidaysSet = new Set(settings.holidays || []);
    return yearVacations.map(dateStr => {
      const mmdd = dateStr.slice(5, 10);
      const period = currentConfig.periods.find(p => mmdd >= p.startMMDD && mmdd <= p.endMMDD);
      const basePoints = period ? Number(period.points) || 0 : 0;

      // Regla festivos Semana Santa / Primavera:
      // Festivos desde el 22 de Marzo al 6 de Mayo ambos incluidos exceptuando el 1 de Mayo
      // A partir del 2026 en adelante
      const isSpringWindow = mmdd >= '03-22' && mmdd <= '05-06';
      const isNotMay1 = mmdd !== '05-01';
      const isHoliday = holidaysSet.has(dateStr);
      const bonusApplies = Boolean(
        currentConfig.holidayBonusEnabled &&
        scoreYear >= 2026 &&
        isSpringWindow &&
        isNotMay1 &&
        isHoliday
      );
      const bonusPoints = bonusApplies ? (Number(currentConfig.holidayBonusPoints) || 0) : 0;
      const totalDayPoints = basePoints + bonusPoints;

      return {
        date: dateStr,
        periodName: period ? period.name : 'Sin período',
        basePoints,
        bonusApplies,
        bonusPoints,
        totalDayPoints,
        isHoliday,
      };
    });
  }, [yearVacations, currentConfig, settings.holidays, scoreYear]);


  // Cálculo total
  const totalBasePoints = useMemo(() => {
    return vacationDetails.reduce((sum, d) => sum + d.basePoints, 0);
  }, [vacationDetails]);

  const totalBonusPoints = useMemo(() => {
    return vacationDetails.reduce((sum, d) => sum + d.bonusPoints, 0);
  }, [vacationDetails]);

  const totalPoints = totalBasePoints + totalBonusPoints;

  const isCustomDivisor = Boolean(currentConfig.customDivisorEnabled);
  const totalVacationDays = yearVacations.length;
  // Por defecto, divide la puntuación entre el número total de días de vacaciones del año
  // Si la casilla está marcada, utiliza el número editado
  const effectiveDivisor = isCustomDivisor
    ? (Number(currentConfig.divisor) && Number(currentConfig.divisor) > 0 ? Number(currentConfig.divisor) : 1)
    : totalVacationDays;

  const finalScore = effectiveDivisor > 0 ? totalPoints / effectiveDivisor : 0;

  // Días que recibieron bonificación de festivo
  const bonusDaysCount = useMemo(() => {
    return vacationDetails.filter(d => d.bonusApplies).length;
  }, [vacationDetails]);

  return (
    <section 
      id="puntuacion-vacaciones-section" 
      className={cn(
        "bg-azul-yellow p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-azul-yellow/20 relative overflow-hidden space-y-6 flex flex-col text-azul-blue border border-white/20 transition-all",
        className
      )}
    >
      {/* Cabecera: Icono y Título */}
      {!hideHeader && (
        <div className="relative z-10 flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-azul-blue flex items-center justify-center text-white shadow-md shrink-0">
              <Award size={20} />
            </div>
            <h3 className="font-black uppercase text-xs sm:text-sm tracking-[0.18em] text-azul-blue/80 whitespace-nowrap">
              Puntuación Vacaciones
            </h3>
          </div>
        </div>
      )}

      {/* Bloque: Botón del año arriba y debajo el botón de los puntos a todo el ancho */}
      <div className="relative z-10 space-y-3">
        {/* Botón del año arriba y centrado */}
        <div className="flex justify-center items-center select-none">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center bg-white/40 border border-white/20 rounded-xl p-0.5 shadow-xs"
          >
            <button
              type="button"
              onClick={() => setScoreYear(y => y - 1)}
              className="w-8 h-8 rounded-lg hover:bg-white/40 text-azul-blue flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
              title="Año anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-black text-azul-blue px-3 select-none tracking-wider">
              {scoreYear}
            </span>
            <button
              type="button"
              onClick={() => setScoreYear(y => y + 1)}
              className="w-8 h-8 rounded-lg hover:bg-white/40 text-azul-blue flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
              title="Año siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Botón de los puntos debajo que ocupa todo el ancho posible */}
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="w-full bg-azul-blue text-white px-5 py-3.5 sm:py-4 rounded-2xl border border-white/20 shadow-md shadow-azul-blue/25 flex items-center justify-between hover:bg-azul-blue/95 transition-all active:scale-[0.99] cursor-pointer group"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
              {finalScore.toFixed(2)}
            </span>
            <span className="text-xs sm:text-sm font-black tracking-widest text-white/80 uppercase">
              PTS
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-white/80 group-hover:text-white transition-colors">
            <ChevronDown 
              size={22} 
              className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")} 
            />
          </div>
        </button>
      </div>

      {/* Contenido Desplegable Principal */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="relative z-10 space-y-5 pt-2 overflow-hidden border-t border-white/20"
          >
            {/* Subsección Puntos Acumulados */}
            <div className="flex flex-col p-1 space-y-2">
              <div>
                <span className="text-[10px] font-black text-azul-blue/70 uppercase tracking-wider">
                  Puntos Acumulados
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-azul-blue">{totalPoints}</span>
                  <span className="text-xs font-bold text-azul-blue/60">pts</span>
                </div>
                <div className="text-[10px] text-azul-blue/70 font-semibold mt-0.5">
                  {yearVacations.length} {yearVacations.length === 1 ? 'día disfrutado' : 'días disfrutados'}
                  {effectiveDivisor > 0 && (
                    <span className="opacity-80"> · Dividido entre {effectiveDivisor} {effectiveDivisor === 1 ? 'día' : 'días'} de vacaciones</span>
                  )}
                </div>
              </div>
            </div>

            {/* SUBSECCIÓN 1: Bonus Festivos Semana Santa / Primavera (Desplegable, por defecto recogido) */}
            <div className="bg-white/25 rounded-2xl border border-white/20 overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setIsBonusExpanded(prev => !prev)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors select-none"
              >
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-azul-blue block">
                    Bonus Festivos Semana Santa / Primavera
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "text-[10px] font-black px-2.5 py-0.5 rounded-full border transition-all",
                    currentConfig.holidayBonusEnabled 
                      ? "bg-azul-blue text-white border-white/20" 
                      : "bg-white/40 text-azul-blue/60 border-white/20"
                  )}>
                    {currentConfig.holidayBonusEnabled ? `Activo (+${currentConfig.holidayBonusPoints ?? 4} pts)` : 'Inactivo'}
                  </span>
                  <ChevronDown 
                    size={16} 
                    className={cn("transition-transform duration-300 text-azul-blue", isBonusExpanded ? "rotate-180" : "")} 
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isBonusExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/15 p-4 space-y-3 bg-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-azul-blue">
                        Estado de la bonificación para el año {scoreYear}:
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(currentConfig.holidayBonusEnabled)}
                            onChange={(e) => {
                              updateYearConfig(scoreYear, prev => ({
                                ...prev,
                                holidayBonusEnabled: e.target.checked
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-azul-blue"></div>
                        </label>
                        <span className="text-[11px] font-black text-azul-blue uppercase">
                          {currentConfig.holidayBonusEnabled ? 'Activado' : 'Desactivado'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-azul-blue/80 font-medium leading-relaxed">
                      Los días festivos desde el <strong>22 de Marzo al 6 de Mayo</strong> (ambos incluidos, exceptuando el <strong>1 de Mayo</strong>: Semana Santa, Viernes Santo, Lunes de Pascua y Santa Faz) sumarán puntos extra al coincidir con tus vacaciones a partir del año 2026.
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-black uppercase tracking-wider text-azul-blue/70">
                          Suma de puntos extra:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={currentConfig.holidayBonusPoints ?? 4}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateYearConfig(scoreYear, prev => ({
                                ...prev,
                                holidayBonusPoints: isNaN(val) ? 4 : val
                              }));
                            }}
                            className="w-16 bg-white/70 border border-white/30 rounded-xl px-2.5 py-1 text-center font-black text-azul-blue text-sm focus:ring-2 focus:ring-azul-blue outline-none"
                          />
                          <span className="text-xs font-black text-azul-blue/80">pts</span>
                        </div>
                      </div>

                      <div className="text-[10px] font-black text-azul-blue bg-white/40 px-3 py-1 rounded-full border border-white/20">
                        {bonusDaysCount > 0 ? (
                          <span>🎉 {bonusDaysCount} festivo(s) bonificado(s) (+{totalBonusPoints} pts)</span>
                        ) : (
                          <span>0 festivos bonificados en {scoreYear}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SUBSECCIÓN 2: Puntuaciones por Período (Desplegable, por defecto recogido) */}
            <div className="bg-white/25 rounded-2xl border border-white/20 overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setIsPeriodsExpanded(prev => !prev)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors select-none"
              >
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-azul-blue block">
                    Puntuaciones por período ({scoreYear})
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ChevronDown 
                    size={16} 
                    className={cn("transition-transform duration-300 text-azul-blue", isPeriodsExpanded ? "rotate-180" : "")} 
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isPeriodsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/15 p-4 space-y-3.5 bg-white/10"
                  >
                    {/* Barra de herramientas: Botones para Editar, Guardar y Restablecer */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-white/15">
                      <div className="text-[11px] font-bold text-azul-blue">
                        {isEditingPeriods ? (
                          <span className="font-black text-amber-700 dark:text-amber-300">
                            ✏️ Editando períodos y puntuaciones para el año {scoreYear}
                          </span>
                        ) : (
                          <span>Elige y edita los períodos y la puntuación asignada a cada mes.</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isEditingPeriods ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditPeriods();
                              }}
                              className="btn-editar-periodos flex items-center gap-1.5 text-[10px] font-black text-white bg-azul-blue hover:bg-azul-blue/90 px-3 py-1.5 rounded-xl border border-white/20 shadow-xs transition-all active:scale-95 cursor-pointer"
                              title="Editar períodos y puntuaciones de los meses"
                            >
                              <Edit2 size={12} />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetPeriods();
                              }}
                              className="btn-restablecer-periodos flex items-center gap-1.5 text-[10px] font-black text-azul-blue/70 hover:text-azul-blue bg-white/30 hover:bg-white/50 px-3 py-1.5 rounded-xl border border-white/20 transition-all active:scale-95 cursor-pointer"
                              title="Restablecer a períodos y valores oficiales por defecto"
                            >
                              <RotateCcw size={12} />
                              <span>Restablecer</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveDraftPeriods();
                              }}
                              className="btn-guardar-periodos flex items-center gap-1.5 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl border border-emerald-500 shadow-sm transition-all active:scale-95 cursor-pointer"
                              title="Guardar los cambios en los períodos"
                            >
                              <Save size={12} />
                              <span>Guardar</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetPeriods();
                              }}
                              className="btn-restablecer-periodos flex items-center gap-1.5 text-[10px] font-black text-azul-blue/70 hover:text-azul-blue bg-white/30 hover:bg-white/50 px-3 py-1.5 rounded-xl border border-white/20 transition-all active:scale-95 cursor-pointer"
                              title="Restablecer a valores por defecto"
                            >
                              <RotateCcw size={12} />
                              <span>Restablecer</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEditPeriods();
                              }}
                              className="flex items-center gap-1 text-[10px] font-black text-rose-600 hover:text-rose-700 bg-white/40 hover:bg-white/60 px-2.5 py-1.5 rounded-xl border border-white/20 transition-all active:scale-95 cursor-pointer"
                              title="Descartar cambios"
                            >
                              <X size={12} />
                              <span>Cancelar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mensaje de confirmación temporal */}
                    {periodsFeedback && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center gap-2">
                        <Check size={14} className="shrink-0" />
                        <span>{periodsFeedback}</span>
                      </div>
                    )}

                    {/* Desglose y selección por meses */}
                    {isEditingPeriods ? (
                      /* MODO EDICIÓN POR MES */
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {MONTHS_LIST.map((m) => {
                            const monthPeriods = draftPeriods.filter(p => p.startMMDD.startsWith(`${m.monthStr}-`));

                            return (
                              <div
                                key={m.monthIndex}
                                className="month-card-edit bg-white/45 p-3.5 rounded-2xl border-2 border-white/30 space-y-3 shadow-xs"
                              >
                                {/* Cabecera del mes con opciones rápidas para elegir el período */}
                                <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-white/20">
                                  <div>
                                    <span className="text-xs font-black uppercase text-azul-blue tracking-wide">
                                      📅 {m.name}
                                    </span>
                                    <span className="text-[10px] font-bold text-azul-blue/60 ml-1">
                                      (1 al {m.daysInMonth})
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="text-[9px] font-black text-azul-blue/60 uppercase">Elegir:</span>
                                    <button
                                      type="button"
                                      onClick={() => applyMonthPreset(m, 'full')}
                                      className="month-preset-btn text-[9px] font-black text-azul-blue bg-white/60 hover:bg-white px-2 py-0.5 rounded-lg border border-white/30 transition-all active:scale-95 cursor-pointer"
                                      title="Todo el mes en 1 solo período"
                                    >
                                      Completo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyMonthPreset(m, 'half')}
                                      className="month-preset-btn text-[9px] font-black text-azul-blue bg-white/60 hover:bg-white px-2 py-0.5 rounded-lg border border-white/30 transition-all active:scale-95 cursor-pointer"
                                      title="Dividir en 2 quincenas (1-15 y 16-fin)"
                                    >
                                      2 Quincenas
                                    </button>
                                    {m.monthIndex === 1 && (
                                      <button
                                        type="button"
                                        onClick={() => applyMonthPreset(m, 'week')}
                                        className="month-preset-btn text-[9px] font-black text-azul-blue bg-white/60 hover:bg-white px-2 py-0.5 rounded-lg border border-white/30 transition-all active:scale-95 cursor-pointer"
                                        title="1-7 Reyes y 8-31"
                                      >
                                        1-7 / 8-31
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Lista de períodos de este mes para elegir fechas y puntuación */}
                                <div className="space-y-2">
                                  {monthPeriods.map((period) => {
                                    const sDay = parseInt(period.startMMDD.slice(3, 5), 10) || 1;
                                    const eDay = parseInt(period.endMMDD.slice(3, 5), 10) || m.daysInMonth;

                                    return (
                                      <div
                                        key={period.id}
                                        className="bg-white/60 p-2.5 rounded-xl border border-white/30 flex flex-wrap items-center justify-between gap-2"
                                      >
                                        {/* Selector de días del período */}
                                        <div className="flex items-center gap-1.5 flex-1 min-w-[170px]">
                                          <span className="text-[10px] font-bold text-azul-blue/70">Día</span>
                                          <input
                                            type="number"
                                            min="1"
                                            max={m.daysInMonth}
                                            value={sDay}
                                            onChange={(e) => handlePeriodDayChange(period.id, 'start', e.target.value, m)}
                                            className="w-12 bg-white border border-white/40 rounded-lg px-1.5 py-1 text-center font-black text-azul-blue text-xs focus:ring-2 focus:ring-azul-blue outline-none"
                                          />
                                          <span className="text-[10px] font-bold text-azul-blue/70">al</span>
                                          <input
                                            type="number"
                                            min="1"
                                            max={m.daysInMonth}
                                            value={eDay}
                                            onChange={(e) => handlePeriodDayChange(period.id, 'end', e.target.value, m)}
                                            className="w-12 bg-white border border-white/40 rounded-lg px-1.5 py-1 text-center font-black text-azul-blue text-xs focus:ring-2 focus:ring-azul-blue outline-none"
                                          />
                                          <span className="text-[10px] font-extrabold text-azul-blue truncate">
                                            {m.name.slice(0, 3)}
                                          </span>
                                        </div>

                                        {/* Puntuación asignada a este período */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-[10px] font-bold text-azul-blue/70">Pts:</span>
                                          <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={period.points}
                                            onChange={(e) => handlePeriodPointsChange(period.id, e.target.value)}
                                            className="w-14 bg-white border border-white/40 rounded-lg px-2 py-1 text-center font-black text-azul-blue text-xs focus:ring-2 focus:ring-azul-blue outline-none"
                                          />

                                          {/* Eliminar tramo si hay más de 1 */}
                                          {monthPeriods.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemovePeriod(period.id, m)}
                                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                              title="Eliminar este tramo"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Botón para añadir otro tramo en este mes */}
                                <div className="pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleAddPeriodToMonth(m)}
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-azul-blue hover:text-azul-blue/80 bg-white/40 hover:bg-white/60 px-2.5 py-1 rounded-lg border border-white/20 transition-all cursor-pointer"
                                  >
                                    <Plus size={12} />
                                    <span>Añadir tramo en {m.name}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Barra inferior para Guardar o Cancelar */}
                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/15">
                          <button
                            type="button"
                            onClick={handleCancelEditPeriods}
                            className="text-xs font-black text-rose-600 hover:text-rose-700 bg-white/40 hover:bg-white/60 px-4 py-2 rounded-xl border border-white/20 transition-all cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDraftPeriods}
                            className="flex items-center gap-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2 rounded-xl border border-emerald-500 shadow-sm transition-all active:scale-95 cursor-pointer"
                          >
                            <Save size={14} />
                            <span>Guardar Períodos y Puntuaciones</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* MODO VISUALIZACIÓN POR MESES */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                        {MONTHS_LIST.map((m) => {
                          const monthPeriods = currentConfig.periods.filter(p => p.startMMDD.startsWith(`${m.monthStr}-`));
                          const monthVacations = vacationDetails.filter(d => d.date.slice(5, 7) === m.monthStr);
                          const monthTotalPoints = monthVacations.reduce((sum, d) => sum + d.totalDayPoints, 0);

                          return (
                            <div 
                              key={m.monthIndex}
                              className="bg-white/40 p-3 rounded-2xl border border-white/20 flex flex-col justify-between space-y-2 hover:bg-white/50 transition-colors"
                            >
                              <div className="flex items-center justify-between pb-1.5 border-b border-white/15">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-black uppercase text-azul-blue tracking-wide">
                                    {m.name}
                                  </span>
                                  <span className="text-[9px] font-bold text-azul-blue/60">
                                    ({m.daysInMonth}d)
                                  </span>
                                </div>

                                {monthVacations.length > 0 ? (
                                  <span className="text-[9px] font-black text-azul-blue bg-white/70 px-2 py-0.5 rounded-full border border-white/20">
                                    {monthVacations.length} {monthVacations.length === 1 ? 'día' : 'días'} · {monthTotalPoints} pts
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-medium text-azul-blue/50">
                                    0 días
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1.5 flex-1">
                                {monthPeriods.length === 0 ? (
                                  <div className="text-[10px] text-azul-blue/50 italic py-1">Sin períodos definidos</div>
                                ) : (
                                  monthPeriods.map(period => {
                                    const pDays = monthVacations.filter(d => {
                                      const mmdd = d.date.slice(5, 10);
                                      return mmdd >= period.startMMDD && mmdd <= period.endMMDD;
                                    });

                                    return (
                                      <div 
                                        key={period.id}
                                        className="flex items-center justify-between gap-1.5 text-xs py-1 px-2 rounded-xl bg-white/30 border border-white/10"
                                      >
                                        <div className="min-w-0 flex-1 truncate">
                                          <span className="font-extrabold text-azul-blue text-[11px]">{period.name}</span>
                                          {pDays.length > 0 && (
                                            <span className="ml-1.5 text-[9px] font-black text-azul-blue/70">
                                              ({pDays.length}d)
                                            </span>
                                          )}
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1">
                                          <span className="font-black text-xs text-azul-blue px-2 py-0.5 rounded-lg bg-azul-blue/10 border border-azul-blue/10">
                                            {period.points} pts
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SUBSECCIÓN 3: Días de Vacaciones Registrados (Desplegable, por defecto recogido, ocultando los de 0 puntos) */}
            <div className="bg-white/25 rounded-2xl border border-white/20 overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setIsDaysExpanded(prev => !prev)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors select-none"
              >
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-azul-blue block">
                    Días de Vacaciones Registrados ({scoreYear})
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ChevronDown 
                    size={16} 
                    className={cn("transition-transform duration-300 text-azul-blue", isDaysExpanded ? "rotate-180" : "")} 
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isDaysExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/15 p-4 space-y-2 bg-white/10"
                  >
                    {vacationDetails.length === 0 ? (
                      <div className="w-full py-6 flex flex-col items-center justify-center bg-white/20 rounded-2xl border border-dashed border-white/30 text-center">
                        <Umbrella size={20} className="text-azul-blue/40 mb-1.5" />
                        <p className="text-[11px] font-black text-azul-blue/70 uppercase tracking-wider">
                          No tienes vacaciones registradas para el año {scoreYear}
                        </p>
                        <p className="text-[10px] text-azul-blue/50 mt-0.5">
                          Añade días en la sección superior de Vacaciones para calcular su puntuación.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                        {vacationDetails.map((item) => (
                          <div 
                            key={item.date}
                            className="bg-white/40 hover:bg-white/50 px-3.5 py-2 rounded-xl border border-white/20 flex items-center justify-between gap-2 transition-colors text-xs font-bold text-azul-blue"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-black">
                                {safeFormat(parseISO(item.date), 'dd MMM yyyy', { locale: es })}
                              </span>
                              <span className="text-[10px] text-azul-blue/70 font-semibold truncate">
                                ({item.periodName}: {item.basePoints} pts)
                              </span>
                              {item.bonusApplies && (
                                <span className="bg-azul-blue text-white text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                  <Sparkles size={10} />
                                  <span>Festivo +{item.bonusPoints} pts</span>
                                </span>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className={cn(
                                "font-black text-sm px-2.5 py-0.5 rounded-lg border",
                                item.totalDayPoints > 0 
                                  ? "bg-azul-blue/10 border-azul-blue/10 text-azul-blue" 
                                  : "bg-white/30 border-white/20 text-azul-blue/60"
                              )}>
                                {item.totalDayPoints} pts
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formas decorativas desenfocadas de fondo */}
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-40 h-40 bg-azul-blue/10 rounded-full blur-3xl pointer-events-none" />
    </section>
  );
};
