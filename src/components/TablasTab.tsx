import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Edit2, 
  X, 
  Save, 
  Wallet, 
  Clock, 
  Zap, 
  Shield, 
  TrendingUp, 
  Coins, 
  Activity, 
  Info,
  Plus,
  Trash2,
  Check,
  ArrowRight,
  Table,
  HelpCircle,
  Lock,
  CalendarCheck,
  Tag
} from 'lucide-react';
import { cn, DayShift, Settings, YearlyLevels, YearlyPluses, LevelData, PlusesData, PlusConfig, INITIAL_LEVELS_PASAJE, INITIAL_PLUSES_PASAJE, getPlusesWithContractTypeDefaults, SharedQuadrantInfo } from '../types';
import { LocalInput } from './LocalInput';
import { ConfirmModal } from './ConfirmModal';
import { CreatePlusModal } from './CreatePlusModal';
import { formatCurrency, formatNumber, calculateLevelMetrics } from '../utils';
import { TutorialModal, TutorialStep } from './TutorialModal';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown, UserPlus } from 'lucide-react';

interface TablasTabProps {
  yearlyLevels: YearlyLevels;
  yearlyPluses: YearlyPluses;
  yearlyLevelsPasaje?: YearlyLevels;
  yearlyPlusesPasaje?: YearlyPluses;
  settings: any;
  updateLevels: (year: number, levels: LevelData[], colectivo?: 'rampa' | 'pasaje') => void;
  updatePluses: (year: number, pluses: PlusesData, colectivo?: 'rampa' | 'pasaje') => void;
  updateSettings: (settings: any) => void;
  initialLevels: LevelData[];
  initialPluses: PlusesData;
  initialLevelsPasaje?: LevelData[];
  initialPlusesPasaje?: PlusesData;
  activeSharedOwner?: SharedQuadrantInfo | null;
}

const PLUS_DESCRIPTIONS: Record<string, string> = {
  'Jornada Fraccionada < 4h': 'Día que contiene 2 turnos y entre el final del primero y el inicio del segundo hay menos de 4h, igual o más de 4h o 7h o más.',
  'Jornada Fraccionada >= 4h': 'Día que contiene 2 turnos y entre el final del primero y el inicio del segundo hay menos de 4h, igual o más de 4h o 7h o más.',
  'Jornada Fraccionada >= 7h': 'Día que contiene 2 turnos y entre el final del primero y el inicio del segundo hay menos de 4h, igual o más de 4h o 7h o más.',
  'Transporte': 'Cada día de asistencia al trabajo.',
  'Madrugue': 'Cada día de inicio de turno entre las 2:00 y las 6:55.',
  'Festivo': 'Horas realizadas en día festivo.',
  'Domingo': 'Horas realizadas en Domingo.',
  'Nocturnas': 'Horas realizadas entre las 22:00 y las 06:00.',
  'Productividad': 'Plus trimestral de 90€ (70% cumplimiento de objetivos personales - 30% rendimiento global del aeropuerto) y que no tenga llegadas tardías ni faltas de asistencia sin justificar.',
  'Multitasking': 'Plus de agentes de rampa que desempeñen la carga y descarga de aviones, pushback o jardineras y que no se haya ausentado al puesto de trabajo de forma injustificada.',
  'Tiempo Parcial - Discontinuo': 'Plus que se cobra en proporción a la jornada del mes el personal a tiempo parcial, fijo discontinuo y eventual.',
  'Teamleader': 'Plus que se cobra en proporción a la jornada del mes.',
  'Jornada Irregular': 'Trabajador que realiza su prestación de forma no regular.',
  'Turnicidad 2': 'Plus que solo para los Tiempo Completo, que varía según el número distinto de turnos en el mes.',
  'Turnicidad 3': 'Plus que solo para los Tiempo Completo, que varía según el número distinto de turnos en el mes.',
  'Turnicidad 4': 'Plus que solo para los Tiempo Completo, que varía según el número distinto de turnos en el mes.',
  'Turnicidad 5+': 'Plus que solo para los Tiempo Completo, que varía según el número distinto de turnos en el mes.',
  'ARCO': 'Desempeña funciones de auxiliar de coordinador de rampa.',
  'RCO': 'Desempeña funciones de coordinador de rampa.',
  'Duty': 'Plus mensual por desempeño de funciones de Duty Manager / Jefe de Servicio de Pasaje.',
  'Dutty': 'Plus mensual por desempeño de funciones de Duty Manager / Jefe de Servicio de Pasaje.',
  'Super': 'Plus mensual por desempeño de funciones de Supervisor/a de Pasaje.',
  'Manutención': 'Día de turno de 6 horas o más, que contenga las horas de 14:00 a 16:00 y de 21:00 a 23:00 (si hay dos turnos, uno de ellos tiene que ser de 6 horas y cumplir los requisitos anteriores)',
  'Nocturnas SUB': 'Horas nocturnas específicas para personal subrogado.',
  'Madrugue SUB': 'Cada día de inicio de turno en horario de madrugue para personal subrogado.',
  'Manutención/Comida SUB': 'Comida/Cena en turnos específicos de rampa para personal subrogado.',
  'Transporte SUB': 'Cobro de transporte mensual para personal subrogado.',
  'Festivo SUB': 'Cobro por horas realizadas en días festivos para personal subrogado.',
  'Domingo SUB': 'Cobro por horas de Domingo para personal subrogado. Si se activa el botón "Festivos", las horas de Domingo se contabilizarán como Festivo SUB.',
  'Jornada Irregular Diaria': 'Plus diario por cada día de asistencia al trabajo en jornada irregular para personal subrogado.',
  'Cambio de función': 'Importe al 100%, el cambio de función se cobrará según las horas desempeñadas en la nueva función'
};

const PLUS_DESCRIPTIONS_PASAJE: Record<string, string> = {
  'Multitasking': 'Plus de agente de pasaje la cual desempeñen las funciones en la oficina Operaciones o funciones propias de un CSA (como check-in y/o boarding), junto con las funciones de operador de OPS.'
};

const getPlusDescription = (name: string, colectivo?: 'rampa' | 'pasaje'): string | undefined => {
  if (colectivo === 'pasaje' && PLUS_DESCRIPTIONS_PASAJE[name]) {
    return PLUS_DESCRIPTIONS_PASAJE[name];
  }
  return PLUS_DESCRIPTIONS[name];
};

const VARIABLE_PLUSES = ['Tiempo Parcial - Discontinuo', 'Teamleader'];

const QUANTITY_BASED_PLUSES = [
  'Jornada Fraccionada < 4h',
  'Jornada Fraccionada >= 4h',
  'Jornada Fraccionada >= 7h',
  'Transporte',
  'Manutención',
  'Madrugue',
  'Festivo',
  'Domingo',
  'Nocturnas',
  'Nocturnas SUB',
  'Madrugue SUB',
  'Manutención/Comida SUB',
  'Transporte SUB',
  'Festivo SUB',
  'Domingo SUB',
  'Jornada Irregular Diaria'
];

const isPlusQuantityBased = (name: string, p?: PlusConfig) => {
  if (QUANTITY_BASED_PLUSES.includes(name)) return true;
  if (!p) return false;
  if (p.baseType && p.baseType !== 'estandar') return true;
  if (p.cloneOf && p.cloneOf !== 'Estándar' && p.cloneOf !== 'estandar') return true;
  return false;
};

export const TablasTab = ({
  yearlyLevels,
  yearlyPluses,
  yearlyLevelsPasaje,
  yearlyPlusesPasaje,
  settings,
  updateLevels,
  updatePluses,
  updateSettings,
  initialLevels,
  initialPluses,
  initialLevelsPasaje = INITIAL_LEVELS_PASAJE,
  initialPlusesPasaje = INITIAL_PLUSES_PASAJE,
  activeSharedOwner
}: TablasTabProps) => {
  const isLocked = !!activeSharedOwner?.isLocked;
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [colectivo, setColectivo] = useState<'rampa' | 'pasaje'>(() => settings.colectivoConvenio || 'rampa');
  const [showCreatePlusModal, setShowCreatePlusModal] = useState(false);
  const [createPlusCategory, setCreatePlusCategory] = useState<'convenio' | 'subrogado'>('convenio');
  const [isEditingLevels, setIsEditingLevels] = useState(false);
  const [originalLevels, setOriginalLevels] = useState<any[] | null>(null);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [plusToDelete, setPlusToDelete] = useState<string | null>(null);
  const [isTurnicidadExpanded, setIsTurnicidadExpanded] = useState(false);
  const [isFraccionadaExpanded, setIsFraccionadaExpanded] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const next = settings.colectivoConvenio || 'rampa';
    setColectivo(prev => (prev !== next ? next : prev));
  }, [settings.colectivoConvenio]);

  const handleToggleColectivo = (newColectivo: 'rampa' | 'pasaje') => {
    setColectivo(newColectivo);
    updateSettings({ ...settings, colectivoConvenio: newColectivo });
    if (newColectivo === 'pasaje' && settings.contractType === 'Parcial') {
      const cur = (yearlyPlusesPasaje || {})[selectedYear] || initialPlusesPasaje || INITIAL_PLUSES_PASAJE;
      const updatedCur = getPlusesWithContractTypeDefaults(cur, 'Parcial');
      setTempPluses(updatedCur);
      updatePluses(selectedYear, updatedCur, 'pasaje');
    }
  };

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Niveles Salariales",
      badge: "Salarios",
      icon: <Table size={22} />,
      color: "text-azul-blue",
      bg: "bg-azul-blue/10",
      description: "Tienes un selector de año para modificar los importes cada año de manera independiente. Se muestra en una tabla editable el desglose de las percepciones anuales, mensuales y de horas según el convenio. Además, en la parte superior tienes unas tarjetas indicativas de los precios según tú nivel de Configuración."
    },
    {
      title: "Variables y Complementos",
      badge: "Pluses",
      icon: <Wallet size={22} />,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      description: "Muestra los pluses del convenio cada uno con su importe, todos ellos editables. Puedes añadir nuevos pluses pulsando en \"Crear Nuevo Plus\"."
    },
    {
      title: "Sección Subrogado",
      badge: "Subrogación",
      icon: <Shield size={22} />,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      description: "Si eres personal subrogado, podrás introducir un salario base fijo para todo el año. Esta sección aún está en fase de creación."
    }
  ];
  
  const expandedSections = settings.expandedTablasSections || {
    convenio: !settings.isSubrogado,
    subrogados: settings.isSubrogado
  };

  const toggleSection = (section: 'convenio' | 'subrogados') => {
    updateSettings({
      ...settings,
      expandedTablasSections: {
        ...expandedSections,
        [section]: !expandedSections[section]
      }
    });
  };
  
  const yearlyUpdates = settings.yearlyUpdates;
  const currentYearUpdate = yearlyUpdates?.[selectedYear] || 0;

  const yearlySubUpdates = settings.yearlySubUpdates || {};
  const currentYearSubUpdate = yearlySubUpdates[selectedYear] || 0;

  const activeYearlyLevels = colectivo === 'pasaje' ? (yearlyLevelsPasaje || {}) : yearlyLevels;
  const activeInitialLevels = colectivo === 'pasaje' ? initialLevelsPasaje : initialLevels;
  const activeYearlyPluses = colectivo === 'pasaje' ? (yearlyPlusesPasaje || {}) : yearlyPluses;
  const rawInitialPluses = (colectivo === 'pasaje' ? initialPlusesPasaje : initialPluses) || (colectivo === 'pasaje' ? INITIAL_PLUSES_PASAJE : initialPluses);
  const activeInitialPluses = useMemo(() => {
    return getPlusesWithContractTypeDefaults(rawInitialPluses, settings.contractType);
  }, [rawInitialPluses, settings.contractType]);

  const levels = activeYearlyLevels[selectedYear] || activeInitialLevels;
  const pluses = activeYearlyPluses[selectedYear] || activeInitialPluses;

  const [tempLevels, setTempLevels] = useState(levels);
  const [tempPluses, setTempPluses] = useState(pluses);

  useEffect(() => {
    if (plusToDelete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [plusToDelete]);

  const applyYearlyUpdate = (percentage: number) => {
    const prevYear = selectedYear - 1;
    const baseLevels = activeYearlyLevels[prevYear] || activeInitialLevels;
    const basePluses = activeYearlyPluses[prevYear] || activeInitialPluses;
    const factor = 1 + (percentage / 100);

    const excludedPluses = ['Multitasking', 'Teamleader', 'Productividad', 'RCO', 'ARCO', 'Duty', 'Dutty', 'Super'];

    const newLevels = baseLevels.map(l => ({
      ...l,
      anual: Math.round(l.anual * factor * 100) / 100
    }));

    const newPluses: PlusesData = {};
    Object.entries(basePluses).forEach(([name, p]: [string, any]) => {
      const isExcluded = excludedPluses.some(ex => ex.toLowerCase() === name.toLowerCase()) || name.toUpperCase().includes('PSF');
      if (isExcluded) {
        newPluses[name] = { ...p };
      } else {
        newPluses[name] = {
          ...p,
          value: Math.round(p.value * factor * 100) / 100,
          subValue: p.subValue ? Math.round(p.subValue * factor * 100) / 100 : undefined
        };
      }
    });

    setTempLevels(newLevels);
    setTempPluses(newPluses);
    updateLevels(selectedYear, newLevels, colectivo);
    updatePluses(selectedYear, newPluses, colectivo);

    const newYearlyUpdates = { ...(yearlyUpdates || {}), [selectedYear]: percentage };
    updateSettings({ ...settings, yearlyUpdates: newYearlyUpdates });
  };

  const applyYearlySubUpdate = (percentage: number) => {
    const prevYear = selectedYear - 1;
    const basePluses = yearlyPluses[prevYear] || initialPluses;
    const factor = 1 + (percentage / 100);

    const subPlusKeys = [
      'Nocturnas SUB',
      'Madrugue SUB',
      'Manutención/Comida SUB',
      'Transporte SUB',
      'Festivo SUB',
      'Domingo SUB',
      'Jornada Irregular Diaria'
    ];

    const newPluses: PlusesData = { ...pluses };
    Object.entries(basePluses).forEach(([name, p]) => {
      if (subPlusKeys.includes(name)) {
        newPluses[name] = {
          ...p,
          value: Math.round(p.value * factor * 100) / 100
        };
      } else {
        if (!newPluses[name]) {
          newPluses[name] = { ...p };
        }
      }
    });

    setTempPluses(newPluses);
    updatePluses(selectedYear, newPluses, colectivo);

    let newSalaries = { ...(settings.subrogadoBaseSalaries || {}) };
    const prevSalary = settings.subrogadoBaseSalaries?.[prevYear];
    if (prevSalary !== undefined && prevSalary > 0) {
      newSalaries[selectedYear] = Math.round(prevSalary * factor * 100) / 100;
    }

    const newYearlySubUpdates = { ...(settings.yearlySubUpdates || {}), [selectedYear]: percentage };
    updateSettings({ 
      ...settings, 
      yearlySubUpdates: newYearlySubUpdates,
      subrogadoBaseSalaries: newSalaries
    });
  };

  const getPlusValue = (p: number | PlusConfig) => typeof p === 'number' ? p : p.value;
  const getPlusPagas = (p: number | PlusConfig) => typeof p === 'number' ? 12 : p.pagas;

  // Sync with props when year changes, colectivo changes, or props change
  useEffect(() => {
    const curLevels = activeYearlyLevels[selectedYear] || activeInitialLevels;
    const curPluses = activeYearlyPluses[selectedYear] || activeInitialPluses;

    if (!activeYearlyLevels[selectedYear] && selectedYear >= 2027) {
      const prevYear = selectedYear - 1;
      const baseLevels = activeYearlyLevels[prevYear] || activeInitialLevels;
      const basePluses = activeYearlyPluses[prevYear] || activeInitialPluses;
      const percentage = yearlyUpdates?.[selectedYear] || 0;
      const factor = 1 + (percentage / 100);

      const excludedPluses = ['Multitasking', 'Teamleader', 'Productividad', 'RCO', 'ARCO', 'Duty', 'Dutty', 'Super'];

      const newLevels = baseLevels.map(l => ({
        ...l,
        anual: Math.round(l.anual * factor * 100) / 100
      }));

      const newPluses: PlusesData = {};
      Object.entries(basePluses).forEach(([name, p]: [string, any]) => {
        const isExcluded = excludedPluses.some(ex => ex.toLowerCase() === name.toLowerCase()) || name.toUpperCase().includes('PSF');
        if (isExcluded) {
          newPluses[name] = { ...p };
        } else {
          newPluses[name] = {
            ...p,
            value: Math.round(p.value * factor * 100) / 100,
            subValue: p.subValue ? Math.round(p.subValue * factor * 100) / 100 : undefined
          };
        }
      });

      setTempLevels(newLevels);
      setTempPluses(newPluses);
      updateLevels(selectedYear, newLevels, colectivo);
      updatePluses(selectedYear, newPluses, colectivo);
    } else {
      setTempLevels(curLevels);
      const mergedPluses = { ...curPluses };
      let updated = false;
      Object.keys(activeInitialPluses).forEach(key => {
        if (!mergedPluses[key]) {
          mergedPluses[key] = { ...activeInitialPluses[key] };
          updated = true;
        }
      });
      // In Pasaje, make sure Teamleader, RCO, and ARCO are stripped out
      if (colectivo === 'pasaje') {
        ['Teamleader', 'RCO', 'ARCO'].forEach(k => {
          if (mergedPluses[k]) {
            delete mergedPluses[k];
            updated = true;
          }
        });
        if (mergedPluses['Dutty']) {
          mergedPluses['Duty'] = {
            value: mergedPluses['Dutty'].value || 250,
            pagas: mergedPluses['Dutty'].pagas || 12,
            enabled: mergedPluses['Dutty'].enabled ?? false,
            isVariable: false
          };
          delete mergedPluses['Dutty'];
          updated = true;
        }
        if (!mergedPluses['Duty']) {
          mergedPluses['Duty'] = { value: 250, pagas: 12, enabled: false, isVariable: false };
          updated = true;
        }
        if (!mergedPluses['Super']) {
          mergedPluses['Super'] = { value: 125, pagas: 12, enabled: false, isVariable: false };
          updated = true;
        }

        // Con la configuración: Parcial y pasaje, por defecto desactiva la casilla Turnicidad y activa la casilla Tiempo parcial
        if (settings.contractType === 'Parcial') {
          const defaultsKey = `pasaje_parcial_defaults_applied_v1_${selectedYear}`;
          if (!localStorage.getItem(defaultsKey)) {
            turnicidadItems.forEach(name => {
              if (mergedPluses[name]?.enabled) {
                mergedPluses[name] = { ...mergedPluses[name], enabled: false };
                updated = true;
              }
            });
            if (mergedPluses['Tiempo Parcial - Discontinuo'] && !mergedPluses['Tiempo Parcial - Discontinuo'].enabled) {
              mergedPluses['Tiempo Parcial - Discontinuo'] = {
                ...mergedPluses['Tiempo Parcial - Discontinuo'],
                enabled: true
              };
              updated = true;
            }
            localStorage.setItem(defaultsKey, 'true');
          }
        }
      }
      setTempPluses(mergedPluses);
      if (updated) {
        updatePluses(selectedYear, mergedPluses, colectivo);
      }
    }
  }, [colectivo, selectedYear, activeYearlyLevels, activeYearlyPluses, yearlyUpdates, settings.contractType]);

  const handleInlineSaveLevel = (idx: number) => {
    const newList = tempLevels.map((l, i) => i === idx ? tempLevels[i] : l);
    updateLevels(selectedYear, newList, colectivo);
    setJustSaved(`level-${idx}`);
    setEditingLevel(null);
    setTimeout(() => setJustSaved(null), 2000);
  };

  const handleSaveAllLevels = () => {
    updateLevels(selectedYear, tempLevels, colectivo);
    setIsEditingLevels(false);
    setOriginalLevels(null);
    setJustSaved('all-levels');
    setTimeout(() => setJustSaved(null), 2000);
  };

  const handleCancelLevels = () => {
    if (originalLevels) {
      setTempLevels(originalLevels);
    }
    setIsEditingLevels(false);
    setOriginalLevels(null);
  };

  const handleInlineSavePlus = (name: string) => {
    updatePluses(selectedYear, tempPluses, colectivo);
    setJustSaved(`plus-${name}`);
    setEditingCard(null);
    setTimeout(() => setJustSaved(null), 2000);
  };

  const handleSaveNewPlusFromModal = (plusName: string, config: PlusConfig, isSubrogado: boolean) => {
    const updatedPluses = { 
      ...tempPluses, 
      [plusName]: config
    };
    setTempPluses(updatedPluses);
    updatePluses(selectedYear, updatedPluses, colectivo);
  };

  const handleDeletePlus = (name: string) => {
    const { [name]: _, ...rest } = tempPluses;
    setTempPluses(rest);
    updatePluses(selectedYear, rest, colectivo);
  };

  const currentLevelData = tempLevels.find(l => l.nivel === settings.selectedLevel) || tempLevels[0];
  const currentMetrics = calculateLevelMetrics(currentLevelData.anual);

  const renderPlusCard = (name: string, p: PlusConfig, isGrouped = false) => {
    const isSubrogadoPlus = (n: string) => n.endsWith(' SUB') || n.endsWith('/Comida SUB') || n === 'Jornada Irregular Diaria';
    const value = p.value;
    const subValue = p.subValue;
    const pagas = p.pagas;
    const isEnabled = p.enabled;
    const isVariable = p.isVariable;
    const subrogadosBaseKeys = [
      'Nocturnas SUB',
      'Madrugue SUB',
      'Manutención/Comida SUB',
      'Transporte SUB',
      'Festivo SUB',
      'Domingo SUB',
      'Jornada Irregular Diaria'
    ];
    const isDefault = !!getPlusDescription(name, colectivo) || groupedKeys.includes(name) || (isSubrogadoPlus(name) && subrogadosBaseKeys.includes(name));
    const isEditing = editingCard === name;

    const isMadrugue = name === 'Madrugue' || name === 'Madrugue SUB' || p.baseType === 'madrugue' || p.cloneOf === 'Madrugue' || p.cloneOf === 'Madrugue SUB' || p.madrugueStart !== undefined;
    const isNocturnas = (name === 'Nocturnas' || name === 'Nocturnas SUB' || p.baseType === 'nocturnas' || p.cloneOf === 'Nocturnas' || p.cloneOf === 'Nocturnas SUB') && !p.startHour2 && !isMadrugue;
    const isManutencion = (name === 'Manutención' || name === 'Manutención/Comida SUB' || p.baseType === 'manutencion' || p.cloneOf === 'Manutención' || p.cloneOf === 'Manutención/Comida SUB' || p.startHour2 !== undefined) && !isMadrugue;

    const toggleEnabled = () => {
      const updatedPluses = { ...tempPluses, [name]: { ...p, enabled: !isEnabled } };
      setTempPluses(updatedPluses);
      updatePluses(selectedYear, updatedPluses, colectivo);
    };

    const toggleFestivos = () => {
      const updatedPluses = { ...tempPluses, [name]: { ...p, festivos: !p.festivos } };
      setTempPluses(updatedPluses);
      updatePluses(selectedYear, updatedPluses, colectivo);
    };

    return (
      <div key={name} className={cn(
        "plus-card bg-white p-5 rounded-3xl border transition-all group flex flex-col relative overflow-hidden",
        !isEnabled && "opacity-60 grayscale-[0.5] border-slate-100 bg-slate-50/50",
        isEnabled && isGrouped && "border-azul-blue/20 bg-azul-blue/5",
        isEnabled && !isGrouped && "border-slate-100 shadow-sm hover:shadow-md",
        isEditing && "ring-2 ring-azul-blue border-transparent"
      )}>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h4 className="text-sm font-black text-slate-700 leading-tight uppercase">{name}</h4>
                {((p.cloneOf && p.cloneOf !== name) || (p.baseType && p.baseType !== 'estandar' && !isDefault)) && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-azul-blue/10 text-azul-blue dark:bg-blue-900/40 dark:text-blue-300">
                    {p.cloneOf && p.cloneOf !== name 
                      ? `Copia de: ${p.cloneOf}` 
                      : (p.baseType === 'proporcional_jornada' ? 'Proporcional jornada' : p.baseType === 'fijo' ? 'Fijo mensual' : `Función: ${p.baseType}`)}
                  </span>
                )}
                {p.showInMonthTags && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    En Turnos
                  </span>
                )}
                {!isEditing && (
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "font-black text-azul-blue",
                      (name.includes('Jornada Fraccionada') || name.includes('Turnicidad')) ? "text-sm" : "text-lg"
                    )}>
                      {formatCurrency(value)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {!isGrouped && getPlusDescription(name, colectivo) && (
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 italic">
                {getPlusDescription(name, colectivo)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {!isLocked && (
              !isEditing ? (
                <button 
                  onClick={() => setEditingCard(name)}
                  className="w-8 h-8 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-azul-blue/10 hover:text-azul-blue transition-colors"
                >
                  <Edit2 size={14} />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleInlineSavePlus(name)}
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm",
                      justSaved === `plus-${name}` ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    )}
                    title="Guardar cambios"
                  >
                    {justSaved === `plus-${name}` ? <Check size={14} /> : <Save size={14} />}
                  </button>
                  <button 
                    onClick={() => {
                      setEditingCard(null);
                      setTempPluses(pluses);
                    }}
                    className="w-8 h-8 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors shadow-sm"
                    title="Cancelar"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            )}

            <button 
              disabled={isLocked}
              onClick={isLocked ? undefined : toggleEnabled}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shadow-inner",
                isEnabled ? "bg-emerald-500" : "bg-slate-300",
                isLocked && "cursor-not-allowed opacity-60"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm",
                  isEnabled ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="mt-4 space-y-4 border-t border-slate-50 dark:border-white/[0.025] pt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Importe</p>
                <div className="relative">
                  <LocalInput 
                    type="number" 
                    value={value === 0 ? '' : value}
                    onChange={(val) => {
                      setTempPluses(prev => ({ ...prev, [name]: { ...prev[name], value: parseFloat(val) || 0 } }));
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-900 outline-none transition-all text-sm"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">€</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              {!isPlusQuantityBased(name, p) && (
                <div className="flex-1">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Pagas</p>
                  <div className="flex gap-2">
                    {[12, 14].map(pg => (
                      <button
                        key={pg}
                        onClick={() => {
                          setTempPluses(prev => ({ ...prev, [name]: { ...prev[name], pagas: pg as 12 | 14 } }));
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all",
                          pagas === pg ? "bg-azul-blue text-white" : "bg-slate-100 text-slate-400"
                        )}
                      >
                        {pg} P
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!isDefault && (
              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.05] space-y-2.5">
                {/* 1. Activar por defecto en nómina */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <CalendarCheck size={12} className="text-azul-blue shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">
                      Activar por defecto en nómina
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentVal = p.defaultActiveInPayroll !== false;
                      setTempPluses(prev => ({
                        ...prev,
                        [name]: { ...prev[name], defaultActiveInPayroll: !currentVal }
                      }));
                    }}
                    className={cn(
                      "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-1.5 shadow-xs",
                      p.defaultActiveInPayroll !== false
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700"
                        : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    )}
                  >
                    {p.defaultActiveInPayroll !== false ? (
                      <>
                        <Check size={10} strokeWidth={3} className="text-emerald-600" />
                        <span>Sí / Activo</span>
                      </>
                    ) : (
                      <span>No / Inactivo</span>
                    )}
                  </button>
                </div>

                {/* 2. Mostrar en pluses generados del mes */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Tag size={12} className="text-azul-blue shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">
                      Mostrar en 'Pluses generados del mes'
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempPluses(prev => ({
                        ...prev,
                        [name]: { ...prev[name], showInMonthTags: !prev[name]?.showInMonthTags }
                      }));
                    }}
                    className={cn(
                      "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-1.5 shadow-xs",
                      p.showInMonthTags
                        ? "bg-azul-blue text-white border-azul-blue shadow-azul-blue/20"
                        : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    )}
                  >
                    {p.showInMonthTags ? (
                      <>
                        <Check size={10} strokeWidth={3} />
                        <span>Visible</span>
                      </>
                    ) : (
                      <span>Oculto</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!isEditing && !isPlusQuantityBased(name, p) && (
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/[0.025]">
            <span className="text-[9px] font-black text-azul-blue uppercase tracking-widest">{pagas} PAGAS</span>
          </div>
        )}

        {name === 'Domingo SUB' && (
          <div className="mt-3 pt-3 border-t border-slate-100/60 dark:border-white/[0.025] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FESTIVOS</span>
            </div>
            <button
              onClick={toggleFestivos}
              className={cn(
                "px-3 py-1.5 rounded-2xl font-black text-[9px] uppercase tracking-wider transition-all border shadow-sm active:scale-95 cursor-pointer select-none",
                p.festivos
                  ? "bg-emerald-500 border-transparent text-white hover:bg-emerald-600 shadow-emerald-500/10"
                  : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-500"
              )}
            >
              {p.festivos ? 'Sí / Activo' : 'No / Inactivo'}
            </button>
          </div>
        )}

        {/* Specific criteria for Nocturnas/Madrugue/Manutención/Domingo SUB when editing */}
        {isEditing && isNocturnas && (
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/[0.025] space-y-4">
            <div className="space-y-2">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Tramo Horario</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LocalInput 
                    type="time" 
                    value={p.startHour || '22:00'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, startHour: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold">a</span>
                <div className="flex-1">
                  <LocalInput 
                    type="time" 
                    value={p.endHour || '06:00'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, endHour: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {isEditing && isMadrugue && (
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/[0.025] space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tight ml-1">Hora Inicio</label>
                  <LocalInput 
                    type="time" 
                    value={p.madrugueStart || '02:00'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, madrugueStart: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tight ml-1">Hora Fin</label>
                  <LocalInput 
                    type="time" 
                    value={p.madrugueEnd || '06:55'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, madrugueEnd: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tight ml-1">Salida posterior a:</label>
                  <button 
                    onClick={() => {
                      const newEnabled = !p.madrugueMinEndEnabled;
                      setTempPluses({ 
                        ...tempPluses, 
                        [name]: { ...p, madrugueMinEndEnabled: newEnabled }
                      });
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                      p.madrugueMinEndEnabled ? "bg-azul-blue" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                        p.madrugueMinEndEnabled ? "translate-x-5" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
                {p.madrugueMinEndEnabled && (
                  <LocalInput 
                    type="time" 
                    value={p.madrugueMinEnd || '00:00'}
                    onChange={(val) => {
                      setTempPluses({ 
                        ...tempPluses, 
                        [name]: { ...p, madrugueMinEnd: val }
                      });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {isEditing && isManutencion && (
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/[0.025] space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Almuerzo / Comida</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LocalInput 
                    type="time" 
                    value={p.startHour || '14:00'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, startHour: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold">a</span>
                <div className="flex-1">
                  <LocalInput 
                    type="time" 
                    value={p.endHour || '16:00'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, endHour: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cena</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LocalInput 
                    type="time" 
                    value={p.startHour2 || '21:00'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, startHour2: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold">a</span>
                <div className="flex-1">
                  <LocalInput 
                    type="time" 
                    value={p.endHour2 || '23:00'}
                    onChange={(val) => {
                      setTempPluses({ ...tempPluses, [name]: { ...p, endHour2: val } });
                    }}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-700 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Read-only Interval Displays */}
        {!isEditing && isNocturnas && (
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/[0.025] space-y-1">
            <div className="flex items-center gap-2">
              <Clock size={12} className={cn(name.endsWith('SUB') ? "text-amber-500" : "text-azul-blue")} />
              <p className={cn("text-[10px] font-black uppercase tracking-widest", name.endsWith('SUB') ? "text-amber-600" : "text-azul-blue")}>
                {name.endsWith('SUB') ? "SUB" : "Normal"}: {p.startHour || '22:00'} - {p.endHour || '06:00'}
              </p>
            </div>
          </div>
        )}

        {!isEditing && isMadrugue && (
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/[0.025] space-y-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock size={12} className={cn(name.endsWith('SUB') ? "text-amber-500" : "text-azul-blue")} />
                <p className={cn("text-[10px] font-black uppercase tracking-widest", name.endsWith('SUB') ? "text-amber-600" : "text-azul-blue")}>
                  {name.endsWith('SUB') ? "SUB" : "Normal"}: {p.madrugueStart || '02:00'} - {p.madrugueEnd || '06:55'}
                </p>
              </div>
              {p.madrugueMinEndEnabled && (
                <div className="flex items-center gap-2 ml-4">
                  <ArrowRight size={12} className={cn(name.endsWith('SUB') ? "text-amber-500/50" : "text-azul-blue/50")} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", name.endsWith('SUB') ? "text-amber-600/70" : "text-azul-blue/70")}>
                    Salida {'>'} {p.madrugueMinEnd || '00:00'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isEditing && isManutencion && (
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/[0.025] space-y-1 text-slate-500">
            <div className="flex items-center gap-2">
              <Clock size={12} className={cn(name.includes('SUB') ? "text-amber-500" : "text-azul-blue")} />
              <p className={cn("text-[10px] font-black uppercase tracking-widest", name.includes('SUB') ? "text-amber-600" : "text-azul-blue")}>
                Almuerzo: {p.startHour || '14:00'} - {p.endHour || '16:00'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={12} className={cn(name.includes('SUB') ? "text-amber-500" : "text-azul-blue")} />
              <p className={cn("text-[10px] font-black uppercase tracking-widest", name.includes('SUB') ? "text-amber-600" : "text-azul-blue")}>
                Cena: {p.startHour2 || '21:00'} - {p.endHour2 || '23:00'}
              </p>
            </div>
          </div>
        )}

         {!isDefault && (
          <button 
            onClick={() => setPlusToDelete(name)}
            className="mt-2 py-2 border-t border-slate-50 dark:border-white/[0.025] text-rose-400 hover:text-rose-600 transition-colors flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest group-hover:border-rose-100"
          >
            <Trash2 size={12} />
            Eliminar Concepto
          </button>
        )}
      </div>
    );
  };

  const fraccionadaItems = ['Jornada Fraccionada < 4h', 'Jornada Fraccionada >= 4h', 'Jornada Fraccionada >= 7h'];
  const turnicidadItems = ['Turnicidad 2', 'Turnicidad 3', 'Turnicidad 4', 'Turnicidad 5+'];
  const groupedKeys = [...fraccionadaItems, ...turnicidadItems];

  const firstGridKeys = [
    'Transporte',
    'Manutención',
    'Madrugue',
    'Festivo',
    'Domingo',
    'Nocturnas',
    'Tiempo Parcial - Discontinuo'
  ];

  const secondGridKeysRampa = [
    'Jornada Irregular',
    'Teamleader',
    'Multitasking',
    'Productividad',
    'ARCO',
    'RCO'
  ];

  const secondGridKeysPasaje = [
    'Jornada Irregular',
    'Multitasking',
    'Productividad',
    'Duty',
    'Super'
  ];

  const secondGridKeys = colectivo === 'pasaje' ? secondGridKeysPasaje : secondGridKeysRampa;

  const standardPlusNames = [
    ...fraccionadaItems,
    ...firstGridKeys,
    ...turnicidadItems,
    ...secondGridKeys,
    'Cambio de función'
  ];

  const isSubrogadoPlusKey = (n: string) => n.endsWith(' SUB') || n.endsWith('/Comida SUB') || n === 'Jornada Irregular Diaria';

  const subrogadosBaseKeys = [
    'Nocturnas SUB',
    'Madrugue SUB',
    'Manutención/Comida SUB',
    'Transporte SUB',
    'Festivo SUB',
    'Domingo SUB',
    'Jornada Irregular Diaria'
  ];

  const customPluses = Object.keys(tempPluses).filter(
    (key) => !standardPlusNames.includes(key) && !isSubrogadoPlusKey(key) && !(colectivo === 'pasaje' && ['Teamleader', 'RCO', 'ARCO'].includes(key))
  );

  const customSubrogadoPluses = Object.keys(tempPluses).filter(
    (key) => isSubrogadoPlusKey(key) && !subrogadosBaseKeys.includes(key)
  );

  const variablePlusesList = Object.entries(tempPluses).filter(([name, p]) => (p as any).isVariable || turnicidadItems.includes(name));
  const fixedPlusesList = Object.entries(tempPluses)
    .filter(([name, p]) => !(p as any).isVariable && !turnicidadItems.includes(name))
    .sort(([nameA], [nameB]) => {
      const isAInitial = nameA in initialPluses;
      const isBInitial = nameB in initialPluses;
      if (isAInitial && !isBInitial) return -1;
      if (!isAInitial && isBInitial) return 1;
      return 0;
    });

  return (
    <div className="px-1 min-[360px]:px-1.5 sm:px-3 md:px-6 space-y-6 sm:space-y-10 pb-32 max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pt-4 sm:pt-6">
      {isLocked && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-center gap-3 text-amber-800 dark:text-amber-200 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
            <Lock size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-100">
              Edición Bloqueada por el Titular
            </h4>
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              {activeSharedOwner?.ownerName || 'El titular'} ha bloqueado los permisos de edición para este cuadrante compartido. Las tablas salariales están en modo solo lectura.
            </p>
          </div>
        </div>
      )}
      
      {/* TABLAS CONVENIO AZUL HANDLING */}
      <div className="space-y-4">
        <button 
          id="tablas-convenio-btn"
          onClick={() => toggleSection('convenio')}
          className={cn(
            "w-full flex items-center justify-between p-5 rounded-[2.5rem] border transition-all duration-500 shadow-sm group overflow-hidden relative",
            "bg-azul-blue border-azul-blue shadow-lg shadow-azul-blue/10 hover:shadow-xl hover:shadow-azul-blue/20"
          )}
        >
          <div className="flex items-center gap-4 relative z-10">
            <div id="tablas-convenio-icon-container" className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 bg-white/10 backdrop-blur-md text-azul-yellow shadow-inner"
            )}>
              <Table size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-black uppercase tracking-tight text-lg text-white">Tablas Convenio Azul Handling</h3>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mt-1 text-white/60">Configuración base del convenio</p>
            </div>
          </div>
          <ChevronDown className={cn("transition-transform duration-500 ease-out h-6 w-6 relative z-10 text-white", expandedSections.convenio ? "rotate-180" : "")} />
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-azul-yellow/10 rounded-full blur-3xl animate-pulse" />
        </button>

        <AnimatePresence initial={false}>
          {expandedSections.convenio && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="overflow-hidden"
            >
              <div className="space-y-6 sm:space-y-10 pt-4 sm:pt-6">
                {/* Header Section */}
                <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 border-b border-slate-100 pb-6 sm:pb-8 text-center">
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div id="convenio-year-picker" className="w-56 sm:w-64 h-11 flex items-center justify-between bg-azul-blue shadow-lg shadow-azul-blue/20 rounded-2xl p-1 border border-white/10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedYear(prev => prev - 1); }} 
                        className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white shrink-0"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="flex-1 flex items-center justify-center gap-2.5">
                        <Calendar size={18} className="text-azul-yellow shrink-0" />
                        <span className="font-black text-white text-base tracking-tight">{selectedYear}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedYear(prev => prev + 1); }} 
                        className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white shrink-0"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    {selectedYear >= 2027 && (
                      <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <TrendingUp size={16} className="text-emerald-500" />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Actualización:</span>
                          <div className="flex items-center gap-1">
                            <LocalInput 
                              type="number" 
                              value={currentYearUpdate === 0 ? '' : currentYearUpdate}
                              onChange={(val) => applyYearlyUpdate(parseFloat(val) || 0)}
                              className="w-12 bg-white border border-emerald-200 rounded-lg px-1.5 py-0.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 text-center"
                            />
                            <span className="text-xs font-black text-emerald-600">%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Botón selector Colectivo: Rampa / Pasaje */}
                    <div 
                      id="selector-colectivo-convenio" 
                      className="w-56 sm:w-64 h-11 bg-sky-50/40 dark:bg-[#0f172a] p-1 rounded-2xl border border-sky-100/60 dark:border-white/10 shadow-sm flex items-center"
                    >
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 w-full h-full">
                        <button
                          type="button"
                          onClick={() => handleToggleColectivo('rampa')}
                          className={cn(
                            "colectivo-option-btn h-full flex items-center justify-center text-[10px] font-black uppercase tracking-wider leading-none transition-all px-2 rounded-xl cursor-pointer select-none",
                            colectivo === 'rampa'
                              ? "colectivo-option-active text-sky-700 bg-sky-100/70 dark:bg-[#020617] dark:text-[#60a5fa] dark:border dark:border-white/10 shadow-2xs"
                              : "text-slate-400 hover:text-slate-600 dark:text-white/50 dark:hover:text-white"
                          )}
                        >
                          Rampa
                        </button>

                        <button 
                          type="button"
                          onClick={() => handleToggleColectivo(colectivo === 'rampa' ? 'pasaje' : 'rampa')}
                          aria-label="Cambiar colectivo entre Rampa y Pasaje"
                          className={cn(
                            "colectivo-toggle-track w-10 h-5 rounded-full relative transition-all duration-300 pointer-events-auto shrink-0 cursor-pointer shadow-inner dark:border dark:border-white/15",
                            colectivo === 'pasaje' ? "is-pasaje bg-sky-500 dark:bg-blue-600" : "bg-sky-600/70 dark:bg-[#020617]"
                          )}
                        >
                          <motion.div 
                            layout
                            className={cn(
                              "colectivo-toggle-thumb absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-xs",
                              colectivo === 'pasaje' ? "right-0.5" : "left-0.5"
                            )} 
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleColectivo('pasaje')}
                          className={cn(
                            "colectivo-option-btn h-full flex items-center justify-center text-[10px] font-black uppercase tracking-wider leading-none transition-all px-2 rounded-xl cursor-pointer select-none",
                            colectivo === 'pasaje'
                              ? "colectivo-option-active text-sky-700 bg-sky-100/70 dark:bg-[#020617] dark:text-[#60a5fa] dark:border dark:border-white/10 shadow-2xs"
                              : "text-slate-400 hover:text-slate-600 dark:text-white/50 dark:hover:text-white"
                          )}
                        >
                          Pasaje
                        </button>
                      </div>
                    </div>
                  </div>
                </div>


      {/* Quick Stats Grid */}
      <div id="tablas-quick-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Salario Base Anual', value: formatCurrency(currentLevelData.anual), icon: Wallet, color: 'text-azul-blue', bg: 'bg-azul-blue/10' },
          { label: 'Salario Base Mensual', value: formatCurrency(currentMetrics.mensual), icon: Coins, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Precio €/Hora', value: formatCurrency(currentMetrics.hora), icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          ...(settings.contractType === 'Completo' 
            ? [{ label: 'Perentorias €/Hora', value: formatCurrency(currentMetrics.perentoria), icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' }]
            : [{ label: 'Complementarias', value: formatCurrency(settings.complementariasPrice || currentMetrics.complementaria), icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' }]
          ),
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
            <div className="absolute top-4 right-4 bg-azul-blue text-white px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest shadow-md shadow-azul-blue/10">
              <span>NIVEL {settings.selectedLevel}</span>
            </div>
            <div className={`w-9 h-9 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-3`}>
              <stat.icon size={18} />
            </div>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest truncate">{stat.label}</p>
            <p className="text-base font-black text-slate-800 mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {settings.contractType === 'Parcial' && (
        <div id="precio-especial-complementarias-box" className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Precio Especial Complementarias</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Sobrescribir precio de tabla por defecto</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Coins size={16} />
              </div>
              <LocalInput
                type="number"
                value={settings.complementariasPrice === undefined ? '' : settings.complementariasPrice}
                onChange={(val) => {
                  const num = parseFloat(val);
                  updateSettings({ ...settings, complementariasPrice: isNaN(num) ? undefined : num });
                }}
                placeholder={`Por defecto: ${formatCurrency(currentMetrics.complementaria)}`}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-2xl pl-12 pr-4 py-3 font-bold text-slate-700 outline-none transition-all"
              />
            </div>
            {settings.complementariasPrice !== undefined && (
              <button 
                onClick={() => updateSettings({ ...settings, complementariasPrice: undefined })}
                className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Quitar Ajuste
              </button>
            )}
          </div>
        </div>
      )}

      {/* Levels Table Section */}
      <div id="tabla-niveles-salariales" className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 dark:border-white/[0.04] overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-white/[0.025] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-azul-blue/10 text-azul-blue rounded-2xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Niveles Salariales</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isLocked && (
              <>
                <button
                  onClick={() => {
                    if (!isEditingLevels) {
                      setOriginalLevels([...tempLevels]);
                      setIsEditingLevels(true);
                    } else {
                      handleSaveAllLevels();
                    }
                  }}
                  className={cn(
                    "p-2 rounded-xl transition-all duration-300 flex items-center justify-center",
                    isEditingLevels 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-110" 
                      : "bg-azul-blue/10 text-azul-blue hover:bg-azul-blue hover:text-white"
                  )}
                  title={isEditingLevels ? 'Guardar' : 'Editar Niveles'}
                >
                  {isEditingLevels ? <Save size={16} /> : <Edit2 size={16} />}
                </button>
                {isEditingLevels && (
                  <button
                    onClick={handleCancelLevels}
                    className="p-2 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20 scale-110 transition-all duration-300 flex items-center justify-center"
                    title="Cancelar"
                  >
                    <X size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50 dark:border-white/[0.025]">
                <th className="px-6 py-4 text-slate-400 uppercase text-[10px] font-black tracking-widest">Nivel</th>
                <th className="px-6 py-4 text-slate-400 uppercase text-[10px] font-black tracking-widest">Anual</th>
                <th className="px-6 py-4 text-slate-400 uppercase text-[10px] font-black tracking-widest">Mensual</th>
                <th className="px-6 py-4 text-slate-400 uppercase text-[10px] font-black tracking-widest">€/Hora</th>
                <th className="px-6 py-4 text-slate-400 uppercase text-[10px] font-black tracking-widest">Perent.</th>
                <th className="px-6 py-4 text-slate-400 uppercase text-[10px] font-black tracking-widest">Compl.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/[0.025]">
              {tempLevels.map((lvl, idx) => {
                const metrics = calculateLevelMetrics(lvl.anual);
                const isSelected = lvl.nivel === settings.selectedLevel;
                return (
                  <tr 
                    key={lvl.nivel} 
                    onClick={() => {
                      if (editingLevel === null) {
                        updateSettings({ ...settings, selectedLevel: lvl.nivel });
                      }
                    }}
                    className={cn(
                      "transition-all group cursor-pointer",
                      isSelected ? "bg-azul-blue/5" : "hover:bg-slate-50/50"
                    )}
                  >
                    <td className="px-4 py-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black",
                        isSelected ? "bg-azul-blue text-white" : "bg-slate-100 text-slate-600"
                      )}>
                        {formatNumber(lvl.nivel, 0)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {isEditingLevels ? (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <LocalInput 
                              type="number" 
                              value={lvl.anual === 0 ? '' : lvl.anual}
                              onChange={(val) => {
                                setTempLevels(prev => prev.map((l, i) => 
                                  i === idx ? { ...l, anual: parseFloat(val) || 0 } : l
                                ));
                              }}
                              className="w-24 bg-slate-50 border-2 border-transparent focus:border-azul-blue rounded-lg px-2 py-1 font-bold text-slate-900 outline-none transition-all text-xs"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">€</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{formatCurrency(lvl.anual)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500 font-medium text-xs">{formatCurrency(metrics.mensual)}</td>
                    <td className="px-4 py-2 text-slate-500 font-medium text-xs">{formatCurrency(metrics.hora)}</td>
                    <td className="px-4 py-2 text-slate-500 font-medium text-xs">{formatCurrency(metrics.perentoria)}</td>
                    <td className="px-4 py-2 text-slate-500 font-medium text-xs">{formatCurrency(metrics.complementaria)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pluses Grid Section */}
      <div className="space-y-8">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-azul-blue/10 text-azul-blue rounded-2xl flex items-center justify-center">
              <Coins size={20} />
            </div>
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Variables y Complementos</h3>
          </div>
        </div>

        {/* Variables Section */}
        <div className="space-y-6">
          <div className="px-2">
            {!isLocked && (
              <button 
                id="crear-nuevo-plus-btn"
                onClick={() => {
                  setCreatePlusCategory('convenio');
                  setShowCreatePlusModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 bg-azul-blue text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-azul-blue/20 hover:bg-azul-blue/90 transition-all active:scale-95 text-xs uppercase tracking-widest mb-6 cursor-pointer"
              >
                <Plus size={18} /> 
                <span>Crear Nuevo Plus</span>
              </button>
            )}
          </div>
          
          {/* Contenedores de Variables y Complementos distribuidos en tres columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {/* 1. Jornada Fraccionada Group */}
            <div className={cn(
              "bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4 animate-in fade-in transition-all",
              isFraccionadaExpanded ? "col-span-1 md:col-span-2 lg:col-span-3" : "col-span-1"
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Jornada Fraccionada</h3>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic mt-0.5">
                      2 turnos con pausa menor de 4h, igual o mayor a 4h o 7h o más.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isFraccionadaExpanded && (
                    <button 
                      onClick={() => setIsFraccionadaExpanded(true)}
                      className="flex items-center gap-1.5 bg-slate-50 hover:bg-azul-blue/10 text-slate-400 hover:text-azul-blue px-3 py-1.5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest border border-slate-100"
                    >
                      <Edit2 size={13} />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      const anyEnabled = fraccionadaItems.some(name => tempPluses[name]?.enabled);
                      const updatedPluses = { ...tempPluses };
                      fraccionadaItems.forEach(name => {
                        if (updatedPluses[name]) {
                          updatedPluses[name] = { ...updatedPluses[name], enabled: !anyEnabled };
                        }
                      });
                      setTempPluses(updatedPluses);
                      updatePluses(selectedYear, updatedPluses, colectivo);
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner",
                      fraccionadaItems.some(name => tempPluses[name]?.enabled) ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                        fraccionadaItems.some(name => tempPluses[name]?.enabled) ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              {!isFraccionadaExpanded ? (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {fraccionadaItems.map(name => {
                    const p = tempPluses[name] as any;
                    if (!p) return null;
                    const isEnabled = p.enabled;
                    
                    return (
                      <div key={name} className={cn(
                        "p-2 rounded-2xl border flex flex-col items-center justify-center text-center flex-1 min-w-[70px] transition-all relative",
                        isEnabled ? "bg-azul-blue/5 border-azul-blue/20 shadow-sm" : "bg-slate-50 border-slate-100 opacity-60"
                      )}>
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-tight mb-1 leading-tight px-1 truncate w-full">
                          {name === 'Jornada Fraccionada < 4h' ? '< 4h' : 
                           name === 'Jornada Fraccionada >= 4h' ? '≥ 4h' : 
                           '≥ 7h'}
                        </span>
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-slate-900">{formatCurrency(p.value)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {fraccionadaItems.map(name => renderPlusCard(name, tempPluses[name], true))}
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={() => setIsFraccionadaExpanded(false)}
                      className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <X size={14} />
                      Finalizar Edición
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* 2. Turnicidad Group */}
            <div className={cn(
              "bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4 transition-all",
              isTurnicidadExpanded ? "col-span-1 md:col-span-2 lg:col-span-3" : "col-span-1"
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Turnicidad</h3>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic mt-0.5">
                      Para Tiempo Completo, según turnos distintos en el mes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isTurnicidadExpanded && (
                    <button 
                      onClick={() => setIsTurnicidadExpanded(true)}
                      className="flex items-center gap-1.5 bg-slate-50 hover:bg-azul-blue/10 text-slate-400 hover:text-azul-blue px-3 py-1.5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest border border-slate-100"
                    >
                      <Edit2 size={13} />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      const anyEnabled = turnicidadItems.some(name => tempPluses[name]?.enabled);
                      const updatedPluses = { ...tempPluses };
                      turnicidadItems.forEach(name => {
                        if (updatedPluses[name]) {
                          updatedPluses[name] = { ...updatedPluses[name], enabled: !anyEnabled };
                        }
                      });
                      setTempPluses(updatedPluses);
                      updatePluses(selectedYear, updatedPluses, colectivo);
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner",
                      turnicidadItems.some(name => tempPluses[name]?.enabled) ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                        turnicidadItems.some(name => tempPluses[name]?.enabled) ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              {!isTurnicidadExpanded ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {turnicidadItems.map(name => {
                    const p = tempPluses[name] as any;
                    if (!p) return null;
                    const isEnabled = p.enabled;

                    return (
                      <div key={name} className={cn(
                        "p-2 rounded-2xl border flex flex-col items-center justify-center text-center transition-all relative",
                        isEnabled ? "bg-azul-blue/5 border-azul-blue/20 shadow-sm" : "bg-slate-50 border-slate-100 opacity-60"
                      )}>
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-tight mb-0.5 leading-tight px-1">
                          {name === 'Turnicidad 2' ? '2 Turnos' :
                           name === 'Turnicidad 3' ? '3 Turnos' :
                           name === 'Turnicidad 4' ? '4 Turnos' :
                           '5+ Turnos'}
                        </span>
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-slate-900">{formatCurrency(p.value)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {turnicidadItems.map(name => renderPlusCard(name, tempPluses[name], true))}
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={() => setIsTurnicidadExpanded(false)}
                      className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <X size={14} />
                      Finalizar Edición
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* 3. First block of individual pluses */}
            {firstGridKeys
              .filter(key => tempPluses[key] !== undefined)
              .map(key => renderPlusCard(key, tempPluses[key] as any))
            }

            {/* 4. Second block of individual + custom pluses */}
            {[...secondGridKeys, ...customPluses]
              .filter(key => tempPluses[key] !== undefined && key !== 'Cambio de función')
              .map(key => renderPlusCard(key, tempPluses[key] as any))
            }
            {renderPlusCard('Cambio de función', (tempPluses['Cambio de función'] || { value: 0, pagas: 12, enabled: false, isVariable: true }) as any)}
          </div>
        </div>
      </div>

      {/* Info Footer moved inside Convenio Section */}
      <div className="bg-azul-blue rounded-[2rem] p-8 text-white relative overflow-hidden mt-8 mx-2 sm:mx-0">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center shrink-0">
            <Info size={32} className="text-azul-yellow" />
          </div>
          <div>
            <h4 className="text-xl font-black mb-2">Sobre las Tablas Salariales</h4>
            <p className="text-white/80 text-sm leading-relaxed opacity-80">
              Los valores mostrados corresponden a las tablas vigentes del convenio colectivo. 
              Si ha habido una actualización salarial, puedes editarlos manualmente pulsando el botón superior. 
              Los cambios afectarán a todos los cálculos de nómina y atrasos.
            </p>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-azul-yellow/20 rounded-full blur-3xl" />
      </div>
    </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TABLAS SUBROGADOS - Only visible if isSubrogado is true */}
      {settings.isSubrogado && (
        <div className="space-y-4">
          <button 
            onClick={() => toggleSection('subrogados')}
            className={cn(
              "w-full flex items-center justify-between p-5 rounded-[2.5rem] border transition-all duration-500 shadow-sm group overflow-hidden relative",
              "bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 text-white"
            )}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 bg-white/10 backdrop-blur-md text-azul-yellow shadow-inner"
              )}>
                <UserPlus size={24} />
              </div>
              <div className="text-left">
                <h3 className="font-black uppercase tracking-tight text-lg text-white">Tablas Subrogados</h3>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mt-1 text-white/60">Configuración para personal subrogado</p>
              </div>
            </div>
            <ChevronDown className={cn("transition-transform duration-500 ease-out h-6 w-6 relative z-10 text-white", expandedSections.subrogados ? "rotate-180" : "")} />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-azul-blue/20 rounded-full blur-3xl translate-y-12 animate-pulse" />
          </button>

          <AnimatePresence initial={false}>
            {expandedSections.subrogados && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.04, 0.62, 0.23, 0.98] }}
                className="overflow-hidden"
              >
                <div className="space-y-6 pt-4 sm:pt-6">
                  {/* Subrogados Header - Year and Percentage Update */}
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex flex-col items-center justify-center gap-4 border-b border-slate-100 pb-6 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center bg-slate-900 shadow-lg shadow-slate-900/20 rounded-2xl p-1 border border-white/10">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedYear(prev => prev - 1); }} 
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <div className="px-6 flex items-center gap-3">
                            <Calendar size={18} className="text-azul-yellow" />
                            <span className="font-black text-white text-base tracking-tight">{selectedYear}</span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedYear(prev => prev + 1); }} 
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>

                        {selectedYear >= 2027 && (
                          <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <TrendingUp size={16} className="text-emerald-500" />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Actualización %:</span>
                              <div className="flex items-center gap-1">
                                <LocalInput 
                                  type="number" 
                                  value={currentYearSubUpdate === 0 ? '' : currentYearSubUpdate}
                                  onChange={(val) => applyYearlySubUpdate(parseFloat(val) || 0)}
                                  className="w-12 bg-white border border-emerald-200 rounded-lg px-1.5 py-0.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 text-center"
                                />
                                <span className="text-xs font-black text-emerald-600">%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <Wallet size={20} />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Salario Particular</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Salario mensual bruto para subrogados en {selectedYear}</p>
                        </div>
                      </div>

                      <div className="relative max-w-sm">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <Coins size={18} />
                        </div>
                        <LocalInput
                          type="number"
                          value={settings.subrogadoBaseSalaries?.[selectedYear] === undefined ? '' : settings.subrogadoBaseSalaries[selectedYear]}
                          onChange={(val) => {
                            const num = parseFloat(val);
                            const newSalaries = { ...(settings.subrogadoBaseSalaries || {}), [selectedYear]: isNaN(num) ? undefined : num };
                            updateSettings({ ...settings, subrogadoBaseSalaries: newSalaries });
                          }}
                          placeholder="Introduce el salario mensual bruto..."
                          className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl pl-12 pr-4 py-4 font-black text-slate-700 outline-none transition-all placeholder:text-slate-300 placeholder:font-bold"
                        />
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-slate-500 text-[10px] font-bold leading-relaxed max-w-sm">
                          Al establecer un Salario Particular, se aplicará automáticamente como salario base para todas las nóminas del año {selectedYear} cuando el modo subrogado esté activo.
                        </p>
                      </div>
                      
                      {settings.subrogadoBaseSalaries?.[selectedYear] && (
                        <div className="mt-4 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2">
                          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Salario Anual ({settings.pagas} pagas)</p>
                            <p className="text-sm font-black text-slate-900">{formatCurrency(settings.subrogadoBaseSalaries[selectedYear] * settings.pagas)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pluses Individuales Subrogados (SUB) */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                      <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                        <Zap size={20} className="fill-current animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Pluses Individuales Subrogados (SUB)</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Configura e introduce los importes y criterios específicos para cada plus SUB en {selectedYear}</p>
                      </div>
                    </div>

                    {!isLocked && (
                      <div className="flex justify-center">
                        <button 
                          onClick={() => {
                            setCreatePlusCategory('subrogado');
                            setShowCreatePlusModal(true);
                          }}
                          className="flex items-center justify-center gap-2 bg-azul-blue text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-azul-blue/20 hover:bg-azul-blue/90 transition-all active:scale-95 text-xs uppercase tracking-widest cursor-pointer"
                        >
                          <Plus size={18} /> 
                          <span>Crear Nuevo Plus</span>
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                      {[
                        'Nocturnas SUB',
                        'Madrugue SUB',
                        'Manutención/Comida SUB',
                        'Transporte SUB',
                        'Festivo SUB',
                        'Domingo SUB',
                        'Jornada Irregular Diaria',
                        ...customSubrogadoPluses
                      ].map(key => {
                        const p = tempPluses[key];
                        if (!p) return null;
                        return renderPlusCard(key, p as any);
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tutorial Trigger Button (Al final de la pestaña) */}
      <div className="flex justify-center pt-4 pb-2">
        <button
          onClick={() => setShowTutorial(!showTutorial)}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md border cursor-pointer",
            showTutorial 
              ? "bg-azul-blue text-white border-azul-blue" 
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750"
          )}
        >
          <HelpCircle size={15} className={showTutorial ? "animate-bounce" : ""} />
          <span>Guía de Tablas Salariales</span>
        </button>
      </div>

      {/* Tutorial Modal Overlay */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        title="Tablas Salariales"
        subtitle="Guía de uso"
        steps={tutorialSteps}
      />

      {/* Create Plus Floating Modal */}
      <CreatePlusModal
        isOpen={showCreatePlusModal}
        onClose={() => setShowCreatePlusModal(false)}
        onSave={handleSaveNewPlusFromModal}
        existingPluses={tempPluses}
        initialCategory={createPlusCategory}
        isSubrogado={!!settings?.isSubrogado}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!plusToDelete}
        onClose={() => setPlusToDelete(null)}
        onConfirm={() => {
          if (plusToDelete) {
            handleDeletePlus(plusToDelete);
          }
          setPlusToDelete(null);
        }}
        title="¿Eliminar Plus?"
        message={plusToDelete ? `Estás a punto de eliminar el plus "${plusToDelete.toUpperCase()}". Esta acción no se puede deshacer y afectará a los cálculos que dependan de él.` : ''}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
      />
    </div>
  );
};
