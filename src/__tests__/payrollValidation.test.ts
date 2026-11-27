import { describe, it, expect } from 'vitest';
import {
  coerceSpanishNumber,
  normalizeExtractedPayroll,
  validateExtractedPayroll,
} from '../utils/payrollValidation';

describe('Normalización y verificación contable de nóminas (payrollValidation.ts)', () => {
  describe('coerceSpanishNumber', () => {
    it('interpreta correctamente formatos numéricos españoles y europeos', () => {
      expect(coerceSpanishNumber('1.234,56')).toBe(1234.56);
      expect(coerceSpanishNumber('1.234,56 €')).toBe(1234.56);
      expect(coerceSpanishNumber('-45,20')).toBe(-45.2);
      expect(coerceSpanishNumber('850.50')).toBe(850.5);
      expect(coerceSpanishNumber(1999.995)).toBe(2000);
      expect(coerceSpanishNumber('')).toBe(0);
    });
  });

  describe('normalizeExtractedPayroll', () => {
    it('elimina filas accidentales de subtotales y bases de cotización', () => {
      const normalized = normalizeExtractedPayroll({
        devengos: [
          { concepto: 'Salario Base', unidades: '30', precio: 50, importe: 1500 },
          { concepto: 'A. TOTAL DEVENGADO', unidades: '', precio: 0, importe: 1500 },
          { concepto: 'Base de Cotización CC', unidades: '', precio: 0, importe: 1750 },
          { concepto: 'Regularización festivo', unidades: '-1', precio: 25, importe: -25 },
        ],
        deducciones: [
          { concepto: 'Contingencias Comunes', base: 1750, tipo: 4.7, importe: -82.25 },
          { concepto: 'Retención IRPF', base: 1475, tipo: 12, importe: 177 },
          { concepto: 'B. TOTAL A DEDUCIR', base: 0, tipo: 0, importe: 259.25 },
        ],
        totalDevengados: '1.475,00',
        totalDeducciones: '-259,25',
        liquido: '1.215,75',
      });

      expect(normalized.devengos).toHaveLength(2);
      expect(normalized.devengos[1].importe).toBe(-25); // preserva regularización negativa
      expect(normalized.deducciones).toHaveLength(2);
      expect(normalized.deducciones[0].importe).toBe(82.25); // normaliza deducción a magnitud positiva
      expect(normalized.totalDevengados).toBe(1475);
      expect(normalized.totalDeducciones).toBe(259.25);
      expect(normalized.liquido).toBe(1215.75);
    });
  });

  describe('validateExtractedPayroll', () => {
    it('marca como cuadrada una nómina exacta o con redondeo <= 0,05 €', () => {
      const payroll = normalizeExtractedPayroll({
        devengos: [
          { concepto: 'Salario Base', unidades: '30', precio: 50, importe: 1500.01 },
          { concepto: 'Plus Nocturnidad', unidades: '10', precio: 2.5, importe: 25 },
        ],
        deducciones: [
          { concepto: 'Contingencias Comunes', base: 1525, tipo: 4.7, importe: 71.68 },
          { concepto: 'IRPF', base: 1525, tipo: 10, importe: 152.5 },
        ],
        totalDevengados: 1525,
        totalDeducciones: 224.18,
        liquido: 1300.82,
      });

      const validation = validateExtractedPayroll(payroll);
      expect(validation.isBalanced).toBe(true);
      expect(validation.discrepancies).toHaveLength(0);
      expect(validation.sumDevengos).toBe(1525.01);
      expect(validation.sumDeducciones).toBe(224.18);
      expect(validation.expectedLiquido).toBe(1300.82);
    });

    it('detecta descuadres en devengos, deducciones y líquido por encima de la tolerancia', () => {
      const payroll = normalizeExtractedPayroll({
        devengos: [{ concepto: 'Salario Base', unidades: '30', precio: 50, importe: 1400 }],
        deducciones: [{ concepto: 'IRPF', base: 1500, tipo: 10, importe: 150 }],
        totalDevengados: 1500,
        totalDeducciones: 200,
        liquido: 1250,
      });

      const validation = validateExtractedPayroll(payroll);
      expect(validation.isBalanced).toBe(false);
      expect(validation.discrepancies.map((d) => d.field)).toEqual(['devengos', 'deducciones', 'liquido']);
      expect(validation.discrepancies[0].diff).toBe(-100);
      expect(validation.discrepancies[1].diff).toBe(-50);
      expect(validation.discrepancies[2].diff).toBe(50);
    });

    it('detecta una extracción vacía como no cuadrada', () => {
      const payroll = normalizeExtractedPayroll({
        devengos: [],
        deducciones: [],
        totalDevengados: 0,
        totalDeducciones: 0,
        liquido: 0,
      });

      const validation = validateExtractedPayroll(payroll);
      expect(validation.isBalanced).toBe(false);
      expect(validation.discrepancies[0].field).toBe('empty');
    });
  });
});
