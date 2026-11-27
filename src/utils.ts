import { 
  parseISO, 
  isSunday, 
  addDays, 
  format, 
  startOfMonth, 
  isSameMonth, 
  isValid,
  differenceInCalendarDays
} from 'date-fns';
import { DayShift, ShiftEntry, PlusConfig, PlusesData, SavedPayroll, CalendarRotationConfig, Settings, AutoShiftsConfig, MixedRotationConfig } from './types';

export const safeFormat = (date: Date | string | number | undefined | null, formatStr: string, options?: any) => {
  if (!date) return '';
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = parseISO(date);
    // Fallback if parseISO fails (e.g. not ISO format)
    if (!isValid(d)) {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  
  if (isValid(d)) {
    return format(d, formatStr, options);
  }
  return '';
};

export const getShiftDuration = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff < 0) diff += 24 * 60; // Crosses midnight
  return diff / 60;
};


export const getNightHours = (start: string, end: string, nightStart: number = 22, nightEnd: number = 6) => {
  const { today, tomorrow } = getNightHoursSplit(start, end, nightStart, nightEnd);
  return today + tomorrow;
};

export const getNightHoursSplit = (start: string, end: string, nightStart: number = 22, nightEnd: number = 6) => {
  if (!start || !end) return { today: 0, tomorrow: 0 };
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  
  let todayNight = 0;
  let tomorrowNight = 0;
  
  let current = sH * 60 + sM;
  let target = eH * 60 + eM;
  const crossesMidnight = target <= current;
  if (crossesMidnight) target += 24 * 60;

  for (let m = current; m < target; m++) {
    const hour = (Math.floor(m / 60)) % 24;
    const isNight = nightStart > nightEnd 
      ? (hour >= nightStart || hour < nightEnd)
      : (hour >= nightStart && hour < nightEnd);
      
    if (isNight) {
      if (m < 24 * 60) todayNight++;
      else tomorrowNight++;
    }
  }
  return { today: todayNight / 60, tomorrow: tomorrowNight / 60 };
};

export const isMadrugue = (start: string, end: string = "", mStart: string = "02:00", mEnd: string = "06:55", mMinEnd: string = "00:00", mMinEndEnabled: boolean = false) => {
  if (!start) return false;
  const [sH, sM] = start.split(':').map(Number);
  const startVal = sH * 60 + sM;
  
  const [msH, msM] = mStart.split(':').map(Number);
  const [meH, meM] = mEnd.split(':').map(Number);
  
  const mStartVal = msH * 60 + msM;
  const mEndVal = meH * 60 + meM;

  const isStartInRange = startVal >= mStartVal && startVal <= mEndVal;

  let isEndAfterMin = false;
  if (mMinEndEnabled && end) {
    const [eH, eM] = end.split(':').map(Number);
    const endVal = eH * 60 + eM;
    const [mmeH, mmeM] = mMinEnd.split(':').map(Number);
    const mMinEndVal = mmeH * 60 + mmeM;

    if (endVal < startVal) {
      isEndAfterMin = endVal >= mMinEndVal;
    } else {
      isEndAfterMin = endVal >= mMinEndVal && startVal <= mEndVal;
    }
  }

  return isStartInRange || isEndAfterMin;
};

export const checkManutencion = (shifts: ShiftEntry[]) => {
  for (const s of shifts) {
    const duration = getShiftDuration(s.start, s.end);
    if (duration >= 6) {
      const [sH, sM] = s.start.split(':').map(Number);
      const [eH, eM] = s.end.split(':').map(Number);
      let startMin = sH * 60 + sM;
      let endMin = eH * 60 + eM;
      if (endMin <= startMin) endMin += 24 * 60;

      const hasLunch = startMin <= 14 * 60 && endMin >= 16 * 60;
      const hasDinner = (startMin <= 21 * 60 && endMin >= 23 * 60) || (startMin <= 21 * 60 && endMin >= (23 + 24) * 60);
      
      if (hasLunch || hasDinner) return true;
    }
  }
  return false;
};

export const checkManutencionWithRanges = (
  shifts: ShiftEntry[],
  mStart1: string = "14:00",
  mEnd1: string = "16:00",
  mStart2: string = "21:00",
  mEnd2: string = "23:00"
) => {
  for (const s of shifts) {
    const duration = getShiftDuration(s.start, s.end);
    if (duration >= 6) {
      if (!s.start || !s.end) continue;
      const [sH, sM] = s.start.split(':').map(Number);
      const [eH, eM] = s.end.split(':').map(Number);
      let startMin = sH * 60 + sM;
      let endMin = eH * 60 + eM;
      if (endMin <= startMin) endMin += 24 * 60;

      const [s1H, s1M] = mStart1.split(':').map(Number);
      const [e1H, e1M] = mEnd1.split(':').map(Number);
      let s1Min = s1H * 60 + s1M;
      let e1Min = e1H * 60 + e1M;
      if (e1Min <= s1Min) e1Min += 24 * 60;

      const [s2H, s2M] = mStart2.split(':').map(Number);
      const [e2H, e2M] = mEnd2.split(':').map(Number);
      let s2Min = s2H * 60 + s2M;
      let e2Min = e2H * 60 + e2M;
      if (e2Min <= s2Min) e2Min += 24 * 60;

      const hasLunch = startMin <= s1Min && endMin >= e1Min;
      const hasDinner = (startMin <= s2Min && endMin >= e2Min) || (startMin <= s2Min && endMin >= (e2Min + 24 * 60));
      
      if (hasLunch || hasDinner) return true;
    }
  }
  return false;
};

export const formatNumber = (num: number, decimals: number = 2) => {
  if (num === undefined || num === null) return '0,00';
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
};

/**
 * Formatea horas con unidad 'h': número entero sin decimales (ej. '8h'),
 * o con 2 decimales si no es un número entero (ej. '6,75h').
 */
export const formatHoursWithDecimals = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0h';
  const rounded = Math.round(num * 100) / 100;
  if (rounded % 1 === 0) {
    return `${Math.round(rounded)}h`;
  }
  return `${formatNumber(rounded, 2)}h`;
};

export const formatCurrency = (num: number) => {
  if (num === undefined || num === null) return '0,00 €';
  return num.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: true,
  });
};

export const calculateLevelMetrics = (anual: number, pagas: 12 | 14 = 12) => {
  const mensual = (anual / 14) + 0.01;
  const hora = pagas === 14 ? (anual / 1712) : (mensual / 142.67);
  const perentoria = (anual / 1712) * 1.75;
  const complementaria = (anual / 1712) * 1.698;
  return { mensual, hora, perentoria, complementaria };
};

export const formatMinutesToHHMM = (totalMins: number): string => {
  const m = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const carveOutShiftRange = (shifts: ShiftEntry[], rangeStart: string, rangeEnd: string): ShiftEntry[] => {
  const [crSH, crSM] = rangeStart.split(':').map(Number);
  const [crEH, crEM] = rangeEnd.split(':').map(Number);
  const c1 = crSH * 60 + crSM;
  let ce = crEH * 60 + crEM;
  if (ce <= c1) ce += 1440;

  const remainingSegments: ShiftEntry[] = [];

  shifts.forEach(sh => {
    if (!sh.start || !sh.end) return;
    const [sH, sM] = sh.start.split(':').map(Number);
    const [eH, eM] = sh.end.split(':').map(Number);
    const s1 = sH * 60 + sM;
    let e1 = eH * 60 + eM;
    if (e1 <= s1) e1 += 1440;

    let compStart = c1;
    let compEnd = ce;
    if (compEnd <= s1) {
      compStart += 1440;
      compEnd += 1440;
    }

    const ovStart = Math.max(s1, compStart);
    const ovEnd = Math.min(e1, compEnd);

    if (ovStart < ovEnd) {
      // There is an overlap: carve out the chunk
      if (s1 < ovStart) {
        const segDuration = (ovStart - s1) / 60;
        if (segDuration > 0.01) {
          remainingSegments.push({
            start: formatMinutesToHHMM(s1),
            end: formatMinutesToHHMM(ovStart)
          });
        }
      }
      if (ovEnd < e1) {
        const segDuration = (e1 - ovEnd) / 60;
        if (segDuration > 0.01) {
          remainingSegments.push({
            start: formatMinutesToHHMM(ovEnd),
            end: formatMinutesToHHMM(e1)
          });
        }
      }
    } else {
      // No overlap with this shift
      remainingSegments.push({ start: sh.start, end: sh.end });
    }
  });

  return remainingSegments;
};

export const getEffectiveShiftsForDay = (s: DayShift): ShiftEntry[] => {
  if (s.type === 'Vacaciones' || s.type === 'Baja IT') return [];
  const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
  if (validShifts.length === 0) return [];

  if (s.type === 'Ausencia Justificada') {
    const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

    // If full absence mode or marked as full
    if (s.ausenciaMode === 'full' || (!s.ausenciaMode && !s.ausenciaRange?.start && s.ausenciaHoursQty === undefined)) {
      return [];
    }

    // If range mode with specific start & end
    if (s.ausenciaRange && s.ausenciaRange.start && s.ausenciaRange.end) {
      return carveOutShiftRange(validShifts, s.ausenciaRange.start, s.ausenciaRange.end);
    }

    // If numeric ausenciaHoursQty is set without an explicit range
    if (s.ausenciaHoursQty !== undefined) {
      if (s.ausenciaHoursQty >= totalShiftDuration - 0.01) {
        return [];
      }
      if (s.ausenciaHoursQty > 0 && validShifts.length > 0) {
        const firstShift = validShifts[0];
        const [sH, sM] = firstShift.start.split(':').map(Number);
        const ausMins = Math.round(s.ausenciaHoursQty * 60);
        const newStartMins = sH * 60 + sM + ausMins;
        const modifiedFirst: ShiftEntry = {
          start: formatMinutesToHHMM(newStartMins),
          end: firstShift.end
        };
        return [modifiedFirst, ...validShifts.slice(1)];
      }
    }

    return [];
  }

  if (s.type === 'A Compensar') {
    const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

    // If full compensation mode or marked as full
    if (s.compensatedMode === 'full') {
      return [];
    }

    // If range mode with specific start & end
    if (s.compensatedRange && s.compensatedRange.start && s.compensatedRange.end) {
      return carveOutShiftRange(validShifts, s.compensatedRange.start, s.compensatedRange.end);
    }

    // If numeric compensatedHoursQty is set without an explicit range
    if (s.compensatedHoursQty !== undefined) {
      if (s.compensatedHoursQty >= totalShiftDuration - 0.01) {
        return [];
      }
      if (s.compensatedHoursQty > 0 && validShifts.length > 0) {
        const firstShift = validShifts[0];
        const [sH, sM] = firstShift.start.split(':').map(Number);
        const compMins = Math.round(s.compensatedHoursQty * 60);
        const newStartMins = sH * 60 + sM + compMins;
        const modifiedFirst: ShiftEntry = {
          start: formatMinutesToHHMM(newStartMins),
          end: firstShift.end
        };
        return [modifiedFirst, ...validShifts.slice(1)];
      }
    }

    return [];
  }

  if (s.type === 'Horas Sindicales') {
    const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

    // If full union hours mode or marked as full
    if (s.sindicalMode === 'full' || (!s.sindicalMode && !s.sindicalRange?.start && s.sindicalHoursQty === undefined)) {
      return [];
    }

    // If range mode with specific start & end
    if (s.sindicalRange && s.sindicalRange.start && s.sindicalRange.end) {
      return carveOutShiftRange(validShifts, s.sindicalRange.start, s.sindicalRange.end);
    }

    // If numeric sindicalHoursQty is set without an explicit range
    if (s.sindicalHoursQty !== undefined) {
      if (s.sindicalHoursQty >= totalShiftDuration - 0.01) {
        return [];
      }
      if (s.sindicalHoursQty > 0 && validShifts.length > 0) {
        const firstShift = validShifts[0];
        const [sH, sM] = firstShift.start.split(':').map(Number);
        const sindMins = Math.round(s.sindicalHoursQty * 60);
        const newStartMins = sH * 60 + sM + sindMins;
        const modifiedFirst: ShiftEntry = {
          start: formatMinutesToHHMM(newStartMins),
          end: firstShift.end
        };
        return [modifiedFirst, ...validShifts.slice(1)];
      }
    }

    return [];
  }

  return validShifts;
};

export const getCompensatedHoursForDay = (s: DayShift): number => {
  if (s.type !== 'A Compensar') {
    if (s.extraHoursStrategy === 'compensate') {
      const extraWork = ((s.perentorias?.day || 0) + (s.perentorias?.night || 0) +
                         (s.complementarias?.day || 0) + (s.complementarias?.night || 0)) * 1.75;
      const extraShiftsHours = (s.extraShifts || []).reduce((acc, es) => {
        if (!es.start || !es.end) return acc;
        return acc + getShiftDuration(es.start, es.end) * 1.75;
      }, 0);
      return extraWork + extraShiftsHours;
    }
    return 0;
  }

  const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
  const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

  if (s.compensatedMode === 'full') {
    return totalShiftDuration;
  }
  if (s.compensatedRange?.start && s.compensatedRange?.end) {
    return getShiftDuration(s.compensatedRange.start, s.compensatedRange.end);
  }
  if (s.compensatedHoursQty !== undefined) {
    return s.compensatedHoursQty;
  }
  return totalShiftDuration;
};

export const isDayPartiallyCompensated = (s: DayShift): boolean => {
  if (s.type !== 'A Compensar') return false;
  const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
  if (validShifts.length === 0) return false;
  const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);
  if (totalShiftDuration === 0) return false;

  const effectiveShifts = getEffectiveShiftsForDay(s);
  const effectiveDuration = effectiveShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

  return effectiveDuration > 0.01 && effectiveDuration < totalShiftDuration - 0.01;
};

export const getSindicalHoursForDay = (s: DayShift): number => {
  if (s.type !== 'Horas Sindicales') return 0;
  const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
  const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

  if (s.sindicalMode === 'full') {
    return totalShiftDuration > 0 ? totalShiftDuration : (155.63 / 22);
  }
  if (s.sindicalRange?.start && s.sindicalRange?.end) {
    return getShiftDuration(s.sindicalRange.start, s.sindicalRange.end);
  }
  if (s.sindicalHoursQty !== undefined && s.sindicalHoursQty > 0) {
    return s.sindicalHoursQty;
  }
  return totalShiftDuration > 0 ? totalShiftDuration : (155.63 / 22);
};

export const isDayPartiallySindical = (s: DayShift): boolean => {
  if (s.type !== 'Horas Sindicales') return false;
  const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
  if (validShifts.length === 0) return false;
  const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);
  if (totalShiftDuration === 0) return false;

  const effectiveShifts = getEffectiveShiftsForDay(s);
  const effectiveDuration = effectiveShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

  return effectiveDuration > 0.01 && effectiveDuration < totalShiftDuration - 0.01;
};

export const getAusenciaHoursForDay = (s: DayShift): number => {
  if (s.type !== 'Ausencia Justificada') return 0;
  const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
  const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

  if (s.ausenciaMode === 'full') {
    return totalShiftDuration > 0 ? totalShiftDuration : (155.63 / 22);
  }
  if (s.ausenciaRange?.start && s.ausenciaRange?.end) {
    return getShiftDuration(s.ausenciaRange.start, s.ausenciaRange.end);
  }
  if (s.ausenciaHoursQty !== undefined && s.ausenciaHoursQty > 0) {
    return s.ausenciaHoursQty;
  }
  return totalShiftDuration > 0 ? totalShiftDuration : (155.63 / 22);
};

export const isDayPartiallyAusencia = (s: DayShift): boolean => {
  if (s.type !== 'Ausencia Justificada') return false;
  const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
  if (validShifts.length === 0) return false;
  const totalShiftDuration = validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);
  if (totalShiftDuration === 0) return false;

  const effectiveShifts = getEffectiveShiftsForDay(s);
  const effectiveDuration = effectiveShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);

  return effectiveDuration > 0.01 && effectiveDuration < totalShiftDuration - 0.01;
};

export interface RestCheckResult {
  restHours: number;
  restMins: number;
  hasViolation: boolean;
  prevEnd: string;
  currStart: string;
}

export const hasEffectiveWorkHours = (
  dayShift: DayShift | undefined,
  vacations: string[] = []
): boolean => {
  if (!dayShift) return false;
  const iso = dayShift.date;
  if (dayShift.type === 'Vacaciones' || (iso && vacations.includes(iso))) return false;
  if (dayShift.type === 'Baja IT') return false;

  const isCededOnly = !!(dayShift.swapInfo?.cededToCoworker && !dayShift.swapInfo?.coveringCoworker);
  if (isCededOnly) return false;

  if (dayShift.type === 'A Compensar' || dayShift.type === 'Horas Sindicales' || dayShift.type === 'Ausencia Justificada') {
    const eff = getEffectiveShiftsForDay(dayShift);
    const extra = (dayShift.extraShifts || []).filter(sh => sh.start && sh.end);
    const effDur = eff.reduce((acc, sh) => acc + (sh.start && sh.end ? getShiftDuration(sh.start, sh.end) : 0), 0);
    const extraDur = extra.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);
    return (effDur + extraDur) > 0.01;
  }

  const rawOrdinarySource = dayShift.swapInfo?.cededToCoworker && dayShift.swapInfo?.coveringCoworker && Array.isArray(dayShift.swapInfo.coveringShifts) && dayShift.swapInfo.coveringShifts.length > 0
    ? dayShift.swapInfo.coveringShifts
    : getEffectiveShiftsForDay(dayShift);
  const ordRaw = rawOrdinarySource.filter(sh => sh.start && sh.end);
  const extraRaw = (dayShift.extraShifts || []).filter(sh => sh.start && sh.end);

  return ordRaw.length > 0 || extraRaw.length > 0;
};

const getDayWorkIntervals = (
  dayShift: DayShift,
  vacations: string[] = []
): { startMins: number; endMins: number; startStr: string; endStr: string }[] => {
  if (!hasEffectiveWorkHours(dayShift, vacations)) {
    return [];
  }

  // If this day's shift was ceded to a coworker and we are NOT also covering a coworker shift on this same day,
  // then the user does not actually work the ordinary shift on this day.
  const isCededOnly = !!(dayShift.swapInfo?.cededToCoworker && !dayShift.swapInfo?.coveringCoworker);
  const rawOrdinarySource = dayShift.swapInfo?.cededToCoworker && dayShift.swapInfo?.coveringCoworker && Array.isArray(dayShift.swapInfo.coveringShifts) && dayShift.swapInfo.coveringShifts.length > 0
    ? dayShift.swapInfo.coveringShifts
    : (isCededOnly ? [] : getEffectiveShiftsForDay(dayShift));
  const ordRaw = rawOrdinarySource.filter(sh => sh.start && sh.end);
  const extraRaw = (dayShift.extraShifts || []).filter(sh => sh.start && sh.end);

  const parseShiftMins = (sh: ShiftEntry) => {
    const [sH, sM] = sh.start.split(':').map(Number);
    const [eH, eM] = sh.end.split(':').map(Number);
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return null;
    const startMins = sH * 60 + sM;
    let endMins = eH * 60 + eM;
    if (endMins <= startMins) endMins += 1440;
    return { startMins, endMins, duration: endMins - startMins, startStr: sh.start, endStr: sh.end };
  };

  const intervals = ordRaw
    .map(parseShiftMins)
    .filter((x): x is NonNullable<ReturnType<typeof parseShiftMins>> => x !== null)
    .map(({ startMins, endMins, startStr, endStr }) => ({ startMins, endMins, startStr, endStr }));

  if (intervals.length === 0) {
    return extraRaw
      .map(parseShiftMins)
      .filter((x): x is NonNullable<ReturnType<typeof parseShiftMins>> => x !== null)
      .map(({ startMins, endMins, startStr, endStr }) => ({ startMins, endMins, startStr, endStr }));
  }

  // Merge extraShifts (perentorias / complementarias) as prolongations of ordinary shifts
  const remainingExtras = extraRaw
    .map(parseShiftMins)
    .filter((x): x is NonNullable<ReturnType<typeof parseShiftMins>> => x !== null);

  let mergedAny = true;
  while (mergedAny && remainingExtras.length > 0) {
    mergedAny = false;
    for (let i = remainingExtras.length - 1; i >= 0; i--) {
      const ex = remainingExtras[i];
      // Check if this extra shift prolongs the end of an existing interval (e.g. 16:00-00:00 + 00:00-02:00)
      const matchAfter = intervals.find(
        iv => iv.endStr === ex.startStr || (iv.endMins % 1440) === (ex.startMins % 1440)
      );
      if (matchAfter) {
        matchAfter.endMins += ex.duration;
        matchAfter.endStr = ex.endStr;
        remainingExtras.splice(i, 1);
        mergedAny = true;
        continue;
      }
      // Check if this extra shift precedes the start of an existing interval (e.g. 04:00-06:00 + 06:00-14:00)
      const matchBefore = intervals.find(
        iv => iv.startStr === ex.endStr || (iv.startMins % 1440) === (ex.endMins % 1440)
      );
      if (matchBefore) {
        matchBefore.startMins -= ex.duration;
        matchBefore.startStr = ex.startStr;
        remainingExtras.splice(i, 1);
        mergedAny = true;
        continue;
      }
    }
  }

  // For any remaining extra shifts on the same day that weren't directly adjacent:
  // If ordinary shift is afternoon/night (starts >= 12:00) and extra shift is madrugada (< 06:00), place it after midnight (+1440)
  const earliestOrdStart = Math.min(...intervals.map(iv => iv.startMins));
  remainingExtras.forEach(ex => {
    let sMins = ex.startMins;
    let eMins = ex.endMins;
    if (earliestOrdStart >= 12 * 60 && sMins < 6 * 60) {
      sMins += 1440;
      eMins += 1440;
    }
    intervals.push({
      startMins: sMins,
      endMins: eMins,
      startStr: ex.startStr,
      endStr: ex.endStr
    });
  });

  return intervals;
};

export const getRestBetweenDays = (
  prevDayShift: DayShift | undefined,
  currDayShift: DayShift | undefined,
  vacations: string[] = []
): RestCheckResult | null => {
  if (!prevDayShift || !currDayShift) return null;
  // Si el día de antes no son horas efectivas (compensar, ausencia justificada, vacaciones o baja it),
  // o el día siguiente no son horas efectivas, no procede mostrar aviso de descanso legal entre jornadas.
  if (!hasEffectiveWorkHours(prevDayShift, vacations) || !hasEffectiveWorkHours(currDayShift, vacations)) {
    return null;
  }

  const prevIntervals = getDayWorkIntervals(prevDayShift, vacations);
  const currIntervals = getDayWorkIntervals(currDayShift, vacations);

  if (prevIntervals.length === 0 || currIntervals.length === 0) return null;

  let latestPrevEndMins = -1;
  let prevEndStr = '';
  prevIntervals.forEach(iv => {
    if (iv.endMins > latestPrevEndMins) {
      latestPrevEndMins = iv.endMins;
      prevEndStr = iv.endStr;
    }
  });

  // Filter out any interval on currDayShift that is a direct midnight continuation of prevDayShift
  // (e.g. prevDay ended at 00:00 [1440] and currDay has a prolongation starting at 00:00 [1440])
  const nonContinuationCurrIntervals = currIntervals.filter(iv => {
    const absStart = 1440 + iv.startMins;
    if (absStart === latestPrevEndMins) {
      // Extend latestPrevEndMins in case there is another shift later on currDayShift
      const duration = iv.endMins - iv.startMins;
      latestPrevEndMins += duration;
      prevEndStr = iv.endStr;
      return false;
    }
    return true;
  });

  if (nonContinuationCurrIntervals.length === 0) return null;

  let earliestCurrStartMins = Infinity;
  let currStartStr = '';
  nonContinuationCurrIntervals.forEach(iv => {
    const startMins = 1440 + iv.startMins;
    if (startMins < earliestCurrStartMins) {
      earliestCurrStartMins = startMins;
      currStartStr = iv.startStr;
    }
  });

  if (latestPrevEndMins < 0 || earliestCurrStartMins === Infinity) return null;

  const restMins = Math.max(0, earliestCurrStartMins - latestPrevEndMins);
  const restHours = Math.round((restMins / 60) * 100) / 100;

  return {
    restHours,
    restMins,
    hasViolation: restMins < 12 * 60,
    prevEnd: prevEndStr,
    currStart: currStartStr
  };
};

export const isFixedHoliday = (date: Date): boolean => {
  if (isSunday(date)) return false;
  const month = date.getMonth(); // 0-11
  const day = date.getDate(); // 1-31
  return (
    (month === 0 && day === 1) ||   // 1 Enero
    (month === 0 && day === 6) ||   // 6 Enero
    (month === 2 && day === 19) ||  // 19 Marzo
    (month === 4 && day === 1) ||   // 1 Mayo
    (month === 5 && day === 24) ||  // 24 Junio
    (month === 7 && day === 15) ||  // 15 Agosto
    (month === 9 && day === 9) ||   // 9 Octubre
    (month === 9 && day === 12) ||  // 12 Octubre
    (month === 10 && day === 1) ||  // 1 Noviembre
    (month === 11 && day === 6) ||  // 6 Diciembre
    (month === 11 && day === 8) ||  // 8 Diciembre
    (month === 11 && day === 25)    // 25 Diciembre
  );
};

function shouldGeneratePluses(s: DayShift): boolean {
  const isCededOnly = !!(s.swapInfo?.cededToCoworker && !s.swapInfo?.coveringCoworker);
  const hasRegularShift = !isCededOnly && !!(s.shifts && s.shifts.some(sh => sh.start && sh.end));
  if (hasRegularShift) return true;
  if (s.generatePluses !== undefined) return s.generatePluses;
  const hasExtraWork = (s.extraShifts && s.extraShifts.some(sh => sh.start && sh.end)) || 
                       (s.perentorias?.day || 0) > 0 || (s.perentorias?.night || 0) > 0 ||
                       (s.complementarias?.day || 0) > 0 || (s.complementarias?.night || 0) > 0;
  if (hasExtraWork) return false;
  return true;
}

export const parseTimeToMins = (t?: string): number | null => {
  if (!t || !t.includes(':')) return null;
  const [h, m] = t.trim().split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return ((h * 60 + m) % 1440 + 1440) % 1440;
};

export const isShiftContinuation = (
  sh: ShiftEntry,
  idx: number,
  sameDayShifts: ShiftEntry[],
  prevDayMidnightCrossingEnds: string[] = [],
  rawRegularShifts: ShiftEntry[] = []
): boolean => {
  const shStartMin = parseTimeToMins(sh.start);
  if (shStartMin === null) return false;
  const shEndMin = parseTimeToMins(sh.end);

  // Check if any other shift on the same day ends right when this shift starts
  const continuesSameDay = sameDayShifts.some((other, otherIdx) => {
    if (otherIdx === idx || other === sh || !other.start || !other.end) return false;
    const otherEndMin = parseTimeToMins(other.end);
    const otherStartMin = parseTimeToMins(other.start);
    if (otherEndMin !== null && otherEndMin === shStartMin) {
      // Avoid mutual cycle if two 12h shifts form 24h; treat the later one as continuation
      if (shEndMin !== null && otherStartMin !== null && shEndMin === otherStartMin) {
        return idx > otherIdx;
      }
      return true;
    }
    return false;
  });
  if (continuesSameDay) return true;

  // Also check raw regular shifts (e.g. if the day is partially or fully A Compensar)
  const continuesRawRegular = rawRegularShifts.some((reg) => {
    if (reg === sh || !reg.start || !reg.end) return false;
    const regEndMin = parseTimeToMins(reg.end);
    const regStartMin = parseTimeToMins(reg.start);
    if (regEndMin !== null && regEndMin === shStartMin) {
      if (shEndMin !== null && regStartMin !== null && shEndMin === regStartMin) {
        return false;
      }
      return true;
    }
    return false;
  });
  if (continuesRawRegular) return true;

  // Check if a shift from the previous day crossed midnight and ended right when this shift starts
  if (prevDayMidnightCrossingEnds.some(endStr => parseTimeToMins(endStr) === shStartMin)) {
    return true;
  }

  return false;
};

export const isShiftAfterMidnightOfDay = (
  sh: ShiftEntry,
  idx: number,
  sameDayShifts: ShiftEntry[],
  rawRegularShifts: ShiftEntry[] = []
): boolean => {
  const shStartMin = parseTimeToMins(sh.start);
  const shEndMin = parseTimeToMins(sh.end);
  if (shStartMin === null || shEndMin === null) return false;

  // If this shift itself crosses midnight (endMin <= startMin), it starts before midnight and crosses over
  if (shEndMin <= shStartMin) return false;

  const combinedPool = [...rawRegularShifts, ...sameDayShifts].filter(
    s => s && s.start && s.end
  );

  const midnightCrossingShifts = combinedPool.filter(other => {
    if (other === sh) return false;
    const oStart = parseTimeToMins(other.start);
    const oEnd = parseTimeToMins(other.end);
    return oStart !== null && oEnd !== null && oEnd <= oStart;
  });

  if (midnightCrossingShifts.length === 0) return false;

  const visited = new Set<ShiftEntry>();
  const continuesMidnightShift = (current: ShiftEntry): boolean => {
    if (visited.has(current)) return false;
    visited.add(current);
    const curStart = parseTimeToMins(current.start);
    const curEnd = parseTimeToMins(current.end);
    if (curStart === null || curEnd === null) return false;

    for (const mc of midnightCrossingShifts) {
      const mcEnd = parseTimeToMins(mc.end);
      if (mcEnd !== null && curStart === mcEnd) {
        return true;
      }
    }

    for (const mc of midnightCrossingShifts) {
      const mcEnd = parseTimeToMins(mc.end);
      if (mcEnd !== null && mcEnd > 0 && curStart >= 0 && curEnd <= mcEnd) {
        return true;
      }
    }

    for (const other of combinedPool) {
      if (other === current) continue;
      const oStart = parseTimeToMins(other.start);
      const oEnd = parseTimeToMins(other.end);
      if (oStart !== null && oEnd !== null && oEnd > oStart && oEnd === curStart) {
        if (continuesMidnightShift(other)) return true;
      }
    }

    return false;
  };

  if (continuesMidnightShift(sh)) return true;

  for (let i = 0; i < idx; i++) {
    const prev = sameDayShifts[i];
    if (!prev || !prev.start || !prev.end) continue;
    const pStart = parseTimeToMins(prev.start);
    const pEnd = parseTimeToMins(prev.end);
    if (pStart !== null && pEnd !== null && pEnd <= pStart) {
      if (shStartMin >= pEnd && shEndMin <= pStart && shStartMin < 12 * 60) {
        return true;
      }
    }
  }

  return false;
};

const getPrevDayMidnightEnds = (dateObj: Date, shiftPool: DayShift[], vacations: string[]): string[] => {
  if (!isValid(dateObj)) return [];
  const prevDateStr = safeFormat(addDays(dateObj, -1), 'yyyy-MM-dd');
  if (!prevDateStr || vacations.includes(prevDateStr)) return [];
  const prevDay = shiftPool.find(s => s.date === prevDateStr);
  if (!prevDay || prevDay.type === 'Vacaciones' || prevDay.type === 'Baja IT' || prevDay.type === 'Ausencia Justificada') return [];

  const isPrevCededOnly = !!(prevDay.swapInfo?.cededToCoworker && !prevDay.swapInfo?.coveringCoworker);
  const prevRawReg = isPrevCededOnly ? [] : (prevDay.shifts || []).filter(sh => sh.start && sh.end);
  const prevEffReg = isPrevCededOnly ? [] : (prevDay.type === 'A Compensar'
    ? getEffectiveShiftsForDay(prevDay)
    : prevRawReg);
  const prevExtra = (prevDay.extraShifts || []).filter(sh => sh.start && sh.end);
  const allPrev = [...prevRawReg, ...prevEffReg, ...prevExtra];

  const ends: string[] = [];
  allPrev.forEach((sh, idx) => {
    if (!sh.start || !sh.end) return;
    const [sH, sM] = sh.start.split(':').map(Number);
    const [eH, eM] = sh.end.split(':').map(Number);
    if ((eH * 60 + eM) <= (sH * 60 + sM) || isShiftAfterMidnightOfDay(sh, idx, allPrev, prevRawReg)) {
      ends.push(sh.end);
    }
  });
  return ends;
};

export const getStatsForShifts = (
  monthShifts: DayShift[], 
  holidays: string[], 
  vacations: string[], 
  contractType: 'Completo' | 'Parcial', 
  isResumen: boolean = false,
  allShifts: DayShift[] = [],
  counterPeriod?: { start: string; end: string },
  nightTarget: number = 0,
  nightPlusConfig?: PlusConfig,
  madrugueTarget: number = 0,
  madruguePlusConfig?: PlusConfig,
  targetMonth?: Date,
  isSubrogado: boolean = false,
  counterTargets: { [key: string]: number } = {},
  pluses: PlusesData = {}
) => {
  let totalHours = 0;
  let effectiveHours = 0;
  let vacationHours = 0;
  let monthlyCompensatedHours = 0;
  let nightHours = 0;
  let nightHoursSub = 0;
  let madrugues = 0;
  let madruguesSub = 0;
  let sundays = 0;
  let sundaysSub = 0;
  let festivos = 0;
  let festivosSub = 0;
  let transport = 0;
  let transportSub = 0;
  let manutencion = 0;
  let manutencionSub = 0;
  let splitLess4 = 0;
  let splitLess4Sub = 0;
  let split4to7 = 0;
  let split4to7Sub = 0;
  let splitPlus7 = 0;
  let splitPlus7Sub = 0;
  let perentDay = 0;
  let perentNight = 0;
  let complDay = 0;
  let complNight = 0;
  let compensatedHours = 0;
  let monthlySindicalHours = 0;
  let sindicalHours = 0;
  let absentDays = 0;
  let ausenciaHours = 0;
  let cambioFuncionHours = 0;
  
  const uniqueShifts = new Set<string>();
  const customCounts: { [key: string]: number } = {};

  // Map stats key to plus name for generic handling
  const plusToTargets = isSubrogado ? counterTargets : {};
  
  const getTarget = (name: string) => plusToTargets[name] || 0;
  const getSubVal = (name: string) => {
    const subName = name === 'Manutención' ? 'Manutención/Comida SUB' : `${name} SUB`;
    const configSub = pluses[subName];
    if (isSubrogado && configSub && configSub.enabled) {
      return configSub.value;
    }
    return pluses[name]?.subValue;
  };

  const checkManutencionWithCustomRanges = (shs: ShiftEntry[]) => {
    if (isSubrogado) {
      const subConfig = pluses['Manutención/Comida SUB'];
      const mStart1 = subConfig?.startHour || '14:00';
      const mEnd1 = subConfig?.endHour || '16:00';
      const mStart2 = subConfig?.startHour2 || '21:00';
      const mEnd2 = subConfig?.endHour2 || '23:00';
      return checkManutencionWithRanges(shs, mStart1, mEnd1, mStart2, mEnd2);
    }
    return checkManutencion(shs);
  };

  // Calculate accumulated counts before this month in the current period
  let runningAcc = {
    night: 0,
    madrugue: 0,
    sundays: 0,
    festivos: 0,
    transport: 0,
    manutencion: 0,
    splitLess4: 0,
    split4to7: 0,
    splitPlus7: 0
  };
  
  if (counterPeriod && targetMonth && isValid(targetMonth)) {
    const periodStart = counterPeriod.start;
    const monthStartStr = safeFormat(startOfMonth(targetMonth), 'yyyy-MM-dd');
    
    const previousShiftsInPeriod = allShifts.filter(s => {
      if (!s.date) return false;
      return s.date >= periodStart && s.date < monthStartStr;
    });
    
    previousShiftsInPeriod.forEach(s => {
      if (s.type !== 'Laboral' && s.type !== 'A Compensar' && s.type !== 'Horas Sindicales' && s.type !== 'Ausencia Justificada' && s.type !== 'Cambio de función') return;
      
      const d = parseISO(s.date);
      if (!isValid(d)) return;
      const nextD = addDays(d, 1);
      const isTomorrowInTarget = isSameMonth(nextD, targetMonth);
      const isFest = holidays.includes(s.date) || isFixedHoliday(d) || (isSunday(d) && isSubrogado && !!pluses['Domingo SUB']?.festivos);
      const isSun = isSunday(d) && !(isSubrogado && !!pluses['Domingo SUB']?.festivos);
      const isNextFest = holidays.includes(safeFormat(nextD, 'yyyy-MM-dd')) || isFixedHoliday(nextD) || (isSunday(nextD) && isSubrogado && !!pluses['Domingo SUB']?.festivos);
      const isNextSun = isSunday(nextD) && !(isSubrogado && !!pluses['Domingo SUB']?.festivos);

      const isCededOnly = !!(s.swapInfo?.cededToCoworker && !s.swapInfo?.coveringCoworker);
      const rawRegShifts = isCededOnly ? [] : (s.shifts || []).filter(sh => sh.start && sh.end);
      const effectiveRegShifts = isCededOnly ? [] : ((s.type === 'A Compensar' || s.type === 'Horas Sindicales' || s.type === 'Ausencia Justificada') ? getEffectiveShiftsForDay(s) : rawRegShifts);
      const extraRegList = (s.extraShifts || []).filter(sh => sh.start && sh.end);
      const allShiftsForDay = [...effectiveRegShifts, ...extraRegList];
      const hasEffective = allShiftsForDay.some(sh => sh.start && sh.end && getShiftDuration(sh.start, sh.end) > 0);
      if (!hasEffective) return;
      const prevDayEnds = getPrevDayMidnightEnds(d, allShifts.length > 0 ? allShifts : previousShiftsInPeriod, vacations);
      const hasAnyShiftStart = allShiftsForDay.some((sh, idx) => {
        const isExtra = extraRegList.includes(sh);
        if (isShiftContinuation(sh, idx, allShiftsForDay, prevDayEnds, rawRegShifts)) return false;
        if (isExtra && !s.generatePluses) return false;
        return true;
      });
      
      // Counter accumulations
      const mTarget = getTarget('Manutención');
      const mSub = getSubVal('Manutención');
      const shiftsForManutencion = s.generatePluses ? allShiftsForDay : effectiveRegShifts;
      if (mTarget > 0 && mSub) {
        if (checkManutencionWithCustomRanges(shiftsForManutencion)) runningAcc.manutencion++;
      }

      const fTarget = getTarget('Festivo');
      const fSub = getSubVal('Festivo');
      const sunTarget = getTarget('Domingo');
      const sunSub = getSubVal('Domingo');

      const sLess4Target = getTarget('Jornada Fraccionada < 4h');
      const sLess4Sub = getSubVal('Jornada Fraccionada < 4h');
      const s4to7Target = getTarget('Jornada Fraccionada >= 4h');
      const s4to7Sub = getSubVal('Jornada Fraccionada >= 4h');
      const sPlus7Target = getTarget('Jornada Fraccionada >= 7h');
      const sPlus7Sub = getSubVal('Jornada Fraccionada >= 7h');

      if (effectiveRegShifts.length > 1 && effectiveRegShifts[0].end && effectiveRegShifts[1].start) {
        const gap = getShiftDuration(effectiveRegShifts[0].end, effectiveRegShifts[1].start);
        if (gap > 0) {
          if (gap < 4) { if (sLess4Target > 0 && sLess4Sub) runningAcc.splitLess4++; }
          else if (gap < 7) { if (s4to7Target > 0 && s4to7Sub) runningAcc.split4to7++; }
          else { if (sPlus7Target > 0 && sPlus7Sub) runningAcc.splitPlus7++; }
        }
      }

      // Time based accumulation
      allShiftsForDay.forEach((sh, shIdx) => {
        if (!sh.start || !sh.end) return;
        const isExtra = extraRegList.includes(sh);
        const isContinuation = isShiftContinuation(sh, shIdx, allShiftsForDay, prevDayEnds, rawRegShifts);
        const isAfterMidnight = isShiftAfterMidnightOfDay(sh, shIdx, allShiftsForDay, rawRegShifts);
        const duration = getShiftDuration(sh.start, sh.end);
        
        const [sH, sM] = sh.start.split(':').map(Number);
        const [eH, eM] = sh.end.split(':').map(Number);
        const startMin = sH * 60 + sM;
        let endMin = eH * 60 + eM;
        const crossesMidnight = endMin <= startMin;
        const minsToday = isAfterMidnight ? 0 : (crossesMidnight ? (24 * 60 - startMin) : (endMin - startMin));
        const minsTomorrow = isAfterMidnight ? (duration * 60) : (crossesMidnight ? endMin : 0);
        const hasTomorrowHours = crossesMidnight || isAfterMidnight;
        
        const canShiftGenerateWeekendOrHolidayPluses = !isExtra && shouldGeneratePluses(s);

        if (canShiftGenerateWeekendOrHolidayPluses) {
          if (sunTarget > 0 && sunSub) {
            if (isSun) runningAcc.sundays += minsToday / 60;
            if (hasTomorrowHours && isNextSun && !isTomorrowInTarget) runningAcc.sundays += minsTomorrow / 60;
          }
          if (fTarget > 0 && fSub) {
            if (isFest) runningAcc.festivos += minsToday / 60;
            if (hasTomorrowHours && isNextFest && !isTomorrowInTarget) runningAcc.festivos += minsTomorrow / 60;
          }
        }

        // Night accumulation (only for regular shifts, extra shifts have their own night extra hours)
        if (!isExtra) {
          const subNightVal = getSubVal('Nocturnas');
          if (nightTarget > 0 && subNightVal !== undefined) {
            const nocturnasSubConfig = pluses['Nocturnas SUB'];
            const nStartCon = nightPlusConfig?.startHour ? parseInt(nightPlusConfig.startHour.split(':')[0]) : 22;
            const nEndCon = nightPlusConfig?.endHour ? parseInt(nightPlusConfig.endHour.split(':')[0]) : 6;
            const nStart = isSubrogado && nocturnasSubConfig?.startHour ? parseInt(nocturnasSubConfig.startHour.split(':')[0]) : (nightPlusConfig?.subStartHour ? parseInt(nightPlusConfig.subStartHour.split(':')[0]) : nStartCon);
            const nEnd = isSubrogado && nocturnasSubConfig?.endHour ? parseInt(nocturnasSubConfig.endHour.split(':')[0]) : (nightPlusConfig?.subEndHour ? parseInt(nightPlusConfig.subEndHour.split(':')[0]) : nEndCon);
            const { today, tomorrow } = getNightHoursSplit(sh.start, sh.end, nStart, nEnd);
            runningAcc.night += today + tomorrow;
          }
        }

        // Madrugue accumulation (only if this shift is an actual shift start, not a continuation)
        const canCountStartPlus = !isContinuation && (!isExtra || !!s.generatePluses);
        if (canCountStartPlus) {
          const madTarget = getTarget('Madrugue');
          const madSubValue = getSubVal('Madrugue');
          if (madTarget > 0 && madSubValue) {
            const madrugueSubConfig = pluses['Madrugue SUB'];
            const mStart = isSubrogado ? (madrugueSubConfig?.madrugueStart || madruguePlusConfig?.subMadrugueStart || madruguePlusConfig?.madrugueStart || "02:00") : (madruguePlusConfig?.madrugueStart || "02:00");
            const mEnd = isSubrogado ? (madrugueSubConfig?.madrugueEnd || madruguePlusConfig?.subMadrugueEnd || madruguePlusConfig?.madrugueEnd || "06:55") : (madruguePlusConfig?.madrugueEnd || "06:55");
            const mMinEnd = isSubrogado ? (madrugueSubConfig?.madrugueMinEnd || madruguePlusConfig?.subMadrugueMinEnd || madruguePlusConfig?.madrugueMinEnd || "00:00") : (madruguePlusConfig?.subMadrugueMinEnd || "00:00");
            const mMinEndEnabled = isSubrogado ? (madrugueSubConfig?.madrugueMinEndEnabled !== undefined ? madrugueSubConfig.madrugueMinEndEnabled : (madruguePlusConfig?.subMadrugueMinEndEnabled || madruguePlusConfig?.madrugueMinEndEnabled || false)) : (madruguePlusConfig?.subMadrugueMinEndEnabled || false);
            if (isMadrugue(sh.start, sh.end || "", mStart, mEnd, mMinEnd, mMinEndEnabled)) {
              runningAcc.madrugue += 1;
            }
          }
        }
      });
    });
  }

  monthShifts.forEach(s => {
    const d = parseISO(s.date);
    const nextD = addDays(d, 1);
    const isTodayInTarget = targetMonth ? isSameMonth(d, targetMonth) : true;
    const isTomorrowInTarget = targetMonth ? isSameMonth(nextD, targetMonth) : true;

    const isBaja = s.type === 'Baja IT';
    if (isBaja) {
      if (isTodayInTarget) {
        absentDays++;
      }
      return;
    }

    const isVacSetting = vacations.includes(s.date);
    const isVacType = s.type === 'Vacaciones';
    const isVac = isVacSetting || isVacType;
    const isCompensar = s.type === 'A Compensar';
    const isSindical = s.type === 'Horas Sindicales';
    const isAusencia = s.type === 'Ausencia Justificada';
    const isCambioFuncion = s.type === 'Cambio de función';
    
    const isCededOnly = !!(s.swapInfo?.cededToCoworker && !s.swapInfo?.coveringCoworker);
    const rawRegularShifts = (isVac || isCededOnly) ? [] : (s.shifts || []).filter(sh => sh.start && sh.end);
    const effectiveRegularShifts = (isVac || isCededOnly) ? [] : ((isCompensar || isSindical || isAusencia) ? getEffectiveShiftsForDay(s) : rawRegularShifts);
    const extraShiftsList = (s.extraShifts || []).filter(sh => sh.start && sh.end);
    const allEffectiveShiftsForDay = [...effectiveRegularShifts, ...extraShiftsList];
    const hasEffectiveWork = allEffectiveShiftsForDay.some(sh => sh.start && sh.end && getShiftDuration(sh.start, sh.end) > 0);
    const prevDayMidnightEnds = getPrevDayMidnightEnds(d, allShifts.length > 0 ? allShifts : monthShifts, vacations);
    const hasAnyShiftStart = allEffectiveShiftsForDay.some((sh, idx) => {
      const isExtra = extraShiftsList.includes(sh);
      if (isShiftContinuation(sh, idx, allEffectiveShiftsForDay, prevDayMidnightEnds, rawRegularShifts)) return false;
      if (isExtra && !s.generatePluses) return false;
      return true;
    });

    if (isTodayInTarget && (isVac || ((isCompensar || isAusencia) && !hasEffectiveWork))) {
      absentDays++;
    }

    // Transport and Manutencion
    if (isTodayInTarget && !isVac && hasEffectiveWork && shouldGeneratePluses(s)) {
      if (hasAnyShiftStart) {
        transport++;
      }

      const shiftsForManutencion = s.generatePluses ? allEffectiveShiftsForDay : effectiveRegularShifts;
      if (checkManutencionWithCustomRanges(shiftsForManutencion)) {
        const mTarget = getTarget('Manutención');
        const mSub = getSubVal('Manutención');
        if (mTarget > 0 && mSub) {
          if (runningAcc.manutencion < mTarget) { manutencionSub++; runningAcc.manutencion++; }
          else manutencion++;
        } else manutencion++;
      }
    }

    if (isTodayInTarget && isVac) {
      const validShifts = (s.shifts || []).filter(sh => sh.start && sh.end);
      const vHours = validShifts.length > 0
        ? validShifts.reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0)
        : 0;
      vacationHours += vHours;
    }

    if (isTodayInTarget && isCompensar) {
      const compQty = getCompensatedHoursForDay(s);
      compensatedHours += compQty;
      monthlyCompensatedHours += compQty;
    }

    if (isTodayInTarget && isSindical) {
      const sindQty = getSindicalHoursForDay(s);
      sindicalHours += sindQty;
      monthlySindicalHours += sindQty;
      totalHours += sindQty;
      effectiveHours += sindQty;
    }

    if (isTodayInTarget && isAusencia) {
      const ausQty = getAusenciaHoursForDay(s);
      ausenciaHours += ausQty;
    }

    if (isTodayInTarget && isCambioFuncion) {
      const cdfHours = (s.shifts || []).filter(sh => sh.start && sh.end).reduce((acc, sh) => acc + getShiftDuration(sh.start, sh.end), 0);
      cambioFuncionHours += cdfHours;
    }

    if (isTodayInTarget && !isVac && !isCompensar && !isSindical && !isAusencia) {
      if (s.extraHoursStrategy === 'compensate') {
        compensatedHours += ((s.perentorias?.day || 0) + (s.perentorias?.night || 0) +
                           (s.complementarias?.day || 0) + (s.complementarias?.night || 0)) * 1.75;
      } else {
        perentDay += (s.perentorias?.day || 0);
        perentNight += (s.perentorias?.night || 0);
        complDay += (s.complementarias?.day || 0);
        complNight += (s.complementarias?.night || 0);
      }
    }
    
    // Madrugues
    if (isTodayInTarget && !isVac && hasEffectiveWork && shouldGeneratePluses(s)) {
      const mStartCon = madruguePlusConfig?.madrugueStart || "02:00";
      const mEndCon = madruguePlusConfig?.madrugueEnd || "06:55";
      const mMinEndCon = madruguePlusConfig?.madrugueMinEnd || "00:00";
      const mMinEndEnabledCon = madruguePlusConfig?.madrugueMinEndEnabled || false;

      const madrugueSubConfig = pluses['Madrugue SUB'];
      const mStartSub = isSubrogado && madrugueSubConfig?.madrugueStart ? madrugueSubConfig.madrugueStart : (madruguePlusConfig?.subMadrugueStart || mStartCon);
      const mEndSub = isSubrogado && madrugueSubConfig?.madrugueEnd ? madrugueSubConfig.madrugueEnd : (madruguePlusConfig?.subMadrugueEnd || mEndCon);
      const mMinEndSub = isSubrogado && madrugueSubConfig?.madrugueMinEnd ? madrugueSubConfig.madrugueMinEnd : (madruguePlusConfig?.subMadrugueMinEnd || mMinEndCon);
      const mMinEndEnabledSub = isSubrogado && madrugueSubConfig ? (madrugueSubConfig.madrugueMinEndEnabled !== undefined ? madrugueSubConfig.madrugueMinEndEnabled : (madruguePlusConfig?.subMadrugueMinEndEnabled || mMinEndEnabledCon)) : (madruguePlusConfig?.subMadrugueMinEndEnabled || mMinEndEnabledCon);
      
      allEffectiveShiftsForDay.forEach((sh, shIdx) => {
        if (!sh.start) return;
        const isExtra = extraShiftsList.includes(sh);
        const isContinuation = isShiftContinuation(sh, shIdx, allEffectiveShiftsForDay, prevDayMidnightEnds, rawRegularShifts);
        if (isContinuation) return;
        if (isExtra && !s.generatePluses) return;
        
        const madTarget = getTarget('Madrugue');
        const madSubValue = getSubVal('Madrugue');
        if (madTarget > 0 && madSubValue) {
          if (runningAcc.madrugue < madTarget) {
            if (isMadrugue(sh.start, sh.end || "", mStartSub, mEndSub, mMinEndSub, mMinEndEnabledSub)) {
              madruguesSub++;
              runningAcc.madrugue++;
            } else if (isMadrugue(sh.start, sh.end || "", mStartCon, mEndCon, mMinEndCon, mMinEndEnabledCon)) {
              madrugues++;
            }
          } else {
            if (isMadrugue(sh.start, sh.end || "", mStartCon, mEndCon, mMinEndCon, mMinEndEnabledCon)) {
              madrugues++;
            }
          }
        } else {
          if (isMadrugue(sh.start, sh.end || "", mStartCon, mEndCon, mMinEndCon, mMinEndEnabledCon)) {
            madrugues++;
          }
        }
      });

      // Custom Pluses with Madrugue, Attendance, Meals, or custom shift functions
      Object.entries(pluses).forEach(([pName, pCfg]) => {
        if (!pCfg || !pCfg.enabled) return;
        if (pName === 'Madrugue' || pName === 'Madrugue SUB' || pName === 'Transporte' || pName === 'Transporte SUB' || pName === 'Jornada Irregular Diaria') return;

        const isMadrugueCustom = pCfg.baseType === 'madrugue' || pCfg.calculationType === 'madrugue' || pCfg.cloneOf === 'Madrugue' || pCfg.cloneOf === 'Madrugue SUB' || pCfg.madrugueStart !== undefined;
        if (isMadrugueCustom) {
          const cStart = pCfg.madrugueStart || "02:00";
          const cEnd = pCfg.madrugueEnd || "06:55";
          const cMinEnd = pCfg.madrugueMinEnd || "00:00";
          const cMinEndEnabled = pCfg.madrugueMinEndEnabled || false;

          allEffectiveShiftsForDay.forEach((sh, shIdx) => {
            if (!sh.start) return;
            const isExtra = extraShiftsList.includes(sh);
            const isContinuation = isShiftContinuation(sh, shIdx, allEffectiveShiftsForDay, prevDayMidnightEnds, rawRegularShifts);
            if (isContinuation) return;
            if (isExtra && !s.generatePluses) return;
            if (isMadrugue(sh.start, sh.end || "", cStart, cEnd, cMinEnd, cMinEndEnabled)) {
              customCounts[pName] = (customCounts[pName] || 0) + 1;
            }
          });
        }

        const isTransportCustom = pCfg.baseType === 'transporte' || pCfg.calculationType === 'transporte' || pCfg.calculationType === 'dias_trabajados' || pCfg.cloneOf === 'Transporte' || pCfg.cloneOf === 'Transporte SUB';
        if (isTransportCustom && hasEffectiveWork && hasAnyShiftStart) {
          customCounts[pName] = (customCounts[pName] || 0) + 1;
        }

        const isManutencionCustom = pCfg.baseType === 'manutencion' || pCfg.calculationType === 'manutencion' || pCfg.cloneOf === 'Manutención' || pCfg.cloneOf === 'Manutención/Comida SUB';
        if (isManutencionCustom) {
          const mStart1 = pCfg.startHour || '14:00';
          const mEnd1 = pCfg.endHour || '16:00';
          const mStart2 = pCfg.startHour2 || '21:00';
          const mEnd2 = pCfg.endHour2 || '23:00';
          const shiftsForMan = s.generatePluses ? allEffectiveShiftsForDay : effectiveRegularShifts;
          if (checkManutencionWithRanges(shiftsForMan, mStart1, mEnd1, mStart2, mEnd2)) {
            customCounts[pName] = (customCounts[pName] || 0) + 1;
          }
        }
      });
    }

    // Hours-based pluses
    const isTodayHoliday = holidays.includes(s.date) || isFixedHoliday(d) || (isSunday(d) && isSubrogado && !!pluses['Domingo SUB']?.festivos);
    const nextDateStr = safeFormat(nextD, 'yyyy-MM-dd');
    const isTomorrowHoliday = holidays.includes(nextDateStr) || isFixedHoliday(nextD) || (isSunday(nextD) && isSubrogado && !!pluses['Domingo SUB']?.festivos);
    const isTodaySunday = isSunday(d) && !(isSubrogado && !!pluses['Domingo SUB']?.festivos);
    const isTomorrowSunday = isSunday(nextD) && !(isSubrogado && !!pluses['Domingo SUB']?.festivos);

    const nStartCon = nightPlusConfig?.startHour ? parseInt(nightPlusConfig.startHour.split(':')[0]) : 22;
    const nEndCon = nightPlusConfig?.endHour ? parseInt(nightPlusConfig.endHour.split(':')[0]) : 6;
    const nocturnasSubConfig = pluses['Nocturnas SUB'];
    const nStartSub = isSubrogado && nocturnasSubConfig?.startHour ? parseInt(nocturnasSubConfig.startHour.split(':')[0]) : (nightPlusConfig?.subStartHour ? parseInt(nightPlusConfig.subStartHour.split(':')[0]) : nStartCon);
    const nEndSub = isSubrogado && nocturnasSubConfig?.endHour ? parseInt(nocturnasSubConfig.endHour.split(':')[0]) : (nightPlusConfig?.subEndHour ? parseInt(nightPlusConfig.subEndHour.split(':')[0]) : nEndCon);

    allEffectiveShiftsForDay.forEach((sh, shIdx) => {
      if (!sh.start || !sh.end) return;
      
      const isExtra = extraShiftsList.includes(sh);
      const isContinuationOfRegular = isShiftContinuation(sh, shIdx, effectiveRegularShifts, prevDayMidnightEnds, rawRegularShifts);
      const isAfterMidnight = isShiftAfterMidnightOfDay(sh, shIdx, allEffectiveShiftsForDay, rawRegularShifts);
      const duration = getShiftDuration(sh.start, sh.end);
      const [sH, sM] = sh.start.split(':').map(Number);
      const [eH, eM] = sh.end.split(':').map(Number);
      const startMin = sH * 60 + sM;
      let endMin = eH * 60 + eM;
      const crossesMidnight = endMin <= startMin;
      const minsToday = isAfterMidnight ? 0 : (crossesMidnight ? (24 * 60 - startMin) : (endMin - startMin));
      const minsTomorrow = isAfterMidnight ? (duration * 60) : (crossesMidnight ? endMin : 0);
      const hoursToday = minsToday / 60;
      const hoursTomorrow = minsTomorrow / 60;
      const hasTomorrowHours = crossesMidnight || isAfterMidnight;

      const nightSplitCon = getNightHoursSplit(sh.start, sh.end, nStartCon, nEndCon);
      const nightSplitSub = getNightHoursSplit(sh.start, sh.end, nStartSub, nEndSub);

      const fTarget = getTarget('Festivo');
      const fSub = getSubVal('Festivo');
      const sunTarget = getTarget('Domingo');
      const sunSub = getSubVal('Domingo');
      const canShiftGenerateWeekendOrHolidayPluses = !isExtra && shouldGeneratePluses(s);

      // Process Today
      if (isTodayInTarget) {
        if (!isExtra) {
          totalHours += duration;
          effectiveHours += duration;
          const isCoveringCoworker = !!s.swapInfo?.coveringCoworker;
          if (!isContinuationOfRegular && !isCoveringCoworker) {
            uniqueShifts.add(sh.start);
          }
        }
        
        if (!isVac && canShiftGenerateWeekendOrHolidayPluses) {
          if (isTodaySunday) {
            if (sunTarget > 0 && sunSub) {
              const remaining = sunTarget - runningAcc.sundays;
              const toAddSub = Math.max(0, Math.min(hoursToday, remaining));
              sundaysSub += toAddSub;
              runningAcc.sundays += toAddSub;
              sundays += hoursToday - toAddSub;
            } else sundays += hoursToday;
          }
          if (isTodayHoliday) {
            if (fTarget > 0 && fSub) {
              const remaining = fTarget - runningAcc.festivos;
              const toAddSub = Math.max(0, Math.min(hoursToday, remaining));
              festivosSub += toAddSub;
              runningAcc.festivos += toAddSub;
              festivos += hoursToday - toAddSub;
            } else festivos += hoursToday;
          }

          // Custom Festivo and Domingo clones
          Object.entries(pluses).forEach(([pName, pCfg]) => {
            if (!pCfg || !pCfg.enabled) return;
            if (pName === 'Festivo' || pName === 'Festivo SUB' || pName === 'Domingo' || pName === 'Domingo SUB') return;
            if ((pCfg.baseType === 'festivo' || pCfg.calculationType === 'festivo' || pCfg.cloneOf === 'Festivo' || pCfg.cloneOf === 'Festivo SUB') && isTodayHoliday) {
              customCounts[pName] = (customCounts[pName] || 0) + hoursToday;
            }
            if ((pCfg.baseType === 'domingo' || pCfg.calculationType === 'domingo' || pCfg.cloneOf === 'Domingo' || pCfg.cloneOf === 'Domingo SUB') && isTodaySunday) {
              customCounts[pName] = (customCounts[pName] || 0) + hoursToday;
            }
          });
        }

        if (!isVac && shouldGeneratePluses(s)) {
          // Night hours
          if (!isExtra) {
            const shiftNightSub = nightSplitSub.today + nightSplitSub.tomorrow;
            const shiftNightCon = nightSplitCon.today + nightSplitCon.tomorrow;
            const targetShiftNight = isSubrogado ? shiftNightSub : shiftNightCon;

            if (nightTarget > 0 && getSubVal('Nocturnas') !== undefined) {
              if (runningAcc.night < nightTarget) {
                const remaining = nightTarget - runningAcc.night;
                const toAddSub = Math.min(shiftNightSub, remaining);
                nightHoursSub += toAddSub;
                runningAcc.night += toAddSub;
                nightHours += Math.max(0, targetShiftNight - toAddSub);
              } else {
                nightHours += targetShiftNight;
              }
            } else {
              nightHours += targetShiftNight;
            }

            // Custom Nocturnas clones
            Object.entries(pluses).forEach(([pName, pCfg]) => {
              if (!pCfg || !pCfg.enabled) return;
              if (pName === 'Nocturnas' || pName === 'Nocturnas SUB') return;
              if (pCfg.baseType === 'nocturnas' || pCfg.calculationType === 'nocturnas' || pCfg.cloneOf === 'Nocturnas' || pCfg.cloneOf === 'Nocturnas SUB') {
                const cStart = pCfg.startHour ? parseInt(pCfg.startHour.split(':')[0]) : 22;
                const cEnd = pCfg.endHour ? parseInt(pCfg.endHour.split(':')[0]) : 6;
                const split = getNightHoursSplit(sh.start, sh.end, cStart, cEnd);
                const shiftNight = split.today + split.tomorrow;
                if (shiftNight > 0) {
                  customCounts[pName] = (customCounts[pName] || 0) + shiftNight;
                }
              }
            });
          }
        }

        // Extra hours
        if (isExtra && !isVac) {
          const shiftNight = isSubrogado 
            ? (nightSplitSub.today + nightSplitSub.tomorrow) 
            : (nightSplitCon.today + nightSplitCon.tomorrow);
          const shiftTotalHours = duration;
          const shiftDayDays = Math.max(0, shiftTotalHours - shiftNight);
          
          if (s.extraHoursStrategy === 'compensate') {
            compensatedHours += shiftTotalHours * 1.75;
          } else {
            if (contractType === 'Completo') {
              perentDay += shiftDayDays;
              perentNight += shiftNight;
            } else {
              complDay += shiftDayDays;
              complNight += shiftNight;
            }
          }
        }
      }

      // Process Tomorrow
      if (isTomorrowInTarget && hasTomorrowHours) {
        if (!isVac && canShiftGenerateWeekendOrHolidayPluses) {
          if (isTomorrowSunday) {
            if (sunTarget > 0 && sunSub) {
              const remaining = sunTarget - runningAcc.sundays;
              const toAddSub = Math.max(0, Math.min(hoursTomorrow, remaining));
              sundaysSub += toAddSub;
              runningAcc.sundays += toAddSub;
              sundays += hoursTomorrow - toAddSub;
            } else sundays += hoursTomorrow;
          }
          if (isTomorrowHoliday) {
            if (fTarget > 0 && fSub) {
              const remaining = fTarget - runningAcc.festivos;
              const toAddSub = Math.max(0, Math.min(hoursTomorrow, remaining));
              festivosSub += toAddSub;
              runningAcc.festivos += toAddSub;
              festivos += hoursTomorrow - toAddSub;
            } else festivos += hoursTomorrow;
          }
        }
      }
    });

    // Split shifts (Jornada Fraccionada) - Only recorded for contract type 'Parcial'
    if (contractType === 'Parcial' && isTodayInTarget && effectiveRegularShifts.length > 1 && effectiveRegularShifts[0].end && effectiveRegularShifts[1].start && shouldGeneratePluses(s)) {
      const gap = getShiftDuration(effectiveRegularShifts[0].end, effectiveRegularShifts[1].start);
      if (gap > 0) {
        if (gap < 4) {
          const t = getTarget('Jornada Fraccionada < 4h');
          const sSub = getSubVal('Jornada Fraccionada < 4h');
          if (t > 0 && sSub) {
            if (runningAcc.splitLess4 < t) { splitLess4Sub++; runningAcc.splitLess4++; }
            else splitLess4++;
          } else splitLess4++;
        } else if (gap < 7) {
          const t = getTarget('Jornada Fraccionada >= 4h');
          const sSub = getSubVal('Jornada Fraccionada >= 4h');
          if (t > 0 && sSub) {
            if (runningAcc.split4to7 < t) { split4to7Sub++; runningAcc.split4to7++; }
            else split4to7++;
          } else split4to7++;
        } else {
          const t = getTarget('Jornada Fraccionada >= 7h');
          const sSub = getSubVal('Jornada Fraccionada >= 7h');
          if (t > 0 && sSub) {
            if (runningAcc.splitPlus7 < t) { splitPlus7Sub++; runningAcc.splitPlus7++; }
            else splitPlus7++;
          } else splitPlus7++;
        }
      }
    }
  });

  const monthlyHours = totalHours + vacationHours + monthlyCompensatedHours + ausenciaHours;
  const baseJornada = 155.63;
  let targetJornada = baseJornada;
  
  if (isResumen) {
    const hoursPerDay = baseJornada / 22;
    targetJornada = Math.max(0, baseJornada - (absentDays * hoursPerDay));
  }

  const effectivePercentage = baseJornada > 0 ? (monthlyHours / baseJornada) * 100 : 0;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalRealizadas: Math.round(totalHours * 100) / 100,
    effectiveHours: Math.round(totalHours * 100) / 100,
    monthlyHours: Math.round(monthlyHours * 100) / 100,
    computedHours: Math.round(monthlyHours * 100) / 100,
    vacationHours: Math.round(vacationHours * 100) / 100,
    monthlyCompensatedHours: Math.round(monthlyCompensatedHours * 100) / 100,
    sindicalHours: Math.round(sindicalHours * 100) / 100,
    monthlySindicalHours: Math.round(monthlySindicalHours * 100) / 100,
    ausenciaHours: Math.round(ausenciaHours * 100) / 100,
    cambioFuncionHours: Math.round(cambioFuncionHours * 100) / 100,
    effectivePercentage,
    nightHours: Math.round(nightHours * 100) / 100,
    nightHoursSub: Math.round(nightHoursSub * 100) / 100,
    madrugues,
    madruguesSub,
    sundays: Math.round(sundays * 100) / 100,
    sundaysSub: Math.round(sundaysSub * 100) / 100,
    festivos: Math.round(festivos * 100) / 100,
    festivosSub: Math.round(festivosSub * 100) / 100,
    transport,
    transportSub: 0,
    manutencion,
    manutencionSub,
    splitLess4,
    splitLess4Sub,
    split4to7,
    split4to7Sub,
    splitPlus7,
    splitPlus7Sub,
    perentDay: Math.round(perentDay * 100) / 100,
    perentNight: Math.round(perentNight * 100) / 100,
    complDay: Math.round(complDay * 100) / 100,
    complNight: Math.round(complNight * 100) / 100,
    compensatedHours: Math.round(compensatedHours * 100) / 100,
    absentDays,
    uniqueShiftsCount: uniqueShifts.size,
    customCounts
  };
};

export const compressImageFile = (file: File, maxDimension = 1280, quality = 0.80): Promise<string> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    };

    img.src = url;
  });
};

/**
 * Determina de forma semántica y robusta si una nómina guardada es una Paga Extraordinaria (Paga Extra).
 * En la legislación laboral y convenios españoles:
 * - Una nómina ordinaria mensual SIEMPRE incluye cotizaciones a la Seguridad Social (Contingencias Comunes,
 *   Desempleo, Formación Profesional, MEI).
 * - Una Paga Extraordinaria NO cotiza a la Seguridad Social en su recibo (ya se cotiza mes a mes mediante la
 *   prorrata de la BCCC), por lo que SOLO tiene retención de IRPF y carece de deducciones de Seguridad Social.
 * - Además, suele incluir en sus devengos la denominación "Paga Extra" o "Extraordinaria".
 */
export const isExtraPayroll = (p: SavedPayroll | null | undefined): boolean => {
  if (!p) return false;

  // 1. Comprobación de deducciones de Seguridad Social:
  // Si tiene deducciones de Contingencias Comunes, Desempleo, FP o MEI, es INEQUÍVOCAMENTE una Nómina Mensual Ordinaria.
  const hasSSDeductions = (p.deducciones || []).some(d => {
    const n = (d.name || '').toLowerCase();
    return (
      n.includes('contingencias') ||
      n.includes('comun') ||
      n.includes('desempleo') ||
      n.includes('formaci') ||
      n.includes('mei') ||
      n.includes('m.e.i')
    );
  });

  if (hasSSDeductions) return false;

  // 2. Comprobación de devengos explícitos de Paga Extra
  const hasExtraDevengo = (p.devengos || []).some(d => {
    const n = (d.name || '').toLowerCase();
    return (
      n.includes('paga extra') ||
      n.includes('extraordinaria') ||
      n.includes('extra de verano') ||
      n.includes('extra de navidad')
    );
  });

  if (hasExtraDevengo) return true;

  // 3. Si solo tiene IRPF (o no tiene deducciones de SS) y su monthKey contiene 'extra'
  if ((p.monthKey || '').toLowerCase().includes('extra')) {
    return true;
  }

  // 4. Si solo tiene 1 devengo y solo IRPF en deducciones
  const onlyHasIrpf = (p.deducciones || []).length <= 1 && (p.deducciones || []).every(d => (d.name || '').toUpperCase().includes('IRPF'));
  if (onlyHasIrpf && (p.devengos || []).length <= 2 && (p.monthKey || '').includes('extra')) {
    return true;
  }

  return false;
};

export const isRegularPayroll = (p: SavedPayroll | null | undefined): boolean => {
  if (!p) return false;
  return !isExtraPayroll(p);
};

export interface ShiftOverlapResult {
  hasSameDayOverlap: boolean;
  hasHourlyOverlap: boolean;
  overlapMinutes: number;
  mainTimesText: string;
  secondTimesText: string;
  hasExactBoundaryOverlap?: boolean;
  boundaryTimeText?: string;
}

export function checkDayShiftsOverlap(
  dayMain?: DayShift | null,
  daySecond?: DayShift | null,
  options?: {
    isMainVacationInSettings?: boolean;
    isMainHoliday?: boolean;
  }
): ShiftOverlapResult {
  const result: ShiftOverlapResult = {
    hasSameDayOverlap: false,
    hasHourlyOverlap: false,
    overlapMinutes: 0,
    mainTimesText: '',
    secondTimesText: '',
    hasExactBoundaryOverlap: false,
    boundaryTimeText: '',
  };

  // Los solapes solo cuentan los días marcados como: laboral o festivo
  // pero nunca los marcados como: vacaciones, ausencia justificada, horas sindicales, baja it y a compensar.
  const nonWorkTypes: string[] = [
    'Vacaciones',
    'Ausencia Justificada',
    'Horas Sindicales',
    'Baja IT',
    'A Compensar'
  ];

  const isMainNonWork = !!(
    options?.isMainVacationInSettings || 
    (dayMain?.type && nonWorkTypes.includes(dayMain.type))
  );

  const validMain = isMainNonWork ? [] : [
    ...((dayMain?.shifts || []).filter(s => s && s.start && s.end)),
    ...((dayMain?.extraShifts || []).filter(s => s && s.start && s.end))
  ];

  const allMain = validMain;
  const allSecond = ((daySecond?.shifts) || []).filter(s => s && s.start && s.end);

  result.mainTimesText = allMain.map(s => `${s.start}-${s.end}`).join(', ');
  result.secondTimesText = allSecond.map(s => `${s.start}-${s.end}`).join(', ');

  if (allMain.length === 0 || allSecond.length === 0) {
    return result;
  }

  // Si ambos tienen turnos el mismo día, existe coincidencia/solape de jornada
  result.hasSameDayOverlap = true;

  const parseMinutes = (start: string, end: string) => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const startM = (sH || 0) * 60 + (sM || 0);
    let endM = (eH || 0) * 60 + (eM || 0);
    if (endM <= startM) {
      endM += 24 * 60; // Noche que cruza medianoche
    }
    return { startM, endM };
  };

  let totalOverlapMin = 0;
  const boundaryTimes: string[] = [];

  for (const m of allMain) {
    const { startM: mStart, endM: mEnd } = parseMinutes(m.start, m.end);
    for (const s of allSecond) {
      const { startM: sStart, endM: sEnd } = parseMinutes(s.start, s.end);
      
      const overlapStart = Math.max(mStart, sStart);
      const overlapEnd = Math.min(mEnd, sEnd);
      if (overlapEnd > overlapStart) {
        totalOverlapMin += (overlapEnd - overlapStart);
        result.hasHourlyOverlap = true;
      } else if (overlapEnd === overlapStart) {
        // Coincidencia exacta de hora: un turno finaliza a una hora y el otro inicia a esa misma hora (ej. 13:00 con 13:00)
        result.hasHourlyOverlap = true;
        result.hasExactBoundaryOverlap = true;
        const h = Math.floor(overlapStart / 60) % 24;
        const min = overlapStart % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        if (!boundaryTimes.includes(timeStr)) {
          boundaryTimes.push(timeStr);
        }
      }
    }
  }

  result.overlapMinutes = totalOverlapMin;
  if (boundaryTimes.length > 0) {
    result.hasExactBoundaryOverlap = true;
    result.boundaryTimeText = boundaryTimes.join(', ');
  }

  return result;
}

/**
 * Resolves the calendar rotation config for a given month.
 * Independent for each month:
 * - If target month has explicit config in settings.monthlyRotations[monthKey], use it.
 * - Otherwise inherits from the latest configured month <= monthKey.
 * - Does NOT alter previous months.
 * - Fallbacks to settings.calendarRotation if applicable.
 */
export function getRotationForMonth(
  targetDateOrMonthKey: Date | string,
  settings?: Settings
): CalendarRotationConfig | undefined {
  if (!settings) return undefined;

  const monthKey = typeof targetDateOrMonthKey === 'string'
    ? targetDateOrMonthKey.slice(0, 7)
    : safeFormat(targetDateOrMonthKey, 'yyyy-MM');

  if (settings.monthlyRotations && settings.monthlyRotations[monthKey]) {
    return settings.monthlyRotations[monthKey];
  }

  if (settings.monthlyRotations) {
    const sortedKeys = Object.keys(settings.monthlyRotations)
      .filter(k => k <= monthKey)
      .sort()
      .reverse();
    if (sortedKeys.length > 0) {
      return settings.monthlyRotations[sortedKeys[0]];
    }
  }

  if (settings.calendarRotation) {
    if (!settings.calendarRotation.effectiveFromMonth || monthKey >= settings.calendarRotation.effectiveFromMonth) {
      return settings.calendarRotation;
    }
  }

  return undefined;
}

/**
 * Resolves the auto-shifts config for a given month.
 * Independent for each month:
 * - If target month has explicit config in settings.monthlyAutoShifts[monthKey], use it.
 * - Otherwise inherits from the latest configured month <= monthKey.
 * - Fallbacks to settings.autoShiftsConfig.
 */
export function getAutoShiftsForMonth(
  targetDateOrMonthKey: Date | string,
  settings?: Settings
): AutoShiftsConfig | undefined {
  if (!settings) return undefined;

  const monthKey = typeof targetDateOrMonthKey === 'string'
    ? targetDateOrMonthKey.slice(0, 7)
    : safeFormat(targetDateOrMonthKey, 'yyyy-MM');

  if (settings.monthlyAutoShifts && settings.monthlyAutoShifts[monthKey]) {
    return settings.monthlyAutoShifts[monthKey];
  }

  if (settings.monthlyAutoShifts) {
    const sortedKeys = Object.keys(settings.monthlyAutoShifts)
      .filter(k => k <= monthKey)
      .sort()
      .reverse();
    if (sortedKeys.length > 0) {
      return settings.monthlyAutoShifts[sortedKeys[0]];
    }
  }

  return settings.autoShiftsConfig;
}

export function getDefaultMixedRotation(referenceMonth?: Date): MixedRotationConfig {
  const ref = referenceMonth && isValid(referenceMonth) ? startOfMonth(referenceMonth) : startOfMonth(new Date());
  const firstAnchorDate = safeFormat(ref, 'yyyy-MM-dd');
  const switchDate = safeFormat(addDays(ref, 14), 'yyyy-MM-dd');
  return {
    mode: 'by_date',
    firstWorkDays: 5,
    firstFreeDays: 2,
    firstAnchorDate,
    firstFreeDay: 1,
    secondWorkDays: 6,
    secondFreeDays: 3,
    switchDate,
    secondStartsWith: 'work',
  };
}

export function loadSavedMixedRotation(settings?: Settings, referenceMonth?: Date): MixedRotationConfig {
  if (settings?.mixedRotation) return settings.mixedRotation;
  if (settings?.calendarRotation?.mixedConfig) return settings.calendarRotation.mixedConfig;
  try {
    const raw = localStorage.getItem('mixedRotationConfig');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.firstWorkDays && parsed.secondWorkDays) {
        return parsed as MixedRotationConfig;
      }
    }
  } catch {
    // ignore storage errors
  }
  return getDefaultMixedRotation(referenceMonth);
}

export function formatMixedRotationShortLabel(mixed?: MixedRotationConfig): string {
  if (!mixed) return '5x2→6x3';
  const sep = mixed.mode === 'alternating' ? '+' : '→';
  return `${mixed.firstWorkDays}x${mixed.firstFreeDays}${sep}${mixed.secondWorkDays}x${mixed.secondFreeDays}`;
}

export function buildSimpleCycleArray(workDays: number, freeDays: number): ('M' | 'T' | 'L')[] {
  const w = Math.max(1, workDays);
  const f = Math.max(1, freeDays);
  const mCount = Math.ceil(w / 2);
  const tCount = Math.floor(w / 2);
  const arr: ('M' | 'T' | 'L')[] = [];
  for (let i = 0; i < f; i++) arr.push('L');
  for (let i = 0; i < mCount; i++) arr.push('M');
  for (let i = 0; i < tCount; i++) arr.push('T');
  return arr;
}

export function getMixedRotationDayShift(
  date: Date,
  mixed: MixedRotationConfig,
  rotation: number = 1
): 'M' | 'T' | 'L' {
  const w1 = Math.max(1, mixed.firstWorkDays || 5);
  const f1 = Math.max(1, mixed.firstFreeDays || 2);
  const w2 = Math.max(1, mixed.secondWorkDays || 6);
  const f2 = Math.max(1, mixed.secondFreeDays || 3);

  let anchor1 = mixed.firstAnchorDate ? parseISO(mixed.firstAnchorDate) : new Date(2026, 0, 1);
  if (!isValid(anchor1)) anchor1 = new Date(2026, 0, 1);

  if (mixed.mode === 'alternating') {
    const combined = [...buildSimpleCycleArray(w1, f1), ...buildSimpleCycleArray(w2, f2)];
    const len = combined.length;
    const stepOffset = Math.max(1, Math.round((f1 + f2) / 2));
    const rotOffset = (rotation - 1) * stepOffset;
    const diff = differenceInCalendarDays(date, anchor1);
    const idx = (((diff - rotOffset) % len) + len) % len;
    return combined[idx];
  }

  // mode === 'by_date'
  const dateStr = safeFormat(date, 'yyyy-MM-dd');
  const switchDate = mixed.switchDate || '';

  if (switchDate && dateStr >= switchDate) {
    const cycle2 = buildSimpleCycleArray(w2, f2);
    let anchor2: Date | null = null;
    if (mixed.secondAnchorDate) {
      const parsed2 = parseISO(mixed.secondAnchorDate);
      if (isValid(parsed2)) anchor2 = parsed2;
    }
    if (!anchor2) {
      const switchObj = parseISO(switchDate);
      if (isValid(switchObj)) {
        anchor2 = mixed.secondStartsWith === 'free' ? switchObj : addDays(switchObj, w2);
      } else {
        anchor2 = anchor1;
      }
    }
    const diff = differenceInCalendarDays(date, anchor2);
    const rotOffset = (rotation - 1) * f2;
    const idx = (((diff - rotOffset) % cycle2.length) + cycle2.length) % cycle2.length;
    return cycle2[idx];
  }

  const cycle1 = buildSimpleCycleArray(w1, f1);
  const diff = differenceInCalendarDays(date, anchor1);
  const rotOffset = (rotation - 1) * f1;
  const idx = (((diff - rotOffset) % cycle1.length) + cycle1.length) % cycle1.length;
  return cycle1[idx];
}

export function getCalendarRotationDayShift(
  dayDate: Date,
  rotationConfig?: CalendarRotationConfig
): 'M' | 'T' | 'L' | null {
  if (!rotationConfig) return null;

  if (rotationConfig.type === 'mixed' && rotationConfig.mixedConfig) {
    return getMixedRotationDayShift(dayDate, rotationConfig.mixedConfig, 1);
  }

  if (!rotationConfig.anchorDate) return null;
  const anchor = parseISO(rotationConfig.anchorDate);
  if (!isValid(anchor)) return null;

  let workDays = 6;
  let freeDaysCount = 3;
  if (rotationConfig.type === '4x4') {
    workDays = 4;
    freeDaysCount = 4;
  } else if (rotationConfig.workDays !== undefined && rotationConfig.freeDays !== undefined && rotationConfig.workDays > 0 && rotationConfig.freeDays > 0) {
    workDays = rotationConfig.workDays;
    freeDaysCount = rotationConfig.freeDays;
  } else if (rotationConfig.type && rotationConfig.type.includes('x')) {
    const parts = rotationConfig.type.split('x').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
      workDays = parts[0];
      freeDaysCount = parts[1];
    }
  }

  const cycle = buildSimpleCycleArray(workDays, freeDaysCount);
  const daysDiff = differenceInCalendarDays(dayDate, anchor);
  const cycleIndex = ((daysDiff % cycle.length) + cycle.length) % cycle.length;
  return cycle[cycleIndex];
}

/**
 * Calculates whether a specific day is a rest day (libranza) according to the configured rotation (6x3, 4x4, custom, or mixed).
 * Supports passing either CalendarRotationConfig or Settings directly.
 * When Settings is provided, resolves the rotation independently for that specific day's month.
 */
export function isRotationFreeDay(
  dayDate: Date,
  configOrSettings?: CalendarRotationConfig | Settings
): boolean {
  if (!configOrSettings) return false;

  let rotationConfig: CalendarRotationConfig | undefined;

  if (
    'calendarRotation' in configOrSettings ||
    'monthlyRotations' in configOrSettings ||
    'theme' in configOrSettings ||
    'workShift' in configOrSettings
  ) {
    rotationConfig = getRotationForMonth(dayDate, configOrSettings as Settings);
  } else {
    rotationConfig = configOrSettings as CalendarRotationConfig;
  }

  if (!rotationConfig || !rotationConfig.enabled) return false;

  const currentMonthKey = safeFormat(dayDate, 'yyyy-MM');
  if (rotationConfig.effectiveFromMonth && currentMonthKey < rotationConfig.effectiveFromMonth) {
    return false;
  }

  if (rotationConfig.type === 'mixed' && rotationConfig.mixedConfig) {
    return getMixedRotationDayShift(dayDate, rotationConfig.mixedConfig, 1) === 'L';
  }

  if (!rotationConfig.anchorDate) return false;

  const anchor = parseISO(rotationConfig.anchorDate);
  if (!isValid(anchor)) return false;

  const daysDiff = differenceInCalendarDays(dayDate, anchor);
  let workDays = 6;
  let freeDaysCount = 3;
  if (rotationConfig.type === '4x4') {
    workDays = 4;
    freeDaysCount = 4;
  } else if (rotationConfig.workDays !== undefined && rotationConfig.freeDays !== undefined && rotationConfig.workDays > 0 && rotationConfig.freeDays > 0) {
    workDays = rotationConfig.workDays;
    freeDaysCount = rotationConfig.freeDays;
  } else if (rotationConfig.type && rotationConfig.type.includes('x')) {
    const parts = rotationConfig.type.split('x').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
      workDays = parts[0];
      freeDaysCount = parts[1];
    }
  }
  const cycleLength = workDays + freeDaysCount;

  // Normalized positive modulo
  const cycleIndex = ((daysDiff % cycleLength) + cycleLength) % cycleLength;

  return cycleIndex < freeDaysCount;
}

export const getDaysSinceBase = (date: Date) => {
  const baseDate = new Date(2026, 0, 1);
  return differenceInCalendarDays(date, baseDate);
};

export const CYCLE_4X4: ('M' | 'T' | 'L')[] = ['M', 'M', 'T', 'T', 'L', 'L', 'L', 'L'];
export const CYCLE_6X3: ('M' | 'T' | 'L')[] = ['M', 'M', 'M', 'T', 'T', 'T', 'L', 'L', 'L'];

export const getRotationShift = (
  date: Date, 
  rotation: number, 
  cycleType: '6x3' | '4x4' | 'mixed' | string = '6x3',
  customConfig?: { workDays?: number; freeDays?: number; anchorDate?: string; firstFreeDay?: number; mixedConfig?: MixedRotationConfig }
): 'M' | 'T' | 'L' => {
  if (cycleType === 'mixed' && customConfig?.mixedConfig) {
    return getMixedRotationDayShift(date, customConfig.mixedConfig, rotation);
  }
  const days = getDaysSinceBase(date);
  if (cycleType === '4x4') {
    let offset = 0;
    if (rotation === 1) offset = 6;
    else if (rotation === 2) offset = 4;
    else if (rotation === 3) offset = 2;
    else if (rotation === 4) offset = 0;
    
    const val = (days + offset) % 8;
    const cycleIndex = val < 0 ? val + 8 : val;
    return CYCLE_4X4[cycleIndex] as 'M' | 'T' | 'L';
  } else if (cycleType === '6x3') {
    let offset = 0;
    if (rotation === 1) offset = 1;
    else if (rotation === 2) offset = 4;
    else if (rotation === 3) offset = 7;
    
    const val = (days + offset) % 9;
    const cycleIndex = val < 0 ? val + 9 : val;
    return CYCLE_6X3[cycleIndex] as 'M' | 'T' | 'L';
  } else {
    let workDays = 5;
    let freeDays = 2;
    if (customConfig?.workDays && customConfig?.freeDays) {
      workDays = customConfig.workDays;
      freeDays = customConfig.freeDays;
    } else if (cycleType && cycleType.includes('x')) {
      const parts = cycleType.split('x').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
        workDays = parts[0];
        freeDays = parts[1];
      }
    }
    const cycleLen = workDays + freeDays;
    const customCycle = buildSimpleCycleArray(workDays, freeDays);

    let anchorObj: Date | null = null;
    if (customConfig?.anchorDate) {
      const parsed = parseISO(customConfig.anchorDate);
      if (isValid(parsed)) anchorObj = parsed;
    }

    if (anchorObj) {
      const diff = differenceInCalendarDays(date, anchorObj);
      const rotOffset = (rotation - 1) * freeDays;
      const val = (diff - rotOffset) % cycleLen;
      const cycleIndex = val < 0 ? val + cycleLen : val;
      return customCycle[cycleIndex] as 'M' | 'T' | 'L';
    } else {
      const offset = (rotation - 1) * freeDays;
      const val = (days + offset) % cycleLen;
      const cycleIndex = val < 0 ? val + cycleLen : val;
      return customCycle[cycleIndex] as 'M' | 'T' | 'L';
    }
  }
};

export function getCounterConfigForYear(
  settings: Settings | undefined,
  targetYear: number
): { period: { start: string; end: string }; targets: { [plusName: string]: number }; counterYear: number } {
  const defaultPeriod = {
    start: `${targetYear - 1}-12-01`,
    end: `${targetYear}-11-30`
  };

  let period = defaultPeriod;
  if (settings?.yearlyCounterPeriods?.[targetYear]?.start && settings.yearlyCounterPeriods[targetYear]?.end) {
    period = settings.yearlyCounterPeriods[targetYear];
  } else if (settings?.counterPeriod?.start && settings?.counterPeriod?.end) {
    const endD = parseISO(settings.counterPeriod.end);
    if (isValid(endD) && endD.getFullYear() === targetYear) {
      period = settings.counterPeriod;
    }
  }

  let targets: { [plusName: string]: number } = {};
  const yearlyMap = settings?.yearlyCounterTargets;
  if (yearlyMap && Object.prototype.hasOwnProperty.call(yearlyMap, targetYear) && yearlyMap[targetYear]) {
    targets = yearlyMap[targetYear];
  } else if (yearlyMap && Object.keys(yearlyMap).length > 0) {
    // Inherit forward only from the most recent configured year strictly earlier than targetYear
    const priorYears = Object.keys(yearlyMap)
      .map(Number)
      .filter((y) => !isNaN(y) && y < targetYear)
      .sort((a, b) => b - a);
    if (priorYears.length > 0) {
      targets = yearlyMap[priorYears[0]] || {};
    }
  } else if (settings?.counterTargets) {
    // Legacy fallback only when yearlyCounterTargets has never been initialized
    targets = settings.counterTargets;
  }

  return { period, targets, counterYear: targetYear };
}

export function getCounterConfigForDate(
  settings: Settings | undefined,
  targetDate: Date
): { period: { start: string; end: string }; targets: { [plusName: string]: number }; counterYear: number } {
  if (!isValid(targetDate)) {
    const yr = new Date().getFullYear();
    return getCounterConfigForYear(settings, yr);
  }

  const dateStr = safeFormat(targetDate, 'yyyy-MM-dd');
  const yr = targetDate.getFullYear();
  const monthIdx = targetDate.getMonth();

  if (settings?.yearlyCounterPeriods) {
    // Prioritize candidate years around targetDate
    const candidateYears = [yr, yr + 1, yr - 1, ...Object.keys(settings.yearlyCounterPeriods).map(Number)];
    const seen = new Set<number>();
    for (const cYear of candidateYears) {
      if (seen.has(cYear)) continue;
      seen.add(cYear);
      const p = settings.yearlyCounterPeriods[cYear];
      if (p?.start && p?.end && dateStr >= p.start && dateStr <= p.end) {
        return getCounterConfigForYear(settings, cYear);
      }
    }
  }

  if (settings?.counterPeriod?.start && settings?.counterPeriod?.end) {
    if (dateStr >= settings.counterPeriod.start && dateStr <= settings.counterPeriod.end) {
      const endD = parseISO(settings.counterPeriod.end);
      const cYear = isValid(endD) ? endD.getFullYear() : yr;
      const cfg = getCounterConfigForYear(settings, cYear);
      return {
        period: settings.counterPeriod,
        targets: cfg.targets,
        counterYear: cYear
      };
    }
  }

  // Standard Handling subrogated counter period runs Dec 1 of (year - 1) to Nov 30 of year
  const defaultCounterYear = monthIdx === 11 ? yr + 1 : yr;
  return getCounterConfigForYear(settings, defaultCounterYear);
}

export function getEffectiveSubPlusPrice(
  yearPluses: PlusesData | undefined,
  baseName: string,
  isSubrogado: boolean
): number | undefined {
  if (!yearPluses) return undefined;
  const subKey = baseName === 'Manutención' ? 'Manutención/Comida SUB' : `${baseName} SUB`;
  const subCfg = yearPluses[subKey];
  if (isSubrogado && subCfg && subCfg.enabled && subCfg.value !== undefined) {
    return subCfg.value;
  }
  return yearPluses[baseName]?.subValue;
}

