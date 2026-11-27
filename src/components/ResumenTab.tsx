import React, { useMemo, useState } from 'react';
import { 
  Clock, 
  BarChart3, 
  Sun, 
  FileText, 
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  LayoutDashboard,
  History,
  TrendingUp,
  Wallet,
  X,
  CreditCard,
  ArrowRight,
  HelpCircle,
  Edit2,
  Download,
  FileSpreadsheet,
  FileDown,
  CheckCircle2,
  RefreshCw,
  Umbrella,
  Check,
  Coins
} from 'lucide-react';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  parseISO,
  isValid,
  addDays,
  format
} from 'date-fns';
import { es } from 'date-fns/locale';
import { formatNumber, formatCurrency as originalFormatCurrency, safeFormat, getShiftDuration, isExtraPayroll, isRegularPayroll, getCounterConfigForDate, getEffectiveSubPlusPrice, calculateLevelMetrics } from '../utils';
import { computeSimulatedPayrollsForMonth } from '../utils/payrollBuilder';
import { exportSinglePayrollPdf } from '../utils/payrollPdf';
import { YearlyLevels, YearlyPluses, cn, SavedPayroll, SharedQuadrantInfo } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TutorialModal, TutorialStep } from './TutorialModal';
import { YearPickerModal } from './YearPickerModal';
import { useScrollLock } from '../hooks/useScrollLock';
import { calculateVacationScoreForYear } from './PuntuacionVacacionesSection';

interface ResumenTabProps {
  shifts: any[];
  currentMonth: Date;
  settings: any;
  levels?: YearlyLevels;
  pluses: YearlyPluses;
  getStatsForShifts: any;
  activeSharedOwner?: SharedQuadrantInfo | null;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const ResumenTab = ({
  shifts,
  currentMonth,
  settings,
  levels,
  pluses,
  getStatsForShifts,
  activeSharedOwner
}: ResumenTabProps) => {
  const hideAmounts = !!activeSharedOwner?.hidePayrollAmounts;
  const isCompleto = settings?.contractType === 'Completo' || settings?.contractType?.toLowerCase?.() === 'completo';

  const formatCurrency = (val: any) => {
    if (hideAmounts) return '•••• €';
    return originalFormatCurrency(val);
  };
  const [selectedYear, setSelectedYear] = useState(currentMonth.getFullYear());
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<SavedPayroll | null>(null);
  const [showHoursChartModal, setShowHoursChartModal] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<{ monthName: string; hours: number } | null>(null);
  const [showPercentageChartModal, setShowPercentageChartModal] = useState(false);
  const [hoveredPercentageMonth, setHoveredPercentageMonth] = useState<{ monthName: string; percentage: number } | null>(null);
  const [showAnnualPlusesModal, setShowAnnualPlusesModal] = useState(false);
  const [plusesCategoryFilter, setPlusesCategoryFilter] = useState<'ALL' | 'CON' | 'SUB'>('ALL');
  const [disabledAnnualPlusIds, setDisabledAnnualPlusIds] = useState<Record<string, boolean>>({});
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAnnualPreviewModal, setShowAnnualPreviewModal] = useState(false);
  const [previewMonthIndex, setPreviewMonthIndex] = useState(0);
  const [isPayrollHistoryExpanded, setIsPayrollHistoryExpanded] = useState(false);
  const [isDownloadChoiceModalOpen, setIsDownloadChoiceModalOpen] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [includeExtraInTotalHours, setIncludeExtraInTotalHours] = useState<boolean>(() => {
    const saved = localStorage.getItem('resumen_include_extra_hours');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleExtraHours = () => {
    setIncludeExtraInTotalHours(prev => {
      const next = !prev;
      try {
        localStorage.setItem('resumen_include_extra_hours', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
  const successTimeoutRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  useScrollLock(!!selectedPayroll || showHoursChartModal || showPercentageChartModal || showAnnualPlusesModal || showAnnualPreviewModal || isYearPickerOpen || isDownloadChoiceModalOpen);

  React.useEffect(() => {
    if (!settings.isSubrogado && plusesCategoryFilter !== 'ALL') {
      setPlusesCategoryFilter('ALL');
    }
  }, [settings.isSubrogado, plusesCategoryFilter]);

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Resumen de Cómputo Anual",
      badge: "Anual",
      icon: <LayoutDashboard size={22} />,
      color: "text-azul-blue",
      bg: "bg-azul-blue/10",
      description: "Las tarjetas de la cabecera calculan automáticamente los acumulados de todo el año seleccionado: total de horas trabajadas, total de ingresos por variables, total de días trabajados y total de días de vacaciones consolidados."
    },
    {
      title: "Comparativa Interanual",
      badge: "Análisis",
      icon: <TrendingUp size={22} />,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      description: "A la derecha de cada métrica verás un porcentaje de incremento o decremento respecto a los datos consolidados del año anterior, permitiéndote analizar fácilmente tu progresión laboral y salarial."
    },
    {
      title: "Archivo Histórico de Nóminas",
      badge: "Historial",
      icon: <History size={22} />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      description: "La sección 'Nóminas Guardadas' recopila las liquidaciones que hayas fijado en la pestaña de turnos. Aparecen ordenadas cronológicamente para que nunca pierdas el control de lo cobrado."
    },
    {
      title: "Visor Detallado de Recibo",
      badge: "Nómina",
      icon: <FileText size={22} />,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      description: "Pulsa sobre cualquiera de las nóminas guardadas en tu listado para abrir un visor flotante interactivo que muestra con exactitud un desglose idéntico al de una nómina oficial, incluyendo devengos, IRPF y líquido neto mensual."
    },
    {
      title: "Descarga del resumen anual",
      badge: "Descarga",
      icon: <Download size={22} />,
      color: "text-teal-600",
      bg: "bg-teal-500/10",
      description: "Descarga en un archivo el resumen completo de todo el año: turnos realizados mes a mes, pluses generados y el desglose íntegro de cada nómina guardada."
    }
  ];

  const stats = useMemo(() => {
    const currentYear = selectedYear;
    const prevYear = currentYear - 1;

    const getYearStats = (year: number) => {
      const yearShifts = shifts.filter(s => {
        const d = parseISO(s.date);
        return isValid(d) && d.getFullYear() === year;
      });
      const fallbackYearPluses = pluses[year] || pluses[new Date().getFullYear()] || Object.values(pluses)[0] || {};
      let totalOrdHours = 0;
      let totalMonthlyHours = 0;
      let totalVariables = 0;
      let totalVacationDays = 0;
      let totalDaysWorked = 0;
      const monthlyHoursData: { monthIndex: number; monthName: string; shortName: string; hours: number; effectivePercentage: number }[] = [];

      interface AnnualPlusItem {
        qty: number;
        conQty: number;
        subQty: number;
        amount: number;
        label: string;
        unit: string;
        decimals: number;
      }

      interface AnnualPlusModalEntry {
        id: string;
        label: string;
        category: 'CON' | 'SUB';
        qty: number;
        amount: number;
        unit: string;
        decimals: number;
      }

      const yearLevels = (levels && (levels[year] || levels[new Date().getFullYear()] || Object.values(levels)[0])) || [];
      const activeLevelNum = settings.selectedLevel || settings.currentLevel || 1;
      const levelData = yearLevels.find((l) => l.nivel === activeLevelNum) || yearLevels[0];
      const pagasNum: 12 | 14 = settings.pagas === 14 ? 14 : 12;
      const subBaseAnual = settings.isSubrogado && settings.subrogadoBaseSalaries?.[year]
        ? Number(settings.subrogadoBaseSalaries[year]) || 0
        : 0;
      const yearMetrics = calculateLevelMetrics(subBaseAnual > 0 ? subBaseAnual : (levelData?.anual || 0), pagasNum);

      const modalEntriesMap: Record<string, AnnualPlusModalEntry> = {};
      const addModalEntry = (
        baseKey: string,
        label: string,
        category: 'CON' | 'SUB',
        qty: number,
        amount: number,
        unit: string,
        decimals: number
      ) => {
        if (qty <= 0 && amount <= 0) return;
        const id = `${baseKey}__${category}`;
        if (!modalEntriesMap[id]) {
          modalEntriesMap[id] = { id, label, category, qty: 0, amount: 0, unit, decimals };
        }
        modalEntriesMap[id].qty += qty;
        modalEntriesMap[id].amount += amount;
      };

      const plusesList: Record<string, AnnualPlusItem> = {
        'Nocturnas': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Horas Nocturnas', unit: 'h', decimals: 2 },
        'Madrugue': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Madrugues', unit: 'uni.', decimals: 0 },
        'Domingo': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Domingos Trabajados', unit: 'h', decimals: 2 },
        'Festivo': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Festivos Trabajados', unit: 'h', decimals: 2 },
        'Fraccionadas': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Fraccionadas', unit: 'uni.', decimals: 0 },
        'Transporte': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Plus Transporte', unit: 'uni.', decimals: 0 },
        'Jornada Irregular Diaria': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'J. Irreg. Diaria', unit: 'días', decimals: 0 },
        'Manutención': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Manutenciones', unit: 'uni.', decimals: 0 },
        'Turnicidad': { qty: 0, conQty: 0, subQty: 0, amount: 0, label: 'Turnicidad', unit: 'turnos', decimals: 0 }
      };
      const customPlusesMap: Record<string, AnnualPlusItem> = {};
      const STANDARD_TAG_KEYS = new Set([
        'Nocturnas',
        'Madrugue',
        'Domingo',
        'Festivo',
        'Jornada Fraccionada < 4h',
        'Jornada Fraccionada >= 4h',
        'Jornada Fraccionada >= 7h',
        'Transporte',
        'Jornada Irregular Diaria',
        'Manutención',
        'Turnicidad 2',
        'Turnicidad 3',
        'Turnicidad 4',
        'Turnicidad 5+',
        'Salario Base'
      ]);

      for (let m = 0; m < 12; m++) {
        const monthDate = new Date(year, m, 1);
        const start = startOfMonth(monthDate);
        const dayBefore = addDays(start, -1);
        const dayBeforeStr = safeFormat(dayBefore, 'yyyy-MM-dd');
        
        const monthShiftsExtended = shifts.filter(s => {
          const d = parseISO(s.date);
          return (isValid(d) && isSameMonth(d, monthDate)) || s.date === dayBeforeStr;
        });

        const monthCounterCfg = getCounterConfigForDate(settings, monthDate);
        const { period: monthCounterPeriod, targets: monthCounterTargets } = monthCounterCfg;
        const plusYear = settings.isSubrogado ? monthCounterCfg.counterYear : monthDate.getFullYear();
        const yearPluses = pluses[plusYear] || fallbackYearPluses;

        const monthStats = getStatsForShifts(
          monthShiftsExtended, 
          settings.holidays, 
          settings.vacations, 
          settings.contractType,
          true,
          shifts,
          monthCounterPeriod,
          monthCounterTargets['Nocturnas'] || 0,
          yearPluses['Nocturnas'],
          monthCounterTargets['Madrugue'] || 0,
          yearPluses['Madrugue'],
          monthDate,
          settings.isSubrogado,
          monthCounterTargets,
          yearPluses
        );
        
        totalOrdHours += monthStats.totalHours;
        totalMonthlyHours += monthStats.monthlyHours;
        totalDaysWorked += monthStats.transport;

        const isSub = !!settings.isSubrogado;
        const nightEnabled = yearPluses['Nocturnas']?.enabled !== false;
        const nightPriceCon = yearPluses['Nocturnas']?.value || 0;
        const nightPriceSub = getEffectiveSubPlusPrice(yearPluses, 'Nocturnas', isSub) ?? nightPriceCon;
        const nightConQty = monthStats.nightHours;
        const nightSubQty = monthStats.nightHoursSub || 0;
        const nightQty = nightConQty + nightSubQty;
        const nightVal = nightEnabled ? ((nightConQty * nightPriceCon) + (nightSubQty * nightPriceSub)) : 0;

        const madrugueEnabled = yearPluses['Madrugue']?.enabled !== false;
        const madruguePriceCon = yearPluses['Madrugue']?.value || 0;
        const madruguePriceSub = getEffectiveSubPlusPrice(yearPluses, 'Madrugue', isSub) ?? madruguePriceCon;
        const madrugueConQty = monthStats.madrugues;
        const madrugueSubQty = monthStats.madruguesSub || 0;
        const madrugueQty = madrugueConQty + madrugueSubQty;
        const madrugueVal = madrugueEnabled ? ((madrugueConQty * madruguePriceCon) + (madrugueSubQty * madruguePriceSub)) : 0;

        const sundayEnabled = yearPluses['Domingo']?.enabled !== false;
        const sundayPriceCon = yearPluses['Domingo']?.value || 0;
        const sundayPriceSub = getEffectiveSubPlusPrice(yearPluses, 'Domingo', isSub) ?? sundayPriceCon;
        const sundayConQty = monthStats.sundays;
        const sundaySubQty = monthStats.sundaysSub || 0;
        const sundayQty = sundayConQty + sundaySubQty;
        const sundayVal = sundayEnabled ? ((sundayConQty * sundayPriceCon) + (sundaySubQty * sundayPriceSub)) : 0;

        const festivoEnabled = yearPluses['Festivo']?.enabled !== false;
        const festivoPriceCon = yearPluses['Festivo']?.value || 0;
        const festivoPriceSub = getEffectiveSubPlusPrice(yearPluses, 'Festivo', isSub) ?? festivoPriceCon;
        const festivoConQty = monthStats.festivos;
        const festivoSubQty = monthStats.festivosSub || 0;
        const festivoQty = festivoConQty + festivoSubQty;
        const festivoVal = festivoEnabled ? ((festivoConQty * festivoPriceCon) + (festivoSubQty * festivoPriceSub)) : 0;

        const splitEnabled = (settings.contractType === 'Parcial') && (
          !!yearPluses['Jornada Fraccionada < 4h']?.enabled ||
          !!yearPluses['Jornada Fraccionada >= 4h']?.enabled ||
          !!yearPluses['Jornada Fraccionada >= 7h']?.enabled
        );
        const splitLess4PriceCon = yearPluses['Jornada Fraccionada < 4h']?.value || 0;
        const splitLess4PriceSub = getEffectiveSubPlusPrice(yearPluses, 'Jornada Fraccionada < 4h', isSub) ?? splitLess4PriceCon;
        const splitLess4Val = (monthStats.splitLess4 * splitLess4PriceCon) + ((monthStats.splitLess4Sub || 0) * splitLess4PriceSub);

        const split4to7PriceCon = yearPluses['Jornada Fraccionada >= 4h']?.value || 0;
        const split4to7PriceSub = getEffectiveSubPlusPrice(yearPluses, 'Jornada Fraccionada >= 4h', isSub) ?? split4to7PriceCon;
        const split4to7Val = (monthStats.split4to7 * split4to7PriceCon) + ((monthStats.split4to7Sub || 0) * split4to7PriceSub);

        const splitPlus7PriceCon = yearPluses['Jornada Fraccionada >= 7h']?.value || 0;
        const splitPlus7PriceSub = getEffectiveSubPlusPrice(yearPluses, 'Jornada Fraccionada >= 7h', isSub) ?? splitPlus7PriceCon;
        const splitPlus7Val = (monthStats.splitPlus7 * splitPlus7PriceCon) + ((monthStats.splitPlus7Sub || 0) * splitPlus7PriceSub);

        const splitConQty = monthStats.splitLess4 + monthStats.split4to7 + monthStats.splitPlus7;
        const splitSubQty = (monthStats.splitLess4Sub || 0) + (monthStats.split4to7Sub || 0) + (monthStats.splitPlus7Sub || 0);
        const splitTotalQty = splitConQty + splitSubQty;
        const splitTotalVal = splitEnabled ? (splitLess4Val + split4to7Val + splitPlus7Val) : 0;

        const manutencionEnabled = yearPluses['Manutención']?.enabled !== false;
        const manutencionPriceCon = yearPluses['Manutención']?.value || 0;
        const manutencionPriceSub = getEffectiveSubPlusPrice(yearPluses, 'Manutención', isSub) ?? manutencionPriceCon;
        const manutencionConQty = monthStats.manutencion;
        const manutencionSubQty = monthStats.manutencionSub || 0;
        const manutencionQty = manutencionConQty + manutencionSubQty;
        const manutencionVal = manutencionEnabled ? ((manutencionConQty * manutencionPriceCon) + (manutencionSubQty * manutencionPriceSub)) : 0;

        const hasShiftsInMonth = monthStats.totalHours > 0 || monthShiftsExtended.some(s => {
          const d = parseISO(s.date);
          return isValid(d) && isSameMonth(d, monthDate) && s.shifts && s.shifts.some((sh: any) => sh.start && sh.end);
        });
        const transportEnabled = yearPluses['Transporte']?.enabled !== false;
        const transportConQty = monthStats.transport;
        const transportSubQty = monthStats.transportSub || 0;
        const transportQty = transportConQty + transportSubQty;
        const transportPriceCon = yearPluses['Transporte']?.value || 0;
        const transportPriceSub = getEffectiveSubPlusPrice(yearPluses, 'Transporte', isSub) ?? transportPriceCon;
        const useMonthlyTransportSub = isSub && !!yearPluses['Transporte SUB']?.enabled && (yearPluses['Transporte SUB']?.value || 0) > 0 && !yearPluses['Transporte SUB']?.showInMonthTags;
        const transportVal = useMonthlyTransportSub
          ? (hasShiftsInMonth ? (yearPluses['Transporte SUB'].value || 0) : 0)
          : (transportEnabled ? ((transportConQty * transportPriceCon) + (transportSubQty * transportPriceSub)) : 0);

        const jIrregDiariaPlus = yearPluses['Jornada Irregular Diaria'];
        const jIrregDiariaVal = (jIrregDiariaPlus?.enabled) ? (transportQty * (jIrregDiariaPlus.value || 0)) : 0;

        const v = nightVal +
                  madrugueVal +
                  sundayVal +
                  festivoVal +
                  splitTotalVal +
                  transportVal +
                  jIrregDiariaVal +
                  manutencionVal;
        
        totalVariables += v;

        // Collect counts and amounts matching 'Pluses Generados del Mes' (CON + SUB)
        if (nightEnabled && nightQty > 0) {
          plusesList['Nocturnas'].qty += nightQty;
          plusesList['Nocturnas'].conQty += nightConQty;
          plusesList['Nocturnas'].subQty += nightSubQty;
          plusesList['Nocturnas'].amount += nightVal;
          addModalEntry('Nocturnas', 'Horas Nocturnas', 'CON', nightConQty, nightConQty * nightPriceCon, 'h', 2);
          if (isSub && nightSubQty > 0) {
            addModalEntry('Nocturnas', 'Horas Nocturnas', 'SUB', nightSubQty, nightSubQty * nightPriceSub, 'h', 2);
          }
        }

        if (madrugueEnabled && madrugueQty > 0) {
          plusesList['Madrugue'].qty += madrugueQty;
          plusesList['Madrugue'].conQty += madrugueConQty;
          plusesList['Madrugue'].subQty += madrugueSubQty;
          plusesList['Madrugue'].amount += madrugueVal;
          addModalEntry('Madrugue', 'Madrugues', 'CON', madrugueConQty, madrugueConQty * madruguePriceCon, 'uni.', 0);
          if (isSub && madrugueSubQty > 0) {
            addModalEntry('Madrugue', 'Madrugues', 'SUB', madrugueSubQty, madrugueSubQty * madruguePriceSub, 'uni.', 0);
          }
        }

        if (sundayEnabled && sundayQty > 0) {
          plusesList['Domingo'].qty += sundayQty;
          plusesList['Domingo'].conQty += sundayConQty;
          plusesList['Domingo'].subQty += sundaySubQty;
          plusesList['Domingo'].amount += sundayVal;
          addModalEntry('Domingo', 'Domingos Trabajados', 'CON', sundayConQty, sundayConQty * sundayPriceCon, 'h', 2);
          if (isSub && sundaySubQty > 0) {
            addModalEntry('Domingo', 'Domingos Trabajados', 'SUB', sundaySubQty, sundaySubQty * sundayPriceSub, 'h', 2);
          }
        }

        if (festivoEnabled && festivoQty > 0) {
          plusesList['Festivo'].qty += festivoQty;
          plusesList['Festivo'].conQty += festivoConQty;
          plusesList['Festivo'].subQty += festivoSubQty;
          plusesList['Festivo'].amount += festivoVal;
          addModalEntry('Festivo', 'Festivos Trabajados', 'CON', festivoConQty, festivoConQty * festivoPriceCon, 'h', 2);
          if (isSub && festivoSubQty > 0) {
            addModalEntry('Festivo', 'Festivos Trabajados', 'SUB', festivoSubQty, festivoSubQty * festivoPriceSub, 'h', 2);
          }
        }

        if (splitEnabled && splitTotalQty > 0) {
          plusesList['Fraccionadas'].qty += splitTotalQty;
          plusesList['Fraccionadas'].conQty += splitConQty;
          plusesList['Fraccionadas'].subQty += splitSubQty;
          plusesList['Fraccionadas'].amount += splitTotalVal;
          const splitConVal = (monthStats.splitLess4 * splitLess4PriceCon) + (monthStats.split4to7 * split4to7PriceCon) + (monthStats.splitPlus7 * splitPlus7PriceCon);
          const splitSubVal = ((monthStats.splitLess4Sub || 0) * splitLess4PriceSub) + ((monthStats.split4to7Sub || 0) * split4to7PriceSub) + ((monthStats.splitPlus7Sub || 0) * splitPlus7PriceSub);
          addModalEntry('Fraccionadas', 'Fraccionadas', 'CON', splitConQty, splitConVal, 'uni.', 0);
          if (isSub && splitSubQty > 0) {
            addModalEntry('Fraccionadas', 'Fraccionadas', 'SUB', splitSubQty, splitSubVal, 'uni.', 0);
          }
        }

        if (useMonthlyTransportSub) {
          if (hasShiftsInMonth) {
            const subMonthlyVal = yearPluses['Transporte SUB']?.value || 0;
            addModalEntry('Transporte', 'Plus Transporte', 'SUB', 1, subMonthlyVal, 'mes', 0);
          }
        } else if (transportEnabled && transportQty > 0) {
          plusesList['Transporte'].qty += transportQty;
          plusesList['Transporte'].conQty += transportConQty;
          plusesList['Transporte'].subQty += transportSubQty;
          plusesList['Transporte'].amount += transportVal;
          addModalEntry('Transporte', 'Plus Transporte', 'CON', transportConQty, transportConQty * transportPriceCon, 'uni.', 0);
          if (isSub && transportSubQty > 0) {
            addModalEntry('Transporte', 'Plus Transporte', 'SUB', transportSubQty, transportSubQty * transportPriceSub, 'uni.', 0);
          }
        }

        if (jIrregDiariaPlus?.enabled && transportQty > 0) {
          const jIrregSubPrice = getEffectiveSubPlusPrice(yearPluses, 'Jornada Irregular Diaria', isSub) ?? (jIrregDiariaPlus.value || 0);
          plusesList['Jornada Irregular Diaria'].qty += transportQty;
          plusesList['Jornada Irregular Diaria'].conQty += transportConQty;
          plusesList['Jornada Irregular Diaria'].subQty += transportSubQty;
          plusesList['Jornada Irregular Diaria'].amount += jIrregDiariaVal;
          addModalEntry('Jornada Irregular Diaria', 'J. Irreg. Diaria', 'CON', transportConQty, transportConQty * (jIrregDiariaPlus.value || 0), 'días', 0);
          if (isSub && transportSubQty > 0) {
            addModalEntry('Jornada Irregular Diaria', 'J. Irreg. Diaria', 'SUB', transportSubQty, transportSubQty * jIrregSubPrice, 'días', 0);
          }
        }

        if (manutencionEnabled && manutencionQty > 0) {
          plusesList['Manutención'].qty += manutencionQty;
          plusesList['Manutención'].conQty += manutencionConQty;
          plusesList['Manutención'].subQty += manutencionSubQty;
          plusesList['Manutención'].amount += manutencionVal;
          addModalEntry('Manutención', 'Manutenciones', 'CON', manutencionConQty, manutencionConQty * manutencionPriceCon, 'uni.', 0);
          if (isSub && manutencionSubQty > 0) {
            addModalEntry('Manutención', 'Manutenciones', 'SUB', manutencionSubQty, manutencionSubQty * manutencionPriceSub, 'uni.', 0);
          }
        }

        const turnicidadEnabled = settings.contractType === 'Completo' && (
          !!yearPluses['Turnicidad 2']?.enabled ||
          !!yearPluses['Turnicidad 3']?.enabled ||
          !!yearPluses['Turnicidad 4']?.enabled ||
          !!yearPluses['Turnicidad 5+']?.enabled
        );
        if (turnicidadEnabled && monthStats.uniqueShiftsCount > 0) {
          const uCount = monthStats.uniqueShiftsCount;
          const turnVal = uCount >= 5 && yearPluses['Turnicidad 5+']?.enabled
            ? (yearPluses['Turnicidad 5+'].value || 0)
            : uCount === 4 && yearPluses['Turnicidad 4']?.enabled
              ? (yearPluses['Turnicidad 4'].value || 0)
              : uCount === 3 && yearPluses['Turnicidad 3']?.enabled
                ? (yearPluses['Turnicidad 3'].value || 0)
                : uCount === 2 && yearPluses['Turnicidad 2']?.enabled
                  ? (yearPluses['Turnicidad 2'].value || 0)
                  : 0;
          plusesList['Turnicidad'].qty += uCount;
          plusesList['Turnicidad'].conQty += uCount;
          plusesList['Turnicidad'].amount += turnVal;
          addModalEntry('Turnicidad', 'Turnicidad', 'CON', uCount, turnVal, 'turnos', 0);
        }

        // Extra hours & Cambio de función reflected in 'Pluses Generados del Mes'
        if (settings.contractType === 'Completo') {
          if ((monthStats.perentDay || 0) > 0) {
            addModalEntry('Perentorias', 'Perentorias', 'CON', monthStats.perentDay, monthStats.perentDay * yearMetrics.perentoria, 'h', 2);
          }
          if ((monthStats.perentNight || 0) > 0) {
            addModalEntry('Perentorias Noc.', 'Perentorias Noc.', 'CON', monthStats.perentNight, monthStats.perentNight * (yearMetrics.perentoria + nightPriceCon), 'h', 2);
          }
        } else {
          const compPrice = settings.complementariasPrice || yearMetrics.complementaria;
          if ((monthStats.complDay || 0) > 0) {
            addModalEntry('Complementarias', 'Complementarias', 'CON', monthStats.complDay, monthStats.complDay * compPrice, 'h', 2);
          }
          if ((monthStats.complNight || 0) > 0) {
            addModalEntry('Complementarias Noc.', 'Complementarias Noc.', 'CON', monthStats.complNight, monthStats.complNight * (compPrice + nightPriceCon), 'h', 2);
          }
        }

        if ((monthStats.cambioFuncionHours || 0) > 0) {
          const cdfCfg = yearPluses['Cambio de función'];
          const cdfHourlyPrice = cdfCfg?.enabled ? ((cdfCfg.value || 0) / 155.63) : 0;
          addModalEntry(
            'Cambio de función',
            'Cambio de Función',
            'CON',
            monthStats.cambioFuncionHours,
            monthStats.cambioFuncionHours * cdfHourlyPrice,
            'h',
            2
          );
        }

        // Custom & SUB pluses flagged with showInMonthTags (mirrors TurnosTab.tsx customItems)
        Object.entries(yearPluses).forEach(([pName, pCfg]: [string, any]) => {
          if (!pCfg || !pCfg.enabled || !pCfg.showInMonthTags || STANDARD_TAG_KEYS.has(pName)) return;

          const customCount = (monthStats as any)?.customCounts?.[pName];
          const isHourly = pCfg.calculationType === 'nocturnas' || pCfg.baseType === 'nocturnas' || pCfg.calculationType === 'festivo' || pCfg.baseType === 'festivo' || pCfg.calculationType === 'domingo' || pCfg.baseType === 'domingo';
          const isTransport = pCfg.calculationType === 'transporte' || pCfg.baseType === 'transporte' || pCfg.calculationType === 'dias_trabajados';
          const isProportional = pCfg.calculationType === 'proporcional_jornada' || pCfg.baseType === 'proporcional_jornada';
          const isFixed = pCfg.calculationType === 'fijo' || pCfg.baseType === 'fijo';

          let val = 0;
          let unit = isHourly ? 'h' : 'uni.';
          let decimals = isHourly ? 2 : 0;

          if (customCount !== undefined) {
            val = customCount;
          } else if (isTransport) {
            val = monthStats.transport + (monthStats.transportSub || 0);
          } else if (isProportional) {
            val = hasShiftsInMonth
              ? (settings.contractType === 'Completo' ? 1 : Math.round(((monthStats.effectivePercentage || 0) / 100) * 100) / 100)
              : 0;
            decimals = 2;
          } else if (isFixed) {
            val = hasShiftsInMonth ? 1 : 0;
            unit = 'mes';
          } else {
            val = hasShiftsInMonth ? 1 : 0;
          }

          if (val <= 0) return;

          if (!customPlusesMap[pName]) {
            customPlusesMap[pName] = { qty: 0, conQty: 0, subQty: 0, amount: 0, label: pName, unit, decimals };
          }
          customPlusesMap[pName].qty += val;
          const isSubCustom = isSub && (pName.endsWith(' SUB') || pName === 'Manutención/Comida SUB' || /\bSUB\b/i.test(pName));
          if (isSubCustom) {
            customPlusesMap[pName].subQty += val;
          } else {
            customPlusesMap[pName].conQty += val;
          }
          const customAmount = val * (pCfg.value || 0);
          customPlusesMap[pName].amount += customAmount;
          addModalEntry(`custom_${pName}`, pName, isSubCustom ? 'SUB' : 'CON', val, customAmount, unit, decimals);
        });

        monthlyHoursData.push({
          monthIndex: m,
          monthName: MONTH_NAMES[m],
          shortName: MONTH_SHORT[m],
          hours: monthStats.totalHours,
          effectivePercentage: Number(monthStats.effectivePercentage) || 0
        });

        const daysInMonth = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
        daysInMonth.forEach(d => {
          const iso = safeFormat(d, 'yyyy-MM-dd');
          const isVacSetting = settings.vacations.includes(iso);
          const shift = monthShiftsExtended.find(s => s.date === iso);
          const isVacType = shift?.type === 'Vacaciones';
          if (isVacSetting || isVacType) totalVacationDays++;
        });
      }

      // Horas perentorias y complementarias del año (a cobrar y a compensar)
      let totalExtraHours = 0;
      yearShifts.forEach(s => {
        const d = parseISO(s.date);
        if (!isValid(d) || d.getFullYear() !== year) return;
        (s.extraShifts || []).forEach(sh => {
          if (sh && sh.start && sh.end) {
            totalExtraHours += getShiftDuration(sh.start, sh.end);
          }
        });
        totalExtraHours += (s.perentorias?.day || 0) + (s.perentorias?.night || 0);
        totalExtraHours += (s.complementarias?.day || 0) + (s.complementarias?.night || 0);
      });

      // En contrato 'Completo', las horas perentorias nunca se suman al total anual.
      // En contrato 'Parcial', las horas complementarias sí se suman al total anual.
      const isContractCompleto = settings?.contractType === 'Completo' || settings?.contractType?.toLowerCase?.() === 'completo';
      const totalRealizadas = isContractCompleto 
        ? totalOrdHours 
        : (totalOrdHours + totalExtraHours);

      const avgPercentage = (totalRealizadas / 1712) * 100;
      const variablesPor11 = totalVariables / 11;
      const dailyRate = totalDaysWorked > 0 ? totalVariables / totalDaysWorked : 0;
      
      const annualPlusModalEntries = Object.values(modalEntriesMap).sort((a, b) => {
        const cmp = a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : a.category.localeCompare(b.category);
      });

      return { 
        totalHours: totalRealizadas,
        totalRealizadas,
        totalOrdHours,
        totalExtraHours,
        totalMonthlyHours,
        avgPercentage,
        totalVariables,
        totalVacationDays,
        variablesPor11,
        dailyRate,
        totalDaysWorked,
        plusesList: [...Object.values(plusesList), ...Object.values(customPlusesMap)],
        annualPlusModalEntries,
        monthlyHoursData
      };
    };

    return {
      current: getYearStats(currentYear),
      prev: getYearStats(prevYear)
    };
  }, [shifts, selectedYear, settings.vacations, settings.holidays, settings.contractType, settings.isSubrogado, settings.counterPeriod, settings.counterTargets, settings.yearlyCounterTargets, settings.yearlyCounterPeriods, settings.selectedLevel, settings.currentLevel, settings.pagas, settings.subrogadoBaseSalaries, settings.complementariasPrice, levels, pluses, getStatsForShifts]);

  const payrollHistory = useMemo(() => {
    const allPayrolls = settings.savedPayrolls || [];
    // Filter by year
    const yearPayrolls = allPayrolls.filter((p: SavedPayroll) => p.monthKey.startsWith(selectedYear.toString()));
    
    // Group by month
    const grouped: Record<string, SavedPayroll[]> = {};
    yearPayrolls.forEach((p: SavedPayroll) => {
      const month = p.monthKey.split('-')[1]; // MM
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(p);
    });
    
    // Sort months
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a)) // Latest month first
      .map(([month, entries]) => ({
        month: parseInt(month),
        payrolls: entries.sort((a, b) => b.saveDate.localeCompare(a.saveDate)) // Latest save first
      }));
  }, [settings.savedPayrolls, selectedYear]);

  const allVacations = useMemo(() => {
    const set = new Set<string>(settings.vacations || []);
    if (shifts) {
      shifts.forEach((s: any) => {
        if (s.type === 'Vacaciones' && s.date) set.add(s.date);
      });
    }
    return Array.from(set);
  }, [settings.vacations, shifts]);

  const vacationScoreData = useMemo(() => {
    return calculateVacationScoreForYear(selectedYear, allVacations, settings.holidays || []);
  }, [selectedYear, allVacations, settings.holidays]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const annualMonthsData = useMemo(() => {
    const yearPluses = pluses[selectedYear] || pluses[new Date().getFullYear()] || Object.values(pluses)[0] || {};
    const yearShifts = shifts.filter(s => {
      const d = parseISO(s.date);
      return isValid(d) && d.getFullYear() === selectedYear;
    });

    const months = [];
    let totWorkedHours = 0;
    let totComputedHours = 0;
    let totGross = 0;
    let totDeductions = 0;
    let totNet = 0;
    let totWorkDays = 0;
    let savedPayrollsCount = 0;

    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(selectedYear, m, 1);
      const start = startOfMonth(monthDate);
      const dayBefore = addDays(start, -1);
      const dayBeforeStr = safeFormat(dayBefore, 'yyyy-MM-dd');
      const monthKey = `${selectedYear}-${String(m + 1).padStart(2, '0')}`;

      const monthShiftsExtended = shifts.filter(s => {
        const d = parseISO(s.date);
        return (isValid(d) && isSameMonth(d, monthDate)) || s.date === dayBeforeStr;
      });

      const monthCounterCfg = getCounterConfigForDate(settings, monthDate);
      const { period: monthCounterPeriod, targets: monthCounterTargets } = monthCounterCfg;
      const monthPlusYear = settings.isSubrogado ? monthCounterCfg.counterYear : monthDate.getFullYear();
      const monthYearPluses = pluses[monthPlusYear] || yearPluses;

      const monthStats = getStatsForShifts(
        monthShiftsExtended,
        settings.holidays,
        settings.vacations,
        settings.contractType,
        true,
        shifts,
        monthCounterPeriod,
        monthCounterTargets?.['Nocturnas'] || 0,
        monthYearPluses['Nocturnas'],
        monthCounterTargets?.['Madrugue'] || 0,
        monthYearPluses['Madrugue'],
        monthDate,
        settings.isSubrogado,
        monthCounterTargets,
        monthYearPluses
      );

      const actualShiftsThisMonth = monthShiftsExtended.filter(s => {
        const d = parseISO(s.date);
        return isValid(d) && isSameMonth(d, monthDate);
      });
      const workDaysCount = actualShiftsThisMonth.filter(s => {
        const hasReg = (s.shifts || []).some((sh: any) => sh.start && sh.end);
        const hasExtra = (s.extraShifts || []).some((sh: any) => sh.start && sh.end);
        return (hasReg || hasExtra) && s.type !== 'Vacaciones' && s.type !== 'Baja IT' && s.type !== 'Ausencia Justificada';
      }).length;

      const vacationDaysCount = actualShiftsThisMonth.filter(s => {
        const isVacSetting = settings.vacations?.includes(s.date);
        const isVacType = s.type === 'Vacaciones';
        return isVacSetting || isVacType;
      }).length;

      const bajaDaysCount = actualShiftsThisMonth.filter(s => s.type === 'Baja IT').length;

      // 1. Pluses calculados en el mes (incluyendo tramos CON y SUB)
      const isSub = !!settings.isSubrogado;
      const nightPriceCon = monthYearPluses['Nocturnas']?.value || 0;
      const nightPriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Nocturnas', isSub) ?? nightPriceCon;
      const nightVal = (monthStats.nightHours * nightPriceCon) + ((monthStats.nightHoursSub || 0) * nightPriceSub);

      const madruguePriceCon = monthYearPluses['Madrugue']?.value || 0;
      const madruguePriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Madrugue', isSub) ?? madruguePriceCon;
      const madrugueVal = (monthStats.madrugues * madruguePriceCon) + ((monthStats.madruguesSub || 0) * madruguePriceSub);

      const sundayPriceCon = monthYearPluses['Domingo']?.value || 0;
      const sundayPriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Domingo', isSub) ?? sundayPriceCon;
      const sundayVal = (monthStats.sundays * sundayPriceCon) + ((monthStats.sundaysSub || 0) * sundayPriceSub);

      const festivoPriceCon = monthYearPluses['Festivo']?.value || 0;
      const festivoPriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Festivo', isSub) ?? festivoPriceCon;
      const festivoVal = (monthStats.festivos * festivoPriceCon) + ((monthStats.festivosSub || 0) * festivoPriceSub);

      const splitLess4PriceCon = monthYearPluses['Jornada Fraccionada < 4h']?.value || 0;
      const splitLess4PriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Jornada Fraccionada < 4h', isSub) ?? splitLess4PriceCon;
      const splitLess4Val = (monthStats.splitLess4 * splitLess4PriceCon) + ((monthStats.splitLess4Sub || 0) * splitLess4PriceSub);

      const split4to7PriceCon = monthYearPluses['Jornada Fraccionada >= 4h']?.value || 0;
      const split4to7PriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Jornada Fraccionada >= 4h', isSub) ?? split4to7PriceCon;
      const split4to7Val = (monthStats.split4to7 * split4to7PriceCon) + ((monthStats.split4to7Sub || 0) * split4to7PriceSub);

      const splitPlus7PriceCon = monthYearPluses['Jornada Fraccionada >= 7h']?.value || 0;
      const splitPlus7PriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Jornada Fraccionada >= 7h', isSub) ?? splitPlus7PriceCon;
      const splitPlus7Val = (monthStats.splitPlus7 * splitPlus7PriceCon) + ((monthStats.splitPlus7Sub || 0) * splitPlus7PriceSub);

      const manutencionPriceCon = monthYearPluses['Manutención']?.value || 0;
      const manutencionPriceSub = getEffectiveSubPlusPrice(monthYearPluses, 'Manutención', isSub) ?? manutencionPriceCon;
      const manutencionVal = (monthStats.manutencion * manutencionPriceCon) + ((monthStats.manutencionSub || 0) * manutencionPriceSub);

      const hasShiftsInMonth = monthStats.totalHours > 0 || monthShiftsExtended.some(s => s.shifts && s.shifts.some(sh => sh.start && sh.end));
      const isTransportSubMonthly = isSub && !!monthYearPluses['Transporte SUB']?.enabled;
      const transportVal = isTransportSubMonthly
        ? (hasShiftsInMonth ? monthYearPluses['Transporte SUB'].value : 0)
        : (monthStats.transport * (monthYearPluses['Transporte']?.value || 0));

      const transportQty = isTransportSubMonthly
        ? (hasShiftsInMonth ? 1 : 0)
        : monthStats.transport;

        const jIrregDiariaPlus = monthYearPluses['Jornada Irregular Diaria'];
        const jIrregDiariaVal = (jIrregDiariaPlus?.enabled) ? (monthStats.transport * (jIrregDiariaPlus.value || 0)) : 0;

        const monthPluses = [
          { name: 'Horas Nocturnas', qty: monthStats.nightHours + (monthStats.nightHoursSub || 0), unit: 'h', price: nightPriceCon, total: nightVal },
          { name: 'Madrugues', qty: monthStats.madrugues + (monthStats.madruguesSub || 0), unit: 'u', price: madruguePriceCon, total: madrugueVal },
          { name: 'Domingos Trabajados', qty: monthStats.sundays + (monthStats.sundaysSub || 0), unit: 'u', price: sundayPriceCon, total: sundayVal },
          { name: 'Festivos Trabajados', qty: monthStats.festivos + (monthStats.festivosSub || 0), unit: 'u', price: festivoPriceCon, total: festivoVal },
          { name: 'Fraccionada < 4h', qty: monthStats.splitLess4 + (monthStats.splitLess4Sub || 0), unit: 'u', price: splitLess4PriceCon, total: splitLess4Val },
          { name: 'Fraccionada 4h - 7h', qty: monthStats.split4to7 + (monthStats.split4to7Sub || 0), unit: 'u', price: split4to7PriceCon, total: split4to7Val },
          { name: 'Fraccionada >= 7h', qty: monthStats.splitPlus7 + (monthStats.splitPlus7Sub || 0), unit: 'u', price: splitPlus7PriceCon, total: splitPlus7Val },
          { name: isTransportSubMonthly ? 'Plus Transporte SUB' : 'Plus Transporte', qty: transportQty, unit: isTransportSubMonthly ? 'mes' : 'días', price: isTransportSubMonthly ? (monthYearPluses['Transporte SUB']?.value || 0) : (monthYearPluses['Transporte']?.value || 0), total: transportVal },
          ...(jIrregDiariaPlus?.enabled ? [{ name: 'J. Irreg. Diaria', qty: monthStats.transport, unit: 'días', price: jIrregDiariaPlus.value || 0, total: jIrregDiariaVal }] : []),
          { name: 'Manutención', qty: monthStats.manutencion + (monthStats.manutencionSub || 0), unit: 'u', price: manutencionPriceCon, total: manutencionVal },
        ].filter(p => p.qty > 0 || p.total > 0);

      const totalMonthPluses = monthPluses.reduce((sum, p) => sum + p.total, 0);

      // 2. Detalle de turnos del mes
      let monthOrdHours = 0;
      let monthExtraHours = 0;

      const monthShiftsDetails = actualShiftsThisMonth
        .filter(s => {
          const hasReg = (s.shifts || []).some((sh: any) => sh.start && sh.end);
          const hasExtra = (s.extraShifts || []).some((sh: any) => sh.start && sh.end);
          const isSpecial = s.type === 'Vacaciones' || s.type === 'Baja IT' || s.type === 'Ausencia Justificada' || s.type === 'A Compensar' || s.type === 'Cambio de función';
          return hasReg || hasExtra || isSpecial;
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(s => {
          const regTimes = (s.shifts || []).filter((sh: any) => sh.start && sh.end).map((sh: any) => `${sh.start}-${sh.end}`).join(', ');
          const extTimes = (s.extraShifts || []).filter((sh: any) => sh.start && sh.end).map((sh: any) => `Ext:${sh.start}-${sh.end}`).join(', ');
          const times = [regTimes, extTimes].filter(Boolean).join(' | ');
          
          let ordHours = 0;
          (s.shifts || []).forEach((sh: any) => {
            if (sh.start && sh.end) ordHours += getShiftDuration(sh.start, sh.end);
          });
          let extraHours = 0;
          (s.extraShifts || []).forEach((sh: any) => {
            if (sh.start && sh.end) extraHours += getShiftDuration(sh.start, sh.end);
          });

          monthOrdHours += ordHours;
          monthExtraHours += extraHours;
          const totalHours = ordHours + extraHours;

          return {
            date: s.date,
            day: parseISO(s.date).getDate(),
            type: s.type || 'Laboral',
            schedule: times || (s.type !== 'Laboral' ? s.type : 'Turno'),
            ordHours,
            extraHours,
            totalHours,
            hours: totalHours,
          };
        });

      // 3. Find saved payrolls for this month
      const rawPayrollsForMonth = (settings.savedPayrolls || []).filter(
        (p: SavedPayroll) => p.monthKey === monthKey || p.monthKey.startsWith(`${monthKey}-`)
      );

      // Separate regular monthly payroll and extra payrolls using semantic detection
      const regularPayrolls = rawPayrollsForMonth.filter(p => isRegularPayroll(p));
      const extraPayrolls = rawPayrollsForMonth.filter(p => isExtraPayroll(p));

      // Sort so regular monthly payroll is ALWAYS first, followed by extra payrolls
      const savedPayrollsForMonth = [...regularPayrolls, ...extraPayrolls];

      const uploadedForMonth = (settings.uploadedPayrolls || []).find(
        (p: any) => p.monthKey === monthKey
      );

      const hasSaved = savedPayrollsForMonth.length > 0 || !!uploadedForMonth;
      if (hasSaved) savedPayrollsCount++;

      let grossSalary = 0;
      let totalDeductions = 0;
      let netSalary = 0;
      let baseCotizacion = 0;
      let irpfRate: number | null = null;
      let payrollType = 'Sin nómina';

      if (savedPayrollsForMonth.length > 0) {
        savedPayrollsForMonth.forEach((p: SavedPayroll) => {
          grossSalary += p.totals?.totalDevengado || 0;
          totalDeductions += p.totals?.totalDeducciones || 0;
          netSalary += p.totals?.liquido || 0;
          baseCotizacion += p.totals?.baseCotizacion || 0;
          if (p.settings?.irpf !== undefined) irpfRate = p.settings.irpf;
        });
        payrollType = (regularPayrolls.length > 0 && extraPayrolls.length > 0)
          ? `Nómina + Extra (${savedPayrollsForMonth.length})` 
          : (regularPayrolls.length > 0 ? 'Nómina Mensual' : 'Paga Extra');
      } else if (uploadedForMonth) {
        grossSalary = uploadedForMonth.data?.totalDevengados || 0;
        totalDeductions = uploadedForMonth.data?.totalDeducciones || 0;
        netSalary = uploadedForMonth.data?.liquido || 0;
        payrollType = 'Subida (PDF)';
      }

      totWorkedHours += monthStats.totalHours;
      totComputedHours += monthStats.monthlyHours;
      totGross += grossSalary;
      totDeductions += totalDeductions;
      totNet += netSalary;
      totWorkDays += workDaysCount;

      months.push({
        monthIndex: m,
        monthName: MONTH_NAMES[m],
        shortName: MONTH_SHORT[m],
        monthKey,
        workedHours: monthStats.totalHours,
        totalOrdHours: monthOrdHours,
        totalExtraHours: monthExtraHours,
        computedHours: monthStats.monthlyHours,
        effectivePercentage: monthStats.effectivePercentage,
        workDaysCount,
        vacationDaysCount,
        bajaDaysCount,
        hasSavedPayroll: hasSaved,
        payrollType,
        grossSalary,
        totalDeductions,
        netSalary,
        baseCotizacion,
        irpfRate,
        regularPayroll: regularPayrolls[0] || null,
        extraPayrolls: extraPayrolls,
        savedPayrolls: savedPayrollsForMonth,
        uploadedPayroll: uploadedForMonth,
        monthPluses,
        totalMonthPluses,
        monthShiftsDetails,
      });
    }

    const avgPercentage = (totWorkedHours / 1712) * 100;
    const totPluses = months.reduce((sum, m) => sum + m.totalMonthPluses, 0);
    const totOrdHours = months.reduce((sum, m) => sum + m.totalOrdHours, 0);
    const totExtraHours = months.reduce((sum, m) => sum + m.totalExtraHours, 0);

    return {
      months,
      totals: {
        totWorkedHours,
        totOrdHours,
        totExtraHours,
        totComputedHours,
        avgPercentage,
        totGross,
        totDeductions,
        totDeducciones: totDeductions,
        totNet,
        totWorkDays,
        savedPayrollsCount,
        totPluses,
      }
    };
  }, [selectedYear, shifts, settings, pluses, getStatsForShifts]);

  const handleDownloadAnnualSummaryPdf = async (payrollSource: 'saved' | 'calculated' = 'saved') => {
    setIsDownloadChoiceModalOpen(false);
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const isCalculatedMode = payrollSource === 'calculated';

      const reportMonths = annualMonthsData.months.map((m) => {
        if (!isCalculatedMode) return m;
        const sim = computeSimulatedPayrollsForMonth(new Date(selectedYear, m.monthIndex, 1), {
          settings,
          shifts,
          levels,
          pluses
        });
        let simGross = 0;
        let simDeductions = 0;
        let simNet = 0;
        let simBase = 0;
        sim.allPayrolls.forEach((sp) => {
          simGross += sp.totals?.totalDevengado || 0;
          simDeductions += sp.totals?.totalDeducciones || 0;
          simNet += sp.totals?.liquido || 0;
          simBase += sp.totals?.baseCotizacion || 0;
        });
        return {
          ...m,
          hasSavedPayroll: true,
          payrollType: sim.extraPayroll ? 'Nómina + Extra (Calc.)' : 'Nómina Mensual (Calc.)',
          grossSalary: Math.round(simGross * 100) / 100,
          totalDeductions: Math.round(simDeductions * 100) / 100,
          netSalary: Math.round(simNet * 100) / 100,
          baseCotizacion: Math.round(simBase * 100) / 100,
          regularPayroll: sim.regularPayroll,
          extraPayrolls: sim.extraPayroll ? [sim.extraPayroll] : [],
          savedPayrolls: sim.allPayrolls,
          uploadedPayroll: null,
        };
      });

      const reportTotals = isCalculatedMode
        ? {
            ...annualMonthsData.totals,
            totGross: Math.round(reportMonths.reduce((s, m) => s + m.grossSalary, 0) * 100) / 100,
            totDeductions: Math.round(reportMonths.reduce((s, m) => s + m.totalDeductions, 0) * 100) / 100,
            totDeducciones: Math.round(reportMonths.reduce((s, m) => s + m.totalDeductions, 0) * 100) / 100,
            totNet: Math.round(reportMonths.reduce((s, m) => s + m.netSalary, 0) * 100) / 100,
            savedPayrollsCount: 12,
          }
        : annualMonthsData.totals;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 12;
      const contentWidth = pageWidth - margin * 2; // 273 mm

      // ============================================================
      // PÁGINA 1: RESUMEN ANUAL CONSOLIDADO DEL EJERCICIO
      // ============================================================
      // 1. Header Banner
      doc.setFillColor(0, 78, 137); // Azul Blue #004e89
      doc.roundedRect(margin, margin, contentWidth, 22, 3, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('INFORME RESUMEN ANUAL DE TURNOS Y NÓMINAS', margin + 6, margin + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(224, 242, 254);
      const sourceSubtitle = isCalculatedMode
        ? 'Nóminas Calculadas (Sección Nómina)'
        : 'Nóminas Guardadas (Historial)';
      doc.text(`Ejercicio Anual ${selectedYear}  •  ${sourceSubtitle}  •  Convenio Colectivo de Contact Center`, margin + 6, margin + 15);

      // Top Right Info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`Contrato: ${settings.contractType || 'Completo'}  |  Nivel: ${settings.currentLevel || 1}  |  Pagas: ${settings.pagas || 12}`, pageWidth - margin - 6, margin + 8, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(224, 242, 254);
      const todayStr = safeFormat(new Date(), 'dd/MM/yyyy HH:mm');
      doc.text(`Fecha de emisión: ${todayStr}`, pageWidth - margin - 6, margin + 15, { align: 'right' });

      // 2. Executive KPI Summary Cards (6 KPIs)
      const kpiY = margin + 25;
      const kpiHeight = 15;
      const kpiGap = 3;
      const numKpis = 6;
      const kpiWidth = (contentWidth - kpiGap * (numKpis - 1)) / numKpis;

      const kpis = [
        { label: 'HORAS TRABAJADAS', val: `${formatNumber(reportTotals.totWorkedHours, 2)} h`, bg: [240, 249, 255], border: [186, 230, 253], text: [3, 105, 161] },
        { label: 'HORAS COMPUTADAS', val: `${formatNumber(reportTotals.totComputedHours, 2)} h`, bg: [245, 243, 255], border: [221, 214, 254], text: [109, 40, 217] },
        { label: 'MEDIA JORNADA', val: `${formatNumber(reportTotals.avgPercentage, 2)} %`, bg: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] },
        { label: 'TOTAL PLUSES', val: formatCurrency(reportTotals.totPluses), bg: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] },
        { label: 'TOTAL DEVENGADO', val: formatCurrency(reportTotals.totGross), bg: [255, 251, 235], border: [254, 240, 138], text: [180, 83, 9] },
        { label: 'LÍQUIDO PERCIBIDO', val: formatCurrency(reportTotals.totNet), bg: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] }
      ];

      kpis.forEach((kpi, idx) => {
        const x = margin + idx * (kpiWidth + kpiGap);
        doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
        doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, kpiY, kpiWidth, kpiHeight, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + kpiWidth / 2, kpiY + 4.8, { align: 'center' });

        doc.setFontSize(9.5);
        doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
        doc.text(kpi.val, x + kpiWidth / 2, kpiY + 11.5, { align: 'center' });
      });

      // 3. Table
      const tableY = kpiY + kpiHeight + 4.5;
      const rowHeight = 7.2;
      const headerHeight = 7.5;

      const cols = [
        { label: 'Mes', w: 26, align: 'left' as const },
        { label: 'Días Trab.', w: 18, align: 'center' as const },
        { label: 'Horas Trab.', w: 24, align: 'right' as const },
        { label: 'Horas Comp.', w: 24, align: 'right' as const },
        { label: '% Jornada', w: 20, align: 'center' as const },
        { label: 'Pluses (€)', w: 24, align: 'right' as const },
        { label: 'Devengos (Bruto)', w: 32, align: 'right' as const },
        { label: 'Deducciones', w: 27, align: 'right' as const },
        { label: 'Líquido (Neto)', w: 31, align: 'right' as const },
        { label: 'Base Cotiz.', w: 25, align: 'right' as const },
        { label: 'Estado', w: 22, align: 'center' as const }
      ];

      // Draw Table Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.roundedRect(margin, tableY, contentWidth, headerHeight, 1.5, 1.5, 'F');

      let currentX = margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(255, 255, 255);

      cols.forEach(col => {
        let textX = currentX + 2;
        if (col.align === 'right') textX = currentX + col.w - 2.5;
        else if (col.align === 'center') textX = currentX + col.w / 2;

        doc.text(col.label, textX, tableY + 5.2, { align: col.align });
        currentX += col.w;
      });

      // Draw Table Rows (12 months)
      reportMonths.forEach((m, idx) => {
        const rowY = tableY + headerHeight + idx * rowHeight;
        const isEven = idx % 2 === 0;

        if (isEven) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, rowY, contentWidth, rowHeight, 'F');
        } else {
          doc.setFillColor(255, 255, 255);
          doc.rect(margin, rowY, contentWidth, rowHeight, 'F');
        }

        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(margin, rowY + rowHeight, margin + contentWidth, rowY + rowHeight);

        let cellX = margin;
        const textY = rowY + 5;

        // Mes
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(30, 41, 59);
        doc.text(m.monthName, cellX + 2.5, textY);
        cellX += cols[0].w;

        // Días
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`${m.workDaysCount} d`, cellX + cols[1].w / 2, textY, { align: 'center' });
        cellX += cols[1].w;

        // Horas Trab.
        doc.setFont('helvetica', m.workedHours > 0 ? 'bold' : 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(`${formatNumber(m.workedHours, 2)} h`, cellX + cols[2].w - 2.5, textY, { align: 'right' });
        cellX += cols[2].w;

        // Horas Comp.
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(`${formatNumber(m.computedHours, 2)} h`, cellX + cols[3].w - 2.5, textY, { align: 'right' });
        cellX += cols[3].w;

        // % Jornada
        doc.setFont('helvetica', 'bold');
        if (m.effectivePercentage >= 95) doc.setTextColor(16, 185, 129);
        else if (m.effectivePercentage > 0) doc.setTextColor(2, 132, 199);
        else doc.setTextColor(148, 163, 184);
        doc.text(`${formatNumber(m.effectivePercentage, 2)} %`, cellX + cols[4].w / 2, textY, { align: 'center' });
        cellX += cols[4].w;

        // Pluses
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(m.totalMonthPluses > 0 ? 180 : 148, m.totalMonthPluses > 0 ? 83 : 163, m.totalMonthPluses > 0 ? 9 : 184);
        doc.text(m.totalMonthPluses > 0 ? formatCurrency(m.totalMonthPluses) : '-', cellX + cols[5].w - 2.5, textY, { align: 'right' });
        cellX += cols[5].w;

        // Devengos
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(m.hasSavedPayroll ? formatCurrency(m.grossSalary) : '-', cellX + cols[6].w - 2.5, textY, { align: 'right' });
        cellX += cols[6].w;

        // Deducciones
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(m.hasSavedPayroll ? formatCurrency(m.totalDeductions) : '-', cellX + cols[7].w - 2.5, textY, { align: 'right' });
        cellX += cols[7].w;

        // Líquido
        doc.setFont('helvetica', 'bold');
        if (m.hasSavedPayroll) {
          doc.setTextColor(16, 185, 129);
          doc.text(formatCurrency(m.netSalary), cellX + cols[8].w - 2.5, textY, { align: 'right' });
        } else {
          doc.setTextColor(148, 163, 184);
          doc.text('-', cellX + cols[8].w - 2.5, textY, { align: 'right' });
        }
        cellX += cols[8].w;

        // Base CC
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(m.hasSavedPayroll && m.baseCotizacion > 0 ? formatCurrency(m.baseCotizacion) : '-', cellX + cols[9].w - 2.5, textY, { align: 'right' });
        cellX += cols[9].w;

        // Estado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        if (isCalculatedMode) {
          doc.setTextColor(3, 105, 161);
          doc.text('EN NÓMINA', cellX + cols[10].w / 2, textY, { align: 'center' });
        } else if (m.hasSavedPayroll) {
          doc.setTextColor(21, 128, 61);
          doc.text('GUARDADA', cellX + cols[10].w / 2, textY, { align: 'center' });
        } else {
          doc.setTextColor(148, 163, 184);
          doc.text('PENDIENTE', cellX + cols[10].w / 2, textY, { align: 'center' });
        }
      });

      // Total Row
      const totalRowY = tableY + headerHeight + 12 * rowHeight;
      doc.setFillColor(224, 242, 254);
      doc.setDrawColor(186, 230, 253);
      doc.setLineWidth(0.4);
      doc.rect(margin, totalRowY, contentWidth, rowHeight + 0.5, 'FD');

      let tCellX = margin;
      const tTextY = totalRowY + 5.2;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(3, 105, 161);
      doc.text('TOTALES / PROMEDIOS', tCellX + 2.5, tTextY);
      tCellX += cols[0].w;

      doc.text(`${reportTotals.totWorkDays} d`, tCellX + cols[1].w / 2, tTextY, { align: 'center' });
      tCellX += cols[1].w;

      doc.text(`${formatNumber(reportTotals.totWorkedHours, 2)} h`, tCellX + cols[2].w - 2.5, tTextY, { align: 'right' });
      tCellX += cols[2].w;

      doc.text(`${formatNumber(reportTotals.totComputedHours, 2)} h`, tCellX + cols[3].w - 2.5, tTextY, { align: 'right' });
      tCellX += cols[3].w;

      doc.text(`${formatNumber(reportTotals.avgPercentage, 2)} %`, tCellX + cols[4].w / 2, tTextY, { align: 'center' });
      tCellX += cols[4].w;

      doc.text(formatCurrency(reportTotals.totPluses), tCellX + cols[5].w - 2.5, tTextY, { align: 'right' });
      tCellX += cols[5].w;

      doc.text(formatCurrency(reportTotals.totGross), tCellX + cols[6].w - 2.5, tTextY, { align: 'right' });
      tCellX += cols[6].w;

      doc.text(formatCurrency(reportTotals.totDeductions), tCellX + cols[7].w - 2.5, tTextY, { align: 'right' });
      tCellX += cols[7].w;

      doc.setTextColor(21, 128, 61);
      doc.text(formatCurrency(reportTotals.totNet), tCellX + cols[8].w - 2.5, tTextY, { align: 'right' });
      tCellX += cols[8].w;

      doc.setTextColor(3, 105, 161);
      doc.text('-', tCellX + cols[9].w - 2.5, tTextY, { align: 'right' });
      tCellX += cols[9].w;

      doc.text(isCalculatedMode ? '12/12 calc.' : `${reportTotals.savedPayrollsCount}/12 reg.`, tCellX + cols[10].w / 2, tTextY, { align: 'center' });

      // Footnotes
      const footY = totalRowY + rowHeight + 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text('* Cómputo de convenio: 1.712 horas anuales (155,63 h/mes base de referencia). Las horas computadas integran horas ordinarias trabajadas, vacaciones y compensadas.', margin + 2, footY);
      doc.text(
        isCalculatedMode
          ? '* A continuación se desglosan en hojas individuales los turnos realizados, los pluses generados y el recibo completo calculado en la sección "Nómina" de cada mes.'
          : '* A continuación se desglosan en hojas individuales los turnos realizados, los pluses generados y el recibo detallado de la nómina guardada de cada mes.',
        margin + 2,
        footY + 4
      );

      // ============================================================
      // PÁGINAS SIGUIENTES: DESGLOSE DETALLADO MES A MES (ENERO A DICIEMBRE)
      // ============================================================
      reportMonths.forEach((m) => {
        doc.addPage('a4', 'landscape');

        // Month Header Banner
        doc.setFillColor(15, 23, 42); // slate-900
        doc.roundedRect(margin, margin, contentWidth, 16, 2.5, 2.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(`${m.monthName.toUpperCase()} ${selectedYear}  —  DESGLOSE MENSUAL COMPLETO`, margin + 5, margin + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(203, 213, 225);
        doc.text(`Días Trab.: ${m.workDaysCount} d   |   Horas Realiz.: ${formatNumber(m.workedHours, 2)} h   |   Horas Comp.: ${formatNumber(m.computedHours, 2)} h   |   Jornada: ${formatNumber(m.effectivePercentage, 2)}%   |   Vacaciones: ${m.vacationDaysCount} d   |   Baja IT: ${m.bajaDaysCount} d`, margin + 5, margin + 12.5);

        // Status pill on the right
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        if (isCalculatedMode) {
          doc.setFillColor(2, 132, 199);
          doc.roundedRect(pageWidth - margin - 42, margin + 4.5, 38, 7, 1.5, 1.5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text('NÓMINA CALCULADA', pageWidth - margin - 23, margin + 9.2, { align: 'center' });
        } else if (m.hasSavedPayroll) {
          doc.setFillColor(16, 185, 129);
          doc.roundedRect(pageWidth - margin - 42, margin + 4.5, 38, 7, 1.5, 1.5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text('NÓMINA GUARDADA', pageWidth - margin - 23, margin + 9.2, { align: 'center' });
        } else {
          doc.setFillColor(100, 116, 139);
          doc.roundedRect(pageWidth - margin - 42, margin + 4.5, 38, 7, 1.5, 1.5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text('SIN NÓMINA FIJADA', pageWidth - margin - 23, margin + 9.2, { align: 'center' });
        }

        const colTopY = margin + 20;
        const colHeight = 168;

        // ----------------------------------------------------
        // COLUMNA 1: TURNOS REALIZADOS (Width 82 mm)
        // ----------------------------------------------------
        const c1X = margin;
        const c1W = 82;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(c1X, colTopY, c1W, colHeight, 2, 2, 'FD');

        // Col 1 Header
        doc.setFillColor(0, 78, 137);
        doc.roundedRect(c1X, colTopY, c1W, 7, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text('1. TURNOS Y HORAS (ORD. Y EXTRAS)', c1X + 3, colTopY + 4.8);

        // Turnos stats mini-bar
        doc.setFillColor(238, 242, 255);
        doc.rect(c1X, colTopY + 7, c1W, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.0);
        doc.setTextColor(67, 56, 202);
        doc.text(`${formatNumber(m.workedHours, 2)} h (${formatNumber(m.totalOrdHours, 1)}h ord. + ${formatNumber(m.totalExtraHours, 1)}h ext.)  •  ${m.workDaysCount} d. efect.`, c1X + 2.5, colTopY + 12.3);

        // Turnos list
        let shiftY = colTopY + 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.8);
        doc.setTextColor(100, 116, 139);
        doc.text('Día', c1X + 2, shiftY);
        doc.text('Tipo', c1X + 11, shiftY);
        doc.text('Horario / Turno', c1X + 26, shiftY);
        doc.text('Horas (Ord. + Ext.)', c1X + c1W - 2, shiftY, { align: 'right' });

        doc.setDrawColor(203, 213, 225);
        doc.line(c1X + 2, shiftY + 1.2, c1X + c1W - 2, shiftY + 1.2);
        shiftY += 4.2;

        if (m.monthShiftsDetails.length > 0) {
          m.monthShiftsDetails.forEach((sh: any) => {
            if (shiftY > colTopY + colHeight - 4) return;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.6);
            doc.setTextColor(15, 23, 42);
            doc.text(`Día ${String(sh.day).padStart(2, '0')}`, c1X + 2, shiftY);

            doc.setFont('helvetica', 'normal');
            if (sh.type === 'Vacaciones') doc.setTextColor(16, 185, 129);
            else if (sh.type === 'Baja IT') doc.setTextColor(239, 68, 68);
            else if (sh.type === 'Ausencia Justificada') doc.setTextColor(245, 158, 11);
            else if (sh.type === 'A Compensar') doc.setTextColor(147, 51, 234);
            else if (sh.type === 'Cambio de función') doc.setTextColor(255, 0, 127);
            else doc.setTextColor(71, 85, 105);
            doc.text(sh.type.substring(0, 8), c1X + 11, shiftY);

            doc.setTextColor(30, 41, 59);
            doc.text(sh.schedule.substring(0, 16), c1X + 26, shiftY);

            doc.setFont('helvetica', 'bold');
            if (sh.ordHours > 0 && sh.extraHours > 0) {
              doc.setTextColor(180, 83, 9);
              doc.text(`${formatNumber(sh.ordHours, 1)}h + ${formatNumber(sh.extraHours, 1)}h ext`, c1X + c1W - 2, shiftY, { align: 'right' });
            } else if (sh.extraHours > 0) {
              doc.setTextColor(217, 119, 6);
              doc.text(`${formatNumber(sh.extraHours, 1)}h extra`, c1X + c1W - 2, shiftY, { align: 'right' });
            } else if (sh.ordHours > 0) {
              doc.setTextColor(15, 23, 42);
              doc.text(`${formatNumber(sh.ordHours, 1)}h`, c1X + c1W - 2, shiftY, { align: 'right' });
            } else {
              doc.setTextColor(148, 163, 184);
              doc.text('-', c1X + c1W - 2, shiftY, { align: 'right' });
            }

            shiftY += 4.0;
          });
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text('Sin turnos registrados este mes', c1X + 4, shiftY + 4);
        }

        // ----------------------------------------------------
        // COLUMNA 2: PLUSES GENERADOS (Width 74 mm)
        // ----------------------------------------------------
        const c2X = c1X + c1W + 3.5;
        const c2W = 74;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(c2X, colTopY, c2W, colHeight, 2, 2, 'FD');

        // Col 2 Header
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(c2X, colTopY, c2W, 7, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text('2. PLUSES GENERADOS EN EL MES', c2X + 3, colTopY + 4.8);

        // Pluses Table Header
        let plusY = colTopY + 11.5;
        doc.setFillColor(241, 245, 249);
        doc.rect(c2X, plusY - 3.5, c2W, 5.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.0);
        doc.setTextColor(100, 116, 139);
        doc.text('Concepto', c2X + 3, plusY);
        doc.text('Cant.', c2X + 38, plusY, { align: 'right' });
        doc.text('Precio', c2X + 54, plusY, { align: 'right' });
        doc.text('Total (€)', c2X + c2W - 3, plusY, { align: 'right' });

        plusY += 5;

        if (m.monthPluses.length > 0) {
          m.monthPluses.forEach((p: any, pIdx: number) => {
            const isPRep = pIdx % 2 === 0;
            if (isPRep) {
              doc.setFillColor(255, 255, 255);
              doc.rect(c2X, plusY - 3.5, c2W, 5, 'F');
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.8);
            doc.setTextColor(30, 41, 59);
            doc.text(p.name.substring(0, 22), c2X + 3, plusY);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(`${formatNumber(p.qty, 1)} ${p.unit}`, c2X + 38, plusY, { align: 'right' });
            doc.text(formatCurrency(p.price), c2X + 54, plusY, { align: 'right' });

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(formatCurrency(p.total), c2X + c2W - 3, plusY, { align: 'right' });

            plusY += 5;
          });

          // Pluses Total Row
          doc.setFillColor(254, 243, 199);
          doc.rect(c2X, plusY - 3, c2W, 6.5, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(180, 83, 9);
          doc.text('TOTAL VARIABLES DEL MES', c2X + 3, plusY + 1.5);
          doc.text(formatCurrency(m.totalMonthPluses), c2X + c2W - 3, plusY + 1.5, { align: 'right' });
          plusY += 8;
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.8);
          doc.setTextColor(148, 163, 184);
          doc.text('Sin pluses variables devengados este mes', c2X + 4, plusY + 3);
          plusY += 12;
        }

        // Mini Card: Cómputo de Horas y Días del Mes
        const statsBoxY = colTopY + colHeight - 34;
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(c2X + 2, statsBoxY, c2W - 4, 30, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(71, 85, 105);
        doc.text('CÓMPUTO HORARIO Y JORNADA', c2X + 4, statsBoxY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• Horas Ordinarias: ${formatNumber(m.totalOrdHours, 2)} h`, c2X + 4, statsBoxY + 10.5);
        doc.text(`• Horas Extras: ${formatNumber(m.totalExtraHours, 2)} h`, c2X + 4, statsBoxY + 15);
        doc.text(`• Total Horas Trabajadas: ${formatNumber(m.workedHours, 2)} h`, c2X + 4, statsBoxY + 19.5);
        doc.text(`• % Jornada de Convenio: ${formatNumber(m.effectivePercentage, 2)}%`, c2X + 4, statsBoxY + 24);

        // ----------------------------------------------------
        // COLUMNA 3: NÓMINA GUARDADA DETALLADA (Width 110 mm)
        // ----------------------------------------------------
        const c3X = c2X + c2W + 3.5;
        const c3W = 110;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(c3X, colTopY, c3W, colHeight, 2, 2, 'FD');

        // Col 3 Header
        doc.setFillColor(6, 95, 70); // emerald-800
        doc.roundedRect(c3X, colTopY, c3W, 7, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(
          isCalculatedMode ? '3. NÓMINA MENSUAL (SECCIÓN NÓMINA)' : '3. NÓMINA GUARDADA DETALLADA',
          c3X + 3,
          colTopY + 4.8
        );

        const mainPayrollToDisplay: SavedPayroll | null = m.regularPayroll || (m.savedPayrolls && m.savedPayrolls.length > 0 ? (m.savedPayrolls.find((p: SavedPayroll) => isRegularPayroll(p)) || m.savedPayrolls[0]) : null);

        if (mainPayrollToDisplay) {
          const sp: SavedPayroll = mainPayrollToDisplay;

          // Subheader with save date or calculation source
          doc.setFillColor(236, 253, 245);
          doc.rect(c3X, colTopY + 7, c3W, 6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.2);
          doc.setTextColor(6, 95, 70);
          const payTitle = isExtraPayroll(sp) ? 'PAGA EXTRAORDINARIA' : 'NÓMINA MENSUAL';
          const receiptMeta = isCalculatedMode
            ? `Recibo: ${payTitle}  •  Calculada en sección Nómina`
            : `Recibo: ${payTitle}  •  Guardada: ${safeFormat(parseISO(sp.saveDate), 'dd/MM/yyyy')}`;
          doc.text(receiptMeta, c3X + 3, colTopY + 11.2);

          let payY = colTopY + 16.5;

          // Devengos Section
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(15, 23, 42);
          doc.text('DEVENGOS (INGRESOS BRUTOS)', c3X + 3, payY);
          payY += 3.5;

          doc.setFillColor(241, 245, 249);
          doc.rect(c3X + 1, payY - 2.8, c3W - 2, 4.2, 'F');
          doc.setFontSize(5.8);
          doc.setTextColor(100, 116, 139);
          doc.text('Concepto', c3X + 3, payY);
          doc.text('Unid.', c3X + 62, payY, { align: 'right' });
          doc.text('Precio', c3X + 82, payY, { align: 'right' });
          doc.text('Total (€)', c3X + c3W - 4, payY, { align: 'right' });
          payY += 3.8;

          const activeDevengos = (sp.devengos || []).filter(d => d.value !== 0 || d.isProrrata);
          activeDevengos.forEach((d) => {
            if (payY > colTopY + 95) return;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.7);
            doc.setTextColor(d.isProrrata ? 100 : 30, d.isProrrata ? 116 : 41, d.isProrrata ? 139 : 59);
            doc.text(d.name.substring(0, 34), c3X + 3, payY);
            doc.setTextColor(71, 85, 105);
            const qtyFormatted = typeof d.qty === 'number'
              ? formatNumber(d.qty, 2).replace(/,00$/, '')
              : String(d.qty ?? 1);
            doc.text(qtyFormatted, c3X + 62, payY, { align: 'right' });
            doc.text(formatCurrency(d.price), c3X + 82, payY, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(d.isProrrata ? 148 : 15, d.isProrrata ? 163 : 23, d.isProrrata ? 184 : 42);
            doc.text(formatCurrency(d.value), c3X + c3W - 4, payY, { align: 'right' });
            payY += 3.5;
          });

          // Devengos Total
          doc.setFillColor(254, 243, 199);
          doc.rect(c3X + 1, payY - 2.4, c3W - 2, 4.6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.0);
          doc.setTextColor(180, 83, 9);
          doc.text('TOTAL DEVENGADO (BRUTO)', c3X + 3, payY + 0.8);
          doc.text(formatCurrency(sp.totals?.totalDevengado || 0), c3X + c3W - 4, payY + 0.8, { align: 'right' });
          payY += 6.2;

          // Conceptos a Descontar (if any)
          const activeConceptosDescontar = (sp.conceptosADescontar || []).filter(cad => cad.value !== 0);
          if (activeConceptosDescontar.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.2);
            doc.setTextColor(185, 28, 28);
            doc.text('CONCEPTOS A DESCONTAR', c3X + 3, payY);
            payY += 3.5;

            activeConceptosDescontar.forEach((cad) => {
              if (payY > colTopY + 115) return;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(5.7);
              doc.setTextColor(30, 41, 59);
              doc.text(cad.name.substring(0, 34), c3X + 3, payY);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(185, 28, 28);
              doc.text(formatCurrency(cad.value), c3X + c3W - 4, payY, { align: 'right' });
              payY += 3.5;
            });
            payY += 2;
          }

          // Deducciones Section
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(15, 23, 42);
          doc.text('DEDUCCIONES (SEGURIDAD SOCIAL E IRPF)', c3X + 3, payY);
          payY += 3.5;

          doc.setFillColor(241, 245, 249);
          doc.rect(c3X + 1, payY - 2.8, c3W - 2, 4.2, 'F');
          doc.setFontSize(5.8);
          doc.setTextColor(100, 116, 139);
          doc.text('Concepto', c3X + 3, payY);
          doc.text('Base (€)', c3X + 62, payY, { align: 'right' });
          doc.text('Tipo %', c3X + 82, payY, { align: 'right' });
          doc.text('Total (€)', c3X + c3W - 4, payY, { align: 'right' });
          payY += 3.8;

          (sp.deducciones || []).forEach((ded) => {
            if (payY > colTopY + colHeight - 22) return;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.7);
            doc.setTextColor(30, 41, 59);
            doc.text(ded.name.substring(0, 34), c3X + 3, payY);
            doc.setTextColor(71, 85, 105);
            doc.text(formatCurrency(ded.base), c3X + 62, payY, { align: 'right' });
            doc.text(`${formatNumber(ded.rate, 2)}%`, c3X + 82, payY, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text(formatCurrency(ded.value), c3X + c3W - 4, payY, { align: 'right' });
            payY += 3.5;
          });

          // Deducciones Total
          doc.setFillColor(241, 245, 249);
          doc.rect(c3X + 1, payY - 2.4, c3W - 2, 4.6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.0);
          doc.setTextColor(71, 85, 105);
          doc.text('TOTAL DEDUCCIONES', c3X + 3, payY + 0.8);
          doc.text(formatCurrency(sp.totals?.totalDeducciones || 0), c3X + c3W - 4, payY + 0.8, { align: 'right' });

          // Summary box at bottom
          const boxBottomY = colTopY + colHeight - 17;
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(187, 247, 208);
          doc.roundedRect(c3X + 2, boxBottomY, c3W - 4, 14, 2, 2, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          doc.setTextColor(71, 85, 105);
          doc.text(`Base Cotización CC: ${formatCurrency(sp.totals?.baseCotizacion || 0)}  |  IRPF: ${sp.settings?.irpf || 0}%`, c3X + 4, boxBottomY + 4.5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(21, 128, 61);
          doc.text('LÍQUIDO A PERCIBIR (NETO):', c3X + 4, boxBottomY + 10.5);
          doc.text(formatCurrency(sp.totals?.liquido || 0), c3X + c3W - 5, boxBottomY + 10.5, { align: 'right' });
        } else if (m.uploadedPayroll) {
          // Uploaded payroll data
          let upY = colTopY + 12;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(6, 95, 70);
          doc.text('Nómina subida por documento oficial (PDF)', c3X + 3, upY);
          upY += 8;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(30, 41, 59);
          doc.text(`Total Devengados: ${formatCurrency(m.grossSalary)}`, c3X + 3, upY);
          upY += 5;
          doc.text(`Total Deducciones: ${formatCurrency(m.totalDeductions)}`, c3X + 3, upY);
          upY += 7;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(21, 128, 61);
          doc.text(`Líquido Neto: ${formatCurrency(m.netSalary)}`, c3X + 3, upY);
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Sin nómina guardada fijada para este mes en la aplicación.', c3X + 4, colTopY + 15);
          doc.setFontSize(6.5);
          doc.text('Puedes calcular y guardar la nómina en la pestaña "Nómina".', c3X + 4, colTopY + 22);
        }

        // Si el mes tiene nóminas guardadas adicionales (ej. Paga Extra en Junio o Diciembre)
        const additionalPayrolls: SavedPayroll[] = (m.savedPayrolls || []).filter(
          (p: SavedPayroll) => p.id !== mainPayrollToDisplay?.id
        );

        if (additionalPayrolls.length > 0) {
          additionalPayrolls.forEach((extraSp: SavedPayroll) => {
            doc.addPage('a4', 'landscape');

            const isExtraType = isExtraPayroll(extraSp);
            const pageHeaderTitle = isExtraType
              ? `${m.monthName.toUpperCase()} ${selectedYear}  —  PAGA EXTRAORDINARIA ${isCalculatedMode ? '(SECCIÓN NÓMINA)' : 'GUARDADA'} (RECIBO DETALLADO)`
              : `${m.monthName.toUpperCase()} ${selectedYear}  —  NÓMINA ADICIONAL ${isCalculatedMode ? '(SECCIÓN NÓMINA)' : 'GUARDADA'} (RECIBO DETALLADO)`;
            const boxDevTitle = isExtraType
              ? 'DEVENGOS DE LA PAGA EXTRAORDINARIA'
              : 'DEVENGOS DE LA NÓMINA';
            const boxDedTitle = isExtraType
              ? 'DEDUCCIONES DE LA PAGA EXTRAORDINARIA'
              : 'DEDUCCIONES DE LA NÓMINA';
            const boxNetTitle = isExtraType
              ? 'LÍQUIDO A PERCIBIR PAGA EXTRA (NETO):'
              : 'LÍQUIDO A PERCIBIR (NETO):';
            const totalBrutoTitle = isExtraType
              ? 'TOTAL BRUTO PAGA EXTRA'
              : 'TOTAL DEVENGADO (BRUTO)';

            // Header Paga Extra / Nómina Adicional
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(margin, margin, contentWidth, 16, 2.5, 2.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(pageHeaderTitle, margin + 5, margin + 7);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(203, 213, 225);
            const extraMetaStr = isCalculatedMode
              ? `Recibo: ${isExtraType ? 'PAGA EXTRAORDINARIA' : 'NÓMINA'}  •  Calculada en sección Nómina  •  Nivel: ${extraSp.settings?.level || 1}  •  IRPF: ${extraSp.settings?.irpf || 0}%`
              : `Recibo: ${isExtraType ? 'PAGA EXTRAORDINARIA' : 'NÓMINA'}  •  Guardado el: ${safeFormat(parseISO(extraSp.saveDate), 'dd/MM/yyyy')}  •  Nivel: ${extraSp.settings?.level || 1}  •  IRPF: ${extraSp.settings?.irpf || 0}%`;
            doc.text(extraMetaStr, margin + 5, margin + 12.5);

            // Box Paga Extra / Nómina Adicional Content
            const extraColY = margin + 20;
            const extraBoxW = contentWidth;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, extraColY, extraBoxW, colHeight, 2, 2, 'FD');

            // Devengos (Left side)
            const exDevX = margin + 5;
            const exDevW = (extraBoxW - 15) / 2;
            doc.setFillColor(6, 95, 70);
            doc.roundedRect(exDevX, extraColY + 4, exDevW, 6.5, 1.5, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text(boxDevTitle, exDevX + 3, extraColY + 8.5);

            let exDevY = extraColY + 16;
            (extraSp.devengos || []).forEach((d) => {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.8);
              doc.setTextColor(30, 41, 59);
              doc.text(d.name, exDevX + 3, exDevY);
              doc.setFont('helvetica', 'bold');
              doc.text(formatCurrency(d.value), exDevX + exDevW - 4, exDevY, { align: 'right' });
              exDevY += 5.5;
            });

            if (extraSp.conceptosADescontar && extraSp.conceptosADescontar.length > 0) {
              extraSp.conceptosADescontar.forEach((cad) => {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.8);
                doc.setTextColor(185, 28, 28);
                doc.text(cad.name, exDevX + 3, exDevY);
                doc.setFont('helvetica', 'bold');
                doc.text(`-${formatCurrency(cad.value)}`, exDevX + exDevW - 4, exDevY, { align: 'right' });
                exDevY += 5.5;
              });
            }

            doc.setFillColor(254, 243, 199);
            doc.rect(exDevX, exDevY - 3, exDevW, 6.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.0);
            doc.setTextColor(180, 83, 9);
            doc.text(totalBrutoTitle, exDevX + 3, exDevY + 1.5);
            doc.text(formatCurrency(extraSp.totals?.totalDevengado || 0), exDevX + exDevW - 4, exDevY + 1.5, { align: 'right' });

            // Deducciones (Right side)
            const exDedX = exDevX + exDevW + 5;
            const exDedW = exDevW;
            doc.setFillColor(30, 41, 59);
            doc.roundedRect(exDedX, extraColY + 4, exDedW, 6.5, 1.5, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text(boxDedTitle, exDedX + 3, extraColY + 8.5);

            let exDedY = extraColY + 16;
            (extraSp.deducciones || []).forEach((ded) => {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.8);
              doc.setTextColor(30, 41, 59);
              doc.text(`${ded.name} (${formatNumber(ded.rate, 2)}%)`, exDedX + 3, exDedY);
              doc.setFont('helvetica', 'bold');
              doc.text(formatCurrency(ded.value), exDedX + exDedW - 4, exDedY, { align: 'right' });
              exDedY += 5.5;
            });

            doc.setFillColor(241, 245, 249);
            doc.rect(exDedX, exDedY - 3, exDedW, 6.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.0);
            doc.setTextColor(71, 85, 105);
            doc.text('TOTAL DEDUCCIONES', exDedX + 3, exDedY + 1.5);
            doc.text(formatCurrency(extraSp.totals?.totalDeducciones || 0), exDedX + exDedW - 4, exDedY + 1.5, { align: 'right' });

            // Bottom Net Banner for Paga Extra / Nómina Adicional
            const exNetY = extraColY + colHeight - 22;
            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(187, 247, 208);
            doc.roundedRect(margin + 5, exNetY, extraBoxW - 10, 16, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(21, 128, 61);
            doc.text(boxNetTitle, margin + 10, exNetY + 10.5);
            doc.text(formatCurrency(extraSp.totals?.liquido || 0), margin + extraBoxW - 15, exNetY + 10.5, { align: 'right' });
          });
        }
      });

      // Add page numbering to all pages
      const totalPages = typeof (doc.internal as any).getNumberOfPages === 'function' 
        ? (doc.internal as any).getNumberOfPages() 
        : ((doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : (doc.internal.pages ? doc.internal.pages.length - 1 : 1));
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('AI Studio Control Horario y Nómina  •  Informe Resumen Anual Oficial del Trabajador', margin + 2, pageHeight - 5.5);
        doc.text(`Página ${i} de ${totalPages}  •  Ejercicio ${selectedYear}`, pageWidth - margin - 2, pageHeight - 5.5, { align: 'right' });
      }

      doc.save(
        isCalculatedMode
          ? `Resumen_Anual_${selectedYear}_Nominas_Calculadas.pdf`
          : `Resumen_Anual_${selectedYear}_Completo_Turnos_Pluses_y_Nominas.pdf`
      );
      setDownloadSuccessMessage(
        isCalculatedMode
          ? `El informe PDF anual de ${selectedYear} con las nóminas calculadas de la sección Nómina se ha descargado correctamente.`
          : `El archivo PDF oficial del año ${selectedYear} con los turnos, horas ordinarias y extras, pluses y nóminas guardadas se ha descargado correctamente.`
      );
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => {
        setDownloadSuccessMessage(null);
      }, 6000);
    } catch (err) {
      console.error('Error generating annual summary PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="px-1 min-[360px]:px-1.5 sm:px-3 md:px-6 space-y-6 sm:space-y-10 pb-32 max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pt-4 sm:pt-6">

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPayroll && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6" data-modal-active="true">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPayroll(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-azul-blue text-white shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Wallet size={24} className="text-azul-yellow" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">
                      {isExtraPayroll(selectedPayroll) ? 'Paga Extra' : 'Nómina Mensual'}
                    </h3>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                      {safeFormat(new Date(parseInt(selectedPayroll.monthKey.split('-')[0]), parseInt(selectedPayroll.monthKey.split('-')[1]) - 1), 'MMMM yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPayroll(null)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1 opacity-70">Líquido a Percibir</span>
                    <span className="text-3xl font-black text-emerald-700 leading-none">{formatCurrency(selectedPayroll.totals.liquido)}</span>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Base Contingencias Comunes</span>
                    <span className="text-xl font-black text-slate-700 leading-none">{formatCurrency(selectedPayroll.totals.baseCotizacion ?? 0)}</span>
                  </div>
                </div>

                {/* Devengos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <History size={16} className="text-azul-blue" />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Devengos y Conceptos</h4>
                  </div>
                  <div className="bg-white border-2 border-slate-50 rounded-3xl overflow-hidden divide-y divide-slate-50">
                    {selectedPayroll.devengos.filter(d => d.value !== 0).map((d, i) => (
                      <div key={i} className="p-4 flex items-center justify-between bg-white">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{d.name}</span>
                          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase">
                            <span>{d.qty} uni.</span>
                            <span>•</span>
                            <span>{formatCurrency(d.price)}/u</span>
                          </div>
                        </div>
                        <span className={cn("text-sm font-black", d.isProrrata ? "text-slate-400 italic" : "text-slate-900")}>
                          {formatCurrency(d.value)}
                        </span>
                      </div>
                    ))}
                    {selectedPayroll.conceptosADescontar.filter(d => d.value !== 0).map((d, i) => (
                      <div key={`desc-${i}`} className="p-4 flex items-center justify-between bg-rose-50/30">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-rose-600 uppercase tracking-tight">{d.name}</span>
                          <span className="text-[9px] font-bold text-rose-400 uppercase">{d.qty} uni. • {formatCurrency(d.price)}/u</span>
                        </div>
                        <span className="text-sm font-black text-rose-600">{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deducciones */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <CreditCard size={16} className="text-rose-500" />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Deducciones e Impuestos</h4>
                  </div>
                  <div className="bg-white border-2 border-slate-50 rounded-3xl overflow-hidden divide-y divide-slate-50">
                    {selectedPayroll.deducciones.filter(d => d.value !== 0).map((d, i) => (
                      <div key={i} className="p-4 flex items-center justify-between bg-white">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{d.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Base: {formatCurrency(d.base)} • {d.rate}%</span>
                        </div>
                        <span className="text-sm font-black text-rose-500">-{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-white/50">Total Deducciones</span>
                      <span className="text-base font-black">-{formatCurrency(selectedPayroll.totals.totalDeducciones)}</span>
                    </div>
                  </div>
                </div>

                {/* Anotaciones */}
                {selectedPayroll.notes && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Edit2 size={16} className="text-amber-500" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Anotaciones de la Nómina</h4>
                    </div>
                    <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-5 text-sm font-bold text-amber-800 whitespace-pre-line shadow-sm">
                      {selectedPayroll.notes}
                    </div>
                  </div>
                )}

                {/* Settings Info */}
                <div className="p-4 bg-azul-blue/5 rounded-2xl border border-azul-blue/10 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-azul-blue/50 uppercase tracking-widest">Configuración Guardada</span>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-azul-blue uppercase mt-0.5">
                      <span>Nivel {selectedPayroll.settings.level}</span>
                      <span>•</span>
                      <span>{selectedPayroll.settings.contractType}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black text-azul-blue/50 uppercase tracking-widest">Fecha Guardado</span>
                    <p className="text-[10px] font-bold text-azul-blue uppercase mt-0.5">{safeFormat(parseISO(selectedPayroll.saveDate), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
              </div>

              {/* Sticky Footer with PDF Download Button */}
              <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedPayroll(null)}
                  className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => exportSinglePayrollPdf(selectedPayroll, { shifts, hideAmounts })}
                  className="px-5 py-3 rounded-2xl bg-azul-blue hover:bg-blue-800 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-azul-blue/25 transition-all active:scale-95 cursor-pointer"
                >
                  <Download size={16} />
                  <span>Descargar PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Annual Hours Line Chart Modal */}
      <AnimatePresence>
        {showHoursChartModal && (() => {
          const monthlyData = stats.current.monthlyHoursData || [];
          const maxHoursInYear = Math.max(...monthlyData.map(d => d.hours), 1);
          const gridMax = Math.max(Math.ceil(maxHoursInYear / 10) * 10, 20);

          const svgWidth = 640;
          const svgHeight = 220;
          const padLeft = 40;
          const padRight = 30;
          const padTop = 30;
          const padBottom = 35;
          const chartWidth = svgWidth - padLeft - padRight;
          const chartHeight = svgHeight - padTop - padBottom;

          const chartPoints = monthlyData.map((d, i) => {
            const x = padLeft + (i / 11) * chartWidth;
            const ratio = gridMax > 0 ? d.hours / gridMax : 0;
            const y = padTop + chartHeight - ratio * chartHeight;
            return { x, y, ...d };
          });

          const linePath = chartPoints.reduce((acc, p, i) => {
            if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
            const prev = chartPoints[i - 1];
            const cp1x = (prev.x + (p.x - prev.x) / 2).toFixed(1);
            const cp1y = prev.y.toFixed(1);
            const cp2x = (prev.x + (p.x - prev.x) / 2).toFixed(1);
            const cp2y = p.y.toFixed(1);
            return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          }, '');

          const areaPath = chartPoints.length > 0
            ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} L ${chartPoints[0].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} Z`
            : '';

          const activeMonthDetail = hoveredMonth || (chartPoints.length > 0 ? { monthName: chartPoints[0].monthName, hours: chartPoints[0].hours } : null);

          return (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6" data-modal-active="true">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setShowHoursChartModal(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-azul-blue text-white shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <BarChart3 size={24} className="text-azul-yellow" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">
                        Evolución Anual de Horas
                      </h3>
                      <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest flex items-center gap-2">
                        <span>Año {selectedYear}</span>
                        <span>•</span>
                        <span>Contrato Parcial</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowHoursChartModal(false)}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-3 gap-3">
                    <div id="total-anual-modal-box" className="bg-azul-blue/5 p-4 rounded-2xl border border-azul-blue/10 text-center dark:bg-azul-blue/20 dark:border-azul-blue/30">
                      <span className="text-[9px] font-black text-azul-blue dark:text-blue-300 uppercase tracking-widest block mb-1">Total Anual</span>
                      <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{formatNumber(stats.current.totalHours)}h</span>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 text-center">
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Promedio Mensual</span>
                      <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 leading-none">{formatNumber(stats.current.totalHours / 12)}h</span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/40 text-center">
                      <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">Mes Máximo</span>
                      <span className="text-xl font-black text-amber-700 dark:text-amber-300 leading-none">
                        {formatNumber(Math.max(...monthlyData.map(m => m.hours), 0))}h
                      </span>
                    </div>
                  </div>

                  {/* SVG Line Chart Box */}
                  <div id="chart-annual-hours-box" className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-3 relative dark:bg-azul-blue/20 dark:border-azul-blue/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-blue-300">Gráfico de Líneas de Horas por Mes</span>
                      <span className="chart-badge text-[10px] font-bold text-azul-blue dark:text-blue-200 uppercase tracking-widest bg-azul-blue/10 dark:bg-azul-blue/30 px-2.5 py-1 rounded-lg border border-transparent dark:border-azul-blue/40">
                        {activeMonthDetail ? `${activeMonthDetail.monthName}: ${formatNumber(activeMonthDetail.hours)}h` : 'Selecciona un mes'}
                      </span>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[480px]">
                        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
                          <defs>
                            <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          {[0, 0.333, 0.666, 1].map((ratio, idx) => {
                            const yVal = padTop + chartHeight * (1 - ratio);
                            const labelVal = Math.round(gridMax * ratio);
                            return (
                              <g key={idx}>
                                <line
                                  className="grid-line"
                                  x1={padLeft - 5}
                                  y1={yVal}
                                  x2={svgWidth - padRight + 5}
                                  y2={yVal}
                                  stroke="#cbd5e1"
                                  strokeDasharray="4 4"
                                  strokeWidth="1"
                                />
                                <text
                                  x={padLeft - 10}
                                  y={yVal + 3}
                                  textAnchor="end"
                                  fontSize="9"
                                  fontWeight="700"
                                  fill="#94a3b8"
                                >
                                  {labelVal}h
                                </text>
                              </g>
                            );
                          })}

                          {/* Area Path */}
                          {areaPath && <path d={areaPath} fill="url(#hoursGradient)" />}

                          {/* Line Path */}
                          {linePath && (
                            <path
                              className="chart-line"
                              d={linePath}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Data points */}
                          {chartPoints.map((p) => {
                            const isSelected = hoveredMonth?.monthName === p.monthName;
                            return (
                              <g
                                key={p.monthIndex}
                                className="cursor-pointer group"
                                onMouseEnter={() => setHoveredMonth({ monthName: p.monthName, hours: p.hours })}
                                onMouseLeave={() => setHoveredMonth(null)}
                                onClick={() => setHoveredMonth({ monthName: p.monthName, hours: p.hours })}
                              >
                                {isSelected && (
                                  <line
                                    x1={p.x}
                                    y1={padTop}
                                    x2={p.x}
                                    y2={padTop + chartHeight}
                                    stroke="#2563eb"
                                    strokeOpacity="0.4"
                                    strokeWidth="1.5"
                                    strokeDasharray="3 3"
                                  />
                                )}

                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isSelected ? "7" : "4.5"}
                                  fill="#ffffff"
                                  stroke="#2563eb"
                                  strokeWidth={isSelected ? "3.5" : "2.5"}
                                  className="data-point transition-all duration-200"
                                />

                                {p.hours > 0 && (
                                  <text
                                    x={p.x}
                                    y={p.y - 10}
                                    textAnchor="middle"
                                    fontSize={isSelected ? "11" : "9"}
                                    fontWeight="800"
                                    fill={isSelected ? "#1d4ed8" : "#334155"}
                                    className={cn("transition-all duration-200", isSelected && "text-selected")}
                                  >
                                    {formatNumber(p.hours)}
                                  </text>
                                )}

                                <text
                                  x={p.x}
                                  y={svgHeight - 10}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fontWeight={isSelected ? "800" : "700"}
                                  fill={isSelected ? "#1d4ed8" : "#64748b"}
                                  className={cn("transition-all duration-200", isSelected && "text-selected")}
                                >
                                  {p.shortName}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Monthly List Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest px-1">Detalle por Mes</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {monthlyData.map((m) => (
                        <div 
                          key={m.monthIndex} 
                          onMouseEnter={() => setHoveredMonth({ monthName: m.monthName, hours: m.hours })}
                          onMouseLeave={() => setHoveredMonth(null)}
                          onClick={() => setHoveredMonth({ monthName: m.monthName, hours: m.hours })}
                          className={cn(
                            "p-3 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer select-none",
                            hoveredMonth?.monthName === m.monthName 
                              ? "bg-azul-blue/10 border-azul-blue ring-2 ring-azul-blue/20" 
                              : m.hours > 0 
                                ? "bg-white border-slate-200 hover:border-azul-blue/40 hover:bg-azul-blue/5" 
                                : "bg-slate-50 border-slate-100 text-slate-400"
                          )}
                        >
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{m.monthName}</span>
                          <span className={cn("text-base font-black tracking-tight mt-1", m.hours > 0 ? "text-slate-800" : "text-slate-300")}>
                            {formatNumber(m.hours)} <span className="text-[10px] font-bold text-slate-400">h</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Annual % Jornada Line Chart Modal */}
      <AnimatePresence>
        {showPercentageChartModal && (() => {
          const monthlyData = stats.current.monthlyHoursData || [];
          const maxPctInYear = Math.max(...monthlyData.map(d => d.effectivePercentage), 0);
          const gridMax = Math.max(Math.ceil(maxPctInYear / 10) * 10, 100);
          const activeMonths = monthlyData.filter(m => m.effectivePercentage > 0);
          const activeMonthlyAvg = activeMonths.length > 0
            ? activeMonths.reduce((acc, m) => acc + m.effectivePercentage, 0) / activeMonths.length
            : 0;

          const svgWidth = 640;
          const svgHeight = 220;
          const padLeft = 44;
          const padRight = 30;
          const padTop = 30;
          const padBottom = 35;
          const chartWidth = svgWidth - padLeft - padRight;
          const chartHeight = svgHeight - padTop - padBottom;

          const chartPoints = monthlyData.map((d, i) => {
            const x = padLeft + (i / 11) * chartWidth;
            const ratio = gridMax > 0 ? d.effectivePercentage / gridMax : 0;
            const y = padTop + chartHeight - ratio * chartHeight;
            return { x, y, ...d };
          });

          const linePath = chartPoints.reduce((acc, p, i) => {
            if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
            const prev = chartPoints[i - 1];
            const cp1x = (prev.x + (p.x - prev.x) / 2).toFixed(1);
            const cp1y = prev.y.toFixed(1);
            const cp2x = (prev.x + (p.x - prev.x) / 2).toFixed(1);
            const cp2y = p.y.toFixed(1);
            return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          }, '');

          const areaPath = chartPoints.length > 0
            ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} L ${chartPoints[0].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} Z`
            : '';

          const activeMonthDetail = hoveredPercentageMonth || (chartPoints.length > 0
            ? { monthName: chartPoints[0].monthName, percentage: chartPoints[0].effectivePercentage }
            : null);

          const gridRatios = gridMax === 100 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.333, 0.666, 1];

          return (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6" data-modal-active="true">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPercentageChartModal(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/80 dark:border-slate-800"
              >
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-600 text-white shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <BarChart3 size={24} className="text-emerald-100" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">
                        Evolución Anual de % Jornada
                      </h3>
                      <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest flex items-center gap-2">
                        <span>Año {selectedYear}</span>
                        <span>•</span>
                        <span>Porcentaje mensual realizado</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPercentageChartModal(false)}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 text-center">
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Media Anual</span>
                      <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 leading-none">{formatNumber(stats.current.avgPercentage)}%</span>
                    </div>
                    <div className="bg-azul-blue/5 dark:bg-azul-blue/20 p-4 rounded-2xl border border-azul-blue/10 dark:border-azul-blue/30 text-center">
                      <span className="text-[9px] font-black text-azul-blue dark:text-blue-300 uppercase tracking-widest block mb-1">Promedio Mensual</span>
                      <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{formatNumber(activeMonthlyAvg)}%</span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/40 text-center">
                      <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">Mes Máximo</span>
                      <span className="text-xl font-black text-amber-700 dark:text-amber-300 leading-none">
                        {formatNumber(maxPctInYear)}%
                      </span>
                    </div>
                  </div>

                  {/* SVG Line Chart Box */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-5 sm:p-6 space-y-3 relative">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Gráfico de % Jornada por Mes</span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                        {activeMonthDetail ? `${activeMonthDetail.monthName}: ${formatNumber(activeMonthDetail.percentage)}%` : 'Selecciona un mes'}
                      </span>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[480px]">
                        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
                          <defs>
                            <linearGradient id="percentageGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          {gridRatios.map((ratio, idx) => {
                            const yVal = padTop + chartHeight * (1 - ratio);
                            const labelVal = Math.round(gridMax * ratio);
                            return (
                              <g key={idx}>
                                <line
                                  x1={padLeft - 5}
                                  y1={yVal}
                                  x2={svgWidth - padRight + 5}
                                  y2={yVal}
                                  stroke="#cbd5e1"
                                  strokeDasharray="4 4"
                                  strokeWidth="1"
                                />
                                <text
                                  x={padLeft - 10}
                                  y={yVal + 3}
                                  textAnchor="end"
                                  fontSize="9"
                                  fontWeight="700"
                                  fill="#94a3b8"
                                >
                                  {labelVal}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Area Path */}
                          {areaPath && <path d={areaPath} fill="url(#percentageGradient)" />}

                          {/* Line Path */}
                          {linePath && (
                            <path
                              d={linePath}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Data points */}
                          {chartPoints.map((p) => {
                            const isSelected = hoveredPercentageMonth?.monthName === p.monthName;
                            return (
                              <g
                                key={p.monthIndex}
                                className="cursor-pointer group"
                                onMouseEnter={() => setHoveredPercentageMonth({ monthName: p.monthName, percentage: p.effectivePercentage })}
                                onMouseLeave={() => setHoveredPercentageMonth(null)}
                                onClick={() => setHoveredPercentageMonth({ monthName: p.monthName, percentage: p.effectivePercentage })}
                              >
                                {isSelected && (
                                  <line
                                    x1={p.x}
                                    y1={padTop}
                                    x2={p.x}
                                    y2={padTop + chartHeight}
                                    stroke="#10b981"
                                    strokeOpacity="0.4"
                                    strokeWidth="1.5"
                                    strokeDasharray="3 3"
                                  />
                                )}

                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isSelected ? "7" : "4.5"}
                                  fill="#ffffff"
                                  stroke="#10b981"
                                  strokeWidth={isSelected ? "3.5" : "2.5"}
                                  className="transition-all duration-200"
                                />

                                {p.effectivePercentage > 0 && (
                                  <text
                                    x={p.x}
                                    y={p.y - 10}
                                    textAnchor="middle"
                                    fontSize={isSelected ? "11" : "9"}
                                    fontWeight="800"
                                    fill={isSelected ? "#047857" : "#475569"}
                                    className="transition-all duration-200"
                                  >
                                    {formatNumber(p.effectivePercentage, 1)}%
                                  </text>
                                )}

                                <text
                                  x={p.x}
                                  y={svgHeight - 10}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fontWeight={isSelected ? "800" : "700"}
                                  fill={isSelected ? "#047857" : "#64748b"}
                                  className="transition-all duration-200"
                                >
                                  {p.shortName}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Monthly List Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest px-1">Detalle por Mes</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {monthlyData.map((m) => (
                        <div
                          key={m.monthIndex}
                          onMouseEnter={() => setHoveredPercentageMonth({ monthName: m.monthName, percentage: m.effectivePercentage })}
                          onMouseLeave={() => setHoveredPercentageMonth(null)}
                          onClick={() => setHoveredPercentageMonth({ monthName: m.monthName, percentage: m.effectivePercentage })}
                          className={cn(
                            "p-3 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer select-none",
                            hoveredPercentageMonth?.monthName === m.monthName
                              ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
                              : m.effectivePercentage > 0
                                ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                                : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-400"
                          )}
                        >
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{m.monthName}</span>
                          <span className={cn("text-base font-black tracking-tight mt-1", m.effectivePercentage > 0 ? "text-slate-800 dark:text-slate-100" : "text-slate-300 dark:text-slate-600")}>
                            {formatNumber(m.effectivePercentage)} <span className="text-[10px] font-bold text-slate-400">%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Annual Pluses & Variables Floating Modal */}
      <AnimatePresence>
        {showAnnualPlusesModal && (() => {
          const allEntries = stats.current.annualPlusModalEntries || [];
          const isSubActive = !!settings.isSubrogado;
          const visibleEntries = isSubActive
            ? (plusesCategoryFilter === 'ALL'
                ? allEntries
                : allEntries.filter(e => e.category === plusesCategoryFilter))
            : allEntries.filter(e => e.category === 'CON');

          const activeEntries = visibleEntries.filter(e => !disabledAnnualPlusIds[e.id]);
          const totalSum = activeEntries.reduce((acc, e) => acc + e.amount, 0);
          const totalConSum = visibleEntries
            .filter(e => e.category === 'CON' && !disabledAnnualPlusIds[e.id])
            .reduce((acc, e) => acc + e.amount, 0);
          const totalSubSum = visibleEntries
            .filter(e => e.category === 'SUB' && !disabledAnnualPlusIds[e.id])
            .reduce((acc, e) => acc + e.amount, 0);
          const allVisibleEnabled = visibleEntries.length > 0 && visibleEntries.every(e => !disabledAnnualPlusIds[e.id]);
          const noneVisibleEnabled = visibleEntries.length > 0 && visibleEntries.every(e => !!disabledAnnualPlusIds[e.id]);

          const toggleEntry = (id: string) => {
            setDisabledAnnualPlusIds(prev => ({ ...prev, [id]: !prev[id] }));
          };

          const handleEnableAllVisible = () => {
            setDisabledAnnualPlusIds(prev => {
              const next = { ...prev };
              visibleEntries.forEach(e => {
                next[e.id] = false;
              });
              return next;
            });
          };

          const handleDisableAllVisible = () => {
            setDisabledAnnualPlusIds(prev => {
              const next = { ...prev };
              visibleEntries.forEach(e => {
                next[e.id] = true;
              });
              return next;
            });
          };

          return (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-6" data-modal-active="true">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAnnualPlusesModal(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/70 dark:border-slate-800"
              >
                {/* Header */}
                <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between bg-azul-blue text-white shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                      <Wallet size={18} className="text-azul-yellow" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black uppercase tracking-tight leading-tight truncate">
                        Pluses Generados en el Año
                      </h3>
                      <p className="text-[9.5px] font-semibold text-white/80 uppercase tracking-wider mt-0.5 truncate">
                        Año {selectedYear} • {activeEntries.length} de {visibleEntries.length} conceptos activos
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAnnualPlusesModal(false)}
                    className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Top Summary Card & Filter Controls */}
                <div className="px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3.5 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900 shrink-0">
                  {/* Summary Card */}
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)] p-3.5 sm:p-4 space-y-2.5">
                    <div>
                      <span className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 block">
                        Suma Total Activa
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none tabular-nums block mt-1">
                        {formatCurrency(totalSum)}
                      </span>
                    </div>

                    {isSubActive && plusesCategoryFilter === 'ALL' && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-700/50 bg-indigo-50/60 dark:bg-indigo-950/40 px-3 py-1.5 min-w-[90px]">
                          <span className="text-[8.5px] font-black uppercase tracking-wider text-azul-blue dark:text-sky-300 block leading-none">
                            CON
                          </span>
                          <span className="text-xs font-black text-azul-blue dark:text-sky-200 mt-1 tabular-nums block leading-none">
                            {formatCurrency(totalConSum)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-amber-200/90 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-1.5 min-w-[90px]">
                          <span className="text-[8.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block leading-none">
                            SUB
                          </span>
                          <span className="text-xs font-black text-amber-700 dark:text-amber-300 mt-1 tabular-nums block leading-none">
                            {formatCurrency(totalSubSum)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Filter Segmented Control + Bulk Action Buttons */}
                  <div className="space-y-2.5">
                    {isSubActive && (
                      <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50">
                        {(['ALL', 'CON', 'SUB'] as const).map((filterKey) => {
                          const active = plusesCategoryFilter === filterKey;
                          return (
                            <button
                              key={filterKey}
                              type="button"
                              onClick={() => setPlusesCategoryFilter(filterKey)}
                              className={cn(
                                "px-3 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                active
                                  ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-white shadow-xs"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              )}
                            >
                              {filterKey === 'ALL' ? 'Todos' : filterKey}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {visibleEntries.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleEnableAllVisible}
                          disabled={allVisibleEnabled}
                          className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-black uppercase tracking-wider shadow-2xs hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 active:scale-95 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-default"
                        >
                          Activar todos
                        </button>
                        <button
                          type="button"
                          onClick={handleDisableAllVisible}
                          disabled={noneVisibleEnabled}
                          className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9.5px] font-black uppercase tracking-wider shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700/60 active:scale-95 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-default"
                        >
                          Desactivar todos
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scrollable Alphabetical List */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-2.5 bg-white dark:bg-slate-900 custom-scrollbar">
                  {visibleEntries.length > 0 ? (
                    visibleEntries.map((item) => {
                      const isIncluded = !disabledAnnualPlusIds[item.id];
                      const unitRateSuffix =
                        item.unit === 'h'
                          ? '/h'
                          : item.unit === 'uni.'
                            ? '/u'
                            : item.unit === 'días'
                              ? '/día'
                              : item.unit === 'turnos'
                                ? '/turno'
                                : `/${item.unit}`;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleEntry(item.id)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl border text-left transition-all cursor-pointer select-none",
                            isIncluded
                              ? "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)] hover:border-azul-blue/40"
                              : "bg-slate-50/70 dark:bg-slate-800/35 border-slate-200/40 dark:border-slate-800 opacity-60 hover:opacity-85"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Pill Switch */}
                            <div
                              className={cn(
                                "w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0",
                                isIncluded
                                  ? "bg-emerald-500 justify-end"
                                  : "bg-slate-300 dark:bg-slate-600 justify-start"
                              )}
                            >
                              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                            </div>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={cn(
                                    "font-black uppercase tracking-tight text-xs leading-tight truncate",
                                    isIncluded
                                      ? "text-slate-900 dark:text-slate-100"
                                      : "text-slate-400 dark:text-slate-500 line-through"
                                  )}
                                >
                                  {item.label}
                                </span>
                                {isSubActive && (
                                  <span
                                    className={cn(
                                      "text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border leading-none shrink-0",
                                      item.category === 'SUB'
                                        ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-700/50"
                                        : "text-azul-blue dark:text-sky-300 bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-200/80 dark:border-indigo-700/50"
                                    )}
                                  >
                                    {item.category}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 mt-0.5">
                                {formatNumber(item.qty, 2)} {item.unit}
                                {item.qty > 0 && ` × ${formatCurrency(item.amount / item.qty)}${unitRateSuffix}`}
                              </span>
                            </div>
                          </div>

                          <span
                            className={cn(
                              "font-black text-xs tabular-nums px-2.5 py-1 rounded-full shrink-0 border transition-colors",
                              isIncluded
                                ? "text-azul-blue dark:text-sky-300 bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-100/90 dark:border-indigo-800/50"
                                : "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 border-transparent line-through"
                            )}
                          >
                            {formatCurrency(item.amount)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Sin pluses ni variables registrados
                      </p>
                      <p className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                        {isSubActive && plusesCategoryFilter !== 'ALL'
                          ? `No hay pluses ${plusesCategoryFilter} generados en el año ${selectedYear}.`
                          : 'Los pluses se calculan con las variables de tus turnos de este año.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
                  <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
                    Pulsa cualquier plus o variable para incluirlo o excluirlo de la suma.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAnnualPlusesModal(false)}
                    className="px-4 py-2 rounded-xl bg-azul-blue hover:bg-azul-blue/90 text-white text-[10.5px] font-black uppercase tracking-wider shadow-md shadow-azul-blue/20 shrink-0 cursor-pointer active:scale-95 transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 1. Selector de Año (Mismo tamaño, estilo y función que el selector de mes de Turnos y Nómina) */}
      <div className="relative z-[20] px-3 sm:px-6 md:px-10 py-2 sm:py-3 transition-all duration-300">
        <div className="flex justify-center max-w-3xl mx-auto items-center gap-2">
          <div 
            id="selector-ano-container"
            className="pointer-events-auto flex items-center bg-azul-blue shadow-2xl shadow-azul-blue/30 rounded-full p-0.5 sm:p-1 border border-white/20 w-full max-w-[280px] sm:max-w-[320px] justify-between transition-all duration-300 py-1 sm:py-1.5"
          >
            <button 
              onClick={() => setSelectedYear(prev => prev - 1)} 
              className="p-2 sm:p-3 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white cursor-pointer"
              aria-label="Año anterior"
            >
              <ChevronLeft size={22} />
            </button>
            <button 
              onClick={() => setIsYearPickerOpen(true)}
              className="px-2 sm:px-4 py-1 hover:bg-white/10 rounded-full transition-all active:scale-95 flex flex-col items-center flex-1 min-w-0 cursor-pointer"
            >
              <span className="font-black text-white uppercase tracking-tight leading-none text-sm sm:text-lg mb-0.5 truncate w-full text-center">
                {selectedYear}
              </span>
              <span className="text-[8px] sm:text-[10px] font-black text-azul-yellow/80 uppercase tracking-widest whitespace-nowrap">
                Cambiar Año
              </span>
            </button>
            <button 
              onClick={() => setSelectedYear(prev => prev + 1)} 
              className="p-2 sm:p-3 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white cursor-pointer"
              aria-label="Año siguiente"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <AnimatePresence>
            {selectedYear !== new Date().getFullYear() && (
              <motion.button
                id="volver-ano-actual-btn"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => setSelectedYear(new Date().getFullYear())}
                className="pointer-events-auto flex flex-col items-center justify-center bg-azul-yellow text-[10px] uppercase text-azul-blue shadow-2xl shadow-azul-yellow/30 rounded-full border border-white/20 transition-all hover:bg-azul-yellow/90 active:scale-95 shrink-0 select-none font-black leading-none w-11 h-11 sm:w-12 sm:h-12 cursor-pointer"
                title="Volver al año actual"
              >
                <span className="leading-none text-[16px] sm:text-[18px]">📅</span>
                <span className="text-[6.5px] sm:text-[7.5px] font-black tracking-tighter leading-none mt-0.5">HOY</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <YearPickerModal
        isOpen={isYearPickerOpen}
        onClose={() => setIsYearPickerOpen(false)}
        selectedYear={selectedYear}
        onSelectYear={(year) => setSelectedYear(year)}
      />

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-2">
          <div className="p-3 sm:p-4 bg-azul-blue/10 dark:bg-azul-blue/20 rounded-full text-azul-blue dark:text-blue-400 mb-1 sm:mb-2 text-azul-blue">
            <Clock size={28} className="sm:w-8 sm:h-8" />
          </div>
          <span className="text-[10px] sm:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Horas Realizadas</span>
          <span className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{formatNumber(stats.current.totalHours)}</span>
          <div className="flex flex-col items-center">
            <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">horas en total</span>
            {settings.contractType === 'Completo' && (() => {
              const remainingHours = Math.max(0, 1712 - stats.current.totalHours);
              const remaining8hDays = Math.round(remainingHours / 8);
              const hasExceeded = stats.current.totalHours > 1712;

              return (
                <>
                  <div className={cn(
                    "mt-2 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg text-center",
                    hasExceeded 
                      ? "bg-red-500 text-white shadow-red-500/20" 
                      : "bg-azul-blue text-white shadow-azul-blue/20"
                  )}>
                    {hasExceeded 
                      ? `Exceso de jornada: ${formatNumber(stats.current.totalHours - 1712)}h`
                      : `Restan ${formatNumber(remainingHours)}h para 1.712h`
                    }
                  </div>
                  <div className="w-full max-w-xs mt-3">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700 p-[1.5px]">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500 ease-out",
                          stats.current.totalHours >= 1712 ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]" : "bg-azul-blue shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                        )}
                        style={{ width: `${Math.min(100, (stats.current.totalHours / 1712) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {!hasExceeded && (
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 text-center">
                      Restan <span className="font-bold text-azul-blue dark:text-blue-400">{remaining8hDays} {remaining8hDays === 1 ? 'día' : 'días'}</span> de turno de 8h para 1.712h.
                    </p>
                  )}
                  {hasExceeded && (
                    <p className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2 text-center">
                      Objetivo anual de 1.712h completado (+{formatNumber(stats.current.totalHours - 1712)}h).
                    </p>
                  )}
                </>
              );
            })()}
            {(settings.contractType === 'Parcial' || settings.contractType?.toLowerCase() === 'parcial') && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowHoursChartModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-azul-blue/10 hover:bg-azul-blue/20 text-azul-blue font-black text-xs uppercase tracking-wider transition-all active:scale-95 border border-azul-blue/20 shadow-xs cursor-pointer"
                >
                  <BarChart3 size={16} className="text-azul-blue" />
                  <span>Ver Gráfico Anual</span>
                </button>
              </div>
            )}
          </div>

          {/* Desglose en 2 columnas: Horas Ordinarias vs Horas Perentorias / Complementarias con interruptor */}
          <div className="w-full pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2.5 sm:gap-3 text-left">
            {/* Columna 1: Horas Ordinarias */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-between">
              <div>
                <span className="text-[9px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Horas Ordinarias
                </span>
                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 block mt-0.5">
                  Efectivas + Sindicales
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {formatNumber(stats.current.totalOrdHours)}
                </span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">h</span>
              </div>
            </div>

            {/* Columna 2: Horas Perentorias / Complementarias */}
            <div className={cn(
              "p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col justify-between",
              isCompleto
                ? "bg-amber-50/70 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-800/50"
                : "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-800/50"
            )}>
              <div className="flex items-start justify-between gap-1.5">
                <div>
                  <span className={cn(
                    "text-[9px] sm:text-[10px] font-black uppercase tracking-wider block leading-tight",
                    isCompleto ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"
                  )}>
                    {isCompleto ? 'Horas Perentorias' : 'Horas Compl.'}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 block mt-0.5 leading-tight">
                    {isCompleto ? 'Cobro y compensación' : 'Ampliación de jornada'}
                  </span>
                </div>

                {/* Badge de estado automático por contrato (solo en contrato parcial) */}
                {!isCompleto && (
                  <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 bg-emerald-100/90 text-emerald-800 border-emerald-300/80 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700/60">
                    + Sumadas
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex items-baseline justify-between gap-1">
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-xl sm:text-2xl font-black tracking-tight",
                    isCompleto ? "text-amber-900 dark:text-amber-200" : "text-emerald-900 dark:text-emerald-200"
                  )}>
                    {formatNumber(stats.current.totalExtraHours)}
                  </span>
                  <span className={cn(
                    "text-xs font-bold",
                    isCompleto ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                  )}>h</span>
                </div>

                <span className={cn(
                  "text-[7.5px] font-bold text-right leading-tight max-w-[120px]",
                  isCompleto ? "text-amber-700/80 dark:text-amber-400/80" : "text-emerald-700/80 dark:text-emerald-400/80"
                )}>
                  {isCompleto ? 'No computan en anual' : 'Computan en anual'}
                </span>
              </div>
            </div>
          </div>

          {/* Botón para abrir la ventana flotante de pluses anuales generados */}
          <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 select-none">
            <button
              id="pluses-anuales-toggle-btn"
              type="button"
              onClick={() => setShowAnnualPlusesModal(true)}
              className="w-full flex items-center justify-between text-xs font-black text-[#0f172a] dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-500/50 rounded-[1.25rem] px-4 py-3 transition-all duration-200 active:scale-98 cursor-pointer outline-none focus:outline-none group"
            >
              <span className="flex items-center gap-2 uppercase tracking-widest text-[9px] sm:text-[10px]">
                <Coins size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Pluses Generados en el Año</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">
                  Ver detalle
                </span>
                <ChevronRight 
                  size={14} 
                  className="transition-transform duration-200 stroke-[2.5] text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5" 
                />
              </span>
            </button>
          </div>
        </div>

        {/* Fila en la misma línea: Media Jornada Anual y Puntuación Vacaciones (mitad y mitad) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setShowPercentageChartModal(true)}
            className="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-400/70 dark:hover:border-emerald-500/50 hover:shadow-md active:scale-[0.98] transition-all flex flex-col items-center text-center space-y-2 cursor-pointer group"
            title="Ver evolución mensual del % de jornada"
          >
            <div className="p-2.5 sm:p-3 md:p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-full text-emerald-600 dark:text-emerald-400 mb-1 sm:mb-2 group-hover:scale-105 transition-transform">
              <BarChart3 size={26} className="sm:w-7 sm:h-7 md:w-8 md:h-8" />
            </div>
            <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-full">Media Jornada Anual</span>
            <span className="text-2xl min-[360px]:text-3xl sm:text-4xl md:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{formatNumber(stats.current.avgPercentage)}%</span>
            <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">de la jornada completa</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider mt-0.5">
              <TrendingUp size={10} />
              <span>Ver gráfico mensual</span>
            </span>
          </button>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-2">
            <div className="p-2.5 sm:p-3 md:p-4 bg-amber-50 dark:bg-amber-950/40 rounded-full text-amber-500 dark:text-azul-yellow mb-1 sm:mb-2">
              <Umbrella size={26} className="sm:w-7 sm:h-7 md:w-8 md:h-8" />
            </div>
            <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-full">Puntuación Vacaciones</span>
            <span className="text-2xl min-[360px]:text-3xl sm:text-4xl md:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{formatNumber(vacationScoreData.finalScore)}</span>
            <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">puntos en el año</span>
          </div>
        </div>

        {/* Historial de Nóminas */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div 
            onClick={() => setIsPayrollHistoryExpanded(!isPayrollHistoryExpanded)}
            className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-azul-blue/5 cursor-pointer select-none transition-colors hover:bg-azul-blue/10"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-azul-blue text-white rounded-2xl flex items-center justify-center shadow-lg shadow-azul-blue/20 shrink-0">
                <History size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">
                    Historial de Nóminas
                  </h3>
                  {payrollHistory.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-azul-blue/10 text-azul-blue">
                      {payrollHistory.reduce((acc, m) => acc + m.payrolls.length, 0)} {payrollHistory.reduce((acc, m) => acc + m.payrolls.length, 0) === 1 ? 'nómina' : 'nóminas'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Tus registros guardados en {selectedYear}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPayrollHistoryExpanded(!isPayrollHistoryExpanded);
                }}
                className="p-2.5 sm:p-3 rounded-2xl bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                title={isPayrollHistoryExpanded ? "Recoger historial" : "Desplegar historial"}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline text-slate-500">
                  {isPayrollHistoryExpanded ? 'Recoger' : 'Desplegar'}
                </span>
                <ChevronDown
                  size={18}
                  className={cn(
                    "transition-transform duration-300",
                    isPayrollHistoryExpanded ? "rotate-180 text-azul-blue" : "text-slate-400"
                  )}
                />
              </button>
            </div>
          </div>
          
          <AnimatePresence initial={false}>
            {isPayrollHistoryExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="p-4 sm:p-8">
                  {payrollHistory.length > 0 ? (
                    <div className="space-y-10">
                      {payrollHistory.map(({ month, payrolls }) => (
                        <div key={month} className="space-y-4">
                          <div className="flex items-center gap-3 px-1">
                            <div className="w-8 h-1 bg-azul-blue rounded-full opacity-30" />
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
                              {safeFormat(new Date(selectedYear, month - 1), 'MMMM', { locale: es })}
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {payrolls.map((p) => (
                              <button 
                                key={p.id} 
                                onClick={() => setSelectedPayroll(p)}
                                className="w-full bg-slate-50 p-4 sm:p-5 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group hover:border-azul-blue/30 hover:bg-white hover:shadow-xl hover:shadow-azul-blue/5 transition-all duration-300 text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-azul-blue shadow-sm group-hover:bg-azul-blue group-hover:text-white transition-colors duration-300 shrink-0">
                                    <Wallet size={20} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                        {isExtraPayroll(p) ? 'Paga Extra' : 'Nómina Mensual'}
                                      </span>
                                      <div className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                        {safeFormat(parseISO(p.saveDate), 'dd/MM/yyyy')}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                      <span className={cn(p.settings.contractType === 'Completo' ? 'text-azul-blue' : 'text-amber-600')}>
                                        {p.settings.contractType}
                                      </span>
                                      <span>•</span>
                                      <span>Nivel {p.settings.level}</span>
                                      <span>•</span>
                                      <span>{p.settings.irpf}% IRPF</span>
                                      <span>•</span>
                                      <span>Base CC: {formatCurrency(p.totals.baseCotizacion ?? 0)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <span className="text-lg font-black text-emerald-600 leading-none block">{formatCurrency(p.totals.liquido)}</span>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Líquido a Percibir</p>
                                  </div>
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-azul-blue/10 group-hover:text-azul-blue transition-all">
                                    <ArrowRight size={18} />
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-slate-100 rounded-full blur-2xl opacity-50 animate-pulse" />
                        <div className="relative w-20 h-20 bg-white border border-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-200 shadow-sm">
                          <FileText size={40} />
                        </div>
                      </div>
                      <div className="space-y-2 max-w-[240px]">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin registros</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase leading-relaxed">
                          Las nóminas que guardes en la pestaña Nómina aparecerán aquí para tu control anual
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Botón Descargar Resumen Anual */}
        <div className="bg-gradient-to-br from-slate-900 via-azul-blue to-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-azul-yellow border border-white/10 shadow-inner shrink-0">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                  Resumen Anual ({selectedYear})
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-azul-yellow text-slate-950">
                  PDF Completo
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium max-w-lg">
                Descarga en un archivo el resumen completo de todo el año: turnos realizados mes a mes, pluses generados y el desglose íntegro de cada nómina guardada.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDownloadChoiceModalOpen(true)}
            disabled={isGeneratingPdf}
            className={cn(
              "w-full sm:w-auto px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 cursor-pointer shrink-0",
              isGeneratingPdf
                ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                : downloadSuccessMessage
                  ? "bg-emerald-600 text-white shadow-emerald-600/30 hover:bg-emerald-500"
                  : "bg-azul-yellow text-slate-950 hover:bg-yellow-300 shadow-yellow-500/20"
            )}
            title={`Descargar resumen anual ${selectedYear} en archivo PDF`}
          >
            {isGeneratingPdf ? (
              <>
                <RefreshCw size={18} className="animate-spin text-slate-950" />
                <span>Generando Archivo...</span>
              </>
            ) : downloadSuccessMessage ? (
              <>
                <CheckCircle2 size={18} className="text-white" />
                <span>¡Descargado con Éxito!</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Descargar Resumen Anual</span>
              </>
            )}
          </button>
        </div>

        {/* Modal de selección de origen de nóminas al descargar Resumen Anual */}
        <AnimatePresence>
          {isDownloadChoiceModalOpen && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6" data-modal-active="true">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDownloadChoiceModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 18 }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-azul-blue text-white flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={22} className="text-azul-yellow" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black uppercase tracking-tight leading-tight">
                        Descargar Resumen {selectedYear}
                      </h3>
                      <p className="text-[11px] font-semibold text-white/75 mt-0.5">
                        Elige qué nóminas quieres incluir en el PDF
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDownloadChoiceModalOpen(false)}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadAnnualSummaryPdf('calculated')}
                    className="w-full text-left p-4 rounded-2xl border-2 border-sky-200 dark:border-sky-800/70 bg-sky-50/70 dark:bg-sky-950/30 hover:border-azul-blue hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-all flex items-start gap-3.5 group cursor-pointer active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-azul-blue text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Wallet size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          Nóminas de la sección «Nómina»
                        </span>
                        <ArrowRight size={16} className="text-azul-blue shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Genera el informe con las nóminas calculadas actualmente en la pestaña Nómina (sin necesidad de haberlas guardado), con el desglose mensual completo de cada mes.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadAnnualSummaryPdf('saved')}
                    className="w-full text-left p-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/25 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/45 transition-all flex items-start gap-3.5 group cursor-pointer active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <History size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          Guardadas en «Historial de Nóminas»
                        </span>
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full shrink-0">
                          {annualMonthsData.totals.savedPayrollsCount}/12
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Incluye únicamente las nóminas que has fijado y guardado en el Historial de Nóminas de la pestaña Resumen.
                      </p>
                    </div>
                  </button>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsDownloadChoiceModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Notificación Toast de Éxito al Descargar Resumen Anual PDF */}
        <AnimatePresence>
          {downloadSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed bottom-6 right-6 z-[200] max-w-md bg-slate-950/95 backdrop-blur-md text-white p-4.5 rounded-3xl shadow-2xl border border-emerald-500/40 flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <CheckCircle2 size={22} />
              </div>
              <div className="flex-1 pr-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-0.5">
                  ¡Descarga Completada!
                </h4>
                <p className="text-[11px] text-slate-200 font-medium leading-relaxed">
                  {downloadSuccessMessage}
                </p>
              </div>
              <button
                onClick={() => setDownloadSuccessMessage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="Cerrar notificación"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tutorial Trigger Button (Al final de la pestaña) */}
      <div className="flex justify-center pt-4 pb-2">
        <button
          onClick={() => setShowTutorial(!showTutorial)}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer"
          )}
        >
          <HelpCircle size={15} className={showTutorial ? "animate-bounce" : ""} />
          <span>Guía de Historial y Análisis</span>
        </button>
      </div>

      {/* Tutorial Modal Overlay */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        title="Historial y Análisis"
        subtitle="Guía de uso"
        steps={tutorialSteps}
      />
    </div>
  );
};
