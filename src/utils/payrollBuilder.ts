import {
  subMonths,
  isSameMonth,
  parseISO,
  startOfMonth,
  endOfMonth,
  addDays,
  addYears,
  differenceInDays,
  isValid
} from 'date-fns';
import {
  YearlyLevels,
  YearlyPluses,
  LevelData,
  PlusesData,
  MonthlyOptions,
  PlusConfig,
  SavedPayroll,
  INITIAL_LEVELS_PASAJE,
  INITIAL_PLUSES_PASAJE
} from '../types';
import {
  getShiftDuration,
  getStatsForShifts,
  calculateLevelMetrics,
  safeFormat,
  getAusenciaHoursForDay,
  getCounterConfigForDate
} from '../utils';

export const STANDARD_PAYROLL_PLUSES = [
  'Tiempo Parcial - Discontinuo', 'Teamleader', 'Jornada Irregular',
  'Turnicidad', 'Turnicidad 2', 'Turnicidad 3', 'Turnicidad 4', 'Turnicidad 5+',
  'Jornada Fraccionada < 4h', 'Jornada Fraccionada >= 4h', 'Jornada Fraccionada >= 7h',
  'Transporte', 'Manutención', 'Madrugue', 'Festivo', 'Domingo', 'Nocturnas',
  'Multitasking', 'Productividad', 'ARCO', 'RCO', 'Duty', 'Super', 'Cambio de función',
  'Jornada Irregular Diaria'
];

export interface SimulatedMonthPayrolls {
  regularPayroll: SavedPayroll;
  extraPayroll: SavedPayroll | null;
  allPayrolls: SavedPayroll[];
}

const getYearlyDataForYear = <T,>(data: Record<number, T> | undefined, year: number, fallback: T): T => {
  if (!data) return fallback;
  if (data[year]) return data[year];
  const years = Object.keys(data).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
  if (years.length > 0 && data[years[0]]) return data[years[0]];
  return fallback;
};

const isProductividadMonth = (date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth();
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

const getExtendedMonthShifts = (shifts: any[], month: Date) => {
  const start = startOfMonth(month);
  const dayBefore = addDays(start, -1);
  const dayBeforeStr = safeFormat(dayBefore, 'yyyy-MM-dd');
  return (shifts || []).filter((s: any) => {
    if (!s?.date) return false;
    const d = parseISO(s.date);
    return (isValid(d) && isSameMonth(d, month)) || s.date === dayBeforeStr;
  });
};

const getMonthlyOptionsForDate = (date: Date, settings: any, currentYearPluses: Record<string, PlusConfig>): MonthlyOptions => {
  const key = safeFormat(date, 'yyyy-MM');
  const allMonthlyOpts = settings?.monthlyOptions || {};
  const monthData = allMonthlyOpts[key] || {};

  const pastKeys = Object.keys(allMonthlyOpts)
    .filter(k => k < key)
    .sort((a, b) => b.localeCompare(a));
  const lastOptions = pastKeys.length > 0 ? allMonthlyOpts[pastKeys[0]] : null;

  const isProdMonth = isProductividadMonth(date);

  const prestamoConfig = settings?.prestamo || (lastOptions?.descuentoOtro ? {
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

const computeMonthlyComponents = (
  monthDate: Date,
  params: { settings: any; shifts: any[]; levels?: YearlyLevels; pluses?: YearlyPluses }
) => {
  const { settings, shifts, levels, pluses } = params;
  const currentYear = monthDate.getFullYear();
  const isPasaje = settings?.colectivoConvenio === 'pasaje';

  const currentYearLevels: LevelData[] = getYearlyDataForYear<LevelData[]>(
    levels,
    currentYear,
    INITIAL_LEVELS_PASAJE
  );
  const currentYearPluses: PlusesData = getYearlyDataForYear<PlusesData>(
    pluses,
    currentYear,
    INITIAL_PLUSES_PASAJE
  );

  const pagas = settings?.pagas || 12;
  const subrogadoBaseAnual = (settings?.isSubrogado && settings?.subrogadoBaseSalaries?.[currentYear])
    ? settings.subrogadoBaseSalaries[currentYear] * pagas
    : 0;

  const monthlyOpts = getMonthlyOptionsForDate(monthDate, settings, currentYearPluses);
  const currentMonthShifts = getExtendedMonthShifts(shifts, monthDate);
  const prevMonth = subMonths(monthDate, 1);
  const prevMonthShifts = getExtendedMonthShifts(shifts, prevMonth);

  const hasCurrentMonthShifts = currentMonthShifts.some((s: any) => (s.shifts || []).some((sh: any) => sh.start && sh.end));
  const currentCounterCfg = getCounterConfigForDate(settings, monthDate);
  const prevCounterCfg = getCounterConfigForDate(settings, prevMonth);

  const currentStats = getStatsForShifts(
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
    monthDate,
    settings.isSubrogado,
    currentCounterCfg.targets,
    currentYearPluses
  );

  const prevStats = getStatsForShifts(
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
  );

  const prevMonthAusenciaHours = (() => {
    if (!prevMonth || !isValid(prevMonth)) return 0;
    const ausenciaShifts = (shifts || []).filter((s: any) => {
      if (!s?.date || s.type !== 'Ausencia Justificada') return false;
      const d = parseISO(s.date);
      return isValid(d) && isSameMonth(d, prevMonth);
    });
    return Math.round(ausenciaShifts.reduce((acc: number, s: any) => acc + getAusenciaHoursForDay(s), 0) * 100) / 100;
  })();

  const prevMonthCambioFuncionHours = (() => {
    if (!prevMonth || !isValid(prevMonth)) return 0;
    const cdfShifts = (shifts || []).filter((s: any) => {
      if (!s?.date || s.type !== 'Cambio de función') return false;
      const d = parseISO(s.date);
      return isValid(d) && isSameMonth(d, prevMonth);
    });
    return Math.round(cdfShifts.reduce((acc: number, s: any) => {
      const valid = (s.shifts || []).filter((sh: any) => sh.start && sh.end);
      return acc + valid.reduce((hAcc: number, sh: any) => hAcc + getShiftDuration(sh.start, sh.end), 0);
    }, 0) * 100) / 100;
  })();

  let activeLevel = settings.currentLevel || 1;
  if (monthlyOpts.manualLevel) {
    activeLevel = monthlyOpts.manualLevel;
  } else if (monthlyOpts.useManualBaseSalary && settings.contractType === 'Completo') {
    activeLevel = settings.selectedLevel || settings.currentLevel || 1;
  } else if (settings.nextLevelDate) {
    const nextDate = startOfMonth(parseISO(settings.nextLevelDate));
    const payrollDate = startOfMonth(monthDate);
    if (isValid(nextDate) && payrollDate >= nextDate) {
      activeLevel = Math.min(7, (settings.currentLevel || 1) + 1);
    }
  }

  let levelJumpInfo: { fromLevel: number; toLevel: number; date: Date } | null = null;
  if (settings.nextLevelDate && (settings.currentLevel || 1) < 7) {
    const nextDateObj = parseISO(settings.nextLevelDate);
    if (isValid(nextDateObj) && isSameMonth(nextDateObj, monthDate)) {
      levelJumpInfo = {
        fromLevel: settings.currentLevel || 1,
        toLevel: Math.min(7, (settings.currentLevel || 1) + 1),
        date: nextDateObj
      };
    }
  }
  if (!levelJumpInfo && !settings.manualLevelProgression && settings.seniorityDate) {
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
        if (isValid(mDate) && isSameMonth(mDate, monthDate)) {
          levelJumpInfo = { fromLevel: m.fromLevel, toLevel: m.toLevel, date: mDate };
          break;
        }
      }
    }
  }

  const levelData = currentYearLevels.find(l => l.nivel === activeLevel) || currentYearLevels[0];
  let metrics = calculateLevelMetrics(levelData.anual, pagas);
  const activeLevelJumpMode: 'full_month' | 'exact_day' = monthlyOpts.levelJumpMode || 'full_month';

  if (subrogadoBaseAnual > 0) {
    metrics = calculateLevelMetrics(subrogadoBaseAnual, pagas);
  } else if (levelJumpInfo && levelJumpInfo.date.getDate() > 1 && activeLevelJumpMode === 'exact_day' && !monthlyOpts.manualLevel) {
    const fromLvlData = currentYearLevels.find(l => l.nivel === levelJumpInfo!.fromLevel) || levelData;
    const toLvlData = currentYearLevels.find(l => l.nivel === levelJumpInfo!.toLevel) || levelData;
    const fromM = calculateLevelMetrics(fromLvlData.anual, pagas);
    const toM = calculateLevelMetrics(toLvlData.anual, pagas);
    const totalDays = endOfMonth(monthDate).getDate();
    const jumpDay = levelJumpInfo.date.getDate();
    const prevDays = Math.max(0, Math.min(totalDays, jumpDay - 1));
    const newDays = Math.max(0, totalDays - prevDays);
    const prevRatio = prevDays / totalDays;
    const newRatio = newDays / totalDays;
    metrics = {
      mensual: fromM.mensual * prevRatio + toM.mensual * newRatio,
      hora: fromM.hora * prevRatio + toM.hora * newRatio,
      perentoria: fromM.perentoria * prevRatio + toM.perentoria * newRatio,
      complementaria: fromM.complementaria * prevRatio + toM.complementaria * newRatio,
    };
  }

  const hasManualHours = settings.contractType === 'Parcial' && !!monthlyOpts.useManualHours;
  const effectivePct = (hasManualHours && monthlyOpts.manualHoursParcial !== undefined && monthlyOpts.manualHoursParcial !== null)
    ? (monthlyOpts.manualHoursParcial / 155.63) * 100
    : currentStats.effectivePercentage;
  const baseSalarioBase = (monthlyOpts.useManualBaseSalary && settings.contractType === 'Completo')
    ? (monthlyOpts.manualBaseSalary || 0)
    : (settings.contractType === 'Completo' ? metrics.mensual : metrics.mensual * (Math.min(100, effectivePct) / 100));
  const salarioBase = settings.contractType === 'Completo' ? baseSalarioBase : ((hasCurrentMonthShifts || hasManualHours) ? baseSalarioBase : 0);

  const getPlusConfig = (name: string): PlusConfig | undefined => currentYearPluses[name];

  const pluses14Base = Object.entries(currentYearPluses).reduce((acc, [name, p]) => {
    if (p && p.pagas === 14 && p.enabled) {
      if (settings.contractType === 'Parcial' && name.startsWith('Turnicidad')) return acc;
      const isToggled = (monthlyOpts as any)[name.toLowerCase()];
      if (!STANDARD_PAYROLL_PLUSES.includes(name) || isToggled) return acc + p.value;
    }
    return acc;
  }, 0);

  const ppExtra = (salarioBase + pluses14Base) / 6;
  const extraPct = (settings.contractType === 'Parcial' && effectivePct > 100) ? effectivePct - 100 : 0;
  const ajusteJornadaValue = metrics.mensual * (extraPct / 100);

  const getBeforeCount = (name: string): number => {
    const config = getPlusConfig(name);
    if (!config) return 0;
    const start = parseISO(prevCounterCfg.period.start);
    if (!isValid(start) || !isValid(prevMonth)) return 0;
    const beforeShifts = (shifts || []).filter((s: any) => {
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
      const beforeStats = getStatsForShifts(
        beforeShifts,
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
        undefined,
        settings.isSubrogado,
        prevCounterCfg.targets,
        currentYearPluses
      );
      const subKey = statsKey === 'nightHours'
        ? 'nightHoursSub'
        : (statsKey === 'madrugues'
          ? 'madruguesSub'
          : (statsKey === 'sundays'
            ? 'sundaysSub'
            : (statsKey === 'festivos' ? 'festivosSub' : `${statsKey}Sub`)));
      return ((beforeStats as any)[statsKey] || 0) + ((beforeStats as any)[subKey] || 0);
    }
    return 0;
  };

  const formatConceptName = (n: string): string => {
    let clean = n;
    clean = clean.replace(/\bSUB\b(?!\))/gi, '(SUB)');
    clean = clean.replace(/\bCON\b(?!\))/gi, '(CON)');
    clean = clean.replace(/\s*\((SUB|CON)\)/gi, ' ($1)');
    return clean;
  };

  const getPlusItem = (name: string, defaultQty: number | string, defaultPrice: number, defaultTotal: number, baseName?: string) => {
    const lookupName = baseName || name;
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
        isProrrata: false,
        baseName: lookupName
      };
    }
    return {
      name: formattedName,
      qty: defaultQty,
      price: defaultPrice,
      value: Math.round(defaultTotal * 100) / 100,
      isManual: false,
      isProrrata: false,
      baseName: lookupName
    };
  };

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
    if (qty <= 0) return [];
    const target = prevCounterCfg.targets[name] || 0;

    const subName = name === 'Manutención' ? 'Manutención/Comida SUB' : `${name} SUB`;
    const subConfig = settings.isSubrogado ? getPlusConfig(subName) : undefined;
    const hasIndividualSub = subConfig !== undefined && subConfig.enabled;

    let subRate = config.subValue;
    const subLabel = `${name} (SUB)`;

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
    if (subQty > 0) items.push(getPlusItem(subLabel, subQty, subRate, subQty * subRate, name));
    if (conQty > 0) items.push(getPlusItem(conLabel, conQty, config.value, conQty * config.value, name));
    return items;
  };

  const isSubrogadoPlus = (n: string) => n.endsWith(' SUB') || n.endsWith('/Comida SUB');

  const baseDevengos = [
    getPlusItem('Salario Base', settings.contractType === 'Completo' ? 1 : ((hasCurrentMonthShifts || hasManualHours) ? Math.min(100, effectivePct) / 100 : 0), monthlyOpts.useManualBaseSalary ? salarioBase : metrics.mensual, salarioBase),
    ...(extraPct > 0 ? [getPlusItem('Ajuste de Jornada', extraPct / 100, metrics.mensual, ajusteJornadaValue)] : []),
    { ...getPlusItem(`PP Extra (${pagas} pagas)`, (settings.contractType === 'Completo' || hasCurrentMonthShifts || hasManualHours) ? 1 : 0, ppExtra, (settings.contractType === 'Completo' || hasCurrentMonthShifts || hasManualHours) ? ppExtra : 0), isProrrata: pagas === 14 },
    ...getPlusItems('Tiempo Parcial - Discontinuo', (settings.contractType === 'Parcial' && getPlusConfig('Tiempo Parcial - Discontinuo')?.enabled) ? effectivePct / 100 : 0),
    ...getPlusItems('Teamleader', (monthlyOpts.teamleader && getPlusConfig('Teamleader')?.enabled) ? (settings.contractType === 'Completo' ? 1 : effectivePct / 100) : 0),
    ...getPlusItems('Jornada Irregular', (monthlyOpts.jornadaIrregular && getPlusConfig('Jornada Irregular')?.enabled) ? 1 : 0),
    ...(settings.contractType === 'Completo' ? [
      getPlusItem('Turnicidad',
        prevStats.uniqueShiftsCount >= 2 ? (prevStats.uniqueShiftsCount >= 5 ? '5 o más' : `${prevStats.uniqueShiftsCount} turnos`) : 0,
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
      if (!cdfConfig?.enabled) return [];
      const cdfFullAmount = cdfConfig.value || 0;
      const cdfHourlyPrice = 155.63 > 0 ? (cdfFullAmount / 155.63) : 0;
      const cdfQty = prevMonthCambioFuncionHours;
      const cdfValue = Math.round(cdfQty * cdfHourlyPrice * 100) / 100;
      if (cdfQty <= 0) return [];
      return [getPlusItem('Cambio de función', cdfQty, cdfHourlyPrice, cdfValue)];
    })()),
  ];

  const subrogadosBaseKeys = [
    'Nocturnas SUB',
    'Madrugue SUB',
    'Manutención/Comida SUB',
    'Transporte SUB',
    'Festivo SUB',
    'Domingo SUB',
    'Jornada Irregular Diaria'
  ];

  const customPluses = Object.entries(currentYearPluses)
    .filter(([name, p]) => {
      const isSub = isSubrogadoPlus(name);
      if (STANDARD_PAYROLL_PLUSES.includes(name)) return false;
      const autoCount = (prevStats as any)?.customCounts?.[name];
      const hasAutoCount = typeof autoCount === 'number' && autoCount > 0;
      const isProporcional = p.baseType === 'proporcional_jornada' || p.calculationType === 'proporcional_jornada' || p.cloneOf === 'Tiempo Parcial - Discontinuo' || p.cloneOf === 'Teamleader';
      const isFijo = p.baseType === 'fijo' || p.calculationType === 'fijo' || p.cloneOf === 'Jornada Irregular' || p.cloneOf === 'Productividad' || p.cloneOf === 'Multitasking' || p.cloneOf === 'Duty' || p.cloneOf === 'Super';

      const isToggled = monthlyOpts.customToggles?.[name] !== undefined
        ? !!monthlyOpts.customToggles[name]
        : (isProporcional || isFijo ? (p.defaultActiveInPayroll !== false) : false);

      if (isSub) {
        return settings.isSubrogado && p.enabled && !subrogadosBaseKeys.includes(name) && (isToggled || hasAutoCount);
      }
      return p.enabled && (isToggled || hasAutoCount);
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
      if (!m.useManual || STANDARD_PAYROLL_PLUSES.includes(name) || currentYearPluses[name]) return false;
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

  const devengos = [
    ...baseDevengos,
    ...customPluses,
    ...adHocPluses,
    { name: extraHoursType, value: extraHoursValue, qty: extraHoursQty, price: extraHoursPrice, isProrrata: false },
    { name: 'Concepto a abonar', value: Math.round((parseFloat(monthlyOpts.atrasos || '') || 0) * 100) / 100, qty: 1, price: Math.round((parseFloat(monthlyOpts.atrasos || '') || 0) * 100) / 100, isProrrata: false },
    { name: 'Concepto a descontar', value: Math.round(-descDinero * 100) / 100, qty: 1, price: Math.round(-descDinero * 100) / 100, isProrrata: false },
    { name: 'Impuntualidad/Absent', value: impuntualidadValue, qty: impuntualidadHours, price: impuntualidadPrice, isProrrata: false },
  ];

  const totalDevengado = Math.round(devengos.reduce((acc, d) => acc + (d.isProrrata ? 0 : d.value), 0) * 100) / 100;

  const cuotaSindical = Number(settings.cuotaSindical) || 0;
  const loanEndDate = monthlyOpts.descuentoOtroEndDate || settings.prestamo?.endDate;
  const isLoanExpired = isDateAfterLoanEnd(monthDate, loanEndDate);
  const descOtro = isLoanExpired ? 0 : (parseFloat(monthlyOpts.descuentoOtro || '') || 0);

  const conceptosADescontar = [
    { name: 'Cuota Sindical', value: Math.round(-cuotaSindical * 100) / 100, qty: 1, price: Math.round(-cuotaSindical * 100) / 100 },
    { name: 'Otro (Préstamos/etc.)', value: Math.round(-descOtro * 100) / 100, qty: 1, price: Math.round(-descOtro * 100) / 100 }
  ].filter(c => c.value !== 0);

  const totalDescuentos = conceptosADescontar.reduce((acc, d) => acc + d.value, 0);

  const salarioBaseItemVal = devengos.find(d => d.name === 'Salario Base')?.value || 0;
  const ajusteJornadaItemVal = devengos.find(d => d.name === 'Ajuste de Jornada')?.value || 0;
  const ppExtraItemVal = devengos.find(d => d.name.startsWith('PP Extra'))?.value || 0;
  const plusesCotizablesItems = devengos.filter(d => d.name !== 'Salario Base' && d.name !== 'Ajuste de Jornada' && !d.name.startsWith('PP Extra') && d.value > 0);
  const plusesCotizablesVal = Math.round(plusesCotizablesItems.reduce((acc, d) => acc + d.value, 0) * 100) / 100;
  const remuneracionMensual = Math.round((salarioBaseItemVal + ajusteJornadaItemVal + plusesCotizablesVal) * 100) / 100;
  const baseCotizacion = Math.round((remuneracionMensual + ppExtraItemVal) * 100) / 100;

  const irpfRate = monthlyOpts.irpf ?? settings.irpf ?? 0;
  const deducciones = [
    { name: 'Contingencias Comunes', value: Math.round(baseCotizacion * ((settings.rateContingencias || 0) / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateContingencias || 0 },
    { name: 'Desempleo', value: Math.round(baseCotizacion * ((settings.rateDesempleo || 0) / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateDesempleo || 0 },
    { name: 'Formación', value: Math.round(baseCotizacion * ((settings.rateFormacion || 0) / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateFormacion || 0 },
    { name: 'Mecanismo Equidad', value: Math.round(baseCotizacion * ((settings.rateEquidad || 0) / 100) * 100) / 100, base: baseCotizacion, rate: settings.rateEquidad || 0 },
    { name: 'IRPF', value: Math.round(totalDevengado * (irpfRate / 100) * 100) / 100, base: totalDevengado, rate: irpfRate },
  ];

  const totalDeducciones = Math.round((deducciones.reduce((acc, d) => acc + d.value, 0) - totalDescuentos) * 100) / 100;
  const liquido = Math.round((totalDevengado - totalDeducciones) * 100) / 100;

  const isAccruedInMonth = settings.contractType === 'Completo' || hasCurrentMonthShifts || hasManualHours;
  const monthPpExtraAccrued = isAccruedInMonth ? Math.round(ppExtra * 100) / 100 : 0;

  const monthKey = safeFormat(monthDate, 'yyyy-MM');
  const regularPayroll: SavedPayroll = {
    id: `calc-${monthKey}`,
    monthKey,
    saveDate: new Date().toISOString(),
    devengos: devengos
      .filter(d => d.value !== 0 || d.isProrrata)
      .map(d => ({ name: d.name, qty: d.qty, price: d.price, value: d.value, isProrrata: d.isProrrata })),
    conceptosADescontar: conceptosADescontar.map(d => ({ name: d.name, qty: d.qty, price: d.price, value: d.value })),
    deducciones: deducciones.filter(d => d.value !== 0),
    totals: {
      totalDevengado,
      totalDescuentos,
      totalDeducciones,
      liquido,
      baseCotizacion
    },
    settings: {
      contractType: settings.contractType || 'Completo',
      pagas,
      level: activeLevel,
      irpf: irpfRate
    },
    notes: monthlyOpts.notes || undefined
  };

  return {
    regularPayroll,
    monthPpExtraAccrued,
    irpfRate,
    activeLevel,
    pagas
  };
};

export const computeSimulatedPayrollsForMonth = (
  monthDate: Date,
  params: { settings: any; shifts: any[]; levels?: YearlyLevels; pluses?: YearlyPluses }
): SimulatedMonthPayrolls => {
  const { settings } = params;
  const monthComponents = computeMonthlyComponents(monthDate, params);
  const { regularPayroll, irpfRate, activeLevel, pagas } = monthComponents;

  let extraPayroll: SavedPayroll | null = null;
  const mIdx = monthDate.getMonth();
  const isSummerExtra = pagas === 14 && mIdx === 5;
  const isWinterExtra = pagas === 14 && mIdx === 11;

  if (isSummerExtra || isWinterExtra) {
    const year = monthDate.getFullYear();
    const semesterIndices = isSummerExtra ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
    const semesterSum = semesterIndices.reduce((sum, idx) => {
      if (idx === mIdx) return sum + monthComponents.monthPpExtraAccrued;
      const mRes = computeMonthlyComponents(new Date(year, idx, 1), params);
      return sum + mRes.monthPpExtraAccrued;
    }, 0);

    const extraGross = Math.round(semesterSum * 100) / 100;
    const irpfVal = Math.round(extraGross * (irpfRate / 100) * 100) / 100;
    const extraNet = Math.round((extraGross - irpfVal) * 100) / 100;
    const monthKey = safeFormat(monthDate, 'yyyy-MM');

    extraPayroll = {
      id: `calc-${monthKey}-extra`,
      monthKey: `${monthKey}-extra`,
      saveDate: new Date().toISOString(),
      devengos: [
        {
          name: isSummerExtra ? 'PAGA EXTRA DE VERANO' : 'PAGA EXTRA DE NAVIDAD',
          qty: 1,
          price: extraGross,
          value: extraGross
        }
      ],
      conceptosADescontar: [],
      deducciones: irpfVal !== 0 ? [{ name: 'IRPF', base: extraGross, rate: irpfRate, value: irpfVal }] : [],
      totals: {
        totalDevengado: extraGross,
        totalDescuentos: 0,
        totalDeducciones: irpfVal,
        liquido: extraNet,
        baseCotizacion: 0
      },
      settings: {
        contractType: settings.contractType || 'Completo',
        pagas,
        level: activeLevel,
        irpf: irpfRate
      }
    };
  }

  return {
    regularPayroll,
    extraPayroll,
    allPayrolls: extraPayroll ? [regularPayroll, extraPayroll] : [regularPayroll]
  };
};

export interface VacationVariableAggregatedItem {
  name: string;
  annualQty: number;
  annualValue: number;
  weightedPrice: number;
  monthsPaid: number;
}

export interface VacationVariablesAggregation {
  targetYear: number;
  prevYear: number;
  paymentMonthKeys: string[];
  itemsByName: Record<string, VacationVariableAggregatedItem>;
  orderedItems: VacationVariableAggregatedItem[];
}

const EXCLUDED_VACATION_VARIABLE_CONCEPTS = new Set<string>([
  'Salario Base',
  'Ajuste de Jornada',
  'Tiempo Parcial - Discontinuo',
  'Perentorias',
  'Perentorias Noc.',
  'Complementarias',
  'Complementarias Noc.',
  'H.Perent.',
  'H.Compl.',
  'HHCC',
  'Concepto a abonar',
  'Concepto a descontar',
  'Impuntualidad/Absent'
]);

export const isEligibleVacationVariableConcept = (name: string): boolean => {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('PP Extra')) return false;
  if (EXCLUDED_VACATION_VARIABLE_CONCEPTS.has(trimmed)) return false;
  return true;
};

export const normalizeVacationConceptName = (name: string): string => {
  return (name || '')
    .replace(/\s*\(CON\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calcula el acumulado anual de conceptos variables efectivamente cobrados
 * en las 12 nóminas mensuales desde Febrero del año anterior hasta Enero del
 * año en curso (variables devengadas de Enero a Diciembre del año anterior,
 * abonadas a mes vencido).
 *
 * Incluye turnos, ajustes manuales mensuales y la tarifa vigente en cada mes
 * de cobro (Feb-Dic año anterior con tarifas N-1; Enero año actual con tarifas N).
 */
export const computeVacationVariablesAggregation = (
  targetYear: number,
  params: { settings: any; shifts: any[]; levels?: YearlyLevels; pluses?: YearlyPluses }
): VacationVariablesAggregation => {
  const prevYear = targetYear - 1;

  // 12 nóminas de cobro: Febrero..Diciembre de prevYear + Enero de targetYear
  const paymentMonths: Date[] = [];
  for (let m = 1; m <= 11; m++) {
    paymentMonths.push(new Date(prevYear, m, 1));
  }
  paymentMonths.push(new Date(targetYear, 0, 1));

  const paymentMonthKeys = paymentMonths.map(d => safeFormat(d, 'yyyy-MM'));
  const accumulator = new Map<string, { qty: number; value: number; monthsPaid: number }>();

  for (const paymentMonthDate of paymentMonths) {
    const { regularPayroll } = computeMonthlyComponents(paymentMonthDate, params);
    const seenInMonth = new Set<string>();

    for (const item of regularPayroll.devengos || []) {
      if (item.isProrrata) continue;
      const numericValue = Number(item.value) || 0;
      if (numericValue <= 0) continue;

      const normalizedName = normalizeVacationConceptName(item.name);
      if (!isEligibleVacationVariableConcept(normalizedName)) continue;

      const qtyContribution =
        typeof item.qty === 'number' && !isNaN(item.qty)
          ? item.qty
          : 1; // Ej: Turnicidad ('3 turnos', '4 turnos', '5 o más') => 1 abono mensual

      const existing = accumulator.get(normalizedName) || { qty: 0, value: 0, monthsPaid: 0 };
      existing.qty += qtyContribution;
      existing.value += numericValue;
      if (!seenInMonth.has(normalizedName)) {
        existing.monthsPaid += 1;
        seenInMonth.add(normalizedName);
      }
      accumulator.set(normalizedName, existing);
    }
  }

  const itemsByName: Record<string, VacationVariableAggregatedItem> = {};
  const orderedItems: VacationVariableAggregatedItem[] = [];

  accumulator.forEach((acc, name) => {
    const annualQty = Math.round(acc.qty * 100) / 100;
    const annualValue = Math.round(acc.value * 100) / 100;
    const weightedPrice = annualQty > 0
      ? Math.round((annualValue / annualQty) * 100) / 100
      : annualValue;

    const aggregated: VacationVariableAggregatedItem = {
      name,
      annualQty,
      annualValue,
      weightedPrice,
      monthsPaid: acc.monthsPaid
    };
    itemsByName[name] = aggregated;
    orderedItems.push(aggregated);
  });

  return {
    targetYear,
    prevYear,
    paymentMonthKeys,
    itemsByName,
    orderedItems
  };
};

