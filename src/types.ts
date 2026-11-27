import { type ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ShiftType = 'Laboral' | 'A Compensar' | 'Vacaciones' | 'Baja IT' | 'Ausencia Justificada' | 'Horas Sindicales' | 'Cambio de función' | 'Permiso Retribuido';

export interface ShiftEntry {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface ShiftTemplate {
  id: string;
  name?: string;
  shifts: ShiftEntry[];
  category?: 'manana' | 'tarde';
}

export type SwapRequestStatus = 'pending' | 'accepted' | 'rejected' | 'undone';

export interface ShiftSwapInfo {
  cededToCoworker?: boolean;      // True when my shift on this day is done by a coworker
  coveringCoworker?: boolean;     // True when the shift on this day is one I do for a coworker
  coveringShifts?: ShiftEntry[];  // If both my ceded shift and coworker's covered shift are on the same day
  coworkerName?: string;
  coworkerCode?: string;
  coworkerUid?: string;           // UID of collaborator when swapped via Compartir/Colab.
  linkedDate?: string;            // The other date involved in the swap
  originalShifts?: ShiftEntry[];  // Backup of original shifts before swap
  status?: SwapRequestStatus;     // Approval status of the shift swap request
  requestId?: string;             // Firestore SwapRequest document ID
}

export interface SwapRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderEmail?: string;
  recipientUid: string;
  recipientName: string;
  recipientEmail?: string;
  senderDate: string;
  senderShifts: ShiftEntry[];
  recipientDate: string;
  recipientShifts: ShiftEntry[];
  status: SwapRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
  timestamp: number;
}

export interface SwapNotification {
  id: string;
  type: 'shift_swap' | 'shift_swap_undo' | 'shift_swap_request' | 'shift_swap_accepted' | 'shift_swap_rejected';
  recipientUid: string;
  senderUid: string;
  senderName: string;
  senderEmail?: string;
  myOriginalDate: string;
  myOriginalShifts: ShiftEntry[];
  coveredDate: string;
  coveredShifts: ShiftEntry[];
  appliedToCalendar: boolean;
  read: boolean;
  requestId?: string;
  status?: SwapRequestStatus;
  createdAt: string;
  timestamp: number;
}

export interface SharedMonthData {
  code: string;
  monthKey: string;
  ownerName: string;
  ownerUid?: string;
  updatedAt: string;
  shifts: DayShift[];
  vacations: string[];
}

export interface DayShift {
  date: string; // ISO string
  type: ShiftType;
  shifts: ShiftEntry[];
  perentorias: { day: number; night: number };
  complementarias: { day: number; night: number };
  extraShifts: ShiftEntry[];
  generatePluses?: boolean;
  extraHoursStrategy?: 'pay' | 'compensate';
  compensatedHoursQty?: number;
  compensatedMode?: 'full' | 'range';
  compensatedRange?: ShiftEntry;
  sindicalHoursQty?: number;
  sindicalMode?: 'full' | 'range';
  sindicalRange?: ShiftEntry;
  ausenciaHoursQty?: number;
  ausenciaMode?: 'full' | 'range';
  ausenciaRange?: ShiftEntry;
  swapInfo?: ShiftSwapInfo;
}

export interface LevelData {
  nivel: number;
  anual: number;
}

export interface YearlyLevels {
  [year: number]: LevelData[];
}

export interface PlusConfig {
  value: number; // CON
  subValue?: number; // SUB
  startHour?: string; // Normal start (Nocturnas)
  endHour?: string;   // Normal end (Nocturnas)
  subStartHour?: string; // Sub start (Nocturnas)
  subEndHour?: string;   // Sub end (Nocturnas)
  madrugueStart?: string; // Normal start (Madrugue)
  madrugueEnd?: string;   // Normal end (Madrugue)
  madrugueMinEnd?: string; // Normal min end (Madrugue)
  madrugueMinEndEnabled?: boolean;
  subMadrugueStart?: string; // Sub start (Madrugue)
  subMadrugueEnd?: string;   // Sub end (Madrugue)
  subMadrugueMinEnd?: string; // Sub min end (Madrugue)
  subMadrugueMinEndEnabled?: boolean;
  startHour2?: string;
  endHour2?: string;
  pagas: 12 | 14;
  enabled: boolean;
  isVariable?: boolean;
  festivos?: boolean;
  baseType?: 'madrugue' | 'nocturnas' | 'manutencion' | 'transporte' | 'festivo' | 'domingo' | 'fijo' | 'proporcional_jornada' | 'fraccionada' | 'estandar' | string;
  calculationType?: 'proporcional_jornada' | 'fijo' | 'madrugue' | 'nocturnas' | 'manutencion' | 'transporte' | 'festivo' | 'domingo' | 'fraccionada' | 'estandar' | string;
  cloneOf?: string;
  defaultActiveInPayroll?: boolean;
  showInMonthTags?: boolean;
}

export interface PlusesData {
  [key: string]: PlusConfig;
}

export const INITIAL_LEVELS_PASAJE: LevelData[] = [
  { nivel: 1, anual: 19533.82 },
  { nivel: 2, anual: 23133.04 },
  { nivel: 3, anual: 23828.60 },
  { nivel: 4, anual: 24305.17 },
  { nivel: 5, anual: 24781.74 },
  { nivel: 6, anual: 25773.01 },
  { nivel: 7, anual: 26803.93 },
];

export const INITIAL_PLUSES_PASAJE: PlusesData = {
  'Jornada Fraccionada < 4h': { value: 11.88, pagas: 12, enabled: false, isVariable: true },
  'Jornada Fraccionada >= 4h': { value: 15.45, pagas: 12, enabled: false, isVariable: true },
  'Jornada Fraccionada >= 7h': { value: 17.84, pagas: 12, enabled: false, isVariable: true },
  'Transporte': { value: 2.97, pagas: 12, enabled: true, isVariable: true },
  'Manutención': { value: 6.74, pagas: 12, enabled: true, isVariable: true },
  'Madrugue': { value: 6.74, pagas: 12, enabled: true, isVariable: true },
  'Festivo': { value: 2.99, pagas: 12, enabled: true, isVariable: true },
  'Domingo': { value: 2.94, pagas: 12, enabled: true, isVariable: true },
  'Nocturnas': { value: 1.69, pagas: 12, enabled: true, isVariable: true },
  'Productividad': { value: 94.36, pagas: 12, enabled: false, isVariable: false },
  'Multitasking': { value: 31.45, pagas: 12, enabled: false, isVariable: false },
  'Tiempo Parcial - Discontinuo': { value: 103.15, pagas: 12, enabled: false, isVariable: false },
  'Jornada Irregular': { value: 149.00, pagas: 12, enabled: false, isVariable: false },
  'Turnicidad 2': { value: 85.96, pagas: 12, enabled: true, isVariable: true },
  'Turnicidad 3': { value: 114.61, pagas: 12, enabled: true, isVariable: true },
  'Turnicidad 4': { value: 131.81, pagas: 12, enabled: true, isVariable: true },
  'Duty': { value: 250.00, pagas: 12, enabled: false, isVariable: false },
  'Super': { value: 125.00, pagas: 12, enabled: false, isVariable: false },
  'Nocturnas SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true, startHour: '22:00', endHour: '06:00' },
  'Madrugue SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true, madrugueStart: '02:00', madrugueEnd: '06:55' },
  'Manutención/Comida SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true, startHour: '14:00', endHour: '16:00', startHour2: '21:00', endHour2: '23:00' },
  'Transporte SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true },
  'Festivo SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true },
  'Domingo SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true },
  'Jornada Irregular Diaria': { value: 0.00, pagas: 12, enabled: false, isVariable: true },
  'Cambio de función': { value: 0.00, pagas: 12, enabled: false, isVariable: true },
};

export const getPlusesWithContractTypeDefaults = (
  plusesData: PlusesData,
  contractType: 'Completo' | 'Parcial'
): PlusesData => {
  const updated: PlusesData = { ...plusesData };
  
  const parcialList = [
    'Jornada Fraccionada < 4h',
    'Jornada Fraccionada >= 4h',
    'Jornada Fraccionada >= 7h',
    'Tiempo Parcial - Discontinuo',
    'Transporte',
    'Manutención',
    'Madrugue',
    'Festivo',
    'Domingo',
    'Nocturnas'
  ];

  const completoList = [
    'Transporte',
    'Manutención',
    'Madrugue',
    'Festivo',
    'Domingo',
    'Nocturnas',
    'Turnicidad 2',
    'Turnicidad 3',
    'Turnicidad 4',
    'Turnicidad 5+',
    'Productividad',
    'Multitasking'
  ];

  if (contractType === 'Parcial') {
    parcialList.forEach(name => {
      if (updated[name]) {
        updated[name] = { ...updated[name], enabled: true };
      }
    });
    const unmarkForParcial = [
      'Turnicidad 2', 'Turnicidad 3', 'Turnicidad 4', 'Turnicidad 5+',
      'Productividad', 'Multitasking'
    ];
    unmarkForParcial.forEach(name => {
      if (updated[name]) {
        updated[name] = { ...updated[name], enabled: false };
      }
    });
  } else {
    completoList.forEach(name => {
      if (updated[name]) {
        updated[name] = { ...updated[name], enabled: true };
      }
    });
    const unmarkForCompleto = [
      'Jornada Fraccionada < 4h',
      'Jornada Fraccionada >= 4h',
      'Jornada Fraccionada >= 7h',
      'Tiempo Parcial - Discontinuo'
    ];
    unmarkForCompleto.forEach(name => {
      if (updated[name]) {
        updated[name] = { ...updated[name], enabled: false };
      }
    });
  }
  return updated;
};

export interface YearlyPluses {
  [year: number]: PlusesData;
}

export interface MonthlyOptions {
  teamleader: boolean;
  multitasking: boolean;
  productividad: boolean;
  productividadPct?: number; // 100 or 70
  arco: boolean;
  rco: boolean;
  turnicidad: boolean;
  jornadaIrregular: boolean;
  duty?: boolean;
  dutty?: boolean;
  super?: boolean;
  atrasos?: string;
  descuento?: string;
  descuentoPrice?: number;
  descuentoDinero?: string;
  descuentoOtro?: string;
  descuentoOtroEndDate?: string;
  impuntualidad?: string;
  irpf?: number;
  manualBaseSalary?: number;
  useManualBaseSalary?: boolean;
  useManualHours?: boolean;
  manualPluses?: { [plusName: string]: { value: number; qty: number; useManual: boolean } };
  customToggles?: { [name: string]: boolean };
  extraHoursType?: 'H.Perent.' | 'HHCC';
  extraHoursQty?: number;
  extraHoursPrice?: number;
  useExtraHours?: boolean;
  manualLevel?: number;
  levelJumpMode?: 'full_month' | 'exact_day';
  notes?: string;
  manualHoursParcial?: number;
  vacationVariablesToggles?: { [name: string]: boolean };
  vacationVariablesManual?: { [name: string]: { qty?: number; price?: number; value?: number; useManual?: boolean } };
  vacationVariablesDivisor?: number;
  vacationVariablesDivisorMode?: '11' | '12' | 'worked_months';
  vacationVariablesWorkedMonths?: number;
  vacationVariablesPrevYearVacDays?: number;
  vacationVariablesRateEquidad?: number;
}

export interface FrozenPeriod {
  start: string; // ISO date
  end: string;   // ISO date
}

export interface SavedPayroll {
  id: string;
  monthKey: string; // yyyy-MM
  saveDate: string; // ISO string
  devengos: { name: string; qty: number | string; price: number; value: number; isProrrata?: boolean }[];
  conceptosADescontar: { name: string; qty: number; price: number; value: number }[];
  deducciones: { name: string; base: number; rate: number; value: number }[];
  totals: {
    totalDevengado: number;
    totalDescuentos: number;
    totalDeducciones: number;
    liquido: number;
    baseCotizacion: number;
  };
  settings: {
    contractType: string;
    pagas: number;
    level: number;
    irpf: number;
  };
  notes?: string;
}

export interface UploadedPayroll {
  id: string;
  monthKey: string;
  uploadDate: string;
  data: {
    devengos: { concepto: string; unidades: string; precio: number; importe: number }[];
    deducciones: { concepto: string; base: number; tipo: number; importe: number }[];
    totalDevengados: number;
    totalDeducciones: number;
    liquido: number;
    validation?: {
      isBalanced: boolean;
      sumDevengos: number;
      sumDeducciones: number;
      expectedLiquido: number;
      totalError: number;
      discrepancies: {
        field: 'devengos' | 'deducciones' | 'liquido' | 'empty';
        label: string;
        expected: number;
        extracted: number;
        diff: number;
      }[];
      autoCorrected?: boolean;
    };
  };
}

export interface Settings {
  contractType: 'Completo' | 'Parcial';
  pagas: 12 | 14;
  seniorityDate: string; // ISO string
  nextLevelDate: string;
  holidays: string[]; // ISO strings
  vacations: string[]; // ISO strings
  frozenPeriods?: FrozenPeriod[];
  irpf: number;
  rateContingencias: number;
  rateDesempleo: number;
  rateFormacion: number;
  rateEquidad: number;
  cuotaSindical: number;
  currentLevel: number;
  selectedLevel: number;
  manualLevelProgression?: boolean;
  monthlyOptions: { [monthKey: string]: MonthlyOptions };
  counterPeriod: { start: string; end: string };
  counterTargets: { [plusName: string]: number };
  yearlyCounterTargets?: { [year: number]: { [plusName: string]: number } };
  yearlyCounterPeriods?: { [year: number]: { start: string; end: string } };
  customizedCounterTargets?: { [year: number]: { [plusName: string]: boolean } };
  yearlyUpdates?: { [year: number]: number };
  yearlySubUpdates?: { [year: number]: number };
  isSubrogado: boolean;
  subrogadoBaseSalaries?: { [year: number]: number };
  complementariasPrice?: number;
  colectivoConvenio?: 'rampa' | 'pasaje';
  expandedTablasSections?: {
    convenio: boolean;
    subrogados: boolean;
  };
  savedPayrolls?: SavedPayroll[];
  uploadedPayrolls?: UploadedPayroll[];
  shiftTemplates?: ShiftTemplate[];
  prestamo?: {
    amount: string;
    endDate?: string;
  };
  dualMode?: boolean;
  secondCompanyName?: string;
  secondCompanyColor?: string;
  secondCompanyShifts?: DayShift[];
  calendarRotation?: CalendarRotationConfig;
  autoShiftsConfig?: AutoShiftsConfig;
  monthlyRotations?: { [monthKey: string]: CalendarRotationConfig };
  monthlyAutoShifts?: { [monthKey: string]: AutoShiftsConfig };
  customRotation?: {
    workDays: number;
    freeDays: number;
    firstFreeDay?: number;
    anchorDate?: string;
  };
  mixedRotation?: MixedRotationConfig;
}

export interface MixedRotationConfig {
  mode: 'by_date' | 'alternating';
  firstWorkDays: number;
  firstFreeDays: number;
  firstAnchorDate: string; // ISO date 'YYYY-MM-DD' (primer día libre del 1er bloque)
  firstFreeDay?: number;
  secondWorkDays: number;
  secondFreeDays: number;
  switchDate?: string; // ISO date 'YYYY-MM-DD' (fecha a partir de la cual empieza la 2ª rotación en modo 'by_date')
  secondStartsWith?: 'work' | 'free'; // En modo 'by_date', si el día de cambio empieza trabajando o librando
  secondAnchorDate?: string; // ISO date 'YYYY-MM-DD' opcional (primer día libre de la 2ª rotación)
}

export interface CalendarRotationConfig {
  enabled: boolean;
  type: '6x3' | '4x4' | 'custom' | 'mixed' | string;
  workDays?: number;
  freeDays?: number;
  anchorDate: string; // ISO date 'YYYY-MM-DD'
  anchorType?: 'first_morning' | 'first_free';
  effectiveFromMonth: string; // 'YYYY-MM'
  firstFreeDay?: number;
  linePosition?: 'top' | 'bottom';
  mixedConfig?: MixedRotationConfig;
}

export interface AutoShiftsConfig {
  enabled: boolean;
  firstMorningDate: string; // 'YYYY-MM-DD'
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
}

export interface SharingConfig {
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  editors: string[];
  editorUids?: string[];
  disabledEditors?: string[];
  disabledEditorUids?: string[];
  activeCode?: string;
  isLocked?: boolean;
  hidePayrollAmounts?: boolean;
  updatedAt?: string;
}

export interface SharedQuadrantInfo {
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  role: 'editor' | 'owner';
  isLocked?: boolean;
  hidePayrollAmounts?: boolean;
  isDisabled?: boolean;
  updatedAt?: string;
}

declare global {
  const __APP_BUILD_TIME__: string;
}


