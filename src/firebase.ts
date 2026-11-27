import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  setLogLevel,
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  writeBatch, 
  query, 
  where, 
  getDocs, 
  getDocFromServer,
  updateDoc 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  type Settings, 
  type DayShift, 
  type LevelData, 
  type PlusConfig, 
  type YearlyLevels, 
  type YearlyPluses, 
  type SharedMonthData,
  type SharingConfig,
  type SharedQuadrantInfo,
  type SwapNotification,
  type SwapRequest,
  type SwapRequestStatus
} from './types';

// Prevent internal @firebase/firestore offline/timeout notices from triggering console.error overlays
setLogLevel('silent');

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Auth functions
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Operational Types for Error Tracking
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function isFirestoreOfflineError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'unavailable' ||
    errorMsg.includes('client is offline') ||
    errorMsg.includes('offline') ||
    errorMsg.includes('unavailable') ||
    errorMsg.includes('Could not reach Cloud Firestore backend') ||
    errorMsg.includes('Backend didn\'t respond')
  );
}

function isUnauthenticatedPermissionError(error: unknown): boolean {
  if (auth.currentUser) return false;
  const errorMsg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'permission-denied' ||
    errorMsg.includes('Missing or insufficient permissions') ||
    errorMsg.includes('PERMISSION_DENIED')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  if (isFirestoreOfflineError(error)) {
    console.warn('Firestore offline/unavailable: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// Validation check
async function testConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (isFirestoreOfflineError(error)) {
      console.warn("Firestore operates in offline/local-cache mode. Local copies are active.");
    }
  }
}
testConnection();

// --- Firestore Hardened Wrapper Services with Unified Error Handling ---

const safeNum = (v: any, def: number): number => {
  if (v === undefined || v === null) return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
};

const safeString = (v: any, def: string): string => {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return def;
  return String(v);
};

function cleanPayload<T>(obj: T): T {
  if (obj === undefined) {
    return undefined as any;
  }
  if (obj === null) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanPayload(item)) as any;
  }
  if (typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) {
      return obj;
    }
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanPayload(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export async function dbSaveSettings(userId: string, settings: Settings) {
  const docPath = `users/${userId}/config/settings`;
  const now = new Date();
  const defaultSeniority = now.toISOString().split('T')[0];
  const defaultNextLevel = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];

  try {
    const payload = {
      contractType: settings.contractType === 'Parcial' ? 'Parcial' : 'Completo',
      pagas: (Number(settings.pagas) === 12 || Number(settings.pagas) === 14) ? (Number(settings.pagas) as 12 | 14) : 14,
      seniorityDate: safeString(settings.seniorityDate, defaultSeniority),
      nextLevelDate: safeString(settings.nextLevelDate, defaultNextLevel),
      holidays: Array.isArray(settings.holidays) ? settings.holidays : [],
      vacations: Array.isArray(settings.vacations) ? settings.vacations : [],
      frozenPeriods: Array.isArray(settings.frozenPeriods) ? settings.frozenPeriods : [],
      irpf: safeNum(settings.irpf, 0),
      rateContingencias: safeNum(settings.rateContingencias, 4.7),
      rateDesempleo: safeNum(settings.rateDesempleo, 1.55),
      rateFormacion: safeNum(settings.rateFormacion, 0.10),
      rateEquidad: safeNum(settings.rateEquidad, 0.15),
      cuotaSindical: safeNum(settings.cuotaSindical, 0),
      currentLevel: safeNum(settings.currentLevel, 1),
      selectedLevel: safeNum(settings.selectedLevel, 1),
      manualLevelProgression: !!settings.manualLevelProgression,
      monthlyOptions: (settings.monthlyOptions && typeof settings.monthlyOptions === 'object') ? settings.monthlyOptions : {},
      counterPeriod: (settings.counterPeriod && typeof settings.counterPeriod === 'object') ? settings.counterPeriod : { start: '', end: '' },
      counterTargets: (settings.counterTargets && typeof settings.counterTargets === 'object') ? settings.counterTargets : {},
      yearlyCounterTargets: (settings.yearlyCounterTargets && typeof settings.yearlyCounterTargets === 'object') ? settings.yearlyCounterTargets : {},
      yearlyCounterPeriods: (settings.yearlyCounterPeriods && typeof settings.yearlyCounterPeriods === 'object') ? settings.yearlyCounterPeriods : {},
      customizedCounterTargets: (settings.customizedCounterTargets && typeof settings.customizedCounterTargets === 'object') ? settings.customizedCounterTargets : {},
      yearlyUpdates: (settings.yearlyUpdates && typeof settings.yearlyUpdates === 'object') ? settings.yearlyUpdates : {},
      yearlySubUpdates: (settings.yearlySubUpdates && typeof settings.yearlySubUpdates === 'object') ? settings.yearlySubUpdates : {},
      isSubrogado: !!settings.isSubrogado,
      subrogadoBaseSalaries: (settings.subrogadoBaseSalaries && typeof settings.subrogadoBaseSalaries === 'object') ? settings.subrogadoBaseSalaries : {},
      complementariasPrice: safeNum(settings.complementariasPrice, 0),
      ...(settings.colectivoConvenio ? { colectivoConvenio: settings.colectivoConvenio } : {}),
      expandedTablasSections: (settings.expandedTablasSections && typeof settings.expandedTablasSections === 'object') ? settings.expandedTablasSections : { convenio: true, subrogados: false },
      savedPayrolls: Array.isArray(settings.savedPayrolls) ? settings.savedPayrolls : [],
      uploadedPayrolls: Array.isArray(settings.uploadedPayrolls) ? settings.uploadedPayrolls : [],
      ...(Array.isArray(settings.shiftTemplates) ? { shiftTemplates: settings.shiftTemplates } : {}),
      ...(settings.prestamo ? { prestamo: settings.prestamo } : {}),
      ...(settings.customRotation ? { customRotation: settings.customRotation } : {}),
      ...(settings.mixedRotation ? { mixedRotation: settings.mixedRotation } : {}),
      dualMode: !!settings.dualMode,
      secondCompanyName: safeString(settings.secondCompanyName, '2ª Empresa'),
      secondCompanyColor: safeString(settings.secondCompanyColor, '#f97316'),
      secondCompanyShifts: Array.isArray(settings.secondCompanyShifts) ? settings.secondCompanyShifts : [],
      ...(settings.calendarRotation ? { calendarRotation: settings.calendarRotation } : {}),
      ...(settings.autoShiftsConfig ? { autoShiftsConfig: settings.autoShiftsConfig } : {}),
      ...(settings.monthlyRotations ? { monthlyRotations: settings.monthlyRotations } : {}),
      ...(settings.monthlyAutoShifts ? { monthlyAutoShifts: settings.monthlyAutoShifts } : {})
    };
    await setDoc(doc(db, 'users', userId, 'config', 'settings'), cleanPayload(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function dbGetSettings(userId: string): Promise<Settings | null> {
  if (!auth.currentUser) return null;
  const docPath = `users/${userId}/config/settings`;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'config', 'settings'));
    if (snap.exists()) {
      return snap.data() as Settings;
    }
    return null;
  } catch (error) {
    if (isUnauthenticatedPermissionError(error)) return null;
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

function buildShiftPayload(shift: DayShift): any {
  const payload: any = {
    date: shift.date,
    type: shift.type,
    shifts: shift.shifts || [],
    perentorias: shift.perentorias || { day: 0, night: 0 },
    complementarias: shift.complementarias || { day: 0, night: 0 },
    extraShifts: shift.extraShifts || [],
    generatePluses: shift.generatePluses !== undefined ? !!shift.generatePluses : true,
    extraHoursStrategy: shift.extraHoursStrategy || 'pay'
  };
  if (shift.compensatedHoursQty !== undefined) payload.compensatedHoursQty = shift.compensatedHoursQty;
  if (shift.compensatedMode !== undefined) payload.compensatedMode = shift.compensatedMode;
  if (shift.compensatedRange !== undefined) payload.compensatedRange = shift.compensatedRange;
  if (shift.sindicalHoursQty !== undefined) payload.sindicalHoursQty = shift.sindicalHoursQty;
  if (shift.sindicalMode !== undefined) payload.sindicalMode = shift.sindicalMode;
  if (shift.sindicalRange !== undefined) payload.sindicalRange = shift.sindicalRange;
  if (shift.ausenciaHoursQty !== undefined) payload.ausenciaHoursQty = shift.ausenciaHoursQty;
  if (shift.ausenciaMode !== undefined) payload.ausenciaMode = shift.ausenciaMode;
  if (shift.ausenciaRange !== undefined) payload.ausenciaRange = shift.ausenciaRange;
  if (shift.swapInfo !== undefined) payload.swapInfo = shift.swapInfo;
  return cleanPayload(payload);
}

export async function dbSaveShift(userId: string, shift: DayShift) {
  const docPath = `users/${userId}/shifts/${shift.date}`;
  try {
    await setDoc(doc(db, 'users', userId, 'shifts', shift.date), buildShiftPayload(shift));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function dbSaveShiftsBatch(userId: string, shifts: DayShift[]) {
  if (!shifts || shifts.length === 0) return;
  const collectionPath = `users/${userId}/shifts`;
  const CHUNK_SIZE = 450;
  try {
    for (let i = 0; i < shifts.length; i += CHUNK_SIZE) {
      const chunk = shifts.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((shift) => {
        if (!shift?.date) return;
        const docRef = doc(db, 'users', userId, 'shifts', shift.date);
        batch.set(docRef, buildShiftPayload(shift));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
}

export async function dbClearAllUserData(userId: string) {
  const subcollections = ['shifts', 'levels', 'pluses'] as const;
  const CHUNK_SIZE = 450;

  for (const sub of subcollections) {
    const colPath = `users/${userId}/${sub}`;
    try {
      const snap = await getDocs(collection(db, 'users', userId, sub));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colPath);
    }
  }

  const settingsPath = `users/${userId}/config/settings`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'config', 'settings'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, settingsPath);
  }
}

const SHARE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateFourCharCode(): string {
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += SHARE_CODE_CHARS.charAt(Math.floor(Math.random() * SHARE_CODE_CHARS.length));
  }
  return result;
}

export async function dbShareMonthShifts(
  monthKey: string,
  ownerName: string,
  shifts: DayShift[],
  vacations: string[],
  existingCode?: string
): Promise<string> {
  let code = existingCode && /^[A-Z0-9]{4}$/.test(existingCode.toUpperCase())
    ? existingCode.toUpperCase()
    : generateFourCharCode();

  // If generating a new code, verify it doesn't collide with another month/user
  if (!existingCode) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const snap = await getDoc(doc(db, 'shared_months', code));
        if (!snap.exists()) break;
        code = generateFourCharCode();
      } catch {
        break;
      }
    }
  }

  const sanitizedShifts = shifts.map(s => ({
    date: s.date,
    type: s.type,
    shifts: (s.shifts || []).filter(sh => sh.start && sh.end),
    perentorias: s.perentorias || { day: 0, night: 0 },
    complementarias: s.complementarias || { day: 0, night: 0 },
    extraShifts: (s.extraShifts || []).filter(sh => sh.start && sh.end)
  }));

  const payload: SharedMonthData = {
    code,
    monthKey,
    ownerName: (ownerName || 'Compañero').slice(0, 60),
    ...(auth.currentUser?.uid ? { ownerUid: auth.currentUser.uid } : {}),
    updatedAt: new Date().toISOString(),
    shifts: sanitizedShifts,
    vacations: Array.isArray(vacations) ? vacations.slice(0, 366) : []
  };

  await setDoc(doc(db, 'shared_months', code), cleanPayload(payload));
  return code;
}

export async function dbGetSharedMonthShifts(code: string): Promise<SharedMonthData | null> {
  const cleanCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(cleanCode)) {
    return null;
  }
  const snap = await getDoc(doc(db, 'shared_months', cleanCode));
  if (snap.exists()) {
    return snap.data() as SharedMonthData;
  }
  return null;
}

export async function dbDeleteShift(userId: string, date: string) {
  const docPath = `users/${userId}/shifts/${date}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'shifts', date));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function dbGetShifts(userId: string): Promise<DayShift[]> {
  if (!auth.currentUser) return [];
  const collectionPath = `users/${userId}/shifts`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'shifts'));
    const shifts: DayShift[] = [];
    snap.forEach((doc) => {
      shifts.push(doc.data() as DayShift);
    });
    return shifts;
  } catch (error) {
    if (isUnauthenticatedPermissionError(error)) return [];
    handleFirestoreError(error, OperationType.GET, collectionPath);
  }
}

export async function dbSaveLevels(userId: string, year: number, levels: LevelData[]) {
  const collectionPath = `users/${userId}/levels`;
  try {
    const batch = writeBatch(db);
    levels.forEach((l) => {
      const docId = `${year}_${l.nivel}`;
      const docRef = doc(db, 'users', userId, 'levels', docId);
      batch.set(docRef, { year, nivel: l.nivel, anual: l.anual });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
}

export async function dbGetLevels(userId: string): Promise<YearlyLevels> {
  if (!auth.currentUser) return {};
  const collectionPath = `users/${userId}/levels`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'levels'));
    const yearlyLevels: YearlyLevels = {};
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const year = Number(data.year);
      if (year && data.nivel && data.anual) {
        if (!yearlyLevels[year]) yearlyLevels[year] = [];
        yearlyLevels[year].push({ nivel: data.nivel, anual: data.anual });
      }
    });
    // Sort levels in each year by level number
    Object.keys(yearlyLevels).forEach(y => {
      yearlyLevels[Number(y)].sort((a, b) => a.nivel - b.nivel);
    });
    return yearlyLevels;
  } catch (error) {
    if (isUnauthenticatedPermissionError(error)) return {};
    handleFirestoreError(error, OperationType.GET, collectionPath);
  }
}

export async function dbSavePluses(userId: string, year: number, pluses: { [key: string]: PlusConfig }) {
  const collectionPath = `users/${userId}/pluses`;
  try {
    const batch = writeBatch(db);
    Object.keys(pluses).forEach((name) => {
      const p = pluses[name];
      const docId = `${year}_${name.replace(/\//g, '-')}`;
      const docRef = doc(db, 'users', userId, 'pluses', docId);
      
      const payload: any = {
        year,
        name,
        value: Number(p.value) || 0,
        pagas: Number(p.pagas) || 12,
        enabled: p.enabled !== undefined ? !!p.enabled : true
      };
      if (p.subValue !== undefined) payload.subValue = Number(p.subValue);
      if (p.startHour !== undefined) payload.startHour = p.startHour;
      if (p.endHour !== undefined) payload.endHour = p.endHour;
      if (p.subStartHour !== undefined) payload.subStartHour = p.subStartHour;
      if (p.subEndHour !== undefined) payload.subEndHour = p.subEndHour;
      if (p.madrugueStart !== undefined) payload.madrugueStart = p.madrugueStart;
      if (p.madrugueEnd !== undefined) payload.madrugueEnd = p.madrugueEnd;
      if (p.madrugueMinEnd !== undefined) payload.madrugueMinEnd = p.madrugueMinEnd;
      if (p.madrugueMinEndEnabled !== undefined) payload.madrugueMinEndEnabled = !!p.madrugueMinEndEnabled;
      if (p.subMadrugueStart !== undefined) payload.subMadrugueStart = p.subMadrugueStart;
      if (p.subMadrugueEnd !== undefined) payload.subMadrugueEnd = p.subMadrugueEnd;
      if (p.subMadrugueMinEnd !== undefined) payload.subMadrugueMinEnd = p.subMadrugueMinEnd;
      if (p.subMadrugueMinEndEnabled !== undefined) payload.subMadrugueMinEndEnabled = !!p.subMadrugueMinEndEnabled;
      if (p.isVariable !== undefined) payload.isVariable = !!p.isVariable;

      batch.set(docRef, cleanPayload(payload));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
}

export async function dbGetPluses(userId: string): Promise<YearlyPluses> {
  if (!auth.currentUser) return {};
  const collectionPath = `users/${userId}/pluses`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'pluses'));
    const yearlyPluses: YearlyPluses = {};
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const year = Number(data.year);
      const name = data.name;
      if (year && name) {
        if (!yearlyPluses[year]) yearlyPluses[year] = {};
        yearlyPluses[year][name] = {
          value: Number(data.value) || 0,
          subValue: data.subValue !== undefined ? Number(data.subValue) : undefined,
          startHour: data.startHour,
          endHour: data.endHour,
          subStartHour: data.subStartHour,
          subEndHour: data.subEndHour,
          madrugueStart: data.madrugueStart,
          madrugueEnd: data.madrugueEnd,
          madrugueMinEnd: data.madrugueMinEnd,
          madrugueMinEndEnabled: data.madrugueMinEndEnabled,
          subMadrugueStart: data.subMadrugueStart,
          subMadrugueEnd: data.subMadrugueEnd,
          subMadrugueMinEnd: data.subMadrugueMinEnd,
          subMadrugueMinEndEnabled: data.subMadrugueMinEndEnabled,
          pagas: (Number(data.pagas) === 14 ? 14 : 12) as 12 | 14,
          enabled: !!data.enabled,
          isVariable: data.isVariable
        };
      }
    });
    return yearlyPluses;
  } catch (error) {
    if (isUnauthenticatedPermissionError(error)) return {};
    handleFirestoreError(error, OperationType.GET, collectionPath);
  }
}

export async function dbDeletePlus(userId: string, year: number, name: string) {
  const docId = `${year}_${name.replace(/\//g, '-')}`;
  const collectionPath = `users/${userId}/pluses/${docId}`;
  try {
    const docRef = doc(db, 'users', userId, 'pluses', docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, collectionPath);
  }
}

export interface StoredSuggestion {
  id: string;
  userName: string;
  type: string;
  description: string;
  userEmail?: string;
  appVersion: string;
  createdAt: string;
  timestamp?: number;
  screenshots?: string[];
}

export interface SuggestionSettingsDoc {
  notifyEmail: boolean;
  updatedAt?: number;
}

export async function dbGetSuggestionSettings(): Promise<SuggestionSettingsDoc | null> {
  const docPath = 'suggestion_settings/global';
  try {
    const snap = await getDoc(doc(db, 'suggestion_settings', 'global'));
    if (snap.exists()) {
      const data = snap.data() as any;
      if (typeof data?.notifyEmail === 'boolean') {
        return {
          notifyEmail: data.notifyEmail,
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined
        };
      }
    }
    return null;
  } catch (error) {
    console.warn('Could not read suggestion settings from Firestore:', error);
    return null;
  }
}

export async function dbSaveSuggestionSettings(settings: SuggestionSettingsDoc): Promise<boolean> {
  const docPath = 'suggestion_settings/global';
  try {
    const payload = cleanPayload({
      notifyEmail: Boolean(settings.notifyEmail),
      updatedAt: typeof settings.updatedAt === 'number' ? settings.updatedAt : Date.now()
    });
    await setDoc(doc(db, 'suggestion_settings', 'global'), payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function dbSaveSuggestion(suggestion: {
  id?: string;
  userName: string;
  type: string;
  description: string;
  userEmail?: string;
  appVersion?: string;
  submittedAt?: string;
  timestamp?: number;
  screenshots?: string[];
}) {
  const id = suggestion.id || `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const docRef = doc(db, 'suggestions', id);
    const createdIso = suggestion.submittedAt || new Date().toISOString();
    const ts = suggestion.timestamp || Date.now();
    const cleanScreenshots = Array.isArray(suggestion.screenshots)
      ? suggestion.screenshots
          .filter((img): img is string => typeof img === 'string' && img.startsWith('data:image/') && img.length <= 350000)
          .slice(0, 3)
      : [];
    const payload = cleanPayload({
      id,
      userName: String(suggestion.userName || 'Usuario anónimo').slice(0, 100),
      type: String(suggestion.type || 'Sugerencia').slice(0, 50),
      description: String(suggestion.description || '').slice(0, 5000),
      ...(suggestion.userEmail ? { userEmail: String(suggestion.userEmail) } : {}),
      appVersion: String(suggestion.appVersion || ''),
      createdAt: createdIso,
      timestamp: ts,
      ...(cleanScreenshots.length > 0 ? { screenshots: cleanScreenshots } : {})
    });
    await setDoc(docRef, payload);
    return id;
  } catch (error) {
    console.warn("Could not save suggestion to firestore:", error);
    return null;
  }
}

export async function dbGetSuggestions(): Promise<StoredSuggestion[]> {
  const collectionPath = 'suggestions';
  try {
    const snap = await getDocs(collection(db, 'suggestions'));
    const list: StoredSuggestion[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      list.push({
        id: docSnap.id,
        userName: data.userName || 'Usuario anónimo',
        type: data.type || 'Sugerencia',
        description: data.description || '',
        userEmail: data.userEmail,
        appVersion: data.appVersion || '',
        createdAt: data.createdAt || '',
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : (Date.parse(data.createdAt) || 0),
        screenshots: Array.isArray(data.screenshots) ? data.screenshots.filter((s: unknown) => typeof s === 'string') : []
      });
    });
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionPath);
  }
}

export function dbSubscribeSuggestions(
  onUpdate: (items: StoredSuggestion[]) => void,
  onError?: (err: unknown) => void
): () => void {
  return onSnapshot(
    collection(db, 'suggestions'),
    (snap) => {
      const list: StoredSuggestion[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          userName: data.userName || 'Usuario anónimo',
          type: data.type || 'Sugerencia',
          description: data.description || '',
          userEmail: data.userEmail,
          appVersion: data.appVersion || '',
          createdAt: data.createdAt || '',
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : (Date.parse(data.createdAt) || 0),
          screenshots: Array.isArray(data.screenshots) ? data.screenshots.filter((s: unknown) => typeof s === 'string') : []
        });
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn('Suggestions subscription error:', error);
    }
  );
}

export async function dbDeleteSuggestion(id: string): Promise<void> {
  const docPath = `suggestions/${id}`;
  try {
    await deleteDoc(doc(db, 'suggestions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// --- Shared Quadrant & Collaboration Methods ---

export async function dbGetSharingConfig(userId: string): Promise<SharingConfig | null> {
  const docPath = `users/${userId}/config/sharing`;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'config', 'sharing'));
    if (snap.exists()) {
      return snap.data() as SharingConfig;
    }
    return null;
  } catch (error) {
    console.warn("Could not fetch sharing config:", error);
    return null;
  }
}

export async function dbSaveSharingConfig(userId: string, sharing: SharingConfig): Promise<void> {
  const docPath = `users/${userId}/config/sharing`;
  try {
    await setDoc(doc(db, 'users', userId, 'config', 'sharing'), cleanPayload(sharing));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

const COLLAB_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function generateSixCharCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += COLLAB_CODE_CHARS.charAt(Math.floor(Math.random() * COLLAB_CODE_CHARS.length));
  }
  return result;
}

export async function dbGenerateShareCode(ownerUid: string, ownerName: string, ownerEmail: string): Promise<string> {
  let code = generateSixCharCode();
  // Check collision
  for (let i = 0; i < 3; i++) {
    const snap = await getDoc(doc(db, 'collaboration_codes', code));
    if (!snap.exists()) break;
    code = generateSixCharCode();
  }

  const payload = {
    code,
    ownerUid,
    ownerName,
    ownerEmail,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'collaboration_codes', code), payload);

  const currentSharing: SharingConfig = (await dbGetSharingConfig(ownerUid)) || {
    ownerUid,
    ownerEmail,
    ownerName,
    editors: [],
    editorUids: []
  };
  currentSharing.activeCode = code;
  currentSharing.updatedAt = new Date().toISOString();
  await dbSaveSharingConfig(ownerUid, currentSharing);

  return code;
}

export async function dbAddEditor(
  ownerUid: string, 
  ownerName: string, 
  ownerEmail: string, 
  editorEmail: string
): Promise<void> {
  const cleanEmail = editorEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Email no válido');
  }

  const currentSharing: SharingConfig = (await dbGetSharingConfig(ownerUid)) || {
    ownerUid,
    ownerEmail,
    ownerName,
    editors: [],
    editorUids: [],
    disabledEditors: []
  };

  if (!currentSharing.editors.includes(cleanEmail)) {
    currentSharing.editors.push(cleanEmail);
  }
  // When adding, ensure not disabled
  if (currentSharing.disabledEditors) {
    currentSharing.disabledEditors = currentSharing.disabledEditors.filter(e => e.toLowerCase() !== cleanEmail);
  }
  currentSharing.updatedAt = new Date().toISOString();
  await dbSaveSharingConfig(ownerUid, currentSharing);

  // Create collaboration record
  const collabId = `${ownerUid}_${cleanEmail.replace(/[@.]/g, '_')}`;
  await setDoc(doc(db, 'collaborations', collabId), {
    ownerUid,
    ownerName,
    ownerEmail,
    editorEmail: cleanEmail,
    isDisabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function dbRemoveEditor(ownerUid: string, editorEmail: string): Promise<void> {
  const cleanEmail = editorEmail.trim().toLowerCase();
  const currentSharing = await dbGetSharingConfig(ownerUid);
  if (currentSharing) {
    currentSharing.editors = currentSharing.editors.filter(e => e.toLowerCase() !== cleanEmail);
    if (currentSharing.disabledEditors) {
      currentSharing.disabledEditors = currentSharing.disabledEditors.filter(e => e.toLowerCase() !== cleanEmail);
    }
    currentSharing.updatedAt = new Date().toISOString();
    await dbSaveSharingConfig(ownerUid, currentSharing);
  }

  const collabId = `${ownerUid}_${cleanEmail.replace(/[@.]/g, '_')}`;
  try {
    await deleteDoc(doc(db, 'collaborations', collabId));
  } catch (e) {
    console.warn("Could not delete collaboration doc:", e);
  }
}

export async function dbToggleEditorStatus(
  ownerUid: string, 
  editorEmail: string, 
  active: boolean
): Promise<void> {
  const cleanEmail = editorEmail.trim().toLowerCase();
  const currentSharing: SharingConfig = (await dbGetSharingConfig(ownerUid)) || {
    ownerUid,
    ownerEmail: '',
    ownerName: '',
    editors: [],
    editorUids: [],
    disabledEditors: []
  };

  const currentDisabled = (currentSharing.disabledEditors || []).map(e => e.toLowerCase());
  if (active) {
    // Activating editor: remove from disabled
    currentSharing.disabledEditors = currentDisabled.filter(e => e !== cleanEmail);
  } else {
    // Deactivating editor: add to disabled
    if (!currentDisabled.includes(cleanEmail)) {
      currentSharing.disabledEditors = [...currentDisabled, cleanEmail];
    }
  }
  currentSharing.updatedAt = new Date().toISOString();
  await dbSaveSharingConfig(ownerUid, currentSharing);

  // Update collaboration document
  const collabId = `${ownerUid}_${cleanEmail.replace(/[@.]/g, '_')}`;
  try {
    const collabRef = doc(db, 'collaborations', collabId);
    const snap = await getDoc(collabRef);
    if (snap.exists()) {
      await updateDoc(collabRef, { 
        isDisabled: !active, 
        updatedAt: new Date().toISOString() 
      });
    }
  } catch (e) {
    console.warn("Could not update isDisabled on collaboration doc:", e);
  }
}

export async function dbToggleAllEditorsStatus(
  ownerUid: string,
  active: boolean
): Promise<void> {
  const currentSharing: SharingConfig = (await dbGetSharingConfig(ownerUid)) || {
    ownerUid,
    ownerEmail: '',
    ownerName: '',
    editors: [],
    editorUids: [],
    disabledEditors: []
  };

  if (active) {
    currentSharing.disabledEditors = [];
  } else {
    currentSharing.disabledEditors = [...(currentSharing.editors || [])];
  }
  currentSharing.updatedAt = new Date().toISOString();
  await dbSaveSharingConfig(ownerUid, currentSharing);

  // Update all collaboration docs for this owner
  try {
    const qByOwner = query(collection(db, 'collaborations'), where('ownerUid', '==', ownerUid));
    const snaps = await getDocs(qByOwner);
    const batch = writeBatch(db);
    snaps.forEach(docSnap => {
      batch.update(docSnap.ref, { 
        isDisabled: !active,
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
  } catch (e) {
    console.warn("Could not batch update isDisabled on collaborations:", e);
  }
}

export async function dbJoinSharedQuadrantByCode(
  code: string,
  editorUid: string,
  editorEmail: string
): Promise<{ ownerUid: string; ownerName: string; ownerEmail: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length !== 6) {
    throw new Error('El código de vinculación debe tener 6 caracteres.');
  }

  const codeSnap = await getDoc(doc(db, 'collaboration_codes', cleanCode));
  if (!codeSnap.exists()) {
    throw new Error('Código no encontrado o caducado. Pide al titular que genere un código nuevo.');
  }

  const codeData = codeSnap.data();
  const ownerUid = codeData.ownerUid;
  const ownerName = codeData.ownerName;
  const ownerEmail = codeData.ownerEmail;

  if (ownerUid === editorUid) {
    throw new Error('Este código pertenece a tu propio cuadrante.');
  }

  const ownerSharing: SharingConfig = (await dbGetSharingConfig(ownerUid)) || {
    ownerUid,
    ownerEmail,
    ownerName,
    editors: [],
    editorUids: []
  };

  const cleanEditorEmail = (editorEmail || '').trim().toLowerCase();
  if (cleanEditorEmail && !ownerSharing.editors.includes(cleanEditorEmail)) {
    ownerSharing.editors.push(cleanEditorEmail);
  }
  if (!ownerSharing.editorUids) ownerSharing.editorUids = [];
  if (!ownerSharing.editorUids.includes(editorUid)) {
    ownerSharing.editorUids.push(editorUid);
  }
  ownerSharing.updatedAt = new Date().toISOString();
  await dbSaveSharingConfig(ownerUid, ownerSharing);

  const collabId = `${ownerUid}_${(cleanEditorEmail || editorUid).replace(/[@.]/g, '_')}`;
  await setDoc(doc(db, 'collaborations', collabId), {
    ownerUid,
    ownerName,
    ownerEmail,
    editorEmail: cleanEditorEmail,
    editorUid,
    isLocked: !!ownerSharing.isLocked,
    hidePayrollAmounts: !!ownerSharing.hidePayrollAmounts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return { ownerUid, ownerName, ownerEmail };
}

export async function dbToggleSharingLocked(ownerUid: string, isLocked: boolean): Promise<void> {
  const currentSharing: SharingConfig = (await dbGetSharingConfig(ownerUid)) || {
    ownerUid,
    ownerEmail: '',
    ownerName: '',
    editors: [],
    editorUids: []
  };
  currentSharing.isLocked = isLocked;
  currentSharing.updatedAt = new Date().toISOString();
  await dbSaveSharingConfig(ownerUid, currentSharing);

  // Update all collaboration docs for this owner
  try {
    const qByOwner = query(collection(db, 'collaborations'), where('ownerUid', '==', ownerUid));
    const snaps = await getDocs(qByOwner);
    const batch = writeBatch(db);
    snaps.forEach(docSnap => {
      batch.update(docSnap.ref, { isLocked });
    });
    await batch.commit();
  } catch (e) {
    console.warn("Could not batch update isLocked in collaborations:", e);
  }
}

export async function dbToggleSharingHidePayroll(ownerUid: string, hidePayrollAmounts: boolean): Promise<void> {
  const currentSharing: SharingConfig = (await dbGetSharingConfig(ownerUid)) || {
    ownerUid,
    ownerEmail: '',
    ownerName: '',
    editors: [],
    editorUids: []
  };
  currentSharing.hidePayrollAmounts = hidePayrollAmounts;
  currentSharing.updatedAt = new Date().toISOString();
  await dbSaveSharingConfig(ownerUid, currentSharing);

  // Update all collaboration docs for this owner
  try {
    const qByOwner = query(collection(db, 'collaborations'), where('ownerUid', '==', ownerUid));
    const snaps = await getDocs(qByOwner);
    const batch = writeBatch(db);
    snaps.forEach(docSnap => {
      batch.update(docSnap.ref, { hidePayrollAmounts });
    });
    await batch.commit();
  } catch (e) {
    console.warn("Could not batch update hidePayrollAmounts in collaborations:", e);
  }
}

export async function dbGetQuadrantsSharedWithMe(userEmail: string, userUid: string): Promise<SharedQuadrantInfo[]> {
  const results: Map<string, SharedQuadrantInfo> = new Map();
  const cleanEmail = (userEmail || '').trim().toLowerCase();

  try {
    if (cleanEmail) {
      const qByEmail = query(collection(db, 'collaborations'), where('editorEmail', '==', cleanEmail));
      const snaps = await getDocs(qByEmail);
      snaps.forEach(docSnap => {
        const data = docSnap.data();
        if (data.ownerUid && data.ownerUid !== userUid) {
          results.set(data.ownerUid, {
            ownerUid: data.ownerUid,
            ownerEmail: data.ownerEmail || '',
            ownerName: data.ownerName || 'Compañero',
            role: 'editor',
            isLocked: !!data.isLocked,
            hidePayrollAmounts: !!data.hidePayrollAmounts,
            isDisabled: !!data.isDisabled,
            updatedAt: data.updatedAt
          });
        }
      });
    }

    if (userUid) {
      const qByUid = query(collection(db, 'collaborations'), where('editorUid', '==', userUid));
      const snapsUid = await getDocs(qByUid);
      snapsUid.forEach(docSnap => {
        const data = docSnap.data();
        if (data.ownerUid && data.ownerUid !== userUid) {
          results.set(data.ownerUid, {
            ownerUid: data.ownerUid,
            ownerEmail: data.ownerEmail || '',
            ownerName: data.ownerName || 'Compañero',
            role: 'editor',
            isLocked: !!data.isLocked,
            hidePayrollAmounts: !!data.hidePayrollAmounts,
            isDisabled: !!data.isDisabled,
            updatedAt: data.updatedAt
          });
        }
      });
    }

    // Refresh isLocked, hidePayrollAmounts and isDisabled directly from each owner's sharing config
    for (const [ownerUid, item] of results.entries()) {
      try {
        const cfg = await dbGetSharingConfig(ownerUid);
        if (cfg) {
          item.isLocked = !!cfg.isLocked;
          item.hidePayrollAmounts = !!cfg.hidePayrollAmounts;
          const isEmailDisabled = !!(cleanEmail && cfg.disabledEditors && cfg.disabledEditors.map(e => e.toLowerCase()).includes(cleanEmail));
          const isUidDisabled = !!(userUid && cfg.disabledEditorUids && cfg.disabledEditorUids.includes(userUid));
          item.isDisabled = item.isDisabled || isEmailDisabled || isUidDisabled;
        }
      } catch {}
    }
  } catch (e) {
    console.warn("Could not query collaborations shared with me:", e);
  }

  return Array.from(results.values());
}

export function isEditorAuthorizedInSharing(
  sharing: SharingConfig | null | undefined,
  targetUid: string,
  targetEmail?: string
): boolean {
  if (!sharing) return false;
  const cleanEmail = (targetEmail || '').trim().toLowerCase();
  const isInUid = Array.isArray(sharing.editorUids) && sharing.editorUids.includes(targetUid);
  const isInEmail = Boolean(
    cleanEmail &&
    Array.isArray(sharing.editors) &&
    sharing.editors.some(e => e.toLowerCase() === cleanEmail)
  );
  if (!isInUid && !isInEmail) return false;

  const isDisabledUid = Array.isArray(sharing.disabledEditorUids) && sharing.disabledEditorUids.includes(targetUid);
  const isDisabledEmail = Boolean(
    cleanEmail &&
    Array.isArray(sharing.disabledEditors) &&
    sharing.disabledEditors.some(e => e.toLowerCase() === cleanEmail)
  );
  return !isDisabledUid && !isDisabledEmail;
}

export async function dbCheckMutualAuthorization(
  myUid: string,
  myEmail: string | null | undefined,
  targetUid: string,
  targetEmail?: string
): Promise<{ isMutual: boolean; targetOwnerName?: string }> {
  try {
    const [mySharing, targetSharing] = await Promise.all([
      dbGetSharingConfig(myUid),
      dbGetSharingConfig(targetUid)
    ]);
    const iAuthorizedTarget = isEditorAuthorizedInSharing(mySharing, targetUid, targetEmail || targetSharing?.ownerEmail);
    const targetAuthorizedMe = isEditorAuthorizedInSharing(targetSharing, myUid, myEmail || '');
    return {
      isMutual: iAuthorizedTarget && targetAuthorizedMe,
      targetOwnerName: targetSharing?.ownerName || undefined
    };
  } catch (e) {
    console.warn('Could not check mutual authorization:', e);
    return { isMutual: false };
  }
}

export function dbSubscribeUserShifts(
  userId: string,
  onUpdate: (shifts: DayShift[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const collectionPath = `users/${userId}/shifts`;
  return onSnapshot(
    collection(db, 'users', userId, 'shifts'),
    (snap) => {
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      const list: DayShift[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as DayShift);
      });
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn(`Shifts subscription error on ${collectionPath}:`, error);
    }
  );
}

export async function dbSendSwapNotification(
  recipientUid: string,
  payload: Omit<SwapNotification, 'id' | 'read' | 'createdAt' | 'timestamp'>
): Promise<string | null> {
  const notifId = `swap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docPath = `users/${recipientUid}/notifications/${notifId}`;
  try {
    const docData: SwapNotification = {
      ...payload,
      id: notifId,
      senderName: String(payload.senderName || 'Compañero').slice(0, 120),
      ...(payload.senderEmail ? { senderEmail: String(payload.senderEmail).slice(0, 200) } : {}),
      ...(payload.requestId ? { requestId: String(payload.requestId).slice(0, 128) } : {}),
      ...(payload.status ? { status: payload.status } : {}),
      myOriginalShifts: (payload.myOriginalShifts || []).slice(0, 10),
      coveredShifts: (payload.coveredShifts || []).slice(0, 10),
      read: false,
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    };
    await setDoc(doc(db, 'users', recipientUid, 'notifications', notifId), cleanPayload(docData));
    return notifId;
  } catch (error) {
    console.warn(`Could not send swap notification to ${docPath}:`, error);
    return null;
  }
}

export function dbSubscribeSwapNotifications(
  userId: string,
  onUpdate: (items: SwapNotification[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const collectionPath = `users/${userId}/notifications`;
  return onSnapshot(
    collection(db, 'users', userId, 'notifications'),
    (snap) => {
      const list: SwapNotification[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as SwapNotification);
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn(`Notifications subscription error on ${collectionPath}:`, error);
    }
  );
}

export async function dbMarkSwapNotificationRead(userId: string, notificationId: string): Promise<void> {
  const docPath = `users/${userId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function dbUpdateSwapNotification(
  userId: string,
  notificationId: string,
  patch: { read?: boolean; status?: SwapRequestStatus }
): Promise<void> {
  const docPath = `users/${userId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), cleanPayload(patch));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function dbDeleteSwapNotification(userId: string, notificationId: string): Promise<void> {
  const docPath = `users/${userId}/notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function dbCreateSwapRequest(
  payload: Omit<SwapRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'respondedAt' | 'timestamp'>
): Promise<SwapRequest | null> {
  const reqId = `sreq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docPath = `swap_requests/${reqId}`;
  try {
    const nowIso = new Date().toISOString();
    const docData: SwapRequest = {
      id: reqId,
      senderUid: payload.senderUid,
      senderName: String(payload.senderName || 'Compañero').slice(0, 120),
      ...(payload.senderEmail ? { senderEmail: String(payload.senderEmail).slice(0, 200) } : {}),
      recipientUid: payload.recipientUid,
      recipientName: String(payload.recipientName || 'Compañero').slice(0, 120),
      ...(payload.recipientEmail ? { recipientEmail: String(payload.recipientEmail).slice(0, 200) } : {}),
      senderDate: String(payload.senderDate).slice(0, 20),
      senderShifts: (payload.senderShifts || []).slice(0, 10),
      recipientDate: String(payload.recipientDate).slice(0, 20),
      recipientShifts: (payload.recipientShifts || []).slice(0, 10),
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
      timestamp: Date.now()
    };
    await setDoc(doc(db, 'swap_requests', reqId), cleanPayload(docData));
    return docData;
  } catch (error) {
    console.warn(`Could not create swap request at ${docPath}:`, error);
    return null;
  }
}

export async function dbUpdateSwapRequestStatus(
  requestId: string,
  status: 'accepted' | 'rejected' | 'undone'
): Promise<void> {
  const docPath = `swap_requests/${requestId}`;
  try {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'swap_requests', requestId), {
      status,
      updatedAt: nowIso,
      respondedAt: nowIso
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function dbDeleteSwapRequest(requestId: string): Promise<void> {
  const docPath = `swap_requests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'swap_requests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function dbSubscribeSentSwapRequests(
  userId: string,
  onUpdate: (items: SwapRequest[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(collection(db, 'swap_requests'), where('senderUid', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list: SwapRequest[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as SwapRequest);
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn('Sent swap requests subscription error:', error);
    }
  );
}

export function dbSubscribeReceivedSwapRequests(
  userId: string,
  onUpdate: (items: SwapRequest[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(collection(db, 'swap_requests'), where('recipientUid', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list: SwapRequest[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as SwapRequest);
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn('Received swap requests subscription error:', error);
    }
  );
}

export { 
  onAuthStateChanged, 
  onSnapshot, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  writeBatch, 
  query, 
  where, 
  getDocs 
};
export type { User };
