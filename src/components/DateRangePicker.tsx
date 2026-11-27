import React, { useState, useEffect } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  parseISO,
  isValid,
  isToday,
  differenceInDays,
  setMonth,
  setYear
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '../types';
import { safeFormat } from '../utils';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  variant?: 'vacaciones' | 'frozen' | 'counter';
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  variant = 'vacaciones'
}) => {
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (startDate) {
      const parsed = parseISO(startDate);
      if (isValid(parsed)) return startOfMonth(parsed);
    }
    return startOfMonth(new Date());
  });

  const [hoverDate, setHoverDate] = useState<string | null>(null);

  useEffect(() => {
    if (startDate) {
      const parsed = parseISO(startDate);
      if (isValid(parsed)) {
        setViewMonth(startOfMonth(parsed));
      }
    }
  }, [startDate]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => currentYear - 18 + i);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingEmptyDays = (monthStart.getDay() + 6) % 7; // Monday = 0

  const handleDayClick = (dayIso: string) => {
    if (!startDate || (startDate && endDate)) {
      onChange(dayIso, '');
      setHoverDate(null);
    } else {
      if (dayIso < startDate) {
        onChange(dayIso, startDate);
      } else {
        onChange(startDate, dayIso);
      }
      setHoverDate(null);
    }
  };

  const previewEnd = (!endDate && startDate && hoverDate) ? hoverDate : endDate;
  const rangeStart = startDate && previewEnd
    ? (startDate <= previewEnd ? startDate : previewEnd)
    : startDate;
  const rangeEnd = startDate && previewEnd
    ? (startDate <= previewEnd ? previewEnd : startDate)
    : '';

  const totalDays = (() => {
    if (!startDate || !endDate) return 0;
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    if (!isValid(s) || !isValid(e)) return 0;
    return differenceInDays(e, s) + 1;
  })();

  const isFrozen = variant === 'frozen';
  const isCounter = variant === 'counter';

  return (
    <div
      className={cn(
        "date-range-picker-calendar rounded-2xl p-3.5 space-y-3 select-none border transition-all",
        isFrozen
          ? "bg-black/60 border-white/10 text-white"
          : isCounter
          ? "bg-white/5 border-white/10 text-white"
          : "bg-white/75 border-white/40 text-azul-blue shadow-sm"
      )}
    >
      {/* Resumen de Inicio y Fin */}
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <button
            type="button"
            onClick={() => onChange('', '')}
            className={cn(
              "date-range-summary-pill flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all cursor-pointer",
              !startDate
                ? isFrozen
                  ? "bg-rose-600/20 border-rose-500 text-white ring-2 ring-rose-500/20"
                  : isCounter
                  ? "bg-azul-yellow/15 border-azul-yellow text-white ring-2 ring-azul-yellow/20"
                  : "bg-azul-blue/10 border-azul-blue text-azul-blue ring-2 ring-azul-blue/15"
                : isFrozen
                ? "bg-white/5 border-white/10 text-white"
                : isCounter
                ? "bg-white/5 border-white/10 text-white"
                : "bg-white border-azul-blue/15 text-azul-blue"
            )}
          >
            <span className={cn(
              "text-[8px] font-black uppercase tracking-widest",
              isFrozen || isCounter ? "text-white/50" : "text-azul-blue/60"
            )}>
              1. Inicio
            </span>
            <span className="text-xs font-black tracking-tight mt-0.5 truncate w-full">
              {startDate && isValid(parseISO(startDate))
                ? safeFormat(parseISO(startDate), 'dd MMM yyyy', { locale: es })
                : 'Pulsa un día'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (startDate) onChange(startDate, '');
            }}
            className={cn(
              "date-range-summary-pill flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all cursor-pointer",
              startDate && !endDate
                ? isFrozen
                  ? "bg-rose-600/20 border-rose-500 text-white ring-2 ring-rose-500/20"
                  : isCounter
                  ? "bg-azul-yellow/15 border-azul-yellow text-white ring-2 ring-azul-yellow/20"
                  : "bg-azul-blue/10 border-azul-blue text-azul-blue ring-2 ring-azul-blue/15"
                : isFrozen
                ? "bg-white/5 border-white/10 text-white"
                : isCounter
                ? "bg-white/5 border-white/10 text-white"
                : "bg-white border-azul-blue/15 text-azul-blue"
            )}
          >
            <span className={cn(
              "text-[8px] font-black uppercase tracking-widest",
              isFrozen || isCounter ? "text-white/50" : "text-azul-blue/60"
            )}>
              2. Fin
            </span>
            <span className="text-xs font-black tracking-tight mt-0.5 truncate w-full">
              {endDate && isValid(parseISO(endDate))
                ? safeFormat(parseISO(endDate), 'dd MMM yyyy', { locale: es })
                : startDate
                ? 'Pulsa fin...'
                : '---'}
            </span>
          </button>
        </div>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            title="Limpiar fechas"
            className={cn(
              "p-2 rounded-xl border transition-all shrink-0 cursor-pointer",
              isFrozen || isCounter
                ? "bg-white/5 border-white/10 text-white/60 hover:text-rose-400 hover:bg-rose-500/10"
                : "bg-white border-azul-blue/15 text-azul-blue/60 hover:text-rose-600 hover:bg-rose-50"
            )}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Cabecera de navegación de mes y año */}
      <div className="flex items-center justify-between gap-1 pt-1">
        <button
          type="button"
          onClick={() => setViewMonth(prev => subMonths(prev, 1))}
          className={cn(
            "date-range-nav-btn p-1.5 rounded-xl transition-colors cursor-pointer",
            isFrozen || isCounter
              ? "hover:bg-white/10 text-white/70 hover:text-white"
              : "hover:bg-azul-blue/10 text-azul-blue"
          )}
          title="Mes anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1.5">
          <select
            value={viewMonth.getMonth()}
            onChange={(e) => setViewMonth(prev => setMonth(prev, parseInt(e.target.value, 10)))}
            className={cn(
              "date-range-select text-xs font-black uppercase tracking-wider rounded-lg px-2 py-1 outline-none cursor-pointer border",
              isFrozen || isCounter
                ? "bg-white/10 border-white/10 text-white"
                : "bg-white border-azul-blue/15 text-azul-blue"
            )}
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx} className="text-slate-900 font-bold">
                {m}
              </option>
            ))}
          </select>

          <select
            value={viewMonth.getFullYear()}
            onChange={(e) => setViewMonth(prev => setYear(prev, parseInt(e.target.value, 10)))}
            className={cn(
              "date-range-select text-xs font-black uppercase tracking-wider rounded-lg px-2 py-1 outline-none cursor-pointer border",
              isFrozen || isCounter
                ? "bg-white/10 border-white/10 text-white"
                : "bg-white border-azul-blue/15 text-azul-blue"
            )}
          >
            {years.map((yr) => (
              <option key={yr} value={yr} className="text-slate-900 font-bold">
                {yr}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setViewMonth(prev => addMonths(prev, 1))}
          className={cn(
            "date-range-nav-btn p-1.5 rounded-xl transition-colors cursor-pointer",
            isFrozen || isCounter
              ? "hover:bg-white/10 text-white/70 hover:text-white"
              : "hover:bg-azul-blue/10 text-azul-blue"
          )}
          title="Mes siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 text-center pt-1">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span
            key={d}
            className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              isFrozen || isCounter ? "text-white/40" : "text-azul-blue/50"
            )}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: leadingEmptyDays }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}

        {days.map((day) => {
          const dayIso = safeFormat(day, 'yyyy-MM-dd');
          const isStart = dayIso === rangeStart;
          const isEnd = dayIso === rangeEnd;
          const isSelectedCap = isStart || isEnd;
          const isInRange = !!(rangeStart && rangeEnd && dayIso > rangeStart && dayIso < rangeEnd);
          const isSingleDayRange = isStart && (!rangeEnd || rangeStart === rangeEnd);
          const today = isToday(day);

          return (
            <button
              key={dayIso}
              type="button"
              onClick={() => handleDayClick(dayIso)}
              onMouseEnter={() => {
                if (startDate && !endDate) setHoverDate(dayIso);
              }}
              onMouseLeave={() => {
                if (startDate && !endDate) setHoverDate(null);
              }}
              className={cn(
                "date-range-day-btn relative h-8 flex items-center justify-center text-xs font-black transition-all cursor-pointer",
                isSingleDayRange && "rounded-xl",
                isStart && !isSingleDayRange && "rounded-l-xl",
                isEnd && !isSingleDayRange && "rounded-r-xl",
                !isSelectedCap && !isInRange && "rounded-xl",
                isSelectedCap
                  ? isFrozen
                    ? "date-range-day-cap-frozen bg-rose-600 text-white shadow-sm z-10"
                    : isCounter
                    ? "date-range-day-cap-counter bg-azul-yellow text-slate-950 shadow-sm z-10"
                    : "date-range-day-cap-vacaciones bg-azul-blue text-white shadow-sm z-10"
                  : isInRange
                  ? isFrozen
                    ? "date-range-day-inrange-frozen bg-rose-600/25 text-rose-200 rounded-none"
                    : isCounter
                    ? "date-range-day-inrange-counter bg-azul-yellow/25 text-white rounded-none"
                    : "date-range-day-inrange-vacaciones bg-azul-blue/15 text-azul-blue rounded-none"
                  : isFrozen || isCounter
                  ? "text-white/80 hover:bg-white/10"
                  : "text-azul-blue hover:bg-azul-blue/10",
                today && !isSelectedCap && "ring-1 ring-inset ring-current"
              )}
            >
              <span>{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Pie informativo del rango */}
      <div className="flex items-center justify-between pt-1 border-t border-current/10 text-[10px] font-black uppercase tracking-wider">
        <span className="flex items-center gap-1.5 opacity-75">
          <CalendarIcon size={12} />
          {!startDate
            ? 'Marca el día de inicio en el calendario'
            : !endDate
            ? 'Ahora marca el día de fin del tramo'
            : 'Tramo seleccionado'}
        </span>
        {totalDays > 0 && (
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-black",
              isFrozen
                ? "bg-rose-600 text-white"
                : isCounter
                ? "bg-azul-yellow text-slate-950"
                : "bg-azul-blue text-white"
            )}
          >
            {totalDays} {totalDays === 1 ? 'día' : 'días'}
          </span>
        )}
      </div>
    </div>
  );
};
