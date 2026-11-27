export interface PayrollDevengoItem {
  concepto: string;
  unidades: string;
  precio: number;
  importe: number;
}

export interface PayrollDeduccionItem {
  concepto: string;
  base: number;
  tipo: number;
  importe: number;
}

export interface PayrollValidationDiscrepancy {
  field: 'devengos' | 'deducciones' | 'liquido' | 'empty';
  label: string;
  expected: number;
  extracted: number;
  diff: number;
}

export interface PayrollValidationSummary {
  isBalanced: boolean;
  sumDevengos: number;
  sumDeducciones: number;
  expectedLiquido: number;
  totalError: number;
  discrepancies: PayrollValidationDiscrepancy[];
  autoCorrected?: boolean;
}

export interface ExtractedPayrollPayload {
  devengos: PayrollDevengoItem[];
  deducciones: PayrollDeduccionItem[];
  totalDevengados: number;
  totalDeducciones: number;
  liquido: number;
  validation?: PayrollValidationSummary;
}

export const PAYROLL_MATH_TOLERANCE = 0.05;

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Coerce numeric strings (including Spanish "1.234,56" or "-45,20 €") or numbers into finite JS numbers.
 */
export function coerceSpanishNumber(input: unknown): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? round2(input) : 0;
  }
  if (typeof input !== 'string') return 0;
  let s = input.trim().replace(/[€%\s]/g, '');
  if (!s) return 0;

  // Handle Spanish format "1.234,56" or "123,45"
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const parsed = Number(s);
  return Number.isFinite(parsed) ? round2(parsed) : 0;
}

const SUMMARY_LINE_PATTERNS: RegExp[] = [
  /^(a\.?\s*)?total\s+devengad[oa]s?$/i,
  /^(a\.?\s*)?total\s+devengos$/i,
  /^suma\s+de\s+devengos$/i,
  /^(b\.?\s*)?total\s+a\s+deducir$/i,
  /^(b\.?\s*)?total\s+deducciones$/i,
  /^total\s+aportaciones(\s+trabajador)?$/i,
  /^l[ií]quido\s+(total\s+)?a\s+percibir$/i,
  /^total\s+l[ií]quido$/i,
  /^neto\s+a\s+percibir$/i,
  /^base\s+(de\s+)?cotizaci[oó]n/i,
  /^base\s+sujeta\s+a\s+retenci[oó]n/i,
  /^base\s+irpf$/i,
  /^remuneraci[oó]n\s+total$/i,
  /^prorrata\s+pagas\s+extras?\s*\(base/i,
];

function isAccidentalSummaryRow(concepto: string): boolean {
  const normalized = concepto.trim().replace(/\s+/g, ' ').replace(/[:.]+$/, '');
  if (!normalized) return true;
  return SUMMARY_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function normalizeExtractedPayroll(raw: any): Omit<ExtractedPayrollPayload, 'validation'> {
  const rawDevengos = Array.isArray(raw?.devengos) ? raw.devengos : [];
  const rawDeducciones = Array.isArray(raw?.deducciones) ? raw.deducciones : [];

  const devengos: PayrollDevengoItem[] = [];
  for (const item of rawDevengos) {
    const concepto = typeof item?.concepto === 'string' ? item.concepto.trim().replace(/\s+/g, ' ') : '';
    if (!concepto || isAccidentalSummaryRow(concepto)) continue;

    const importe = coerceSpanishNumber(item?.importe);
    const precio = coerceSpanishNumber(item?.precio);
    const unidades =
      item?.unidades !== undefined && item?.unidades !== null
        ? String(item.unidades).trim()
        : '';

    // Skip zero-amount noise rows unless it explicitly carries informative units/price
    if (importe === 0 && precio === 0 && !unidades) continue;

    devengos.push({
      concepto,
      unidades,
      precio,
      importe,
    });
  }

  const deducciones: PayrollDeduccionItem[] = [];
  for (const item of rawDeducciones) {
    const concepto = typeof item?.concepto === 'string' ? item.concepto.trim().replace(/\s+/g, ' ') : '';
    if (!concepto || isAccidentalSummaryRow(concepto)) continue;

    // Deductions on payslips are sometimes printed with a leading minus sign; normalize to positive magnitude
    const rawImporte = coerceSpanishNumber(item?.importe);
    const importe = round2(Math.abs(rawImporte));
    const base = round2(Math.abs(coerceSpanishNumber(item?.base)));
    const tipo = round2(Math.abs(coerceSpanishNumber(item?.tipo)));

    if (importe === 0 && base === 0 && tipo === 0) continue;

    deducciones.push({
      concepto,
      base,
      tipo,
      importe,
    });
  }

  const totalDevengados = coerceSpanishNumber(raw?.totalDevengados);
  const totalDeducciones = round2(Math.abs(coerceSpanishNumber(raw?.totalDeducciones)));
  const liquido = coerceSpanishNumber(raw?.liquido);

  return {
    devengos,
    deducciones,
    totalDevengados,
    totalDeducciones,
    liquido,
  };
}

export function validateExtractedPayroll(
  payload: Omit<ExtractedPayrollPayload, 'validation'>,
  tolerance = PAYROLL_MATH_TOLERANCE,
  autoCorrected = false
): PayrollValidationSummary {
  const sumDevengos = round2(payload.devengos.reduce((acc, item) => acc + item.importe, 0));
  const sumDeducciones = round2(payload.deducciones.reduce((acc, item) => acc + item.importe, 0));
  const expectedLiquido = round2(payload.totalDevengados - payload.totalDeducciones);

  const discrepancies: PayrollValidationDiscrepancy[] = [];

  const isEmpty =
    payload.devengos.length === 0 &&
    payload.deducciones.length === 0 &&
    payload.totalDevengados === 0 &&
    payload.liquido === 0;

  if (isEmpty) {
    discrepancies.push({
      field: 'empty',
      label: 'No se han detectado conceptos económicos en el documento.',
      expected: 0,
      extracted: 0,
      diff: 0,
    });

    return {
      isBalanced: false,
      sumDevengos,
      sumDeducciones,
      expectedLiquido,
      totalError: Number.POSITIVE_INFINITY,
      discrepancies,
      autoCorrected,
    };
  }

  const devDiff = round2(sumDevengos - payload.totalDevengados);
  if (Math.abs(devDiff) > tolerance) {
    discrepancies.push({
      field: 'devengos',
      label: 'La suma de devengos no coincide con el total devengado',
      expected: sumDevengos,
      extracted: payload.totalDevengados,
      diff: devDiff,
    });
  }

  const dedDiff = round2(sumDeducciones - payload.totalDeducciones);
  if (Math.abs(dedDiff) > tolerance) {
    discrepancies.push({
      field: 'deducciones',
      label: 'La suma de deducciones no coincide con el total a deducir',
      expected: sumDeducciones,
      extracted: payload.totalDeducciones,
      diff: dedDiff,
    });
  }

  const liqDiff = round2(expectedLiquido - payload.liquido);
  if (Math.abs(liqDiff) > tolerance) {
    discrepancies.push({
      field: 'liquido',
      label: 'Devengado menos deducciones no coincide con el líquido a percibir',
      expected: expectedLiquido,
      extracted: payload.liquido,
      diff: liqDiff,
    });
  }

  const totalError = round2(Math.abs(devDiff) + Math.abs(dedDiff) + Math.abs(liqDiff));

  return {
    isBalanced: discrepancies.length === 0,
    sumDevengos,
    sumDeducciones,
    expectedLiquido,
    totalError,
    discrepancies,
    autoCorrected,
  };
}
