import { describe, it, expect } from 'vitest';
import {
  getShiftDuration,
  getNightHours,
  getNightHoursSplit,
  isMadrugue,
  checkManutencion,
  checkManutencionWithRanges,
  calculateLevelMetrics,
  carveOutShiftRange,
  getEffectiveShiftsForDay,
  getRestBetweenDays,
  isFixedHoliday,
  getStatsForShifts,
  isRotationFreeDay,
} from '../utils';
import type { DayShift } from '../types';

const makeDayShift = (overrides: Partial<DayShift> & Pick<DayShift, 'date' | 'type'>): DayShift => ({
  shifts: [],
  perentorias: { day: 0, night: 0 },
  complementarias: { day: 0, night: 0 },
  extraShifts: [],
  ...overrides,
});

describe('Cálculos de turnos y nómina (utils.ts)', () => {
  describe('getShiftDuration', () => {
    it('calcula turnos diurnos estándar correctamente', () => {
      expect(getShiftDuration('06:00', '14:00')).toBe(8);
      expect(getShiftDuration('08:30', '16:15')).toBe(7.75);
    });

    it('calcula correctamente turnos que cruzan la medianoche', () => {
      expect(getShiftDuration('22:00', '06:00')).toBe(8);
      expect(getShiftDuration('20:30', '02:00')).toBe(5.5);
    });

    it('devuelve 0 si faltan horas', () => {
      expect(getShiftDuration('', '14:00')).toBe(0);
      expect(getShiftDuration('06:00', '')).toBe(0);
    });
  });

  describe('getNightHours y getNightHoursSplit', () => {
    it('no computa nocturnas en turnos puramente diurnos', () => {
      expect(getNightHours('08:00', '16:00')).toBe(0);
    });

    it('divide correctamente las horas nocturnas entre hoy y mañana', () => {
      const split = getNightHoursSplit('20:00', '04:00', 22, 6);
      expect(split.today).toBe(2);
      expect(split.tomorrow).toBe(4);
      expect(getNightHours('20:00', '04:00', 22, 6)).toBe(6);
    });

    it('computa nocturnas de madrugada temprana (04:00-12:00)', () => {
      expect(getNightHours('04:00', '12:00', 22, 6)).toBe(2);
    });
  });

  describe('isMadrugue', () => {
    it('detecta madrugues en el rango por defecto 02:00 - 06:55', () => {
      expect(isMadrugue('05:00', '13:00')).toBe(true);
      expect(isMadrugue('06:55', '14:55')).toBe(true);
      expect(isMadrugue('07:00', '15:00')).toBe(false);
    });

    it('respeta la condición opcional de hora mínima de finalización', () => {
      expect(isMadrugue('22:00', '03:00', '02:00', '06:55', '02:00', true)).toBe(true);
      expect(isMadrugue('22:00', '01:00', '02:00', '06:55', '02:00', true)).toBe(false);
    });
  });

  describe('checkManutencion y checkManutencionWithRanges', () => {
    it('exige una jornada mínima de 6 horas cubriendo comida o cena', () => {
      expect(checkManutencion([{ start: '11:00', end: '17:00' }])).toBe(true); // cubre 14-16 y dura 6h
      expect(checkManutencion([{ start: '13:00', end: '17:00' }])).toBe(false); // dura 4h (< 6h)
      expect(checkManutencion([{ start: '17:00', end: '23:30' }])).toBe(true); // cubre 21-23 y dura 6.5h
      expect(checkManutencion([{ start: '06:00', end: '14:00' }])).toBe(false); // no cubre 14-16 ni 21-23
    });

    it('aplica franjas personalizadas cuando se indican', () => {
      expect(checkManutencionWithRanges([{ start: '12:00', end: '18:00' }], '13:00', '15:00', '20:00', '22:00')).toBe(true);
      expect(checkManutencionWithRanges([{ start: '13:30', end: '19:30' }], '13:00', '15:00', '20:00', '22:00')).toBe(false);
    });
  });

  describe('calculateLevelMetrics', () => {
    it('calcula mensual, hora ordinaria (12 vs 14 pagas), perentoria y complementaria', () => {
      const anual = 22907.89;
      const m12 = calculateLevelMetrics(anual, 12);
      const m14 = calculateLevelMetrics(anual, 14);

      expect(m12.mensual).toBeCloseTo(anual / 14 + 0.01, 4);
      expect(m12.hora).toBeCloseTo(m12.mensual / 142.67, 4);
      expect(m14.hora).toBeCloseTo(anual / 1712, 4);
      expect(m12.perentoria).toBeCloseTo((anual / 1712) * 1.75, 4);
      expect(m12.complementaria).toBeCloseTo((anual / 1712) * 1.698, 4);
    });
  });

  describe('carveOutShiftRange y getEffectiveShiftsForDay', () => {
    it('recorta una franja intermedia dividiendo el turno en dos segmentos', () => {
      const result = carveOutShiftRange([{ start: '08:00', end: '16:00' }], '10:00', '12:00');
      expect(result).toEqual([
        { start: '08:00', end: '10:00' },
        { start: '12:00', end: '16:00' },
      ]);
    });

    it('devuelve lista vacía en Vacaciones, Baja IT o compensación completa', () => {
      const vac = makeDayShift({ date: '2026-07-01', type: 'Vacaciones', shifts: [{ start: '08:00', end: '16:00' }] });
      const compFull = makeDayShift({
        date: '2026-07-02',
        type: 'A Compensar',
        compensatedMode: 'full',
        shifts: [{ start: '08:00', end: '16:00' }],
      });
      expect(getEffectiveShiftsForDay(vac)).toEqual([]);
      expect(getEffectiveShiftsForDay(compFull)).toEqual([]);
    });

    it('calcula correctamente turnos efectivos en compensación parcial por rango', () => {
      const compRange = makeDayShift({
        date: '2026-07-03',
        type: 'A Compensar',
        compensatedRange: { start: '14:00', end: '16:00' },
        shifts: [{ start: '08:00', end: '16:00' }],
      });
      expect(getEffectiveShiftsForDay(compRange)).toEqual([{ start: '08:00', end: '14:00' }]);
    });
  });

  describe('getRestBetweenDays', () => {
    it('detecta infracción cuando el descanso entre jornadas es inferior a 12h', () => {
      const prev = makeDayShift({ date: '2026-05-10', type: 'Laboral', shifts: [{ start: '14:00', end: '22:00' }] });
      const curr = makeDayShift({ date: '2026-05-11', type: 'Laboral', shifts: [{ start: '06:00', end: '14:00' }] });
      const res = getRestBetweenDays(prev, curr);
      expect(res).not.toBeNull();
      expect(res?.restHours).toBe(8);
      expect(res?.hasViolation).toBe(true);
    });

    it('no marca infracción cuando hay 12 horas o más de descanso', () => {
      const prev = makeDayShift({ date: '2026-05-10', type: 'Laboral', shifts: [{ start: '06:00', end: '14:00' }] });
      const curr = makeDayShift({ date: '2026-05-11', type: 'Laboral', shifts: [{ start: '06:00', end: '14:00' }] });
      const res = getRestBetweenDays(prev, curr);
      expect(res?.restHours).toBe(16);
      expect(res?.hasViolation).toBe(false);
    });

    it('ignora días cedidos íntegramente a un compañero o en vacaciones', () => {
      const ceded = makeDayShift({
        date: '2026-05-10',
        type: 'Laboral',
        shifts: [{ start: '16:00', end: '23:59' }],
        swapInfo: { cededToCoworker: true, coveringCoworker: false },
      });
      const curr = makeDayShift({ date: '2026-05-11', type: 'Laboral', shifts: [{ start: '06:00', end: '14:00' }] });
      expect(getRestBetweenDays(ceded, curr)).toBeNull();
      expect(getRestBetweenDays(curr, curr, ['2026-05-11'])).toBeNull();
    });
  });

  describe('isFixedHoliday', () => {
    it('reconoce festivos nacionales fijos que no caen en domingo', () => {
      expect(isFixedHoliday(new Date(2026, 0, 1))).toBe(true); // 1 Ene 2026 (Jueves)
      expect(isFixedHoliday(new Date(2026, 4, 1))).toBe(true); // 1 May 2026 (Viernes)
      expect(isFixedHoliday(new Date(2026, 11, 25))).toBe(true); // 25 Dic 2026 (Viernes)
      expect(isFixedHoliday(new Date(2026, 10, 1))).toBe(false); // 1 Nov 2026 es Domingo
    });
  });

  describe('getStatsForShifts', () => {
    it('agrega horas, nocturnidad, madrugue, manutención, domingos y festivos correctamente', () => {
      const shifts: DayShift[] = [
        // Jueves 1 Ene 2026 (Festivo): turno 05:00-13:00 (8h, 1h nocturna 05-06, madrugue)
        makeDayShift({ date: '2026-01-01', type: 'Laboral', shifts: [{ start: '05:00', end: '13:00' }] }),
        // Domingo 4 Ene 2026: turno 11:00-17:00 (6h, domingo, manutención 14-16)
        makeDayShift({ date: '2026-01-04', type: 'Laboral', shifts: [{ start: '11:00', end: '17:00' }] }),
        // Lunes 5 Ene 2026: cedido al compañero -> no debe sumar horas trabajadas ni pluses
        makeDayShift({
          date: '2026-01-05',
          type: 'Laboral',
          shifts: [{ start: '06:00', end: '14:00' }],
          swapInfo: { cededToCoworker: true, coveringCoworker: false },
        }),
      ];

      const stats = getStatsForShifts(
        shifts,
        [],
        [],
        'Completo',
        false,
        shifts,
        undefined,
        0,
        undefined,
        0,
        undefined,
        new Date(2026, 0, 1)
      );

      expect(stats.effectiveHours).toBe(14);
      expect(stats.nightHours).toBe(1);
      expect(stats.madrugues).toBe(1);
      expect(stats.manutencion).toBe(1);
      expect(stats.festivos).toBe(8);
      expect(stats.sundays).toBe(6);
    });
  });

  describe('isRotationFreeDay', () => {
    it('calcula correctamente ciclos 6x3 y respeta effectiveFromMonth', () => {
      const config = {
        enabled: true,
        type: '6x3' as const,
        anchorDate: '2026-03-01',
        effectiveFromMonth: '2026-03',
      };
      // Días 0, 1, 2 del ciclo son libranza; día 3 ya es laboral
      expect(isRotationFreeDay(new Date(2026, 2, 1), config)).toBe(true);
      expect(isRotationFreeDay(new Date(2026, 2, 3), config)).toBe(true);
      expect(isRotationFreeDay(new Date(2026, 2, 4), config)).toBe(false);
      // Mes anterior a effectiveFromMonth no se marca
      expect(isRotationFreeDay(new Date(2026, 1, 28), config)).toBe(false);
    });
  });
});
