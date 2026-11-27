/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { 
  Table, 
  Settings as SettingsIcon, 
  Calendar as CalendarIcon, 
  FileText, 
  BarChart3, 
  Plus, 
  Trash2, 
  ArrowLeftRight,
  Edit2, 
  Save, 
  X, 
  MoreVertical,
  LogOut,
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ArrowUp,
  Clock,
  Moon,
  Sun,
  CalendarDays,
  List,
  AlertCircle,
  CheckCircle2,
  Wallet,
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Zap,
  Shield,
  Activity,
  DollarSign,
  Coins,
  Briefcase,
  CreditCard,
  Umbrella,
  Cloud,
  CloudOff,
  RefreshCw,
  Wrench,
  QrCode,
  Share2,
  Sparkles,
  HardDrive,
  MessageSquare,
  MessageSquarePlus,
  Users,
  FolderOpen,
  Download,
  Lock,
  EyeOff,
  Loader2,
  Tag,
  Calendar,
  Sliders,
  Bell,
  Check
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  getDay, 
  addYears, 
  addDays,
  differenceInYears,
  differenceInDays,
  parseISO,
  isValid,
  isSunday,
  startOfDay,
  setHours,
  setMinutes,
  isWithinInterval,
  differenceInMinutes
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { 
  cn, 
  type ShiftType, 
  type ShiftEntry, 
  type DayShift, 
  type LevelData, 
  type YearlyLevels,
  type PlusesData, 
  type YearlyPluses,
  type MonthlyOptions, 
  type Settings,
  type SharedQuadrantInfo,
  type SwapNotification,
  type SwapRequest,
  INITIAL_LEVELS_PASAJE,
  INITIAL_PLUSES_PASAJE,
  getPlusesWithContractTypeDefaults
} from './types';
import { 
  auth, 
  loginWithGoogle, 
  logout, 
  onAuthStateChanged, 
  User,
  dbSaveSettings, 
  dbGetSettings, 
  dbSaveShift, 
  dbDeleteShift, 
  dbGetShifts, 
  dbSaveLevels, 
  dbGetLevels, 
  dbSavePluses, 
  dbGetPluses,
  dbDeletePlus,
  dbGetQuadrantsSharedWithMe,
  dbGetSharingConfig,
  dbClearAllUserData,
  dbSaveShiftsBatch,
  dbSubscribeSuggestions,
  dbSubscribeUserShifts,
  dbSubscribeSwapNotifications,
  dbMarkSwapNotificationRead,
  dbDeleteSwapNotification,
  dbSendSwapNotification,
  dbSubscribeSentSwapRequests,
  dbSubscribeReceivedSwapRequests,
  dbUpdateSwapRequestStatus,
  dbDeleteSwapRequest,
  type StoredSuggestion
} from './firebase';
import { 
  getShiftDuration, 
  getNightHours, 
  isMadrugue, 
  checkManutencion, 
  getStatsForShifts, 
  formatNumber, 
  formatCurrency,
  calculateLevelMetrics,
  safeFormat
} from './utils';
import { 
  queueOrExecute, 
  useSyncQueue, 
  setQueueProcessedToastCallback,
  clearSyncQueue
} from './syncQueue';
import { LocalInput } from './components/LocalInput';
import { TurnosTab } from './components/TurnosTab';
import { ConfirmModal } from './components/ConfirmModal';
import { WelcomeModal } from './components/WelcomeModal';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getAuthHeaders } from './utils/authHeaders';
import { APP_VERSION, UPDATES_HISTORY, isWednesdayReleaseDay, type AppUpdate } from './data/updatesHistory';
import { registerSW } from 'virtual:pwa-register';

const TablasTab = lazy(() => import('./components/TablasTab').then(m => ({ default: m.TablasTab })));
const ConfiguracionTab = lazy(() => import('./components/ConfiguracionTab').then(m => ({ default: m.ConfiguracionTab })));
const ResumenTab = lazy(() => import('./components/ResumenTab').then(m => ({ default: m.ResumenTab })));
const ContadorTab = lazy(() => import('./components/ContadorTab').then(m => ({ default: m.ContadorTab })));
const HerramientasTab = lazy(() => import('./components/HerramientasTab').then(m => ({ default: m.HerramientasTab })));
const DataBackupModal = lazy(() => import('./components/DataBackupModal').then(m => ({ default: m.DataBackupModal })));
const ChangelogModal = lazy(() => import('./components/ChangelogModal').then(m => ({ default: m.ChangelogModal })));
const SuggestionModal = lazy(() => import('./components/SuggestionModal').then(m => ({ default: m.SuggestionModal })));
const GuestWorkspaceModal = lazy(() => import('./components/GuestWorkspaceModal').then(m => ({ default: m.GuestWorkspaceModal })));
const ShareQuadrantModal = lazy(() => import('./components/ShareQuadrantModal').then(m => ({ default: m.ShareQuadrantModal })));

// --- Constants & Initial Data ---

const INITIAL_LEVELS: LevelData[] = [
  { nivel: 1, anual: 19343.52 },
  { nivel: 2, anual: 22907.89 },
  { nivel: 3, anual: 23596.68 },
  { nivel: 4, anual: 24068.48 },
  { nivel: 5, anual: 24540.55 },
  { nivel: 6, anual: 25522.17 },
  { nivel: 7, anual: 26543.06 },
];

const INITIAL_PLUSES: PlusesData = {
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
  'Teamleader': { value: 80.23, pagas: 12, enabled: false, isVariable: false },
  'Jornada Irregular': { value: 149.00, pagas: 12, enabled: false, isVariable: false },
  'Turnicidad 2': { value: 85.96, pagas: 12, enabled: true, isVariable: true },
  'Turnicidad 3': { value: 114.61, pagas: 12, enabled: true, isVariable: true },
  'Turnicidad 4': { value: 131.81, pagas: 12, enabled: true, isVariable: true },
  'Turnicidad 5+': { value: 149.00, pagas: 12, enabled: true, isVariable: true },
  'ARCO': { value: 170.00, pagas: 12, enabled: false, isVariable: false },
  'RCO': { value: 270.00, pagas: 12, enabled: false, isVariable: false },
  'Nocturnas SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true, startHour: '22:00', endHour: '06:00' },
  'Madrugue SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true, madrugueStart: '02:00', madrugueEnd: '06:55' },
  'Manutención/Comida SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true, startHour: '14:00', endHour: '16:00', startHour2: '21:00', endHour2: '23:00' },
  'Transporte SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true },
  'Festivo SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true },
  'Domingo SUB': { value: 0.00, pagas: 12, enabled: true, isVariable: true },
  'Jornada Irregular Diaria': { value: 0.00, pagas: 12, enabled: false, isVariable: true },
  'Cambio de función': { value: 0.00, pagas: 12, enabled: false, isVariable: true },
};

const migratePluses = (parsed: any): YearlyPluses => {
  if (!parsed || typeof parsed !== 'object') {
    return { [new Date().getFullYear()]: { ...INITIAL_PLUSES } };
  }
  const migrated: YearlyPluses = {};
  Object.keys(parsed).forEach(year => {
    const yearData = parsed[year];
    if (!yearData || typeof yearData !== 'object') return;
    migrated[Number(year)] = {};
    Object.keys(yearData).forEach(name => {
      const val = yearData[name];
      if (!val) return;
      const lowerName = name.toLowerCase();
      const isForcedFixed = ['supervision', 'jardinera', 'compl plus psf'].includes(lowerName);
      
      let finalVal = typeof val === 'number' ? val : val.value;
      if (name === 'Manutención' && finalVal === 6.47) finalVal = 6.74;
      if (name === 'Madrugue' && finalVal === 6.47) finalVal = 6.74;
      if (name === 'Domingo' && finalVal === 2.93) finalVal = 2.94;

      if (typeof val === 'number') {
        migrated[Number(year)][name] = { 
          value: finalVal, 
          pagas: 12, 
          enabled: INITIAL_PLUSES[name]?.enabled ?? true, 
          isVariable: isForcedFixed ? false : (INITIAL_PLUSES[name]?.isVariable ?? false)
        };
      } else {
        migrated[Number(year)][name] = {
          ...val,
          value: finalVal,
          enabled: val.enabled !== undefined ? val.enabled : (INITIAL_PLUSES[name]?.enabled ?? true),
          isVariable: isForcedFixed ? false : (val.isVariable ?? INITIAL_PLUSES[name]?.isVariable ?? false)
        };
      }
    });
    // Backwards compatibility migration: make sure all default pluses exist
    Object.keys(INITIAL_PLUSES).forEach(name => {
      if (!migrated[Number(year)][name]) {
        migrated[Number(year)][name] = { ...INITIAL_PLUSES[name] };
      }
    });
  });

  // Also make sure the current year exists
  const currentYear = new Date().getFullYear();
  if (!migrated[currentYear]) {
    migrated[currentYear] = { ...INITIAL_PLUSES };
  } else {
    Object.keys(INITIAL_PLUSES).forEach(name => {
      if (!migrated[currentYear][name]) {
        migrated[currentYear][name] = { ...INITIAL_PLUSES[name] };
      }
    });
  }

  return migrated;
};

const INITIAL_SETTINGS: Settings = {
  contractType: 'Completo',
  pagas: 14,
  seniorityDate: safeFormat(new Date(), 'yyyy-MM-dd'),
  nextLevelDate: safeFormat(addYears(new Date(), 1), 'yyyy-MM-dd'),
  holidays: [],
  vacations: [],
  frozenPeriods: [],
  irpf: 0,
  rateContingencias: 4.7,
  rateDesempleo: 1.55,
  rateFormacion: 0.10,
  rateEquidad: 0.15,
  cuotaSindical: 0,
  currentLevel: 1,
  selectedLevel: 1,
  manualLevelProgression: false,
  monthlyOptions: {},
  counterPeriod: { 
    start: safeFormat(new Date(new Date().getFullYear() - 1, 11, 1), 'yyyy-MM-dd'), 
    end: safeFormat(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd') 
  },
  counterTargets: {},
  isSubrogado: false,
  expandedTablasSections: {
    convenio: true,
    subrogados: false
  },
  savedPayrolls: []
};

// --- Main Component ---

export default function App() {
  const TABS = ['Configuracion', 'Contador', 'Tablas', 'Turnos', 'Herramientas', 'Resumen'] as const;
  type TabId = typeof TABS[number];

  // --- State ---
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('settings');
    if (!saved) return INITIAL_SETTINGS;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        const merged = { ...INITIAL_SETTINGS, ...parsed };
        merged.monthlyOptions = parsed.monthlyOptions || {};
        merged.counterPeriod = parsed.counterPeriod || INITIAL_SETTINGS.counterPeriod;
        merged.counterTargets = parsed.counterTargets || {};
        merged.expandedTablasSections = parsed.expandedTablasSections || INITIAL_SETTINGS.expandedTablasSections;
        merged.savedPayrolls = parsed.savedPayrolls || [];
        merged.uploadedPayrolls = parsed.uploadedPayrolls || [];
        return merged;
      }
      return INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem('activeTab');
    if (saved) return saved as TabId;
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) return 'Configuracion';
    return 'Turnos';
  });
  const [direction, setDirection] = useState(0);

  // --- Auth & Synchronization States ---
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme_preference');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  const isAdmin = Boolean(user?.email && ['gelo.mm92@gmail.com', 'angel2martinez92@gmail.com'].includes(user.email.toLowerCase().trim()));

  useEffect(() => {
    const isDarkActive = theme === 'dark';
    if (isDarkActive) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const [isSyncing, setIsSyncing] = useState(false);
  const {
    queueLength,
    failedCount,
    isOnline,
    isSyncing: isSyncingQueue,
    processQueue,
    retryFailed,
    dismissFailed,
    downloadSyncBackup,
  } = useSyncQueue();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('success');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; title: string; desc: string } | null>(null);

  // Register callback to notify user when background offline sync queue items finish
  useEffect(() => {
    setQueueProcessedToastCallback((count: number) => {
      setToastMessage({
        type: 'success',
        title: 'Sincronización Completada',
        desc: `Se ${count === 1 ? 'ha guardado 1 cambio pendiente' : `han guardado ${count} cambios pendientes`} en la nube automáticamente.`
      });
    });
  }, []);

  // Automatically dismiss toast notifications after 3.5 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeSharedOwner, setActiveSharedOwner] = useState<SharedQuadrantInfo | null>(null);
  const [sharedQuadrantsAvailable, setSharedQuadrantsAvailable] = useState<SharedQuadrantInfo[]>([]);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('is_guest_mode') === 'true';
  });
  const [guestWorkerName, setGuestWorkerName] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('guest_worker_name')) || 'Compañero';
  });
  const [qrCopied, setQrCopied] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollListenerRef = useRef<(() => void) | null>(null);
  const [isTabScrolled, setIsTabScrolled] = useState(false);

  const [levels, setLevels] = useState<YearlyLevels>(() => {
    const saved = localStorage.getItem('levels');
    if (!saved) return { [new Date().getFullYear()]: INITIAL_LEVELS };
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return { [new Date().getFullYear()]: parsed };
      return parsed;
    } catch {
      return { [new Date().getFullYear()]: INITIAL_LEVELS };
    }
  });

  const [pluses, setPluses] = useState<YearlyPluses>(() => {
    const saved = localStorage.getItem('pluses');
    if (!saved) return { [new Date().getFullYear()]: { ...INITIAL_PLUSES } };
    try {
      return migratePluses(JSON.parse(saved));
    } catch {
      return { [new Date().getFullYear()]: { ...INITIAL_PLUSES } };
    }
  });

  const [levelsPasaje, setLevelsPasaje] = useState<YearlyLevels>(() => {
    const saved = localStorage.getItem('levels_pasaje');
    if (!saved) return { [new Date().getFullYear()]: INITIAL_LEVELS_PASAJE };
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return { [new Date().getFullYear()]: parsed };
      return parsed;
    } catch {
      return { [new Date().getFullYear()]: INITIAL_LEVELS_PASAJE };
    }
  });

  const [plusesPasaje, setPlusesPasaje] = useState<YearlyPluses>(() => {
    const saved = localStorage.getItem('pluses_pasaje');
    let loaded: YearlyPluses;
    if (!saved) {
      loaded = { [new Date().getFullYear()]: { ...INITIAL_PLUSES_PASAJE } };
    } else {
      try {
        loaded = migratePluses(JSON.parse(saved));
      } catch {
        loaded = { [new Date().getFullYear()]: { ...INITIAL_PLUSES_PASAJE } };
      }
    }
    const savedSettings = localStorage.getItem('settings');
    let isParcial = false;
    if (savedSettings) {
      try {
        const s = JSON.parse(savedSettings);
        if (s?.contractType === 'Parcial') isParcial = true;
      } catch {}
    }
    if (isParcial) {
      Object.keys(loaded).forEach(y => {
        loaded[Number(y)] = getPlusesWithContractTypeDefaults(loaded[Number(y)], 'Parcial');
      });
    }
    return loaded;
  });

  const [shifts, setShifts] = useState<DayShift[]>(() => {
    const saved = localStorage.getItem('shifts');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('app_has_loaded')) {
      return false;
    }
    return true;
  });
  const [comparisonA, setComparisonA] = useState<{ start: string; end: string }[]>([{ start: '', end: '' }]);
  const [comparisonB, setComparisonB] = useState<{ start: string; end: string }[]>([{ start: '', end: '' }]);
  const [currentMonthTurnos, setCurrentMonthTurnos] = useState(() => {
    const saved = localStorage.getItem('currentMonthTurnos');
    if (saved) {
      const parsed = parseISO(saved);
      if (isValid(parsed)) return parsed;
    }
    return startOfMonth(new Date());
  });

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved as 'calendar' | 'list') || 'calendar';
  });

  // --- Pull to Refresh State ---
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [hasInstalledUpdateNotice, setHasInstalledUpdateNotice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (sessionStorage.getItem('app_manual_update_installed') === '1') {
        return false;
      }
      const lastSeenVersion = localStorage.getItem('app_last_seen_version');
      if (!lastSeenVersion) {
        return Boolean(
          localStorage.getItem('settings') ||
          localStorage.getItem('shifts') ||
          localStorage.getItem('hasSeenWelcome')
        );
      }
      return lastSeenVersion !== APP_VERSION;
    } catch {
      return false;
    }
  });
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [serverLatestUpdate, setServerLatestUpdate] = useState<AppUpdate | null>(null);
  const [unreadSuggestionsCount, setUnreadSuggestionsCount] = useState(0);
  const [swapNotifications, setSwapNotifications] = useState<SwapNotification[]>([]);
  const [sentSwapRequests, setSentSwapRequests] = useState<SwapRequest[]>([]);
  const [receivedSwapRequests, setReceivedSwapRequests] = useState<SwapRequest[]>([]);
  const [hasLoadedReceivedSwapRequests, setHasLoadedReceivedSwapRequests] = useState(false);

  const activeSwapNotifications = useMemo(() => {
    const receivedById = new Map<string, SwapRequest>(receivedSwapRequests.map(r => [r.id, r]));
    return swapNotifications.filter((n) => {
      if (n.type !== 'shift_swap_request') return true;
      if (n.status === 'accepted' || n.status === 'rejected' || n.status === 'undone') return false;
      if (n.requestId) {
        const linked = receivedById.get(n.requestId);
        if (linked && linked.status !== 'pending') return false;
        if (hasLoadedReceivedSwapRequests && !linked) return false;
      }
      return true;
    });
  }, [swapNotifications, receivedSwapRequests, hasLoadedReceivedSwapRequests]);

  const unreadSwapCount = useMemo(
    () => activeSwapNotifications.filter(n => !n.read).length,
    [activeSwapNotifications]
  );
  const toastedSwapIdsRef = useRef<Set<string>>(new Set());
  const [respondingSwapReqId, setRespondingSwapReqId] = useState<string | null>(null);
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const appBootTimestampRef = useRef<number>(Date.now());
  const isAutoUpdatingStartupRef = useRef<boolean>(false);

  const dismissInstalledUpdateNotice = useCallback(() => {
    setHasInstalledUpdateNotice(false);
    try {
      localStorage.setItem('app_last_seen_version', APP_VERSION);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('app_manual_update_installed') === '1') {
        sessionStorage.removeItem('app_manual_update_installed');
        localStorage.setItem('app_last_seen_version', APP_VERSION);
        setHasInstalledUpdateNotice(false);
      } else if (!localStorage.getItem('app_last_seen_version')) {
        const hasExistingUserData = Boolean(
          localStorage.getItem('settings') ||
          localStorage.getItem('shifts') ||
          localStorage.getItem('hasSeenWelcome')
        );
        if (!hasExistingUserData) {
          localStorage.setItem('app_last_seen_version', APP_VERSION);
        }
      }
    } catch {}
  }, []);

  const performStartupAutoUpdate = useCallback(async (targetVersion?: string): Promise<boolean> => {
    if (isAutoUpdatingStartupRef.current) return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

    const guardKey = 'app_startup_auto_reload';
    try {
      const rawGuard = sessionStorage.getItem(guardKey);
      if (rawGuard) {
        const parsed = JSON.parse(rawGuard);
        if (
          Date.now() - (parsed?.at || 0) < 30000 &&
          (parsed?.fromVersion === APP_VERSION || (targetVersion && parsed?.targetVersion === targetVersion))
        ) {
          return false;
        }
      }
      sessionStorage.setItem(
        guardKey,
        JSON.stringify({
          fromVersion: APP_VERSION,
          targetVersion: targetVersion || 'sw',
          at: Date.now()
        })
      );
    } catch {}

    isAutoUpdatingStartupRef.current = true;
    setIsLoading(true);

    try {
      try {
        localStorage.removeItem('app_known_deploy_time');
      } catch {}

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }

      if (updateSWRef.current) {
        try {
          await Promise.race([
            updateSWRef.current(true),
            new Promise((resolve) => setTimeout(resolve, 1500))
          ]);
        } catch (swErr) {
          console.debug('Startup SW update error:', swErr);
        }
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.waiting) {
            try {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } catch {}
          }
          await reg.unregister();
        }
      }
    } catch (e) {
      console.warn('Startup auto-update error:', e);
    } finally {
      setTimeout(() => {
        window.location.reload();
      }, 250);
    }

    return true;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            const isStartupWindow = Date.now() - appBootTimestampRef.current < 6000;
            if (isStartupWindow && navigator.onLine) {
              performStartupAutoUpdate().then((started) => {
                if (!started) setNeedRefresh(true);
              });
            } else {
              setNeedRefresh(true);
            }
          },
          onOfflineReady() {
            console.log('App is ready to work offline');
          },
          onRegisteredSW(swUrl, registration) {
            if (registration) {
              swRegistrationRef.current = registration;
              const checkUpdate = () => {
                registration.update().catch(err => console.debug('SW update check failed:', err));
              };

              checkUpdate();
              const interval = setInterval(checkUpdate, 60 * 1000);

              const handleVisibilityOrFocus = () => {
                if (document.visibilityState === 'visible') {
                  checkUpdate();
                }
              };

              document.addEventListener('visibilitychange', handleVisibilityOrFocus);
              window.addEventListener('focus', handleVisibilityOrFocus);
              window.addEventListener('online', handleVisibilityOrFocus);

              return () => {
                clearInterval(interval);
                document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
                window.removeEventListener('focus', handleVisibilityOrFocus);
                window.removeEventListener('online', handleVisibilityOrFocus);
              };
            }
          }
        });
        updateSWRef.current = updateSW;
      } catch (e) {
        console.error('PWA SW Register error:', e);
      }
    }
  }, [performStartupAutoUpdate]);

  // Version check against server: auto-load on startup, prompt with orange badge during active session
  useEffect(() => {
    const checkDeploymentVersion = async (isInitialStartup = false) => {
      try {
        const res = await fetch(`/api/version?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const fetchedServerVersion = data.version;
        if (fetchedServerVersion) {
          setServerVersion(fetchedServerVersion);
        }
        if (data.latestUpdate) {
          setServerLatestUpdate(data.latestUpdate);
        }
        if (!fetchedServerVersion) return;

        if (typeof fetchedServerVersion === 'string' && fetchedServerVersion !== APP_VERSION) {
          if (isInitialStartup && navigator.onLine) {
            const started = await performStartupAutoUpdate(fetchedServerVersion);
            if (!started) {
              setNeedRefresh(true);
            }
          } else {
            setNeedRefresh(true);
            if (swRegistrationRef.current) {
              swRegistrationRef.current.update().catch(() => {});
            }
          }
        }
      } catch (err) {
        // Silently handle network interruptions
      }
    };

    // Check immediately on app startup to load any already-published version
    checkDeploymentVersion(true);
    const pollInterval = setInterval(() => checkDeploymentVersion(false), 30 * 1000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        checkDeploymentVersion(false);
      }
    };

    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);
    window.addEventListener('online', handleFocusOrVisible);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
      window.removeEventListener('online', handleFocusOrVisible);
    };
  }, [performStartupAutoUpdate]);

  const latestSuggestionTimestampRef = useRef<number>(0);

  // Admin in-app notification: real-time Firestore subscription + server API fallback
  useEffect(() => {
    if (!isAdmin) {
      setUnreadSuggestionsCount(0);
      return;
    }

    let apiList: StoredSuggestion[] = [];
    let fsList: StoredSuggestion[] = [];

    const parseTs = (item: any): number => {
      if (typeof item?.timestamp === 'number' && !isNaN(item.timestamp)) return item.timestamp;
      if (item?.createdAt) {
        const p = Date.parse(item.createdAt);
        if (!isNaN(p)) return p;
      }
      return 0;
    };

    const recomputeUnread = () => {
      const byId = new Map<string, number>();
      const fallbackSeen = new Set<string>();
      [...fsList, ...apiList].forEach((item) => {
        if (!item || !item.description) return;
        const ts = parseTs(item);
        const fallbackKey = `${(item.userName || '').trim()}::${(item.type || '').trim()}::${item.description.trim()}`;
        if (item.id && byId.has(item.id)) return;
        if (fallbackSeen.has(fallbackKey) && !byId.has(item.id)) return;
        byId.set(item.id || fallbackKey, ts);
        fallbackSeen.add(fallbackKey);
      });

      const lastRead = Number(localStorage.getItem('admin_last_read_suggestion_time') || '0');
      let maxTs = 0;
      let unread = 0;
      byId.forEach((ts) => {
        if (ts > maxTs) maxTs = ts;
        if (ts > lastRead) unread++;
      });
      latestSuggestionTimestampRef.current = maxTs;
      setUnreadSuggestionsCount(unread);
    };

    const checkApiSuggestions = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/suggestions?_t=${Date.now()}`, { cache: 'no-store', headers });
        if (!res.ok) return;
        const list = await res.json();
        if (Array.isArray(list)) {
          apiList = list;
          recomputeUnread();
        }
      } catch {
        // Ignore network hiccup
      }
    };

    let unsubFs: (() => void) | null = null;
    if (user) {
      unsubFs = dbSubscribeSuggestions(
        (items) => {
          fsList = items;
          recomputeUnread();
        },
        () => {}
      );
    }

    checkApiSuggestions();
    const interval = setInterval(checkApiSuggestions, 30 * 1000);
    return () => {
      clearInterval(interval);
      if (unsubFs) unsubFs();
    };
  }, [isAdmin, user?.uid]);

  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const activeSwapNotificationsRef = useRef<SwapNotification[]>(activeSwapNotifications);
  activeSwapNotificationsRef.current = activeSwapNotifications;
  const [headerBannerSessionIds, setHeaderBannerSessionIds] = useState<string[]>([]);

  useEffect(() => {
    if (isHeaderMenuOpen) {
      setHeaderBannerSessionIds(
        activeSwapNotificationsRef.current.filter((n) => !n.read).map((n) => n.id)
      );
    } else {
      setHeaderBannerSessionIds([]);
    }
  }, [isHeaderMenuOpen]);

  const headerBannerSwapNotifications = useMemo(() => {
    if (!isHeaderMenuOpen) return [];
    const sessionSet = new Set<string>(headerBannerSessionIds);
    return activeSwapNotifications.filter((n) => !n.read || sessionSet.has(n.id));
  }, [isHeaderMenuOpen, activeSwapNotifications, headerBannerSessionIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close header menu dropdown on scroll, touch swipe or wheel
  useEffect(() => {
    if (!isHeaderMenuOpen) return;

    const handleScrollOrSwipe = () => {
      setIsHeaderMenuOpen(false);
    };

    window.addEventListener('scroll', handleScrollOrSwipe, { capture: true, passive: true });
    window.addEventListener('touchmove', handleScrollOrSwipe, { passive: true });
    window.addEventListener('wheel', handleScrollOrSwipe, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrSwipe, { capture: true });
      window.removeEventListener('touchmove', handleScrollOrSwipe);
      window.removeEventListener('wheel', handleScrollOrSwipe);
    };
  }, [isHeaderMenuOpen]);

  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshing) return;
    const el = e.currentTarget;
    if (el.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    } else {
      setIsPulling(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPulling || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0) {
      const resistance = 0.35;
      const calculatedPull = diff * resistance;
      setPullDistance(Math.min(95, calculatedPull));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling || isRefreshing) return;
    setIsPulling(false);
    if (pullDistance >= 60) {
      setIsRefreshing(true);
      setPullDistance(60);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } else {
      setPullDistance(0);
    }
  };

  const handleModalRefresh = async () => {
    setIsRefreshing(true);
    try {
      try {
        localStorage.removeItem('app_known_deploy_time');
        if (needRefresh) {
          sessionStorage.setItem('app_manual_update_installed', '1');
        }
      } catch (e) {}
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }
      if (needRefresh && updateSWRef.current) {
        try {
          await updateSWRef.current(true);
        } catch (swErr) {
          console.debug("SW update error:", swErr);
        }
      } else if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
    } catch (e) {
      console.warn("Cache purge error on update:", e);
    } finally {
      // Guarantee page reload so it never gets stuck on 'Actualizando App...'
      setTimeout(() => {
        window.location.reload();
      }, 700);
    }
  };

  const handleCloseUpdateModal = () => {
    setIsUpdateModalOpen(false);
    if (!needRefresh && hasInstalledUpdateNotice) {
      dismissInstalledUpdateNotice();
    }
  };

  const handleForcePurgeServiceWorker = async () => {
    if (isPurgingCache || isRefreshing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setToastMessage({
        type: 'error',
        title: 'Sin conexión a internet',
        desc: 'Para limpiar la caché y actualizar la versión necesitas tener conexión a internet.'
      });
      return;
    }
    setIsPurgingCache(true);
    setPurgeSuccess(false);

    try {
      // 1. Limpiar identificadores y marcas de actualización temporales sin tocar datos de usuario
      try {
        localStorage.removeItem('app_known_deploy_time');
      } catch (e) {}

      // 2. Desregistrar explícitamente todos los Service Workers instalados
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        } catch (swErr) {
          console.debug("ServiceWorker unregister warning:", swErr);
        }
      }

      // 3. Purgar completamente todos los contenedores de CacheStorage (HTML, CSS, JS cacheados)
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
        } catch (cacheErr) {
          console.debug("CacheStorage purge warning:", cacheErr);
        }
      }

      setPurgeSuccess(true);
    } catch (err) {
      console.warn("Error al purgar la caché del Service Worker:", err);
    } finally {
      // Breve pausa para mostrar la animación de éxito y forzar la recarga limpia
      setTimeout(() => {
        try {
          const cleanUrl = window.location.origin + window.location.pathname + '?_purge=' + Date.now();
          window.location.replace(cleanUrl);
        } catch {
          window.location.reload();
        }
      }, 700);
    }
  };

  const visibleTabs = useMemo(() => {
    return TABS.filter(tab => {
      if (tab === 'Contador') return settings.isSubrogado;
      return true;
    });
  }, [settings.isSubrogado]);

  // --- Callbacks & Handlers ---
  const handleTabChange = (newTab: TabId) => {
    const currentIndex = TABS.indexOf(activeTab);
    const newIndex = TABS.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
    localStorage.setItem('activeTab', newTab);
    setSelectedDay(null);
  };

  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    // Clean up previous listener on the old node
    if (scrollContainerRef.current && scrollListenerRef.current) {
      scrollContainerRef.current.removeEventListener('scroll', scrollListenerRef.current);
    }

    if (node) {
      try {
        const savedPositions = JSON.parse(sessionStorage.getItem('scroll_positions') || '{}');
        const savedPos = savedPositions[activeTab] || 0;
        // Use a small timeout to ensure layout is complete before scrolling
        setTimeout(() => {
          if (node) {
            node.scrollTop = savedPos;
            setIsTabScrolled(savedPos > 100);
          }
        }, 0);
      } catch (e) {
        node.scrollTop = 0;
        setIsTabScrolled(false);
      }

      const handleScroll = () => {
        const pos = node.scrollTop;
        setIsTabScrolled(pos > 100);
        try {
          const savedPositions = JSON.parse(sessionStorage.getItem('scroll_positions') || '{}');
          savedPositions[activeTab] = pos;
          sessionStorage.setItem('scroll_positions', JSON.stringify(savedPositions));
        } catch (e) {
          // Ignore storage errors
        }
      };

      node.addEventListener('scroll', handleScroll, { passive: true });
      scrollListenerRef.current = handleScroll;
      scrollContainerRef.current = node;
    } else {
      scrollContainerRef.current = null;
      scrollListenerRef.current = null;
    }
  }, [activeTab]);

  useEffect(() => {
    // If we have loaded settings and activeTab is Contador but not allowed, fallback
    if (activeTab === 'Contador' && !settings.isSubrogado) {
      setActiveTab('Turnos');
    }
  }, [settings.isSubrogado, activeTab]);

  const handleSwipe = (offset: number) => {
    const currentIndex = visibleTabs.indexOf(activeTab);
    if (offset < -50 && currentIndex < visibleTabs.length - 1) {
      handleTabChange(visibleTabs[currentIndex + 1] as TabId);
    } else if (offset > 50 && currentIndex > 0) {
      handleTabChange(visibleTabs[currentIndex - 1] as TabId);
    }
  };

  const handleSetCurrentMonthTurnos = (date: Date) => {
    const monthStart = startOfMonth(date);
    setCurrentMonthTurnos(monthStart);
    localStorage.setItem('currentMonthTurnos', safeFormat(monthStart, 'yyyy-MM-dd'));
  };

  const handleSetViewMode = (mode: 'calendar' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: any) {
      if (error && (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user'))) {
        console.log('El usuario cerró la ventana de inicio de sesión de Google antes de completar la autenticación.');
        return;
      }
      console.error("Error al iniciar sesión con Google:", error);
      setToastMessage({
        type: 'error',
        title: 'Error de autenticación',
        desc: 'No se pudo completar el inicio de sesión. Por favor, inténtalo de nuevo.'
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleLogout = async () => {
    clearSyncQueue();
    setActiveSharedOwner(null);
    setSharedQuadrantsAvailable([]);
    setSwapNotifications([]);
    setSentSwapRequests([]);
    setReceivedSwapRequests([]);
    try {
      await logout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
    // Limpiamos los datos del usuario anterior de localStorage para evitar mezclas y fuga de privacidad
    localStorage.removeItem('settings');
    localStorage.removeItem('shifts');
    localStorage.removeItem('levels');
    localStorage.removeItem('pluses');
    localStorage.removeItem('last_uid');

    // Reseteamos el estado a los valores iniciales
    setSettings(INITIAL_SETTINGS);
    setShifts([]);
    setLevels({ [new Date().getFullYear()]: INITIAL_LEVELS });
    setPluses({ [new Date().getFullYear()]: { ...INITIAL_PLUSES } });
  };

  // Synchronized loading: listens to Google Auth and manages LocalStorage/Cloud Merge
  useEffect(() => {
    let active = true;
    let latestSyncId = 0;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      const runId = ++latestSyncId;
      setUser(currentUser);
      
      // If we are currently in Guest Workspace mode, DO NOT sync or overwrite coworker data with cloud
      if (localStorage.getItem('is_guest_mode') === 'true') {
        setIsLoading(false);
        return;
      }

      const savedUid = localStorage.getItem('last_uid');
      const isStaleAuthSync = () =>
        !active || runId !== latestSyncId || !auth.currentUser || !currentUser || auth.currentUser.uid !== currentUser.uid;
      
      if (currentUser) {
        setIsSyncing(true);
        dbGetQuadrantsSharedWithMe(currentUser.email || '', currentUser.uid)
          .then(list => {
            if (!isStaleAuthSync()) setSharedQuadrantsAvailable(list);
          })
          .catch(() => {});
        try {
          if (savedUid && savedUid !== currentUser.uid) {
            // DIFERENTE USUARIO DETECTADO: Limpiamos los datos locales antiguos para no fusionarlos
            localStorage.removeItem('settings');
            localStorage.removeItem('shifts');
            localStorage.removeItem('levels');
            localStorage.removeItem('pluses');

            if (isStaleAuthSync()) return;
            const cloudSettings = await dbGetSettings(currentUser.uid);
            if (isStaleAuthSync()) return;
            if (cloudSettings) {
              setSettings(cloudSettings);
              localStorage.setItem('settings', JSON.stringify(cloudSettings));
              
              const cloudShifts = await dbGetShifts(currentUser.uid);
              if (isStaleAuthSync()) return;
              setShifts(cloudShifts);
              localStorage.setItem('shifts', JSON.stringify(cloudShifts));
              
              const cloudLevels = await dbGetLevels(currentUser.uid);
              if (isStaleAuthSync()) return;
              setLevels(cloudLevels);
              localStorage.setItem('levels', JSON.stringify(cloudLevels));
              
              const cloudPluses = await dbGetPluses(currentUser.uid);
              if (isStaleAuthSync()) return;
              const migratedCloud = migratePluses(cloudPluses);
              setPluses(migratedCloud);
              localStorage.setItem('pluses', JSON.stringify(migratedCloud));
            } else {
              setSettings(INITIAL_SETTINGS);
              localStorage.setItem('settings', JSON.stringify(INITIAL_SETTINGS));
              
              setShifts([]);
              localStorage.setItem('shifts', JSON.stringify([]));
              
              const freshLevels = { [new Date().getFullYear()]: INITIAL_LEVELS };
              setLevels(freshLevels);
              localStorage.setItem('levels', JSON.stringify(freshLevels));
              
              const freshPluses = { [new Date().getFullYear()]: { ...INITIAL_PLUSES } };
              setPluses(freshPluses);
              localStorage.setItem('pluses', JSON.stringify(freshPluses));
            }
          } else {
            // Mismo usuario o primer login desde offline (savedUid es nulo)
            const cloudSettings = await dbGetSettings(currentUser.uid);
            
            if (cloudSettings) {
              // FUSION INTELIGENTE: Combinamos los datos de la nube con los locales de manera profunda
              const localSettingsStr = localStorage.getItem('settings');
              let mergedSettings = { ...cloudSettings };
              
              if (localSettingsStr) {
                try {
                  const localSettings = JSON.parse(localSettingsStr);
                  
                  // Fusionamos todas las propiedades dando prioridad a los datos de la nube
                  mergedSettings = {
                    ...INITIAL_SETTINGS,
                    ...localSettings,
                    ...cloudSettings,
                    monthlyOptions: {
                      ...(localSettings.monthlyOptions || {}),
                      ...(cloudSettings.monthlyOptions || {})
                    },
                    counterTargets: {
                      ...(localSettings.counterTargets || {}),
                      ...(cloudSettings.counterTargets || {})
                    },
                    yearlyCounterTargets: {
                      ...(localSettings.yearlyCounterTargets || {}),
                      ...(cloudSettings.yearlyCounterTargets || {})
                    },
                    yearlyCounterPeriods: {
                      ...(localSettings.yearlyCounterPeriods || {}),
                      ...(cloudSettings.yearlyCounterPeriods || {})
                    },
                    customizedCounterTargets: {
                      ...(localSettings.customizedCounterTargets || {}),
                      ...(cloudSettings.customizedCounterTargets || {})
                    },
                    expandedTablasSections: {
                      ...(localSettings.expandedTablasSections || {}),
                      ...(cloudSettings.expandedTablasSections || {})
                    },
                    subrogadoBaseSalaries: {
                      ...(localSettings.subrogadoBaseSalaries || {}),
                      ...(cloudSettings.subrogadoBaseSalaries || {})
                    },
                    yearlyUpdates: {
                      ...(localSettings.yearlyUpdates || {}),
                      ...(cloudSettings.yearlyUpdates || {})
                    },
                    yearlySubUpdates: {
                      ...(localSettings.yearlySubUpdates || {}),
                      ...(cloudSettings.yearlySubUpdates || {})
                    }
                  };

                  // Unión inteligente de arrays para evitar duplicados y conservar los datos
                  mergedSettings.holidays = Array.from(new Set([
                    ...(cloudSettings.holidays || []),
                    ...(localSettings.holidays || [])
                  ]));
                  
                  mergedSettings.vacations = Array.from(new Set([
                    ...(cloudSettings.vacations || []),
                    ...(localSettings.vacations || [])
                  ]));

                  // frozenPeriods: deduplicada por start_end 
                  const frozenMap = new Map<string, any>();
                  (cloudSettings.frozenPeriods || []).forEach((f: any) => {
                    if (f && f.start && f.end) frozenMap.set(`${f.start}_${f.end}`, f);
                  });
                  (localSettings.frozenPeriods || []).forEach((f: any) => {
                    if (f && f.start && f.end) frozenMap.set(`${f.start}_${f.end}`, f);
                  });
                  mergedSettings.frozenPeriods = Array.from(frozenMap.values());

                  // savedPayrolls: deduplicada por id
                  const savedPayrollsMap = new Map<string, any>();
                  (cloudSettings.savedPayrolls || []).forEach((p: any) => {
                    if (p && p.id) savedPayrollsMap.set(p.id, p);
                  });
                  (localSettings.savedPayrolls || []).forEach((p: any) => {
                    if (p && p.id) savedPayrollsMap.set(p.id, p);
                  });
                  mergedSettings.savedPayrolls = Array.from(savedPayrollsMap.values());

                  // uploadedPayrolls: deduplicada por id
                  const uploadedPayrollsMap = new Map<string, any>();
                  (cloudSettings.uploadedPayrolls || []).forEach((p: any) => {
                    if (p && p.id) uploadedPayrollsMap.set(p.id, p);
                  });
                  (localSettings.uploadedPayrolls || []).forEach((p: any) => {
                    if (p && p.id) uploadedPayrollsMap.set(p.id, p);
                  });
                  mergedSettings.uploadedPayrolls = Array.from(uploadedPayrollsMap.values());

                  // secondCompanyShifts: deduplicada por date
                  const secondShiftsMap = new Map<string, any>();
                  (cloudSettings.secondCompanyShifts || []).forEach((s: any) => {
                    if (s && s.date) secondShiftsMap.set(s.date, s);
                  });
                  (localSettings.secondCompanyShifts || []).forEach((s: any) => {
                    if (s && s.date) secondShiftsMap.set(s.date, s);
                  });
                  mergedSettings.secondCompanyShifts = Array.from(secondShiftsMap.values());

                  // Si hay diferencias detectadas entre lo fusionado y lo que estaba en la nube, lo subimos
                  if (JSON.stringify(mergedSettings) !== JSON.stringify(cloudSettings)) {
                    await dbSaveSettings(currentUser.uid, mergedSettings);
                  }
                } catch (e) {
                  console.error("Error fusing settings on auth load:", e);
                }
              }

              setSettings(mergedSettings);
              localStorage.setItem('settings', JSON.stringify(mergedSettings));

              // FUSION INTELIGENTE DE SHIFTS
              const cloudShifts = await dbGetShifts(currentUser.uid);
              const localShiftsStr = localStorage.getItem('shifts');
              let mergedShifts = [...cloudShifts];
              
              if (localShiftsStr) {
                try {
                  const localShifts: DayShift[] = JSON.parse(localShiftsStr);
                  const shiftsMap = new Map<string, DayShift>();
                  cloudShifts.forEach(s => shiftsMap.set(s.date, s));
                  localShifts.forEach(s => shiftsMap.set(s.date, s));
                  mergedShifts = Array.from(shiftsMap.values());

                  // Guardar de vuelta en local
                  localStorage.setItem('shifts', JSON.stringify(mergedShifts));

                  // Subir diferencias locales a la nube
                  const cloudDates = new Set(cloudShifts.map(s => s.date));
                  const localShiftsToUpload = localShifts.filter(s => {
                    const cloudVersion = shiftsMap.get(s.date);
                    return !cloudDates.has(s.date) || JSON.stringify(cloudVersion) !== JSON.stringify(s);
                  });

                  for (const s of localShiftsToUpload) {
                    await dbSaveShift(currentUser.uid, s);
                  }
                } catch (e) {
                  console.error("Error fusing shifts on auth load:", e);
                }
              } else {
                localStorage.setItem('shifts', JSON.stringify(cloudShifts));
              }
              setShifts(mergedShifts);

              // NIVELES
              if (isStaleAuthSync()) return;
              const cloudLevels = await dbGetLevels(currentUser.uid);
              if (isStaleAuthSync()) return;
              if (Object.keys(cloudLevels).length > 0) {
                setLevels(cloudLevels);
                localStorage.setItem('levels', JSON.stringify(cloudLevels));
              }

              // PLUSES
              if (isStaleAuthSync()) return;
              const cloudPluses = await dbGetPluses(currentUser.uid);
              if (isStaleAuthSync()) return;
              if (Object.keys(cloudPluses).length > 0) {
                const migratedCloud = migratePluses(cloudPluses);
                setPluses(migratedCloud);
                localStorage.setItem('pluses', JSON.stringify(migratedCloud));
              }
            } else {
              // First time logging in with no cloud database: migrate local data up to Firestore
              const localSettings = localStorage.getItem('settings');
              const localShifts = localStorage.getItem('shifts');
              const localLevels = localStorage.getItem('levels');
              const localPluses = localStorage.getItem('pluses');

              const parsedSettings = localSettings ? JSON.parse(localSettings) : settings;
              const parsedShifts = localShifts ? JSON.parse(localShifts) : [];
              const parsedLevels = localLevels ? JSON.parse(localLevels) : levels;
              const parsedPluses = migratePluses(localPluses ? JSON.parse(localPluses) : pluses);
              if (isStaleAuthSync()) return;
              setPluses(parsedPluses);
              localStorage.setItem('pluses', JSON.stringify(parsedPluses));

              await dbSaveSettings(currentUser.uid, parsedSettings);
              
              for (const s of parsedShifts) {
                if (isStaleAuthSync()) return;
                await dbSaveShift(currentUser.uid, s);
              }

              for (const year of Object.keys(parsedLevels).map(Number)) {
                if (isStaleAuthSync()) return;
                await dbSaveLevels(currentUser.uid, year, parsedLevels[year]);
              }

              for (const year of Object.keys(parsedPluses).map(Number)) {
                if (isStaleAuthSync()) return;
                await dbSavePluses(currentUser.uid, year, parsedPluses[year]);
              }
            }
          }

          if (!isStaleAuthSync()) {
            localStorage.setItem('last_uid', currentUser.uid);
          }
        } catch (error) {
          console.warn("Cloud synchronization failed, falling back to localStorage", error);
          
          const localSettings = localStorage.getItem('settings');
          const localShifts = localStorage.getItem('shifts');
          const localLevels = localStorage.getItem('levels');
          const localPluses = localStorage.getItem('pluses');

          if (localSettings) {
            try {
              const parsed = JSON.parse(localSettings);
              if (parsed.contractType) setSettings(parsed);
            } catch (e) {
              console.error(e);
            }
          }
          if (localShifts) {
            try {
              setShifts(JSON.parse(localShifts));
            } catch (e) {
              console.error(e);
            }
          }
          if (localLevels) {
            try {
              setLevels(JSON.parse(localLevels));
            } catch (e) {
              console.error(e);
            }
          }
          if (localPluses) {
            try {
              setPluses(migratePluses(JSON.parse(localPluses)));
            } catch (e) {
              console.error(e);
            }
          }
        } finally {
          setIsSyncing(false);
          setIsLoading(false);
        }
      } else {
        // Not authenticated: standard Offline LocalStorage load
        const localSettings = localStorage.getItem('settings');
        const localShifts = localStorage.getItem('shifts');
        const localLevels = localStorage.getItem('levels');
        const localPluses = localStorage.getItem('pluses');

        if (localSettings) {
          try {
            const parsed = JSON.parse(localSettings);
            if (parsed.contractType) setSettings(parsed);
          } catch (e) {
            console.error(e);
          }
        }
        if (localShifts) {
          try {
            setShifts(JSON.parse(localShifts));
          } catch (e) {
            console.error(e);
          }
        }
        if (localLevels) {
          try {
            setLevels(JSON.parse(localLevels));
          } catch (e) {
            console.error(e);
          }
        }
        if (localPluses) {
          try {
            setPluses(migratePluses(JSON.parse(localPluses)));
          } catch (e) {
            console.error(e);
          }
        }
        setIsLoading(false);
      }
    });

    // Mark as loaded in session if already skipping loading
    if (!isLoading) {
      sessionStorage.setItem('app_has_loaded', 'true');
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Additional settings parsing & welcome modal load (ran if offline/standalone or once mounted)
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
    
    // Avoid calculating levels or modifying settings while configurations are still loading or manual mode is active
    if (isLoading || settings.manualLevelProgression) return;
    
    // Automatic level up check triggers offline/on-mount if settings exist
    if (settings.seniorityDate) {
      const seniority = parseISO(settings.seniorityDate);
      if (isValid(seniority)) {
        const today = new Date();
        let totalFrozenDays = 0;
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

        const todayStart = startOfDay(today);
        const getMilestoneDate = (yearsToAdd: number) =>
          startOfDay(addDays(addYears(seniority, yearsToAdd), totalFrozenDays));

        const dateLvl2 = getMilestoneDate(1);
        const dateLvl3 = getMilestoneDate(4);
        const dateLvl4 = getMilestoneDate(6);
        const dateLvl5 = getMilestoneDate(8);
        const dateLvl6 = getMilestoneDate(10);
        const dateLvl7 = getMilestoneDate(12);

        let calculatedLevel = 1;
        let nextDate = dateLvl2;

        if (todayStart >= dateLvl7) {
          calculatedLevel = 7;
          nextDate = addYears(seniority, 100);
        } else if (todayStart >= dateLvl6) {
          calculatedLevel = 6;
          nextDate = dateLvl7;
        } else if (todayStart >= dateLvl5) {
          calculatedLevel = 5;
          nextDate = dateLvl6;
        } else if (todayStart >= dateLvl4) {
          calculatedLevel = 4;
          nextDate = dateLvl5;
        } else if (todayStart >= dateLvl3) {
          calculatedLevel = 3;
          nextDate = dateLvl4;
        } else if (todayStart >= dateLvl2) {
          calculatedLevel = 2;
          nextDate = dateLvl3;
        } else {
          calculatedLevel = 1;
          nextDate = dateLvl2;
        }

        const nextDateStr = safeFormat(nextDate, 'yyyy-MM-dd');

        if (settings.currentLevel !== calculatedLevel || settings.nextLevelDate !== nextDateStr) {
          const parsed = {
            ...settings,
            currentLevel: calculatedLevel,
            selectedLevel: calculatedLevel,
            nextLevelDate: nextDateStr
          };
          setSettings(parsed);
          localStorage.setItem('settings', JSON.stringify(parsed));
          if (user && !isGuestMode) {
            dbSaveSettings(user.uid, parsed).catch(console.warn);
          }
        }
      }
    }
  }, [isLoading, settings.seniorityDate]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('hasSeenWelcome', 'true');
  };

  const handleResetData = () => {
    setShowResetConfirm(true);
  };

  const confirmResetData = async () => {
    setShowResetConfirm(false);
    clearSyncQueue();

    if (user && !isGuestMode && !activeSharedOwner) {
      setIsSyncing(true);
      try {
        await dbClearAllUserData(user.uid);
      } catch (e) {
        console.warn("Error clearing cloud data on full reset:", e);
      } finally {
        setIsSyncing(false);
      }
    }

    const currentYear = new Date().getFullYear();
    setSettings(INITIAL_SETTINGS);
    setShifts([]);
    setLevels({ [currentYear]: INITIAL_LEVELS });
    setPluses({ [currentYear]: { ...INITIAL_PLUSES } });
    setLevelsPasaje({ [currentYear]: INITIAL_LEVELS_PASAJE });
    setPlusesPasaje({ [currentYear]: { ...INITIAL_PLUSES_PASAJE } });

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    window.location.reload();
  };

  // Manual Verification & explicit Cloud/Local Save with animated feedback & visual toast details
  const verifyAndSaveAllData = async () => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus datos (Modo Solo Lectura).`
      });
      return;
    }
    setSaveStatus('verifying');
    try {
      // 1. Fuerza la escritura local de todos nuestros estados de manera inmediata y síncrona
      localStorage.setItem('settings', JSON.stringify(settings));
      localStorage.setItem('shifts', JSON.stringify(shifts));
      localStorage.setItem('levels', JSON.stringify(levels));
      localStorage.setItem('pluses', JSON.stringify(pluses));
      localStorage.setItem('levels_pasaje', JSON.stringify(levelsPasaje));
      localStorage.setItem('pluses_pasaje', JSON.stringify(plusesPasaje));

      // 2. Si hay usuario conectado (o editor en la nube) y NO está en modo invitado, guardamos en Firestore
      const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
      if (targetUid && !isGuestMode) {
        setIsSyncing(true);
        // Guardamos configuración, niveles y pluses en la cuenta objetivo (personal o titular compartido)
        await dbSaveSettings(targetUid, settings);
        
        for (const yearStr of Object.keys(levels)) {
          const year = Number(yearStr);
          await dbSaveLevels(targetUid, year, levels[year]);
        }

        for (const yearStr of Object.keys(pluses)) {
          const year = Number(yearStr);
          await dbSavePluses(targetUid, year, pluses[year]);
        }
        
        // Respaldamos todos los turnos registrados
        for (const s of shifts) {
          await dbSaveShift(targetUid, s);
        }
        setIsSyncing(false);
      }

      setSaveStatus('success');
      setToastMessage({
        type: 'success',
        title: activeSharedOwner 
          ? '¡Cuadrante Compartido Guardado!'
          : isGuestMode 
            ? '¡Datos de Invitado Guardados!' 
            : '¡Verificación Completada Con Éxito!',
        desc: activeSharedOwner
          ? `Todos los cambios (turnos, configuración, tablas y contador) se han guardado directamente en la nube de ${activeSharedOwner.ownerName}.`
          : isGuestMode
            ? `Los turnos y datos de "${guestWorkerName}" se han guardado de forma segura en el dispositivo. La sincronización en la nube permanece pausada para proteger tus datos personales.`
            : user
              ? 'Todos tus turnos registrados, cuadrantes de nóminas de cada mes y niveles se han guardado con éxito localmente en este dispositivo y se han respaldado de forma segura en la nube de Google.'
              : 'Tus datos están guardados con máxima seguridad localmente en este dispositivo. Si prefieres hacer un respaldo en la nube y sincronizarlo entre varios dispositivos, puedes iniciar sesión con Google.'
      });

      // Cerramos el Toast después de 7 segundos
      setTimeout(() => {
        setToastMessage(null);
      }, 7000);
    } catch (e) {
      console.error("Manual verification failed:", e);
      setIsSyncing(false);
      setSaveStatus('error');
      setToastMessage({
        type: 'error',
        title: 'Fallo al sincronizar en la nube',
        desc: 'Los datos se han guardado de forma segura en tu dispositivo de manera local, pero no hemos podido respaldarlos en Firestore. Por favor, comprueba tu conexión a internet.'
      });
    }
  };

  const handleRestoreData = async (
    restored: {
      settings?: Partial<Settings> | null;
      shifts: DayShift[];
      levels?: YearlyLevels | null;
      pluses?: YearlyPluses | null;
    },
    mode: 'replace' | 'merge' = 'replace'
  ) => {
    const currentYear = new Date().getFullYear();
    const isReplace = mode === 'replace';

    const baseSettings = isReplace ? INITIAL_SETTINGS : settings;
    const rawSettings = restored.settings || {};
    const finalSettings: Settings = {
      ...baseSettings,
      ...rawSettings,
      monthlyOptions: rawSettings.monthlyOptions || (isReplace ? {} : baseSettings.monthlyOptions),
      counterPeriod: rawSettings.counterPeriod || (isReplace ? INITIAL_SETTINGS.counterPeriod : baseSettings.counterPeriod),
      counterTargets: rawSettings.counterTargets || (isReplace ? {} : baseSettings.counterTargets),
      expandedTablasSections: rawSettings.expandedTablasSections || INITIAL_SETTINGS.expandedTablasSections,
      holidays: Array.isArray(rawSettings.holidays) ? rawSettings.holidays : (isReplace ? [] : baseSettings.holidays),
      vacations: Array.isArray(rawSettings.vacations) ? rawSettings.vacations : (isReplace ? [] : baseSettings.vacations),
      frozenPeriods: Array.isArray(rawSettings.frozenPeriods) ? rawSettings.frozenPeriods : (isReplace ? [] : baseSettings.frozenPeriods),
      savedPayrolls: Array.isArray(rawSettings.savedPayrolls) ? rawSettings.savedPayrolls : (isReplace ? [] : baseSettings.savedPayrolls),
      uploadedPayrolls: Array.isArray(rawSettings.uploadedPayrolls) ? rawSettings.uploadedPayrolls : (isReplace ? [] : (baseSettings.uploadedPayrolls || []))
    };

    const finalShifts: DayShift[] = Array.isArray(restored.shifts) ? restored.shifts : [];
    const finalLevels: YearlyLevels = (restored.levels && Object.keys(restored.levels).length > 0)
      ? restored.levels
      : (isReplace ? { [currentYear]: INITIAL_LEVELS } : levels);
    const finalPluses: YearlyPluses = migratePluses(
      (restored.pluses && Object.keys(restored.pluses).length > 0)
        ? restored.pluses
        : (isReplace ? { [currentYear]: { ...INITIAL_PLUSES } } : pluses)
    );

    if (isReplace) {
      clearSyncQueue();
      const freshPasajeLevels = { [currentYear]: INITIAL_LEVELS_PASAJE };
      const freshPasajePluses = {
        [currentYear]: getPlusesWithContractTypeDefaults({ ...INITIAL_PLUSES_PASAJE }, finalSettings.contractType)
      };
      setLevelsPasaje(freshPasajeLevels);
      setPlusesPasaje(freshPasajePluses);
      localStorage.setItem('levels_pasaje', JSON.stringify(freshPasajeLevels));
      localStorage.setItem('pluses_pasaje', JSON.stringify(freshPasajePluses));
    }

    setSettings(finalSettings);
    setShifts(finalShifts);
    setLevels(finalLevels);
    setPluses(finalPluses);

    localStorage.setItem('settings', JSON.stringify(finalSettings));
    localStorage.setItem('shifts', JSON.stringify(finalShifts));
    localStorage.setItem('levels', JSON.stringify(finalLevels));
    localStorage.setItem('pluses', JSON.stringify(finalPluses));

    const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
    if (targetUid && !isGuestMode) {
      setIsSyncing(true);
      try {
        if (isReplace && !activeSharedOwner) {
          await dbClearAllUserData(targetUid);
        }
        await dbSaveSettings(targetUid, finalSettings);
        for (const yearStr of Object.keys(finalLevels)) {
          const year = Number(yearStr);
          await dbSaveLevels(targetUid, year, finalLevels[year]);
        }
        for (const yearStr of Object.keys(finalPluses)) {
          const year = Number(yearStr);
          await dbSavePluses(targetUid, year, finalPluses[year]);
        }
        if (finalShifts.length > 0) {
          await dbSaveShiftsBatch(targetUid, finalShifts);
        }
      } catch (e) {
        console.error("Error syncing restored data to cloud:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Writers with Firestore Cloud Sync Support
  const updateSettings = async (newSettings: Settings) => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus datos (Modo Solo Lectura).`
      });
      return;
    }
    setSettings(newSettings);
    localStorage.setItem('settings', JSON.stringify(newSettings));
    const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
    if (targetUid && !isGuestMode) {
      queueOrExecute({
        type: 'SAVE_SETTINGS',
        targetUid,
        payload: { settings: newSettings }
      });
    }

    if (newSettings.contractType !== settings.contractType) {
      setPluses(prev => {
        const updatedPluses = { ...prev };
        Object.keys(updatedPluses).forEach(yearStr => {
          const year = Number(yearStr);
          const currentYearPluses = updatedPluses[year];
          if (currentYearPluses) {
            updatedPluses[year] = getPlusesWithContractTypeDefaults(currentYearPluses, newSettings.contractType);
            if (targetUid && !isGuestMode) {
              queueOrExecute({
                type: 'SAVE_PLUSES',
                targetUid,
                payload: { year, pluses: updatedPluses[year] }
              });
            }
          }
        });
        localStorage.setItem('pluses', JSON.stringify(updatedPluses));
        return updatedPluses;
      });

      setPlusesPasaje(prev => {
        const updatedPluses = { ...prev };
        Object.keys(updatedPluses).forEach(yearStr => {
          const year = Number(yearStr);
          const currentYearPluses = updatedPluses[year];
          if (currentYearPluses) {
            updatedPluses[year] = getPlusesWithContractTypeDefaults(currentYearPluses, newSettings.contractType);
          }
        });
        localStorage.setItem('pluses_pasaje', JSON.stringify(updatedPluses));
        return updatedPluses;
      });
    }

    if (newSettings.colectivoConvenio !== settings.colectivoConvenio && newSettings.colectivoConvenio === 'pasaje') {
      if (newSettings.contractType === 'Parcial') {
        setPlusesPasaje(prev => {
          const updatedPluses = { ...prev };
          Object.keys(updatedPluses).forEach(yearStr => {
            const year = Number(yearStr);
            const currentYearPluses = updatedPluses[year];
            if (currentYearPluses) {
              updatedPluses[year] = getPlusesWithContractTypeDefaults(currentYearPluses, 'Parcial');
            }
          });
          localStorage.setItem('pluses_pasaje', JSON.stringify(updatedPluses));
          return updatedPluses;
        });
      }
    }
  };

  const updateLevels = async (year: number, newLevels: LevelData[], colectivo: 'rampa' | 'pasaje' = 'rampa') => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus datos (Modo Solo Lectura).`
      });
      return;
    }
    const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
    if (colectivo === 'pasaje') {
      setLevelsPasaje(prev => {
        const updated = { ...prev, [year]: newLevels };
        localStorage.setItem('levels_pasaje', JSON.stringify(updated));
        return updated;
      });
    } else {
      setLevels(prev => {
        const updated = { ...prev, [year]: newLevels };
        localStorage.setItem('levels', JSON.stringify(updated));
        if (targetUid && !isGuestMode) {
          queueOrExecute({
            type: 'SAVE_LEVELS',
            targetUid,
            payload: { year, levels: newLevels }
          });
        }
        return updated;
      });
    }
  };

  const updatePluses = async (year: number, newPluses: PlusesData, colectivo: 'rampa' | 'pasaje' = 'rampa') => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus datos (Modo Solo Lectura).`
      });
      return;
    }
    const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
    if (colectivo === 'pasaje') {
      setPlusesPasaje(prev => {
        const updated = { ...prev, [year]: newPluses };
        localStorage.setItem('pluses_pasaje', JSON.stringify(updated));
        return updated;
      });
    } else {
      setPluses(prev => {
        const oldKeys = Object.keys(prev[year] || {});
        const newKeys = Object.keys(newPluses);
        const deletedKeys = oldKeys.filter(k => !newKeys.includes(k));

        const updated = { ...prev, [year]: newPluses };
        localStorage.setItem('pluses', JSON.stringify(updated));
        if (targetUid && !isGuestMode) {
          queueOrExecute({
            type: 'SAVE_PLUSES',
            targetUid,
            payload: { year, pluses: newPluses }
          });
          deletedKeys.forEach(k => {
            queueOrExecute({
              type: 'DELETE_PLUS',
              targetUid,
              payload: { year, name: k }
            });
          });
        }
        return updated;
      });
    }
  };

  const updateShift = async (shift: DayShift) => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus turnos (Modo Solo Lectura).`
      });
      return;
    }
    setShifts(prev => {
      const newShifts = [...prev.filter(s => s.date !== shift.date), shift];
      localStorage.setItem('shifts', JSON.stringify(newShifts));
      const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
      if (targetUid && !isGuestMode) {
        queueOrExecute({
          type: 'SAVE_SHIFT',
          targetUid,
          payload: { shift }
        });
      }
      return newShifts;
    });
  };

  const updateShifts = async (newShiftsList: DayShift[]) => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus turnos (Modo Solo Lectura).`
      });
      return;
    }
    setShifts(prev => {
      const datesToUpdate = newShiftsList.map(s => s.date);
      const filteredShifts = prev.filter(s => !datesToUpdate.includes(s.date));
      const updatedShifts = [...filteredShifts, ...newShiftsList];
      localStorage.setItem('shifts', JSON.stringify(updatedShifts));
      const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
      if (targetUid && !isGuestMode) {
        newShiftsList.forEach(s => {
          queueOrExecute({
            type: 'SAVE_SHIFT',
            targetUid,
            payload: { shift: s }
          });
        });
      }
      return updatedShifts;
    });
  };

  const deleteShift = async (date: string) => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus turnos (Modo Solo Lectura).`
      });
      return;
    }
    setShifts(prev => {
      const newShifts = prev.filter(s => s.date !== date);
      localStorage.setItem('shifts', JSON.stringify(newShifts));
      const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
      if (targetUid && !isGuestMode) {
        queueOrExecute({
          type: 'DELETE_SHIFT',
          targetUid,
          payload: { date }
        });
      }
      return newShifts;
    });
  };

  const deleteShifts = async (dates: string[]) => {
    if (activeSharedOwner?.isLocked) {
      setToastMessage({
        type: 'error',
        title: 'Edición Bloqueada',
        desc: `El titular "${activeSharedOwner.ownerName}" ha bloqueado la edición de sus turnos (Modo Solo Lectura).`
      });
      return;
    }
    setShifts(prev => {
      const newShifts = prev.filter(s => !dates.includes(s.date));
      localStorage.setItem('shifts', JSON.stringify(newShifts));
      const targetUid = activeSharedOwner ? activeSharedOwner.ownerUid : (user ? user.uid : null);
      if (targetUid && !isGuestMode) {
        dates.forEach(d => {
          queueOrExecute({
            type: 'DELETE_SHIFT',
            targetUid,
            payload: { date: d }
          });
        });
      }
      return newShifts;
    });
  };

  // --- Shared Quadrant Delegate Handler ---
  const handleSelectSharedQuadrant = async (owner: SharedQuadrantInfo | null) => {
    if (!owner) {
      // Revert to personal quadrant
      setActiveSharedOwner(null);
      const savedSnap = localStorage.getItem('primary_cloud_user_session_snapshot');
      if (savedSnap) {
        try {
          const snap = JSON.parse(savedSnap);
          if (snap.settings) setSettings(snap.settings);
          if (snap.shifts) setShifts(snap.shifts);
          if (snap.levels) setLevels(snap.levels);
          if (snap.pluses) setPluses(snap.pluses);
          localStorage.setItem('settings', JSON.stringify(snap.settings));
          localStorage.setItem('shifts', JSON.stringify(snap.shifts));
          localStorage.setItem('levels', JSON.stringify(snap.levels));
          localStorage.setItem('pluses', JSON.stringify(snap.pluses));
        } catch (e) {}
        localStorage.removeItem('primary_cloud_user_session_snapshot');
      } else if (user) {
        setIsSyncing(true);
        try {
          const [s, st] = await Promise.all([
            dbGetShifts(user.uid),
            dbGetSettings(user.uid)
          ]);
          setShifts(s);
          if (st) setSettings(st);
        } finally {
          setIsSyncing(false);
        }
      }
      setToastMessage({
        type: 'success',
        title: 'Tu Cuadrante Personal',
        desc: 'Has regresado a tu propio cuadrante.'
      });
      return;
    }

    // Switch to editing the shared owner's quadrant
    if (!auth.currentUser || !user) {
      return;
    }

    if (owner.isDisabled) {
      setToastMessage({
        type: 'error',
        title: 'Acceso Desactivado',
        desc: `El titular "${owner.ownerName}" ha desactivado temporalmente tu acceso a sus datos.`
      });
      return;
    }

    if (!activeSharedOwner) {
      const mySnapshot = { settings, shifts, levels, pluses };
      localStorage.setItem('primary_cloud_user_session_snapshot', JSON.stringify(mySnapshot));
    }

    setIsSyncing(true);
    try {
      const [cloudSettings, cloudShifts, cloudLevels, cloudPluses, cloudSharing] = await Promise.all([
        dbGetSettings(owner.ownerUid),
        dbGetShifts(owner.ownerUid),
        dbGetLevels(owner.ownerUid),
        dbGetPluses(owner.ownerUid),
        dbGetSharingConfig(owner.ownerUid)
      ]);

      const cleanUserEmail = user?.email?.toLowerCase() || '';
      const isEmailDisabled = !!(cleanUserEmail && cloudSharing?.disabledEditors && cloudSharing.disabledEditors.map(e => e.toLowerCase()).includes(cleanUserEmail));
      const isUidDisabled = !!(user?.uid && cloudSharing?.disabledEditorUids && cloudSharing.disabledEditorUids.includes(user.uid));
      if (isEmailDisabled || isUidDisabled) {
        setToastMessage({
          type: 'error',
          title: 'Acceso Desactivado',
          desc: `El titular "${owner.ownerName}" ha pausado tu acceso a este cuadrante.`
        });
        return;
      }

      if (cloudSettings) setSettings(cloudSettings);
      setShifts(cloudShifts || []);
      if (cloudLevels && Object.keys(cloudLevels).length > 0) setLevels(cloudLevels);
      if (cloudPluses && Object.keys(cloudPluses).length > 0) setPluses(migratePluses(cloudPluses));

      const updatedOwner: SharedQuadrantInfo = {
        ...owner,
        isLocked: cloudSharing ? !!cloudSharing.isLocked : !!owner.isLocked,
        hidePayrollAmounts: cloudSharing ? !!cloudSharing.hidePayrollAmounts : !!owner.hidePayrollAmounts,
        isDisabled: false
      };
      setActiveSharedOwner(updatedOwner);
      setToastMessage({
        type: 'success',
        title: updatedOwner.isLocked ? 'Cuadrante (Solo Lectura)' : 'Modo Colaborador Conectado',
        desc: updatedOwner.isLocked
          ? `Visualizando los turnos de "${owner.ownerName}". La edición ha sido bloqueada por el titular.`
          : `Estás colaborando en el cuadrante de "${owner.ownerName}" en tiempo real en la nube.`
      });
    } catch (e) {
      console.error("Error loading shared owner quadrant:", e);
      setToastMessage({
        type: 'error',
        title: 'Error de conexión',
        desc: 'No se pudo cargar el cuadrante compartido.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // When logged in as owner, auto-refresh shifts on window focus so external edits appear immediately
  useEffect(() => {
    if (!user || activeSharedOwner || isGuestMode) return;
    const handleFocusCheck = async () => {
      try {
        const freshShifts = await dbGetShifts(user.uid);
        if (freshShifts && freshShifts.length > 0) {
          setShifts(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(freshShifts)) {
              return freshShifts;
            }
            return prev;
          });
        }
      } catch (e) {}
    };
    window.addEventListener('focus', handleFocusCheck);
    return () => window.removeEventListener('focus', handleFocusCheck);
  }, [user, activeSharedOwner, isGuestMode]);

  // Real-time shifts subscription when logged in as owner (receives mutual shift swaps immediately)
  useEffect(() => {
    if (!user || activeSharedOwner || isGuestMode || isLoading) return;
    const canonicalShiftsKey = (list: DayShift[]) =>
      JSON.stringify([...list].sort((a, b) => a.date.localeCompare(b.date)));

    const unsub = dbSubscribeUserShifts(user.uid, (cloudShifts) => {
      setShifts((prev) => {
        if (canonicalShiftsKey(prev) !== canonicalShiftsKey(cloudShifts)) {
          try {
            localStorage.setItem('shifts', JSON.stringify(cloudShifts));
          } catch {}
          return cloudShifts;
        }
        return prev;
      });
    });

    return () => unsub();
  }, [user?.uid, activeSharedOwner?.ownerUid, isGuestMode, isLoading]);

  // Real-time in-app swap notifications subscription
  useEffect(() => {
    if (!user || isGuestMode) {
      setSwapNotifications([]);
      return;
    }

    const formatNotifDate = (iso: string) => {
      const parsed = parseISO(iso);
      return isValid(parsed) ? format(parsed, 'd MMM', { locale: es }) : iso;
    };

    const unsub = dbSubscribeSwapNotifications(user.uid, (items) => {
      setSwapNotifications(items);
      items.forEach((n) => {
        if (!n.read && !toastedSwapIdsRef.current.has(n.id)) {
          toastedSwapIdsRef.current.add(n.id);
          if ((n.timestamp || 0) >= appBootTimestampRef.current - 5000) {
            const origFmt = formatNotifDate(n.myOriginalDate);
            const covFmt = formatNotifDate(n.coveredDate);
            if (n.type === 'shift_swap_request') {
              setToastMessage({
                type: 'success',
                title: 'Solicitud de cambio de turno',
                desc: `${n.senderName} te solicita cambiar su ${covFmt} por tu ${origFmt}. Acepta o rechaza en Notificaciones.`
              });
            } else if (n.type === 'shift_swap_accepted') {
              setToastMessage({
                type: 'success',
                title: 'Cambio de turno aceptado',
                desc: `${n.senderName} ha aceptado tu cambio (${origFmt} ↔ ${covFmt}).`
              });
            } else if (n.type === 'shift_swap_rejected') {
              setToastMessage({
                type: 'error',
                title: 'Cambio de turno rechazado',
                desc: `${n.senderName} ha rechazado tu solicitud de cambio (${origFmt} ↔ ${covFmt}).`
              });
            } else {
              setToastMessage({
                type: 'success',
                title: n.type === 'shift_swap_undo' ? 'Cambio de turno deshecho' : 'Cambio de turno recibido',
                desc:
                  n.type === 'shift_swap_undo'
                    ? `${n.senderName} ha deshecho el cambio del ${origFmt}${n.appliedToCalendar ? '. Tu calendario ya se ha restaurado.' : '.'}`
                    : `${n.senderName} ha cambiado contigo su ${covFmt} por tu ${origFmt}${n.appliedToCalendar ? '. Tu calendario ya se ha actualizado.' : '.'}`
              });
            }
          }
        }
      });
    });

    return () => unsub();
  }, [user?.uid, isGuestMode]);

  // Real-time sent & received shift swap requests subscriptions
  useEffect(() => {
    if (!user || isGuestMode) {
      setSentSwapRequests([]);
      setReceivedSwapRequests([]);
      setHasLoadedReceivedSwapRequests(false);
      return;
    }
    setHasLoadedReceivedSwapRequests(false);
    const unsubSent = dbSubscribeSentSwapRequests(user.uid, (items) => {
      setSentSwapRequests(items);
    });
    const unsubReceived = dbSubscribeReceivedSwapRequests(user.uid, (items) => {
      setReceivedSwapRequests(items);
      setHasLoadedReceivedSwapRequests(true);
    });
    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [user?.uid, isGuestMode]);

  // Auto-clean resolved or cancelled shift_swap_request notifications from Firestore
  useEffect(() => {
    if (!user || isGuestMode || swapNotifications.length === 0) return;
    const receivedById = new Map<string, SwapRequest>(receivedSwapRequests.map(r => [r.id, r]));
    swapNotifications.forEach((n) => {
      if (n.type !== 'shift_swap_request') return;
      const linked = n.requestId ? receivedById.get(n.requestId) : undefined;
      const isResolvedOrRemoved =
        n.status === 'accepted' ||
        n.status === 'rejected' ||
        n.status === 'undone' ||
        (linked && linked.status !== 'pending') ||
        (hasLoadedReceivedSwapRequests && !!n.requestId && !linked);
      if (isResolvedOrRemoved) {
        dbDeleteSwapNotification(user.uid, n.id).catch(() => {});
      }
    });
  }, [user?.uid, isGuestMode, swapNotifications, receivedSwapRequests, hasLoadedReceivedSwapRequests]);

  // Keep sender & recipient calendar day status synced in real time when a request is accepted/rejected/undone
  useEffect(() => {
    if (!user || activeSharedOwner || isGuestMode || isLoading) return;
    if (sentSwapRequests.length === 0 && receivedSwapRequests.length === 0) return;
    const reqById = new Map<string, SwapRequest>([
      ...sentSwapRequests.map(r => [r.id, r] as const),
      ...receivedSwapRequests.map(r => [r.id, r] as const)
    ]);
    const shiftsToSync: DayShift[] = [];

    shifts.forEach((day) => {
      const reqId = day.swapInfo?.requestId;
      if (!reqId) return;
      const matchedReq = reqById.get(reqId);
      if (!matchedReq || !day.swapInfo) return;

      if (matchedReq.status === 'undone') {
        const restoredShifts = Array.isArray(day.swapInfo.originalShifts) && day.swapInfo.originalShifts.length > 0
          ? day.swapInfo.originalShifts
          : (day.swapInfo.coveringCoworker && !day.swapInfo.cededToCoworker ? [{ start: '', end: '' }] : day.shifts);
        const restoredDay: DayShift = {
          ...day,
          shifts: JSON.parse(JSON.stringify(restoredShifts))
        };
        delete restoredDay.swapInfo;
        shiftsToSync.push(restoredDay);
        return;
      }

      const isCededOnly = !!(day.swapInfo.cededToCoworker && !day.swapInfo.coveringCoworker);
      const hasRemainingShiftOnAcceptedCeded =
        matchedReq.status === 'accepted' &&
        isCededOnly &&
        (day.shifts || []).some(s => (s.start && s.start.trim() !== '') || (s.end && s.end.trim() !== ''));

      if (day.swapInfo.status !== matchedReq.status || hasRemainingShiftOnAcceptedCeded) {
        shiftsToSync.push({
          ...day,
          ...(matchedReq.status === 'accepted' && isCededOnly ? { shifts: [{ start: '', end: '' }] } : {}),
          swapInfo: {
            ...day.swapInfo,
            status: matchedReq.status
          }
        });
      }
    });

    if (shiftsToSync.length > 0) {
      updateShifts(shiftsToSync);
    }
  }, [sentSwapRequests, receivedSwapRequests, shifts, user?.uid, activeSharedOwner?.ownerUid, isGuestMode, isLoading]);

  const handleMarkSwapNotificationsRead = useCallback(() => {
    if (!user || isGuestMode) return;
    activeSwapNotifications
      .filter((n) => !n.read)
      .forEach((n) => {
        dbMarkSwapNotificationRead(user.uid, n.id).catch(() => {});
      });
  }, [user, isGuestMode, activeSwapNotifications]);

  const handleMarkSingleSwapNotificationRead = useCallback((notificationId: string) => {
    if (!user || isGuestMode) return;
    dbMarkSwapNotificationRead(user.uid, notificationId).catch(() => {});
  }, [user, isGuestMode]);

  const handleDeleteSwapNotification = useCallback((notificationId: string) => {
    if (!user || isGuestMode) return;
    dbDeleteSwapNotification(user.uid, notificationId).catch(() => {});
  }, [user, isGuestMode]);

  const handleDeleteSwapRequest = useCallback(async (requestId: string) => {
    if (!user || isGuestMode) return;
    try {
      await dbDeleteSwapRequest(requestId);
    } catch (e) {
      console.warn('Could not delete swap request:', e);
    }
  }, [user, isGuestMode]);

  const handleRespondSwapRequest = useCallback(async (
    requestId: string,
    decision: 'accepted' | 'rejected'
  ) => {
    if (!user || isGuestMode) return;
    const req = receivedSwapRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    setRespondingSwapReqId(requestId);
    try {
      await dbUpdateSwapRequestStatus(req.id, decision);

      const senderValidShifts = (req.senderShifts || []).filter(s => s && s.start && s.end);
      const recipientValidShifts = (req.recipientShifts || []).filter(s => s && s.start && s.end);

      // When accepted, apply the new shift to the recipient's own calendar immediately
      if (decision === 'accepted' && !activeSharedOwner) {
        const makeEmptyDay = (dateIso: string): DayShift => ({
          date: dateIso,
          type: 'Laboral',
          shifts: [{ start: '', end: '' }],
          perentorias: { day: 0, night: 0 },
          complementarias: { day: 0, night: 0 },
          extraShifts: []
        });

        const existingOnRecipDate = shifts.find(s => s.date === req.recipientDate);
        const existingOnSenderDate = shifts.find(s => s.date === req.senderDate);
        const recipientUpdates: DayShift[] = [];

        if (req.senderDate === req.recipientDate) {
          const backupOrig =
            existingOnRecipDate?.swapInfo?.originalShifts ||
            existingOnRecipDate?.shifts ||
            recipientValidShifts;
          recipientUpdates.push({
            ...(existingOnRecipDate || makeEmptyDay(req.recipientDate)),
            date: req.recipientDate,
            type: senderValidShifts.length > 0 ? 'Laboral' : (existingOnRecipDate?.type || 'Laboral'),
            shifts: senderValidShifts.length > 0
              ? JSON.parse(JSON.stringify(senderValidShifts))
              : [{ start: '', end: '' }],
            swapInfo: {
              cededToCoworker: true,
              ...(senderValidShifts.length > 0
                ? {
                    coveringCoworker: true,
                    coveringShifts: JSON.parse(JSON.stringify(senderValidShifts))
                  }
                : {}),
              originalShifts: JSON.parse(JSON.stringify(backupOrig)),
              coworkerName: req.senderName || 'Compañero',
              coworkerCode: 'COLAB',
              coworkerUid: req.senderUid,
              linkedDate: req.senderDate,
              status: 'accepted',
              requestId: req.id
            }
          });
        } else {
          const backupRecipOrig =
            existingOnRecipDate?.swapInfo?.originalShifts ||
            existingOnRecipDate?.shifts ||
            recipientValidShifts;
          recipientUpdates.push({
            ...(existingOnRecipDate || makeEmptyDay(req.recipientDate)),
            date: req.recipientDate,
            // Remove the unworked shift from the recipient's calendar upon acceptance
            shifts: [{ start: '', end: '' }],
            swapInfo: {
              ...(existingOnRecipDate?.swapInfo || {}),
              cededToCoworker: true,
              originalShifts: JSON.parse(JSON.stringify(backupRecipOrig)),
              coworkerName: req.senderName || 'Compañero',
              coworkerCode: 'COLAB',
              coworkerUid: req.senderUid,
              linkedDate: req.senderDate,
              status: 'accepted',
              requestId: req.id
            }
          });

          if (senderValidShifts.length > 0) {
            const backupOnSenderDate =
              existingOnSenderDate?.swapInfo?.originalShifts ||
              existingOnSenderDate?.shifts ||
              [{ start: '', end: '' }];
            recipientUpdates.push({
              ...(existingOnSenderDate || makeEmptyDay(req.senderDate)),
              date: req.senderDate,
              type: 'Laboral',
              shifts: JSON.parse(JSON.stringify(senderValidShifts)),
              swapInfo: {
                ...(existingOnSenderDate?.swapInfo || {}),
                coveringCoworker: true,
                coveringShifts: JSON.parse(JSON.stringify(senderValidShifts)),
                originalShifts: JSON.parse(JSON.stringify(backupOnSenderDate)),
                coworkerName: req.senderName || 'Compañero',
                coworkerCode: 'COLAB',
                coworkerUid: req.senderUid,
                linkedDate: req.recipientDate,
                status: 'accepted',
                requestId: req.id
              }
            });
          }
        }

        if (recipientUpdates.length > 0) {
          updateShifts(recipientUpdates);
        }
      }

      // Best-effort direct status update on sender's shifts if mutually authorized (sender also auto-syncs via listener)
      try {
        const senderRemoteShifts = await dbGetShifts(req.senderUid);
        const senderStatusUpdates = senderRemoteShifts
          .filter(d => d.swapInfo?.requestId === req.id)
          .map(d => {
            const isCededOnly = !!(d.swapInfo?.cededToCoworker && !d.swapInfo?.coveringCoworker);
            return {
              ...d,
              ...(decision === 'accepted' && isCededOnly ? { shifts: [{ start: '', end: '' }] } : {}),
              swapInfo: {
                ...d.swapInfo!,
                status: decision
              }
            };
          });
        if (senderStatusUpdates.length > 0) {
          await dbSaveShiftsBatch(req.senderUid, senderStatusUpdates);
        }
      } catch {
        // Sender will sync automatically via dbSubscribeSentSwapRequests
      }

      // Delete linked request notifications so they disappear immediately from top-right banner, Notificaciones, and all badges
      const matchingNotifIds = new Set<string>(
        swapNotifications
          .filter(
            (n) =>
              n.requestId === req.id ||
              (n.type === 'shift_swap_request' &&
                n.senderUid === req.senderUid &&
                n.myOriginalDate === req.recipientDate &&
                n.coveredDate === req.senderDate)
          )
          .map((n) => n.id)
      );
      if (matchingNotifIds.size > 0) {
        setSwapNotifications((prev) => prev.filter((n) => !matchingNotifIds.has(n.id)));
        matchingNotifIds.forEach((notifId) => {
          dbDeleteSwapNotification(user.uid, notifId).catch(() => {});
        });
      }

      // Notify sender of acceptance / rejection
      let myDisplayName = user.displayName || user.email?.split('@')[0] || 'Compañero';
      try {
        const mySharing = await dbGetSharingConfig(user.uid);
        if (mySharing?.ownerName) myDisplayName = mySharing.ownerName;
      } catch {}

      await dbSendSwapNotification(req.senderUid, {
        type: decision === 'accepted' ? 'shift_swap_accepted' : 'shift_swap_rejected',
        recipientUid: req.senderUid,
        senderUid: user.uid,
        senderName: myDisplayName,
        senderEmail: user.email || '',
        myOriginalDate: req.senderDate,
        myOriginalShifts: senderValidShifts,
        coveredDate: req.recipientDate,
        coveredShifts: recipientValidShifts,
        appliedToCalendar: decision === 'accepted',
        requestId: req.id,
        status: decision
      });

      const senderDateObj = parseISO(req.senderDate);
      const recipDateObj = parseISO(req.recipientDate);
      const sLabel = isValid(senderDateObj) ? format(senderDateObj, 'd MMM', { locale: es }) : req.senderDate;
      const rLabel = isValid(recipDateObj) ? format(recipDateObj, 'd MMM', { locale: es }) : req.recipientDate;

      setToastMessage({
        type: 'success',
        title: decision === 'accepted' ? 'Cambio de turno aceptado' : 'Solicitud rechazada',
        desc:
          decision === 'accepted'
            ? `El cambio con ${req.senderName} (${rLabel} ↔ ${sLabel}) ya se muestra en tu calendario.`
            : `Has rechazado la solicitud de cambio de turno de ${req.senderName}.`
      });
    } catch (err) {
      console.error('Error responding to swap request:', err);
      setToastMessage({
        type: 'error',
        title: 'No se pudo procesar',
        desc: 'Hubo un problema al responder a la solicitud. Inténtalo de nuevo.'
      });
    } finally {
      setRespondingSwapReqId(null);
    }
  }, [user, isGuestMode, receivedSwapRequests, activeSharedOwner, shifts, swapNotifications]);

  // Helper para mantener sincronizado el listado de perfiles guardados de invitado
  const syncGuestProfileRegistry = (
    wName: string,
    currentSet: Settings,
    currentShs: DayShift[],
    currentLevs: YearlyLevels,
    currentPlus: YearlyPluses
  ) => {
    try {
      const raw = localStorage.getItem('turnom_saved_guest_profiles');
      let list: any[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      const idx = list.findIndex(p => (p.workerName || '').toLowerCase() === wName.toLowerCase());
      const profileItem = {
        id: idx >= 0 ? list[idx].id : `guest_${Date.now()}`,
        workerName: wName,
        contractType: currentSet.contractType || 'Completo',
        colectivo: currentSet.colectivoConvenio || 'rampa',
        totalShifts: currentShs.length,
        updatedAt: new Date().toISOString(),
        settings: currentSet,
        shifts: currentShs,
        levels: currentLevs,
        pluses: currentPlus
      };
      if (idx >= 0) {
        list[idx] = profileItem;
      } else {
        list.unshift(profileItem);
      }
      localStorage.setItem('turnom_saved_guest_profiles', JSON.stringify(list));
    } catch (e) {
      console.error("Error al sincronizar registro de perfiles:", e);
    }
  };

  // --- Guest Workspace Handlers ---
  const handleEnterGuestModeWithFile = (payload: {
    settings: Settings;
    shifts: DayShift[];
    levels: YearlyLevels;
    pluses: YearlyPluses;
    workerName: string;
  }) => {
    // If transitioning from primary mode, snapshot user's state
    if (!isGuestMode) {
      const primarySnapshot = {
        settings,
        shifts,
        levels,
        pluses,
        levelsPasaje,
        plusesPasaje
      };
      localStorage.setItem('primary_user_session_snapshot', JSON.stringify(primarySnapshot));
    }

    setSettings(payload.settings);
    setShifts(payload.shifts);
    setLevels(payload.levels);
    setPluses(payload.pluses);
    setIsGuestMode(true);
    setGuestWorkerName(payload.workerName);

    localStorage.setItem('settings', JSON.stringify(payload.settings));
    localStorage.setItem('shifts', JSON.stringify(payload.shifts));
    localStorage.setItem('levels', JSON.stringify(payload.levels));
    localStorage.setItem('pluses', JSON.stringify(payload.pluses));
    localStorage.setItem('is_guest_mode', 'true');
    localStorage.setItem('guest_worker_name', payload.workerName);

    syncGuestProfileRegistry(payload.workerName, payload.settings, payload.shifts, payload.levels, payload.pluses);
  };

  const handleEnterBlankGuestMode = (
    workerName: string, 
    contractType: 'Completo' | 'Parcial', 
    colectivo: 'rampa' | 'pasaje'
  ) => {
    if (!isGuestMode) {
      const primarySnapshot = {
        settings,
        shifts,
        levels,
        pluses,
        levelsPasaje,
        plusesPasaje
      };
      localStorage.setItem('primary_user_session_snapshot', JSON.stringify(primarySnapshot));
    }

    const currentYear = new Date().getFullYear();
    const blankSettings: Settings = {
      ...INITIAL_SETTINGS,
      contractType,
      colectivoConvenio: colectivo,
      holidays: [],
      vacations: [],
      frozenPeriods: [],
      savedPayrolls: [],
      uploadedPayrolls: [],
      secondCompanyShifts: []
    };
    const blankShifts: DayShift[] = [];
    const blankLevels: YearlyLevels = {
      [currentYear]: colectivo === 'pasaje' ? INITIAL_LEVELS_PASAJE : INITIAL_LEVELS
    };
    const blankPluses: YearlyPluses = {
      [currentYear]: colectivo === 'pasaje' ? { ...INITIAL_PLUSES_PASAJE } : { ...INITIAL_PLUSES }
    };

    setSettings(blankSettings);
    setShifts(blankShifts);
    setLevels(blankLevels);
    setPluses(blankPluses);
    setIsGuestMode(true);
    setGuestWorkerName(workerName);

    localStorage.setItem('settings', JSON.stringify(blankSettings));
    localStorage.setItem('shifts', JSON.stringify(blankShifts));
    localStorage.setItem('levels', JSON.stringify(blankLevels));
    localStorage.setItem('pluses', JSON.stringify(blankPluses));
    localStorage.setItem('is_guest_mode', 'true');
    localStorage.setItem('guest_worker_name', workerName);

    syncGuestProfileRegistry(workerName, blankSettings, blankShifts, blankLevels, blankPluses);
  };

  const handleEnterCopyGuestMode = (workerName: string) => {
    if (!isGuestMode) {
      const primarySnapshot = {
        settings,
        shifts,
        levels,
        pluses,
        levelsPasaje,
        plusesPasaje
      };
      localStorage.setItem('primary_user_session_snapshot', JSON.stringify(primarySnapshot));
    }

    // Clona los turnos y configuración actuales para trabajar en una copia aislada
    const copiedSettings: Settings = JSON.parse(JSON.stringify(settings));
    const copiedShifts: DayShift[] = JSON.parse(JSON.stringify(shifts));
    const copiedLevels: YearlyLevels = JSON.parse(JSON.stringify(levels));
    const copiedPluses: YearlyPluses = JSON.parse(JSON.stringify(pluses));

    setSettings(copiedSettings);
    setShifts(copiedShifts);
    setLevels(copiedLevels);
    setPluses(copiedPluses);
    setIsGuestMode(true);
    setGuestWorkerName(workerName);

    localStorage.setItem('settings', JSON.stringify(copiedSettings));
    localStorage.setItem('shifts', JSON.stringify(copiedShifts));
    localStorage.setItem('levels', JSON.stringify(copiedLevels));
    localStorage.setItem('pluses', JSON.stringify(copiedPluses));
    localStorage.setItem('is_guest_mode', 'true');
    localStorage.setItem('guest_worker_name', workerName);

    syncGuestProfileRegistry(workerName, copiedSettings, copiedShifts, copiedLevels, copiedPluses);

    setToastMessage({
      type: 'success',
      title: 'Copia Creada en Modo Invitado',
      desc: `Trabajando sobre una copia de turnos actuales para "${workerName}". Tu cuadrante original está protegido.`
    });
  };

  const handleSaveGuestChanges = (newName?: string) => {
    const finalName = newName && newName.trim() ? newName.trim() : guestWorkerName;
    if (newName && newName.trim()) {
      setGuestWorkerName(finalName);
      localStorage.setItem('guest_worker_name', finalName);
    }

    localStorage.setItem('settings', JSON.stringify(settings));
    localStorage.setItem('shifts', JSON.stringify(shifts));
    localStorage.setItem('levels', JSON.stringify(levels));
    localStorage.setItem('pluses', JSON.stringify(pluses));
    localStorage.setItem(`guest_backup_${finalName}`, JSON.stringify({
      workerName: finalName,
      settings,
      shifts,
      levels,
      pluses,
      savedAt: new Date().toISOString()
    }));

    // Actualiza la lista de perfiles guardados para poder volver a ellos cuando quieras
    syncGuestProfileRegistry(finalName, settings, shifts, levels, pluses);

    setToastMessage({
      type: 'success',
      title: 'Cambios de Invitado Guardados',
      desc: `Los turnos y ajustes de "${finalName}" se han guardado. Podrás volver a este perfil siempre que quieras desde la pestaña 'Guardados'.`
    });
  };

  const handleApplyGuestChangesToPrimary = async () => {
    const workerName = guestWorkerName;
    localStorage.removeItem('primary_user_session_snapshot');
    localStorage.removeItem('is_guest_mode');
    localStorage.removeItem('guest_worker_name');
    setIsGuestMode(false);
    setGuestWorkerName('Compañero');

    localStorage.setItem('settings', JSON.stringify(settings));
    localStorage.setItem('shifts', JSON.stringify(shifts));
    localStorage.setItem('levels', JSON.stringify(levels));
    localStorage.setItem('pluses', JSON.stringify(pluses));

    if (user && !activeSharedOwner) {
      setIsSyncing(true);
      try {
        await dbSaveSettings(user.uid, settings);
        for (const yearStr of Object.keys(levels)) {
          await dbSaveLevels(user.uid, Number(yearStr), levels[yearStr]);
        }
        for (const yearStr of Object.keys(pluses)) {
          await dbSavePluses(user.uid, Number(yearStr), pluses[yearStr]);
        }
        for (const s of shifts) {
          await dbSaveShift(user.uid, s);
        }
      } catch (err) {
        console.error("Error al sincronizar cambios con la nube principal:", err);
      } finally {
        setIsSyncing(false);
      }
    }

    setToastMessage({
      type: 'success',
      title: 'Cuadrante Principal Actualizado',
      desc: `Los turnos editados de "${workerName}" se han aplicado y guardado como tu cuadrante principal.`
    });
  };

  const handleDownloadGuestData = () => {
    try {
      const now = new Date();
      const timestamp = safeFormat(now, 'yyyy-MM-dd_HHmm');
      const cleanName = guestWorkerName.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ-]/g, '').trim() || 'Companero';
      const secondShiftsCount = settings.secondCompanyShifts?.length || 0;
      
      const payload = {
        version: 1,
        appName: 'TurNom Ramp',
        exportDate: now.toISOString(),
        workerName: guestWorkerName,
        settings,
        shifts,
        levels,
        pluses,
        meta: {
          workerName: guestWorkerName,
          totalShifts: shifts.length,
          totalSecondCompanyShifts: secondShiftsCount,
          totalPayrolls: (settings.savedPayrolls?.length || 0) + (settings.uploadedPayrolls?.length || 0),
          appVersion: '2.0'
        }
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(payload, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `cuadrante_${cleanName.replace(/\s+/g, '_')}_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setToastMessage({
        type: 'success',
        title: 'Cuadrante Descargado',
        desc: `Se ha guardado el archivo .json con los ${shifts.length} turnos de "${guestWorkerName}".`
      });
    } catch (err) {
      console.error("Error al descargar cuadrante de invitado:", err);
      setToastMessage({
        type: 'error',
        title: 'Error al descargar',
        desc: 'No se pudo generar el archivo .json del compañero.'
      });
    }
  };

  const handleExitGuestMode = () => {
    const snapshotStr = localStorage.getItem('primary_user_session_snapshot');
    if (snapshotStr) {
      try {
        const snap = JSON.parse(snapshotStr);
        if (snap.settings) setSettings(snap.settings);
        if (snap.shifts) setShifts(snap.shifts);
        if (snap.levels) setLevels(snap.levels);
        if (snap.pluses) setPluses(snap.pluses);
        if (snap.levelsPasaje) setLevelsPasaje(snap.levelsPasaje);
        if (snap.plusesPasaje) setPlusesPasaje(snap.plusesPasaje);

        localStorage.setItem('settings', JSON.stringify(snap.settings));
        localStorage.setItem('shifts', JSON.stringify(snap.shifts));
        localStorage.setItem('levels', JSON.stringify(snap.levels));
        localStorage.setItem('pluses', JSON.stringify(snap.pluses));
        if (snap.levelsPasaje) localStorage.setItem('levels_pasaje', JSON.stringify(snap.levelsPasaje));
        if (snap.plusesPasaje) localStorage.setItem('pluses_pasaje', JSON.stringify(snap.plusesPasaje));
      } catch (e) {
        console.error("Error al restaurar sesión principal:", e);
      }
    }
    localStorage.removeItem('primary_user_session_snapshot');
    localStorage.removeItem('is_guest_mode');
    localStorage.removeItem('guest_worker_name');
    setIsGuestMode(false);
    setGuestWorkerName('Compañero');

    setToastMessage({
      type: 'success',
      title: 'Cuadrante Principal Restaurado',
      desc: 'Has regresado a tu cuadrante personal. Todos tus datos y turnos originales están activos.'
    });
  };

  // --- Tab components extracted to components/ ---




  // --- TurnosTab extracted to components/TurnosTab.tsx ---




  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-azul-blue/10 overflow-hidden">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100]"
          >
            <LoadingScreen onComplete={() => setIsLoading(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner for Guest Mode */}
      {isGuestMode && (
        <div className="bg-amber-500 text-slate-950 px-3 sm:px-6 py-2 border-b border-amber-600/30 text-xs font-semibold shrink-0 z-50 shadow-sm">
          <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-black/15 text-slate-950 shrink-0">
                <Users className="w-3.5 h-3.5" />
              </span>
              <div className="flex items-center gap-2 truncate">
                <span className="font-black uppercase tracking-wider text-[10px] text-slate-950/80">
                  Modo Invitado:
                </span>
                <span className="font-extrabold text-slate-950 truncate underline decoration-black/30">
                  {guestWorkerName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black bg-black/10 px-2 py-0.5 rounded-full text-slate-950">
                  🔒 Nube Pausada
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
              <button
                type="button"
                onClick={() => handleSaveGuestChanges()}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Guardar cambios de este cuadrante de invitado"
              >
                <Save className="w-3 h-3 text-white" />
                <span>Guardar</span>
              </button>

              <button
                type="button"
                onClick={() => setIsGuestModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-black/15 hover:bg-black/25 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Gestionar cuadrante: renombrar, descargar, aplicar a tu cuenta o cambiar modo"
              >
                <Sliders className="w-3 h-3" />
                <span>Gestionar</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadGuestData}
                className="hidden sm:flex px-2.5 py-1 rounded-lg bg-white text-slate-900 font-extrabold text-[10px] uppercase tracking-wider shadow-xs transition-all items-center gap-1 cursor-pointer active:scale-95"
                title="Descargar archivo .json del compañero"
              >
                <Download className="w-3 h-3 text-amber-600" />
                <span>Descargar .json</span>
              </button>

              <button
                type="button"
                onClick={handleExitGuestMode}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Restaurar tu cuadrante personal"
              >
                <LogOut className="w-3 h-3 text-rose-300" />
                <span>Salir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner for Active Shared Owner (Cloud Editing) */}
      {activeSharedOwner && (
        <div className={cn(
          "px-3 sm:px-6 py-2 border-b text-xs font-semibold shrink-0 z-50 shadow-md transition-colors",
          activeSharedOwner.isLocked
            ? "bg-amber-600 text-white border-amber-700/60 dark:bg-amber-700 dark:border-amber-800"
            : "bg-azul-blue text-white border-azul-blue/80 dark:bg-slate-800 dark:border-slate-700"
        )}>
          <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 text-white shrink-0">
                {activeSharedOwner.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              </span>
              <div className="flex items-center gap-2 truncate">
                <span className="font-black uppercase tracking-wider text-[10px] text-white/80">
                  {activeSharedOwner.isLocked ? "Solo Lectura:" : "Compartir/Colab:"}
                </span>
                <span className="font-extrabold text-white truncate underline decoration-white/40">
                  {activeSharedOwner.ownerName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-full text-white">
                  {activeSharedOwner.isLocked ? "🔒 Turnos Bloqueados" : "⚡ En Vivo en la Nube"}
                </span>
                {activeSharedOwner.hidePayrollAmounts && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black bg-orange-950/60 border border-orange-400/40 px-2 py-0.5 rounded-full text-orange-200">
                    <EyeOff className="w-2.5 h-2.5" />
                    Nómina Oculta
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <button
                type="button"
                onClick={async () => {
                  setIsSyncing(true);
                  try {
                    const freshShifts = await dbGetShifts(activeSharedOwner.ownerUid);
                    setShifts(freshShifts);
                    setToastMessage({
                      type: 'success',
                      title: 'Cuadrante actualizado',
                      desc: 'Turnos sincronizados con la nube de ' + activeSharedOwner.ownerName
                    });
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Refrescar datos desde la nube"
              >
                <RefreshCw className={cn("w-3 h-3", isSyncing ? "animate-spin" : "")} />
                <span className="hidden xs:inline">Refrescar</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSharedQuadrant(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Volver a tu cuadrante personal"
              >
                <LogOut className="w-3 h-3 text-rose-300" />
                <span>Volver al mío</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-40 px-3 sm:px-6 md:px-10 py-3 sm:py-4 safe-top">
        <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => setShowWelcome(true)}
            className="flex items-center gap-2 sm:gap-3 text-left focus:outline-none focus:ring-2 focus:ring-azul-blue/20 rounded-2xl p-1 -m-1 transition-transform active:scale-95 cursor-pointer hover:opacity-95"
            title="Mostrar pantalla de bienvenida"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-azul-blue rounded-xl flex items-center justify-center shadow-lg shadow-azul-blue/10 shrink-0">
              <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-black tracking-tighter text-slate-800 uppercase whitespace-nowrap leading-none">
                <span id="app-title-text" className="text-azul-blue">TurNom Ramp</span>
              </h1>
              <span id="app-info-btn" className="inline-flex items-center justify-center p-0.5 sm:p-1 rounded-full bg-azul-blue/10 text-azul-blue hover:bg-azul-blue/20 transition-colors">
                <Info className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              </span>
            </div>
          </button>

          {/* User Profile, Sync & Menu Dropdown */}
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {isTabScrolled && (
                <motion.button
                  key="scroll-to-top"
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  onClick={() => {
                    if (scrollContainerRef.current) {
                      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className={cn(
                    "group flex items-center justify-center transition-all border border-slate-200/80 bg-white/95 text-slate-700 shadow-lg shadow-slate-200/50 active:scale-90 cursor-pointer select-none dark:border-slate-800 dark:text-slate-200 dark:shadow-none",
                    "hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:bg-slate-900/90 dark:hover:bg-white dark:hover:text-slate-950 dark:hover:border-white",
                    activeTab === 'Turnos'
                      ? "px-3 sm:px-4 h-8 sm:h-10 rounded-full gap-1.5 sm:gap-2"
                      : "w-8 h-8 sm:w-10 sm:h-10 rounded-full"
                  )}
                  title="Volver al principio"
                >
                  <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-y-0.5 duration-200 text-current shrink-0" strokeWidth={2.5} />
                  {activeTab === 'Turnos' && (
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-current whitespace-nowrap">
                      {(() => {
                        const formatted = safeFormat(currentMonthTurnos, 'MMMM yyyy', { locale: es });
                        return formatted ? formatted.charAt(0).toUpperCase() + formatted.slice(1) : '';
                      })()}
                    </span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 relative" ref={headerMenuRef}>
            {/* Sync Queue / Network Status Badge */}
            {!isOnline ? (
              <span
                className="text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 shadow-2xs"
                title={queueLength > 0 ? `Modo sin conexión: ${queueLength} acción(es) pendiente(s) de sincronizar` : 'Sin conexión a internet (modo offline activo)'}
              >
                <CloudOff className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="hidden xs:inline">Sin conexión</span>
                {queueLength > 0 && (
                  <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black leading-none shadow-2xs">
                    {queueLength}
                  </span>
                )}
              </span>
            ) : (isSyncing || isSyncingQueue) ? (
              <span className="text-[10px] text-azul-blue dark:text-sky-300 font-semibold animate-pulse flex items-center gap-1 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-100 dark:border-sky-800">
                <Cloud className="w-3 h-3 animate-spin text-azul-blue dark:text-sky-400" />
                <span className="hidden xs:inline">
                  {queueLength > 0 ? `Sincronizando (${queueLength})...` : 'Sincronizando...'}
                </span>
              </span>
            ) : queueLength > 0 ? (
              <button
                type="button"
                onClick={() => processQueue()}
                className="text-[10px] text-purple-700 dark:text-purple-300 font-bold flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800 shadow-2xs cursor-pointer active:scale-95 transition-all"
                title="Pulsa para forzar la sincronización de cambios pendientes con la nube"
              >
                <RefreshCw className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span className="hidden xs:inline">Pendientes:</span>
                <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black leading-none">
                  {queueLength}
                </span>
              </button>
            ) : null}

            {/* Menu Trigger Button */}
            <button
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              className={cn(
                "relative flex items-center gap-1 sm:gap-1.5 pl-2.5 pr-2 py-1.5 sm:py-2 rounded-full transition-all border shadow-sm active:scale-95 cursor-pointer select-none",
                isHeaderMenuOpen
                  ? "bg-slate-100 border-slate-300 text-slate-800"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                needRefresh
                  ? "border-orange-400 bg-orange-50/70 shadow-orange-500/10 ring-2 ring-orange-500/20"
                  : hasInstalledUpdateNotice && "border-blue-400 bg-blue-50/80 dark:bg-blue-950/40 shadow-blue-500/10 ring-2 ring-blue-500/20"
              )}
              title={
                needRefresh
                  ? "¡Nueva versión lista para actualizar!"
                  : hasInstalledUpdateNotice
                    ? `¡App actualizada a la v${APP_VERSION}! Ver novedades`
                    : "Menú de opciones"
              }
            >
              {needRefresh ? (
                <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-sm shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              ) : hasInstalledUpdateNotice ? (
                <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-400 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              ) : user && user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Perfil" 
                  className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full border border-slate-200 object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : user ? (
                <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-azul-blue text-white text-[10px] sm:text-xs font-bold flex items-center justify-center">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
              ) : (
                <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-500">
                  <MoreVertical className="w-3.5 h-3.5" />
                </div>
              )}

              {needRefresh && (
                <span className="hidden min-[480px]:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-orange-500 text-white px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                  ¡Actualizar!
                </span>
              )}

              {unreadSwapCount > 0 && !needRefresh && (
                <span className="hidden min-[420px]:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.5 rounded-full shadow-xs">
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                  {unreadSwapCount}
                </span>
              )}

              <ChevronDown className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 transition-transform duration-200", isHeaderMenuOpen ? "rotate-180" : "")} />

              {/* Orange warning dot if needRefresh is true */}
              {needRefresh && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 border-2 border-white dark:border-slate-900 shadow-xs"></span>
                </span>
              )}

              {/* Blue gradient dot if app auto-updated on startup and changelog hasn't been seen yet */}
              {!needRefresh && hasInstalledUpdateNotice && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3" title={`Novedades v${APP_VERSION}`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600 border-2 border-white dark:border-slate-900 shadow-xs"></span>
                </span>
              )}

              {/* Emerald notification dot if user has unread swap notifications */}
              {unreadSwapCount > 0 && !needRefresh && !hasInstalledUpdateNotice && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3" title={`${unreadSwapCount} ${unreadSwapCount === 1 ? 'cambio de turno nuevo' : 'cambios de turno nuevos'}`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs"></span>
                </span>
              )}

              {/* Blue notification dot if admin has unread suggestions */}
              {isAdmin && unreadSuggestionsCount > 0 && !needRefresh && !hasInstalledUpdateNotice && unreadSwapCount === 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3" title={`${unreadSuggestionsCount} nuevas sugerencias`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600 border-2 border-white dark:border-slate-900 shadow-xs"></span>
                </span>
              )}
            </button>

            {/* Dropdown Menu Container */}
            <AnimatePresence>
              {isHeaderMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-2 z-50 flex flex-col gap-1"
                >
                  {/* Banner Notificación de Actualización en el Desplegable */}
                  {needRefresh && (
                    <div
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        setIsUpdateModalOpen(true);
                      }}
                      className="mb-1 p-2.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/25 cursor-pointer hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-between gap-2 select-none"
                      title="Instalar actualización disponible"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                          <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: '3s' }} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider leading-tight flex items-center gap-1">
                            <span>¡Actualización Lista!</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          </span>
                          <span className="text-[9px] font-semibold text-white/90 leading-tight truncate">
                            {serverVersion ? `Versión ${serverVersion} disponible` : 'Nueva versión lista para instalar'}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white text-orange-600 font-black text-[8px] uppercase tracking-wider shadow-xs shrink-0">
                        Instalar
                      </span>
                    </div>
                  )}

                  {/* Banner Informativo de Novedades Ya Instaladas al Entrar */}
                  {!needRefresh && hasInstalledUpdateNotice && (
                    <div
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        setIsUpdateModalOpen(true);
                      }}
                      className="mb-1 p-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25 cursor-pointer hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-between gap-2 select-none"
                      title="Ver novedades ya instaladas en esta versión"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider leading-tight flex items-center gap-1">
                            <span>¡App Actualizada!</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          </span>
                          <span className="text-[9px] font-semibold text-white/90 leading-tight truncate">
                            Versión {APP_VERSION} instalada • Ver cambios
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white text-indigo-600 font-black text-[8px] uppercase tracking-wider shadow-xs shrink-0">
                        Ver
                      </span>
                    </div>
                  )}

                  {/* Banner Notificación de Nuevas Sugerencias para Admin */}
                  {isAdmin && unreadSuggestionsCount > 0 && (
                    <div
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        setIsSuggestionModalOpen(true);
                      }}
                      className="mb-1 p-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md shadow-blue-500/25 cursor-pointer hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-between gap-2 select-none"
                      title="Ver sugerencias recibidas"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                          <MessageSquare className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider leading-tight flex items-center gap-1">
                            <span>Buzón Admin</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          </span>
                          <span className="text-[9px] font-semibold text-white/90 leading-tight truncate">
                            {unreadSuggestionsCount} {unreadSuggestionsCount === 1 ? 'nueva sugerencia recibida' : 'nuevas sugerencias recibidas'}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white text-blue-600 font-black text-[8px] uppercase tracking-wider shadow-xs shrink-0">
                        Ver
                      </span>
                    </div>
                  )}

                  {/* Notificaciones de Cambios de Turno */}
                  {user && !isGuestMode && headerBannerSwapNotifications.length > 0 && (
                    <div className="mb-1 p-2 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200/90 dark:border-emerald-800/60 space-y-1.5">
                      <div className="flex items-center justify-between gap-1 px-1">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                          <Bell className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Cambios de Turno</span>
                          {unreadSwapCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[8px] font-black">
                              {unreadSwapCount}
                            </span>
                          )}
                        </span>
                        {unreadSwapCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkSwapNotificationsRead}
                            className="text-[8.5px] font-black text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                          >
                            Marcar vistas
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-0.5">
                        {headerBannerSwapNotifications.slice(0, 6).map((notif) => {
                          const origDateObj = parseISO(notif.myOriginalDate);
                          const covDateObj = parseISO(notif.coveredDate);
                          const origLabel = isValid(origDateObj) ? format(origDateObj, 'd MMM', { locale: es }) : notif.myOriginalDate;
                          const covLabel = isValid(covDateObj) ? format(covDateObj, 'd MMM', { locale: es }) : notif.coveredDate;
                          const covShiftLabel = (notif.coveredShifts || [])
                            .filter(s => s && s.start && s.end)
                            .map(s => `${s.start}-${s.end}`)
                            .join('/');
                          const linkedReceivedReq = notif.requestId
                            ? receivedSwapRequests.find(r => r.id === notif.requestId)
                            : undefined;
                          const linkedSentReq = notif.requestId
                            ? sentSwapRequests.find(r => r.id === notif.requestId)
                            : undefined;
                          const effectiveStatus = linkedReceivedReq?.status || linkedSentReq?.status || notif.status;
                          const isPendingRequest =
                            notif.type === 'shift_swap_request' &&
                            linkedReceivedReq?.status === 'pending';
                          const isUndo = notif.type === 'shift_swap_undo' || effectiveStatus === 'undone';
                          const isAccepted =
                            !isUndo &&
                            (notif.type === 'shift_swap_accepted' || effectiveStatus === 'accepted');
                          const isRejected =
                            !isUndo &&
                            (notif.type === 'shift_swap_rejected' || effectiveStatus === 'rejected');
                          const isPendingBadge =
                            notif.type === 'shift_swap_request' &&
                            !isUndo &&
                            !isAccepted &&
                            !isRejected;
                          const isBusy = !!notif.requestId && respondingSwapReqId === notif.requestId;

                          return (
                            <div
                              key={notif.id}
                              className={cn(
                                "p-2 rounded-xl border text-left space-y-1.5 transition-all",
                                !notif.read
                                  ? "bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                                  : "bg-white/60 dark:bg-slate-900/50 border-emerald-100 dark:border-slate-800 opacity-85"
                              )}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {!notif.read && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    )}
                                    <span className="text-[10px] font-black text-slate-900 dark:text-white truncate">
                                      {notif.senderName}
                                    </span>
                                    <span className={cn(
                                      "text-[7.5px] font-black uppercase px-1.5 py-0.2 rounded-md",
                                      isUndo || isRejected
                                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                        : isPendingBadge
                                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                          : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                    )}>
                                      {isUndo
                                        ? 'Deshecho'
                                        : isRejected
                                          ? 'Rechazada'
                                          : isPendingBadge
                                            ? 'Pendiente'
                                            : isAccepted
                                              ? 'Aceptada'
                                              : 'Cambio aplicado'}
                                    </span>
                                  </div>
                                  <p className="text-[9.5px] font-semibold text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                                    {isUndo
                                      ? `Restaurado tu turno del ${origLabel}.`
                                      : notif.type === 'shift_swap_request'
                                        ? `Solicita cambiar tu ${origLabel} por su ${covLabel}${covShiftLabel ? ` (${covShiftLabel})` : ''}.`
                                        : notif.type === 'shift_swap_accepted'
                                          ? `Aceptó cambiar tu ${origLabel} por su ${covLabel}${covShiftLabel ? ` (${covShiftLabel})` : ''}.`
                                          : notif.type === 'shift_swap_rejected'
                                            ? `Rechazó cambiar tu ${origLabel} por su ${covLabel}.`
                                            : `Cambiado tu ${origLabel} por su ${covLabel}${covShiftLabel ? ` (${covShiftLabel})` : ''}.`}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSwapNotification(notif.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                                  title="Eliminar notificación"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              {isPendingRequest && notif.requestId && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRespondSwapRequest(notif.requestId!, 'accepted')}
                                    className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                  >
                                    {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                                    <span>Aceptar</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRespondSwapRequest(notif.requestId!, 'rejected')}
                                    className="flex-1 py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-950/80 disabled:opacity-50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                    <span>Rechazar</span>
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetJumpDate = isValid(covDateObj) ? covDateObj : (isValid(origDateObj) ? origDateObj : null);
                                    if (targetJumpDate) {
                                      handleSetCurrentMonthTurnos(startOfMonth(targetJumpDate));
                                    }
                                    setActiveTab('Turnos');
                                    if (!notif.read) {
                                      handleMarkSingleSwapNotificationRead(notif.id);
                                    }
                                    setIsHeaderMenuOpen(false);
                                  }}
                                  className="text-[9px] font-black uppercase tracking-wider text-azul-blue dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <CalendarDays className="w-3 h-3" />
                                  <span>Ver en calendario</span>
                                </button>
                                {!notif.read && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkSingleSwapNotificationRead(notif.id)}
                                    className="text-[8.5px] font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Vista</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Banner de Cola de Sincronización Offline si hay pendientes */}
                  {queueLength > 0 && (
                    <div className="px-3 py-2 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                          <CloudOff className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-200 leading-tight">
                            Cola Offline
                          </span>
                          <span className="text-[9px] text-amber-700 dark:text-amber-300 leading-tight truncate">
                            {queueLength} cambio{queueLength === 1 ? '' : 's'} pendiente{queueLength === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      {isOnline && (
                        <button
                          onClick={() => {
                            setIsHeaderMenuOpen(false);
                            processQueue();
                          }}
                          className="px-2 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-wider active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          Sincronizar
                        </button>
                      )}
                    </div>
                  )}

                  {/* Banner de Recuperación si algún cambio offline falló al sincronizar */}
                  {failedCount > 0 && (
                    <div className="px-3 py-2.5 bg-rose-50/95 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex flex-col gap-2 mb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-xl bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-200 leading-tight">
                              Cambios sin sincronizar
                            </span>
                            <span className="text-[9px] text-rose-700 dark:text-rose-300 leading-tight">
                              {failedCount} cambio{failedCount === 1 ? '' : 's'} no se pudo{failedCount === 1 ? '' : 'ieron'} subir a la nube
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => dismissFailed()}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer shrink-0"
                          title="Descartar aviso"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            setIsHeaderMenuOpen(false);
                            const res = await retryFailed();
                            if (res.failedMovedCount > 0) {
                              setToastMessage({
                                type: 'error',
                                title: 'No se pudo sincronizar',
                                desc: 'Sigue habiendo cambios pendientes. Puedes guardar una copia local para no perderlos.',
                              });
                            }
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          Reintentar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = downloadSyncBackup();
                            if (ok) {
                              setToastMessage({
                                type: 'success',
                                title: 'Copia descargada',
                                desc: 'Se ha guardado el archivo JSON con tus cambios pendientes.',
                              });
                            }
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-slate-700 font-black text-[9px] uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Download className="w-2.5 h-2.5" />
                          Guardar copia
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1. Sincronizar Nube / Perfil */}
                  {user ? (
                    <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 rounded-2xl flex flex-col gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {user.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt="Perfil" 
                            className="w-7 h-7 rounded-full border border-slate-200 shrink-0" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-azul-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {user.email?.[0].toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-tight truncate">
                            {user.displayName || user.email?.split('@')[0]}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-600 leading-none flex items-center gap-0.5 mt-0.5">
                            <Cloud className="w-2.5 h-2.5" />
                            En la nube
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase text-rose-600 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 rounded-xl transition-all cursor-pointer active:scale-95"
                      >
                        <LogOut className="w-3 h-3" />
                        Cerrar sesión
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        handleGoogleLogin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider text-white bg-azul-blue hover:bg-azul-blue/90 shadow-sm transition-all cursor-pointer text-left active:scale-[0.98] mb-1"
                    >
                      <Cloud className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>Sincronizar Nube</span>
                    </button>
                  )}

                  {/* 2. Modo Claro / Oscuro */}
                  <button
                    onClick={() => {
                      const nextTheme = theme === 'dark' ? 'light' : 'dark';
                      setTheme(nextTheme);
                      localStorage.setItem('theme_preference', nextTheme);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer text-left active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2">
                      {theme === 'dark' ? (
                        <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      )}
                      <span className="font-black uppercase text-[10px] tracking-wider text-slate-700 dark:text-slate-300">
                        {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                      </span>
                    </div>
                    
                    {/* Visual Toggle Switch */}
                    <div className={cn(
                      "w-8 h-4.5 rounded-full p-0.5 transition-colors duration-300 flex items-center",
                      theme === 'dark' ? "bg-emerald-500" : "bg-slate-300"
                    )}>
                      <div className={cn(
                        "w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-300",
                        theme === 'dark' ? "translate-x-3.5" : "translate-x-0"
                      )} />
                    </div>
                  </button>

                  {/* 3. Datos Verificados */}
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      verifyAndSaveAllData();
                    }}
                    disabled={saveStatus === 'verifying'}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left active:scale-[0.98] cursor-pointer ${
                      saveStatus === 'verifying'
                        ? 'bg-amber-50 text-amber-700 opacity-50 cursor-not-allowed'
                        : saveStatus === 'success'
                          ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                          : saveStatus === 'error'
                            ? 'text-rose-700 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${saveStatus === 'verifying' ? 'animate-spin text-amber-500' : saveStatus === 'success' ? 'text-emerald-500' : 'text-slate-500'}`} />
                    <span className="font-black uppercase text-[10px] tracking-wider">
                      {saveStatus === 'verifying' 
                        ? 'Verificando...' 
                        : saveStatus === 'success'
                          ? 'Datos Verificados'
                          : 'Re-verificar Datos'}
                    </span>
                  </button>

                  {/* 4. Compartir QR */}
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsQrModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer text-left active:scale-[0.98]"
                  >
                    <QrCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="font-black uppercase text-[10px] tracking-wider text-slate-700 dark:text-slate-200">Compartir QR</span>
                  </button>

                  {/* 5. Actualizar App */}
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsUpdateModalOpen(true);
                    }}
                    className={cn(
                      "relative w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer text-left active:scale-[0.98]",
                      needRefresh 
                        ? "bg-orange-500/15 text-orange-950 dark:text-orange-200 font-black border border-orange-500/40 shadow-xs" 
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5 shrink-0", needRefresh ? "text-orange-500 animate-spin" : "text-indigo-500", isRefreshing ? "animate-spin" : "")} style={needRefresh && !isRefreshing ? { animationDuration: '3s' } : undefined} />
                    <span className="flex-1 font-black uppercase text-[10px] tracking-wider text-inherit">
                      {needRefresh ? "Actualización Lista" : "Actualizar App"}
                    </span>
                    {needRefresh && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-orange-500 text-white shadow-xs animate-pulse">
                          ¡NUEVA!
                        </span>
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-80"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                        </span>
                      </span>
                    )}
                  </button>

                  {/* 6. Copia de Seguridad */}
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsBackupModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer text-left active:scale-[0.98]"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="font-black uppercase text-[10px] tracking-wider text-slate-700 dark:text-slate-200">Copia de Seguridad</span>
                  </button>

                  {/* 7. Modo Invitado */}
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsGuestModalOpen(true);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer text-left active:scale-[0.98]",
                      isGuestMode
                        ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Users className={cn("w-3.5 h-3.5 shrink-0", isGuestMode ? "text-amber-500" : "text-amber-600 dark:text-amber-400")} />
                      <span className="font-black uppercase text-[10px] tracking-wider text-inherit">
                        {isGuestMode ? `Modo Invitado (${guestWorkerName})` : "Modo Invitado"}
                      </span>
                    </div>
                    {isGuestMode && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-xs">Activo</span>
                    )}
                  </button>

                  {/* 8. Compartir/Colab. */}
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsShareModalOpen(true);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer text-left active:scale-[0.98]",
                      activeSharedOwner
                        ? "bg-azul-blue/15 text-azul-blue dark:text-sky-300 border border-azul-blue/30 dark:border-azul-blue/50"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Share2 className={cn("w-3.5 h-3.5 shrink-0", activeSharedOwner ? "text-azul-blue dark:text-sky-400" : "text-azul-blue dark:text-sky-400")} />
                      <span className="font-black uppercase text-[10px] tracking-wider text-inherit">
                        {activeSharedOwner ? `Editando a ${activeSharedOwner.ownerName}` : "Compartir/Colab."}
                      </span>
                    </div>
                    {activeSharedOwner && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-azul-blue text-white shadow-xs">Activo</span>
                    )}
                  </button>

                  {/* 9. Buzón de Sugerencias */}
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsSuggestionModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer text-left active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-black uppercase text-[10px] tracking-wider text-slate-700 dark:text-slate-200">Buzón de Sugerencias</span>
                    </div>
                    {isAdmin && unreadSuggestionsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-blue-600 text-white shrink-0 shadow-2xs animate-pulse">
                        {unreadSuggestionsCount} nueva{unreadSuggestionsCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </button>

                  {/* 10. Versión de la app */}
                  <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (!needRefresh && hasInstalledUpdateNotice) {
                          dismissInstalledUpdateNotice();
                        }
                        setIsChangelogModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-azul-blue dark:text-slate-400 dark:hover:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all cursor-pointer group active:scale-[0.98]"
                      title="Ver historial de actualizaciones"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 group-hover:rotate-12 transition-transform" />
                      <div className="flex flex-col text-left min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 group-hover:text-azul-blue dark:group-hover:text-sky-300 leading-tight">
                            Versión {APP_VERSION}
                          </span>
                          {needRefresh ? (
                            <span className="text-[7.5px] font-black uppercase tracking-wider bg-orange-500 text-white px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
                              {serverVersion ? `v${serverVersion} lista` : 'Nueva lista'}
                            </span>
                          ) : hasInstalledUpdateNotice ? (
                            <span className="text-[7.5px] font-black uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded-full shrink-0">
                              Novedades
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 leading-none mt-0.5">
                          Historial de novedades
                        </span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>

      {/* Aviso visible de recuperación si falla la sincronización offline */}
      {failedCount > 0 && (
        <div
          role="alert"
          className="shrink-0 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800/70 px-3 py-2 z-30"
        >
          <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <p className="text-xs font-semibold text-rose-900 dark:text-rose-100 leading-snug">
                {failedCount === 1
                  ? '1 cambio offline no se pudo guardar en la nube.'
                  : `${failedCount} cambios offline no se pudieron guardar en la nube.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await retryFailed();
                  if (res.failedMovedCount > 0) {
                    setToastMessage({
                      type: 'error',
                      title: 'Sigue fallando la sincronización',
                      desc: 'Comprueba tu conexión o guarda una copia local en JSON.',
                    });
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = downloadSyncBackup();
                  if (ok) {
                    setToastMessage({
                      type: 'success',
                      title: 'Copia descargada',
                      desc: 'Tus cambios locales y pendientes se han guardado en formato JSON.',
                    });
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 hover:bg-rose-100/70 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Guardar copia
              </button>
              <button
                type="button"
                onClick={() => dismissFailed()}
                className="min-h-[44px] min-w-[44px] rounded-xl text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cerrar aviso de sincronización"
                title="Descartar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full relative overflow-hidden max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        {/* Pull to Refresh Indicator */}
        <div 
          className="absolute left-0 right-0 z-[100] flex justify-center pointer-events-none"
          style={{ 
            transform: `translateY(${Math.max(-48, pullDistance - 48)}px)`,
            opacity: pullDistance > 0 || isRefreshing ? Math.min(1, Math.max(0.3, pullDistance / 50)) : 0,
            transition: isPulling ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'
          }}
        >
          <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2 mt-1">
            <RefreshCw className={cn("w-3.5 h-3.5 text-azul-blue", (isRefreshing || pullDistance >= 60) ? "animate-spin" : "")} />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
              {isRefreshing 
                ? 'Actualizando...' 
                : pullDistance >= 60 
                  ? 'Suelta para actualizar' 
                  : 'Arrastra para actualizar'}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            ref={setScrollRef}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 overflow-y-auto pb-32 pt-2 sm:pt-0 px-1 min-[360px]:px-1.5 sm:px-3"
            data-active-tab={activeTab}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <ErrorBoundary
              scope="tab"
              sectionName={activeTab}
              resetKey={activeTab}
              onNavigateHome={() => handleTabChange('Turnos')}
            >
              <Suspense
                fallback={
                  <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin text-azul-blue" />
                    <span className="text-xs font-bold uppercase tracking-wider">Cargando sección...</span>
                  </div>
                }
              >
                {activeTab === 'Configuracion' && (
                  <ConfiguracionTab 
                    settings={settings}
                    shifts={shifts}
                    updateSettings={updateSettings}
                    updateShift={updateShift}
                    updateShifts={updateShifts}
                    handleResetData={handleResetData}
                    activeSharedOwner={activeSharedOwner}
                  />
                )}
                {activeTab === 'Tablas' && (
                  <TablasTab 
                    yearlyLevels={levels}
                    yearlyPluses={pluses}
                    yearlyLevelsPasaje={levelsPasaje}
                    yearlyPlusesPasaje={plusesPasaje}
                    settings={settings}
                    updateLevels={updateLevels}
                    updatePluses={updatePluses}
                    updateSettings={updateSettings}
                    initialLevels={INITIAL_LEVELS}
                    initialPluses={INITIAL_PLUSES}
                    initialLevelsPasaje={INITIAL_LEVELS_PASAJE}
                    initialPlusesPasaje={INITIAL_PLUSES_PASAJE}
                    activeSharedOwner={activeSharedOwner}
                  />
                )}
                {activeTab === 'Turnos' && (
                  <TurnosTab 
                    shifts={shifts}
                    settings={settings}
                    updateSettings={updateSettings}
                    updateShift={updateShift}
                    updateShifts={updateShifts}
                    deleteShift={deleteShift}
                    deleteShifts={deleteShifts}
                    currentMonth={currentMonthTurnos}
                    setCurrentMonth={handleSetCurrentMonthTurnos}
                    formatNumber={formatNumber}
                    pluses={settings.colectivoConvenio === 'pasaje' ? plusesPasaje : pluses}
                    levels={settings.colectivoConvenio === 'pasaje' ? levelsPasaje : levels}
                    viewMode={viewMode}
                    setViewMode={handleSetViewMode}
                    activeSharedOwner={activeSharedOwner}
                    user={user}
                    onShowToast={setToastMessage}
                    unreadSwapCount={unreadSwapCount}
                    swapNotifications={activeSwapNotifications}
                    sentSwapRequests={sentSwapRequests}
                    receivedSwapRequests={receivedSwapRequests}
                    respondingSwapReqId={respondingSwapReqId}
                    onMarkSwapNotificationsRead={handleMarkSwapNotificationsRead}
                    onMarkSingleSwapNotificationRead={handleMarkSingleSwapNotificationRead}
                    onDeleteSwapNotification={handleDeleteSwapNotification}
                    onRespondSwapRequest={handleRespondSwapRequest}
                    onDeleteSwapRequest={handleDeleteSwapRequest}
                  />
                )}
                {activeTab === 'Herramientas' && (
                  <HerramientasTab 
                    formatNumber={formatNumber}
                    shifts={shifts}
                    user={user}
                    settings={settings}
                    levels={settings.colectivoConvenio === 'pasaje' ? levelsPasaje : levels}
                    pluses={settings.colectivoConvenio === 'pasaje' ? plusesPasaje : pluses}
                    updateSettings={activeSharedOwner?.isLocked ? undefined : updateSettings}
                    updateShift={activeSharedOwner?.isLocked ? undefined : updateShift}
                    updateShifts={activeSharedOwner?.isLocked ? undefined : updateShifts}
                  />
                )}
                {activeTab === 'Resumen' && (
                  <ResumenTab 
                    shifts={shifts}
                    currentMonth={currentMonthTurnos}
                    settings={settings}
                    levels={settings.colectivoConvenio === 'pasaje' ? levelsPasaje : levels}
                    pluses={settings.colectivoConvenio === 'pasaje' ? plusesPasaje : pluses}
                    getStatsForShifts={getStatsForShifts}
                    activeSharedOwner={activeSharedOwner}
                  />
                )}
                {activeTab === 'Contador' && (
                  <ContadorTab 
                    shifts={shifts}
                    settings={settings}
                    updateSettings={updateSettings}
                    pluses={settings.colectivoConvenio === 'pasaje' ? plusesPasaje : pluses}
                    activeSharedOwner={activeSharedOwner}
                  />
                )}
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="shrink-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 z-40 pb-safe shadow-[0_-1px_15px_rgba(0,0,0,0.05)] notranslate" translate="no">
        <div className={cn(
          "max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto grid h-16 sm:h-20 px-1 sm:px-4",
          settings.isSubrogado ? "grid-cols-6" : "grid-cols-5"
        )}>
          {[
            { id: 'Configuracion', icon: SettingsIcon, label: 'CONFIGURACIÓN' },
            { id: 'Contador', icon: Activity, label: 'CONTADOR', hidden: !settings.isSubrogado },
            { id: 'Tablas', icon: Table, label: 'TABLAS SALARIALES' },
            { id: 'Turnos', icon: CalendarIcon, label: 'TURNOS Y NÓMINA' },
            { id: 'Herramientas', icon: Wrench, label: 'HERRAMIENTAS' },
            { id: 'Resumen', icon: BarChart3, label: 'RESUMEN' },
          ].filter(t => !t.hidden).map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabId)}
              className={cn(
                "flex flex-col items-center justify-center transition-all relative outline-none py-1",
                activeTab === tab.id ? "text-azul-blue" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon 
                className={cn(
                  "w-[18px] h-[18px] min-[360px]:w-[20px] min-[360px]:h-[20px] sm:w-[22px] sm:h-[22px]",
                  activeTab === tab.id ? "stroke-[2.5]" : "stroke-[2]"
                )} 
              />
              <span className="text-[6.5px] min-[340px]:text-[7.5px] min-[380px]:text-[8.5px] sm:text-[10px] font-black uppercase tracking-tighter text-center mt-1 w-full px-0.5 leading-tight flex-1 flex items-center justify-center">
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabDot" className="w-1 h-1 rounded-full bg-azul-yellow mt-0.5" />
              )}
            </button>
          ))}
        </div>
      </nav>
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmResetData}
        title="Borrar todos los datos"
        message="¿Estás seguro de que quieres borrar todos los datos? Esta acción no se puede deshacer."
        confirmLabel="Borrar todo"
        variant="danger"
      />
      <WelcomeModal 
        isOpen={showWelcome} 
        onClose={handleCloseWelcome} 
      />
      
      {/* Modal de Compartir mediante Código QR */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsQrModalOpen(false)}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-sm relative z-10 flex flex-col items-center text-center overflow-hidden"
            >
              {/* Decorative light reflection */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-azul-blue via-azul-yellow to-azul-blue" />
              
              {/* Close Button */}
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100/80 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="mb-4 mt-2">
                <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Compartir Aplicación</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Escanea el código QR o copia el enlace de abajo</p>
              </div>

              {/* QR Image Wrapper */}
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-inner flex items-center justify-center mb-5 relative group overflow-hidden">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("https://ais-pre-yq34y6yschpgltefu4wdgy-837569731384.europe-west2.run.app/")}`}
                  alt="Código QR de la aplicación"
                  className="w-[180px] h-[180px] bg-white rounded-2xl p-1.5 shadow-sm object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Copy Link Input & Button */}
              <div className="w-full space-y-2">
                <div className="w-full flex items-center gap-1.5 bg-slate-50 rounded-2xl p-1.5 border border-slate-200 shadow-sm relative group overflow-hidden">
                  <span className="text-[10px] text-slate-400 truncate text-left flex-1 px-2 font-mono whitespace-nowrap">
                    https://ais-pre-yq34y6yschpgltefu4wdgy-837569731384.europe-west2.run.app/
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("https://ais-pre-yq34y6yschpgltefu4wdgy-837569731384.europe-west2.run.app/");
                      setQrCopied(true);
                      setTimeout(() => setQrCopied(false), 2000);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black select-none cursor-pointer transition-all active:scale-95 flex items-center gap-1 shrink-0 ${
                      qrCopied
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : "bg-azul-blue text-white hover:bg-azul-blue/95"
                    }`}
                  >
                    {qrCopied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" /> 
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Actualización y Caché */}
      <AnimatePresence>
        {isUpdateModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={handleCloseUpdateModal}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="bg-slate-900 rounded-[2.5rem] p-5 sm:p-6 w-full max-w-md border border-slate-800 shadow-2xl relative z-10 flex flex-col text-left overflow-hidden text-white max-h-[90vh]"
            >
              {/* Decorative light reflection */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-sky-400" />
              
              {/* Close Button */}
              <button
                onClick={handleCloseUpdateModal}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer z-20"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="mb-3 mt-1 flex items-center gap-3 pr-8">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                  needRefresh 
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30" 
                    : hasInstalledUpdateNotice
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                }`}>
                  {needRefresh ? (
                    <Sparkles size={22} className="text-amber-400 animate-pulse" />
                  ) : hasInstalledUpdateNotice ? (
                    <Sparkles size={22} className="text-emerald-400" />
                  ) : (
                    <RefreshCw size={20} className={isRefreshing ? "animate-spin" : "text-indigo-400"} />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit ${
                    needRefresh 
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                      : hasInstalledUpdateNotice
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  }`}>
                    {needRefresh
                      ? "🎉 ¡Nueva versión disponible!"
                      : hasInstalledUpdateNotice
                        ? "✨ ¡App actualizada!"
                        : "✨ Novedades de la app"}
                  </span>
                  <h3 className="font-black text-sm sm:text-base text-white tracking-tight mt-0.5 leading-tight truncate">
                    Versión {((needRefresh && serverLatestUpdate) ? serverLatestUpdate.version : UPDATES_HISTORY[0]?.version) || APP_VERSION}
                  </h3>
                </div>
              </div>

              {/* Body Content - Scrollable */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 my-1">
                {/* Release summary & changes card (Simplificada) */}
                {(() => {
                  const activeUpdate = (needRefresh && serverLatestUpdate) ? serverLatestUpdate : UPDATES_HISTORY[0];
                  if (!activeUpdate) return null;
                  return (
                    <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span className="text-amber-400 font-black uppercase tracking-wider text-[9px] flex items-center gap-1">
                          <Tag size={11} />
                          <span>Versión {activeUpdate.version}</span>
                        </span>
                        <span className="text-slate-400 font-bold text-[9.5px]">
                          {activeUpdate.date}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-black text-white leading-snug">
                        {activeUpdate.title}
                      </h4>

                      {/* Bullet list of changes categorizados */}
                      {activeUpdate.changes && activeUpdate.changes.length > 0 && (
                        <ul className="pt-1.5 border-t border-white/10 space-y-1.5">
                          {activeUpdate.changes.map((change, idx) => {
                            const parts = change.split(':');
                            if (parts.length === 2) {
                              const category = parts[0].trim();
                              const section = parts[1].trim();
                              let badgeColor = "bg-white/10 text-white border-white/15";
                              if (category.toLowerCase().includes('nueva')) {
                                badgeColor = "bg-purple-500/20 text-purple-200 border-purple-400/30";
                              } else if (category.toLowerCase().includes('diseño')) {
                                badgeColor = "bg-sky-500/20 text-sky-200 border-sky-400/30";
                              } else if (category.toLowerCase().includes('mejora')) {
                                badgeColor = "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
                              } else if (category.toLowerCase().includes('error') || category.toLowerCase().includes('corregid')) {
                                badgeColor = "bg-rose-500/20 text-rose-200 border-rose-400/30";
                              }

                              return (
                                <li key={idx} className="flex items-center gap-2 text-[10.5px] leading-snug py-0.5">
                                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={cn("px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider border", badgeColor)}>
                                      {category}
                                    </span>
                                    <span className="font-bold text-white text-[10.5px]">
                                      {section}
                                    </span>
                                  </div>
                                </li>
                              );
                            }

                            return (
                              <li key={idx} className="flex items-start gap-2 text-[10.5px] text-slate-200 leading-snug">
                                <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                                <span>{change}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                {/* Notificación de Actualizaciones */}
                <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-between gap-2 text-[10px]">
                  <div className="flex items-center gap-1.5 text-sky-300">
                    <Calendar size={13} className="shrink-0 text-sky-400" />
                    <span>
                      Notificación inmediata: las actualizaciones y novedades se notifican en cuanto se publican mejoras.
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    En vivo
                  </span>
                </div>

                {/* Status Notice */}
                {needRefresh ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
                    <p className="text-[10px] text-amber-200 font-semibold leading-normal">
                      Hay una versión más reciente lista para cargarse. Pulsa el botón inferior para instalar las novedades y sincronizar la aplicación.
                    </p>
                  </div>
                ) : hasInstalledUpdateNotice ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
                    <p className="text-[10px] text-emerald-200 font-semibold leading-normal">
                      Esta actualización se ha cargado automáticamente al iniciar la aplicación. No hace falta instalar nada: todas las novedades ya están activas.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                    <p className="text-[10px] text-slate-300 font-semibold leading-normal">
                      Tu dispositivo ya cuenta con la última versión instalada.
                    </p>
                  </div>
                )}

                {/* iOS & mobile advice */}
                {!(hasInstalledUpdateNotice && !needRefresh) && (
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 flex items-start gap-2 text-[10px] text-slate-400">
                    <span className="text-indigo-400 font-bold shrink-0">💡 Tip:</span>
                    <span>En iPhone y Android, también puedes deslizar la pantalla hacia abajo en cualquier pestaña para refrescar al instante.</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 mt-1 border-t border-white/10 space-y-2">
                {!needRefresh && hasInstalledUpdateNotice ? (
                  <button
                    type="button"
                    onClick={handleCloseUpdateModal}
                    className="w-full text-white font-black uppercase text-xs tracking-widest py-3.5 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 shadow-indigo-500/25"
                  >
                    <CheckCircle2 size={15} />
                    <span>¡Entendido!</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleModalRefresh}
                      disabled={isRefreshing || isPurgingCache}
                      className={`w-full text-white font-black uppercase text-xs tracking-widest py-3.5 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        needRefresh 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/25 ring-2 ring-amber-400/30' 
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                      }`}
                    >
                      <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                      <span>
                        {isRefreshing 
                          ? "Actualizando App..." 
                          : needRefresh 
                            ? "Instalar y Aplicar Novedades" 
                            : "Recargar y Forzar Caché"}
                      </span>
                    </button>

                    {/* Botón Específico: Limpiar Caché Versión APP */}
                    <button
                      type="button"
                      onClick={handleForcePurgeServiceWorker}
                      disabled={isPurgingCache || isRefreshing}
                      className={cn(
                        "w-full text-xs font-black uppercase tracking-wider py-3 px-4 rounded-2xl transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border select-none",
                        purgeSuccess
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border-white/15 hover:border-white/25",
                        (isPurgingCache || isRefreshing) && "opacity-60 cursor-not-allowed"
                      )}
                      title="Desregistra el Service Worker y limpia completamente la memoria caché para resolver cualquier conflicto de versión"
                    >
                      {isPurgingCache ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-amber-400 shrink-0" />
                          <span>Limpiando caché de la APP...</span>
                        </>
                      ) : purgeSuccess ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span>¡Caché limpiada! Recargando...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} className="text-amber-400/90 shrink-0" />
                          <span>Limpiar Caché Versión APP</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    handleCloseUpdateModal();
                    setIsChangelogModalOpen(true);
                  }}
                  className="w-full py-2 rounded-xl text-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  Ver historial de versiones anteriores →
                </button>
              </div>

              {/* Decorative background elements */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl p-0 pointer-events-none" />
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-slate-800 rounded-full blur-3xl p-0 pointer-events-none" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Modo Invitado / Cuadrante de Compañero */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {isGuestModalOpen && (
            <GuestWorkspaceModal
              isOpen={isGuestModalOpen}
              onClose={() => setIsGuestModalOpen(false)}
              isGuestMode={isGuestMode}
              guestWorkerName={guestWorkerName}
              currentSettings={settings}
              currentShifts={shifts}
              currentLevels={levels}
              currentPluses={pluses}
              onEnterGuestModeWithFile={handleEnterGuestModeWithFile}
              onEnterBlankGuestMode={handleEnterBlankGuestMode}
              onEnterCopyGuestMode={handleEnterCopyGuestMode}
              onSaveGuestChanges={handleSaveGuestChanges}
              onApplyGuestChangesToPrimary={handleApplyGuestChangesToPrimary}
              onDownloadGuestData={handleDownloadGuestData}
              onExitGuestMode={handleExitGuestMode}
              onShowToast={setToastMessage}
            />
          )}
        </AnimatePresence>

        {/* Modal de Compartir Cuadrante (Editores en la Nube) */}
        <AnimatePresence>
          {isShareModalOpen && (
            <ShareQuadrantModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              user={user}
              onGoogleLogin={handleGoogleLogin}
              activeSharedOwner={activeSharedOwner}
              onSelectSharedQuadrant={handleSelectSharedQuadrant}
              onShowToast={setToastMessage}
            />
          )}
        </AnimatePresence>

        {/* Modal de Copia de Seguridad (Exportar / Importar) */}
        <AnimatePresence>
          {isBackupModalOpen && (
            <DataBackupModal
              isOpen={isBackupModalOpen}
              onClose={() => setIsBackupModalOpen(false)}
              settings={settings}
              shifts={shifts}
              levels={levels}
              pluses={pluses}
              onRestoreData={handleRestoreData}
              onShowToast={setToastMessage}
            />
          )}
        </AnimatePresence>

        {/* Modal de Historial de Actualizaciones */}
        {isChangelogModalOpen && (
          <ChangelogModal
            isOpen={isChangelogModalOpen}
            onClose={() => setIsChangelogModalOpen(false)}
          />
        )}

        {/* Modal de Buzón de Sugerencias */}
        <AnimatePresence>
          {isSuggestionModalOpen && (
            <SuggestionModal
              isOpen={isSuggestionModalOpen}
              onClose={() => setIsSuggestionModalOpen(false)}
              user={user}
              onShowToast={setToastMessage}
              onMarkAllRead={() => {
                const readTs = Math.max(Date.now(), latestSuggestionTimestampRef.current);
                localStorage.setItem('admin_last_read_suggestion_time', readTs.toString());
                setUnreadSuggestionsCount(0);
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>
      {/* Toast de Verificación */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-24 left-4 right-4 z-[150] max-w-md mx-auto"
          >
            <div className={`p-4 rounded-2xl border shadow-xl flex gap-3 backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600/95 border-emerald-400 text-white'
                : 'bg-rose-600/95 border-rose-400 text-white'
            }`}>
              <div className="shrink-0 w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                {toastMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-white" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm uppercase tracking-wider mb-1 text-white">
                  {toastMessage.title}
                </h4>
                <p className="text-xs font-medium text-white/95 leading-normal">
                  {toastMessage.desc}
                </p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="shrink-0 w-6 h-6 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
