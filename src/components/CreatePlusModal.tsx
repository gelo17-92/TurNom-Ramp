import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Check, 
  Sunrise, 
  Moon, 
  Utensils, 
  Bus, 
  CalendarDays, 
  Sun,
  Percent,
  Coins,
  CalendarCheck,
  Tag,
  Info
} from 'lucide-react';
import { PlusConfig, PlusesData, cn } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { LocalInput } from './LocalInput';

interface CreatePlusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, config: PlusConfig, isSubrogado: boolean) => void;
  existingPluses: PlusesData;
  initialCategory?: 'convenio' | 'subrogado';
  isSubrogado?: boolean;
}

export type BaseCalculationBehavior = 
  | 'proporcional_jornada' 
  | 'fijo' 
  | 'madrugue' 
  | 'nocturnas' 
  | 'manutencion' 
  | 'transporte' 
  | 'festivo' 
  | 'domingo';

export const CreatePlusModal = ({
  isOpen,
  onClose,
  onSave,
  existingPluses,
  initialCategory = 'convenio',
  isSubrogado = false
}: CreatePlusModalProps) => {
  useScrollLock(isOpen);

  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [pagas, setPagas] = useState<12 | 14>(12);
  const [category, setCategory] = useState<'convenio' | 'subrogado'>(initialCategory);
  const [behavior, setBehavior] = useState<BaseCalculationBehavior>('fijo');
  const [defaultActive, setDefaultActive] = useState<boolean>(true);
  const [showInMonthTags, setShowInMonthTags] = useState<boolean>(false);

  // Madrugue criteria
  const [madrugueStart, setMadrugueStart] = useState('02:00');
  const [madrugueEnd, setMadrugueEnd] = useState('06:55');
  const [madrugueMinEnd, setMadrugueMinEnd] = useState('00:00');
  const [madrugueMinEndEnabled, setMadrugueMinEndEnabled] = useState(false);

  // Nocturnas criteria
  const [nocturnaStart, setNocturnaStart] = useState('22:00');
  const [nocturnaEnd, setNocturnaEnd] = useState('06:00');

  // Manutención criteria
  const [lunchStart, setLunchStart] = useState('14:00');
  const [lunchEnd, setLunchEnd] = useState('16:00');
  const [dinnerStart, setDinnerStart] = useState('21:00');
  const [dinnerEnd, setDinnerEnd] = useState('23:00');

  // Reset or preset values when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setValue('');
      setPagas(12);
      setCategory(isSubrogado ? initialCategory : 'convenio');
      setBehavior('fijo');
      setDefaultActive(true);
      setShowInMonthTags(false);
      setMadrugueStart('02:00');
      setMadrugueEnd('06:55');
      setMadrugueMinEnd('00:00');
      setMadrugueMinEndEnabled(false);
      setNocturnaStart('22:00');
      setNocturnaEnd('06:00');
      setLunchStart('14:00');
      setLunchEnd('16:00');
      setDinnerStart('21:00');
      setDinnerEnd('23:00');
    }
  }, [isOpen, initialCategory, isSubrogado]);

  const handleBehaviorChange = (newBehavior: BaseCalculationBehavior) => {
    setBehavior(newBehavior);
    if (newBehavior === 'madrugue') {
      const existingMad = existingPluses['Madrugue'];
      if (existingMad) {
        setMadrugueStart(existingMad.madrugueStart || '02:00');
        setMadrugueEnd(existingMad.madrugueEnd || '06:55');
        setMadrugueMinEnd(existingMad.madrugueMinEnd || '00:00');
        setMadrugueMinEndEnabled(!!existingMad.madrugueMinEndEnabled);
      }
    } else if (newBehavior === 'nocturnas') {
      const existingNoc = existingPluses['Nocturnas'];
      if (existingNoc) {
        setNocturnaStart(existingNoc.startHour || '22:00');
        setNocturnaEnd(existingNoc.endHour || '06:00');
      }
    } else if (newBehavior === 'manutencion') {
      const existingMan = existingPluses['Manutención'];
      if (existingMan) {
        setLunchStart(existingMan.startHour || '14:00');
        setLunchEnd(existingMan.endHour || '16:00');
        setDinnerStart(existingMan.startHour2 || '21:00');
        setDinnerEnd(existingMan.endHour2 || '23:00');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || value === '') return;

    const numValue = parseFloat(value) || 0;
    const isSub = category === 'subrogado';
    const finalName = isSub && !trimmedName.toUpperCase().endsWith(' SUB') 
      ? `${trimmedName} SUB` 
      : trimmedName;

    const cloneSource = (
      behavior === 'proporcional_jornada' ? 'Tiempo Parcial - Discontinuo' :
      behavior === 'fijo' ? 'Jornada Irregular' :
      behavior === 'madrugue' ? 'Madrugue' :
      behavior === 'nocturnas' ? 'Nocturnas' :
      behavior === 'manutencion' ? 'Manutención' :
      behavior === 'transporte' ? 'Transporte' :
      behavior === 'festivo' ? 'Festivo' :
      behavior === 'domingo' ? 'Domingo' : undefined
    );

    const isShiftBased = ['madrugue', 'nocturnas', 'manutencion', 'transporte', 'festivo', 'domingo'].includes(behavior);

    const config: PlusConfig = {
      value: numValue,
      pagas,
      enabled: true,
      isVariable: isShiftBased,
      baseType: behavior,
      calculationType: behavior,
      cloneOf: cloneSource,
      defaultActiveInPayroll: defaultActive,
      showInMonthTags,
      ...(behavior === 'madrugue' ? {
        madrugueStart,
        madrugueEnd,
        madrugueMinEnd,
        madrugueMinEndEnabled
      } : {}),
      ...(behavior === 'nocturnas' ? {
        startHour: nocturnaStart,
        endHour: nocturnaEnd
      } : {}),
      ...(behavior === 'manutencion' ? {
        startHour: lunchStart,
        endHour: lunchEnd,
        startHour2: dinnerStart,
        endHour2: dinnerEnd
      } : {})
    };

    onSave(finalName, config, isSub);
    onClose();
  };

  const behaviorOptions: { 
    id: BaseCalculationBehavior; 
    label: string; 
    description: string;
    example: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    hasInlineConfig?: boolean;
  }[] = [
    { 
      id: 'proporcional_jornada', 
      label: 'Proporcional a la Jornada', 
      description: 'Se cobra según el % de horas de trabajo del contrato.',
      example: 'Como Tiempo Parcial - Discontinuo o Teamleader',
      icon: Percent,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
    },
    { 
      id: 'fijo', 
      label: 'Importe Fijo Mensual', 
      description: 'Cantidad íntegra fija al mes en la nómina.',
      example: 'Como Jornada Irregular, Multitasking o Productividad',
      icon: Coins,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
    },
    { 
      id: 'madrugue', 
      label: 'Madrugue (por turnos)', 
      description: 'Por turnos que inicien en el tramo horario configurado.',
      example: 'Como Madrugue (02:00 a 06:55)',
      icon: Sunrise,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
      hasInlineConfig: true
    },
    { 
      id: 'nocturnas', 
      label: 'Nocturnidad (por horas)', 
      description: 'Por cada hora trabajada en la franja nocturna.',
      example: 'Como Nocturnas (22:00 a 06:00)',
      icon: Moon,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
      hasInlineConfig: true
    },
    { 
      id: 'manutencion', 
      label: 'Manutención / Dietas', 
      description: 'Por turnos con horario que coincida con almuerzo o cena.',
      example: 'Como Manutención (14:00-16:00 / 21:00-23:00)',
      icon: Utensils,
      color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
      hasInlineConfig: true
    },
    { 
      id: 'transporte', 
      label: 'Por Día Trabajado', 
      description: 'Se multiplica por cada día con turno efectivo en el mes.',
      example: 'Como Transporte o Jornada Irregular Diaria',
      icon: Bus,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10'
    },
    { 
      id: 'festivo', 
      label: 'Festivos', 
      description: 'Por horas o turnos trabajados en días festivos.',
      example: 'Como Festivo',
      icon: CalendarDays,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
    },
    { 
      id: 'domingo', 
      label: 'Domingos', 
      description: 'Por horas o turnos trabajados en domingos.',
      example: 'Como Domingo',
      icon: Sun,
      color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10'
    }
  ];

  const currentOption = behaviorOptions.find(o => o.id === behavior) || behaviorOptions[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card with fixed header, scrollable body, and fixed footer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', duration: 0.25 }}
            className="relative w-full max-w-xl bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] z-10 text-slate-800 dark:text-slate-100 overflow-hidden"
          >
            {/* 1. Fixed Header (Always visible) */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-[#0f172a]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-azul-blue/10 dark:bg-azul-blue/20 text-azul-blue flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight">
                    Crear Nuevo Plus
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                    Define un nuevo plus y selecciona sus reglas de cálculo e importe
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer shrink-0"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {/* 2. Scrollable Body */}
            <form id="create-plus-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
              {/* Categoría: Convenio vs Subrogados (Solo si Subrogado está activado en Configuración) */}
              {isSubrogado && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                    Categoría del Plus
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCategory('convenio')}
                      className={cn(
                        "py-1.5 px-3 rounded-lg font-black text-xs uppercase tracking-wider transition-all cursor-pointer text-center",
                        category === 'convenio'
                          ? "bg-azul-blue text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                      )}
                    >
                      Convenio General
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('subrogado')}
                      className={cn(
                        "py-1.5 px-3 rounded-lg font-black text-xs uppercase tracking-wider transition-all cursor-pointer text-center",
                        category === 'subrogado'
                          ? "bg-amber-600 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                      )}
                    >
                      Subrogados (SUB)
                    </button>
                  </div>
                </div>
              )}

              {/* Nombre e Importe */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                    Nombre del Nuevo Plus
                  </label>
                  <LocalInput
                    value={name}
                    onChange={setName}
                    placeholder="Ej: Plus SuperDriver o Supermadrugue"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 focus:border-azul-blue rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white outline-none transition-all text-xs"
                  />
                  {category === 'subrogado' && name.trim() && !name.toUpperCase().endsWith(' SUB') && (
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 ml-1">
                      Se guardará como: <span className="underline">{name.trim()} SUB</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                    Nuevo Importe (€)
                  </label>
                  <div className="relative">
                    <LocalInput
                      type="number"
                      value={value}
                      onChange={setValue}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 focus:border-azul-blue rounded-xl px-3 py-2 pr-6 font-bold text-slate-900 dark:text-white outline-none transition-all text-xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      €
                    </span>
                  </div>
                </div>
              </div>

              {/* Pagas Anuales */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                  Pagas Anuales
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
                  {([12, 14] as const).map(pg => (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setPagas(pg)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                        pagas === pg
                          ? "bg-white dark:bg-slate-700 text-azul-blue dark:text-blue-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                      )}
                    >
                      {pg} Pagas
                    </button>
                  ))}
                </div>
              </div>

              {/* Opciones de Visualización y Activación: Nómina y Etiquetas de Turnos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Activar en nómina */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1 flex items-center gap-1">
                    <CalendarCheck size={11} className="text-azul-blue" />
                    <span>Nómina Mensual</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDefaultActive(!defaultActive)}
                    className={cn(
                      "w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer min-h-[44px]",
                      defaultActive 
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                    )}
                  >
                    <span className="text-left text-[11px] sm:text-xs">Activar por defecto en nómina</span>
                    <div className={cn(
                      "w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0 ml-1.5",
                      defaultActive ? "bg-emerald-600 text-white" : "bg-slate-300 dark:bg-slate-600"
                    )}>
                      {defaultActive && <Check size={10} strokeWidth={4} />}
                    </div>
                  </button>
                </div>

                {/* 2. Mostrar en etiquetas 'Pluses generados del mes' */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1 flex items-center gap-1">
                    <Tag size={11} className="text-azul-blue" />
                    <span>Turnos y Nómina</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowInMonthTags(!showInMonthTags)}
                    className={cn(
                      "w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer min-h-[44px]",
                      showInMonthTags 
                        ? "bg-azul-blue/10 dark:bg-azul-blue/20 border-azul-blue text-azul-blue dark:text-blue-300"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                    )}
                  >
                    <span className="text-left text-[11px] sm:text-xs">Mostrar en 'Pluses generados del mes'</span>
                    <div className={cn(
                      "w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0 ml-1.5",
                      showInMonthTags ? "bg-azul-blue text-white" : "bg-slate-300 dark:bg-slate-600"
                    )}>
                      {showInMonthTags && <Check size={10} strokeWidth={4} />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Selector de Comportamiento / Función con reglas inline */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                    Comportamiento y Reglas de Cálculo
                  </label>
                  <span className="text-[10px] font-black uppercase tracking-wider text-azul-blue dark:text-blue-400">
                    {currentOption.label}
                  </span>
                </div>

                {/* Grid de opciones de cálculo con reglas embebidas debajo de la opción seleccionada (2 columnas en móvil) */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {behaviorOptions.map(opt => {
                    const Icon = opt.icon;
                    const isSelected = behavior === opt.id;
                    const hasInlineConfig = !!opt.hasInlineConfig;

                    return (
                      <div 
                        key={opt.id}
                        className={cn(
                          "transition-all flex flex-col",
                          isSelected && hasInlineConfig ? "col-span-2 sm:col-span-2 md:col-span-3" : "col-span-1"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleBehaviorChange(opt.id)}
                          className={cn(
                            "w-full p-2 sm:p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 relative",
                            isSelected
                              ? "bg-azul-blue/10 dark:bg-azul-blue/20 border-azul-blue shadow-xs ring-1 ring-azul-blue/50"
                              : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", opt.color)}>
                              <Icon size={14} />
                            </div>
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-azul-blue text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Check size={10} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <div className="mt-1">
                            <div className={cn(
                              "text-[11px] sm:text-xs font-black uppercase tracking-tight",
                              isSelected ? "text-azul-blue dark:text-blue-300" : "text-slate-800 dark:text-slate-200"
                            )}>
                              {opt.label}
                            </div>
                            <div className="text-[9.5px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight line-clamp-2 mt-0.5">
                              {opt.example}
                            </div>
                          </div>
                        </button>

                        {/* Reglas de edición inline debajo de Madrugue */}
                        {isSelected && opt.id === 'madrugue' && (
                          <div className="mt-2 p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                              <div className="flex items-center gap-1.5">
                                <Sunrise size={14} />
                                <span className="text-xs font-black uppercase tracking-wider">
                                  Reglas de Madrugue
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/80">
                                Editable también en la tarjeta
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">
                                  Hora Inicio Tramo
                                </label>
                                <LocalInput
                                  type="time"
                                  value={madrugueStart}
                                  onChange={setMadrugueStart}
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2.5 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">
                                  Hora Fin Tramo
                                </label>
                                <LocalInput
                                  type="time"
                                  value={madrugueEnd}
                                  onChange={setMadrugueEnd}
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2.5 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                />
                              </div>
                            </div>

                            <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1">
                                  Salida posterior a:
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setMadrugueMinEndEnabled(!madrugueMinEndEnabled)}
                                  className={cn(
                                    "relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
                                    madrugueMinEndEnabled ? "bg-azul-blue" : "bg-slate-300 dark:bg-slate-700"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform",
                                      madrugueMinEndEnabled ? "translate-x-4" : "translate-x-1"
                                    )}
                                  />
                                </button>
                              </div>

                              {madrugueMinEndEnabled && (
                                <div className="w-28">
                                  <LocalInput
                                    type="time"
                                    value={madrugueMinEnd}
                                    onChange={setMadrugueMinEnd}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2 py-1 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Reglas de edición inline debajo de Nocturnas */}
                        {isSelected && opt.id === 'nocturnas' && (
                          <div className="mt-2 p-3 sm:p-3.5 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/5 border border-indigo-500/20 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                              <Moon size={14} />
                              <span className="text-xs font-black uppercase tracking-wider">
                                Reglas de Nocturnidad
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">
                                  Hora Inicio Noche
                                </label>
                                <LocalInput
                                  type="time"
                                  value={nocturnaStart}
                                  onChange={setNocturnaStart}
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2.5 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">
                                  Hora Fin Noche
                                </label>
                                <LocalInput
                                  type="time"
                                  value={nocturnaEnd}
                                  onChange={setNocturnaEnd}
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2.5 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Reglas de edición inline debajo de Manutención */}
                        {isSelected && opt.id === 'manutencion' && (
                          <div className="mt-2 p-3 sm:p-3.5 rounded-2xl bg-teal-500/10 dark:bg-teal-500/5 border border-teal-500/20 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
                              <Utensils size={14} />
                              <span className="text-xs font-black uppercase tracking-wider">
                                Tramos de Manutención / Dietas
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">
                                  Almuerzo / Comida
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <LocalInput
                                    type="time"
                                    value={lunchStart}
                                    onChange={setLunchStart}
                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                  />
                                  <span className="text-xs text-slate-400 font-bold">a</span>
                                  <LocalInput
                                    type="time"
                                    value={lunchEnd}
                                    onChange={setLunchEnd}
                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">
                                  Cena
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <LocalInput
                                    type="time"
                                    value={dinnerStart}
                                    onChange={setDinnerStart}
                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                  />
                                  <span className="text-xs text-slate-400 font-bold">a</span>
                                  <LocalInput
                                    type="time"
                                    value={dinnerEnd}
                                    onChange={setDinnerEnd}
                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-azul-blue rounded-xl px-2 py-1.5 font-bold text-slate-700 dark:text-white outline-none text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Caja de Explicación Detallada de la opción seleccionada */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-lg bg-azul-blue/10 text-azul-blue flex items-center justify-center shrink-0 mt-0.5">
                    <Info size={12} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                      {currentOption.label}: <span className="font-normal text-slate-600 dark:text-slate-300">{currentOption.description}</span>
                    </p>
                    <p className="text-[10px] font-semibold text-azul-blue dark:text-blue-400 mt-0.5">
                      {currentOption.example}
                    </p>
                  </div>
                </div>
              </div>
            </form>

            {/* 3. Fixed Footer (Always visible) */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50/80 dark:bg-slate-900/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="create-plus-form"
                disabled={!name.trim() || value === ''}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-azul-blue hover:bg-azul-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider shadow-md shadow-azul-blue/20 transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles size={14} />
                <span>Crear Plus</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
