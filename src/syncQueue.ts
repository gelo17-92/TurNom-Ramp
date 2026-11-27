import { useState, useEffect } from 'react';
import {
  auth,
  dbSaveSettings,
  dbSaveShift,
  dbDeleteShift,
  dbSaveLevels,
  dbSavePluses,
  dbDeletePlus,
  isFirestoreOfflineError,
} from './firebase';

export type SyncActionType =
  | 'SAVE_SETTINGS'
  | 'SAVE_SHIFT'
  | 'DELETE_SHIFT'
  | 'SAVE_LEVELS'
  | 'SAVE_PLUSES'
  | 'DELETE_PLUS';

export interface SyncActionItem {
  id: string;
  type: SyncActionType;
  targetUid: string;
  payload: any;
  createdAt: number;
  retryCount: number;
}

export interface FailedSyncActionItem extends SyncActionItem {
  failedAt: number;
  errorMessage: string;
}

export interface SyncQueueState {
  queueLength: number;
  failedCount: number;
  failedItems: FailedSyncActionItem[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt?: number;
}

export const QUEUE_STORAGE_KEY = 'app_offline_sync_queue';
export const FAILED_STORAGE_KEY = 'app_offline_sync_failed';
const MAX_RETRY_ATTEMPTS = 5;

type QueueSubscriber = (state: SyncQueueState) => void;
const subscribers = new Set<QueueSubscriber>();

let isProcessingQueue = false;
let lastSyncedTimestamp: number | undefined;
let onQueueProcessedToast: ((count: number) => void) | null = null;

function getStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function getActiveUid(explicitUid?: string | null): string | null {
  if (explicitUid !== undefined) return explicitUid;
  return auth?.currentUser?.uid || null;
}

export function setQueueProcessedToastCallback(cb: (count: number) => void) {
  onQueueProcessedToast = cb;
}

export function getSyncQueue(): SyncActionItem[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[SyncQueue] Error reading offline sync queue from storage:', err);
    return [];
  }
}

function saveSyncQueue(queue: SyncActionItem[]) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    notifySubscribers();
  } catch (err) {
    console.error('[SyncQueue] Error saving offline sync queue to storage:', err);
  }
}

export function getFailedSyncItems(uid?: string | null): FailedSyncActionItem[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(FAILED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const scopedUid = uid !== undefined ? uid : getActiveUid();
    if (!scopedUid) return parsed;
    return parsed.filter((item: FailedSyncActionItem) => item.targetUid === scopedUid);
  } catch (err) {
    console.warn('[SyncQueue] Error reading failed sync items from storage:', err);
    return [];
  }
}

function getAllFailedSyncItemsRaw(): FailedSyncActionItem[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(FAILED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFailedSyncItems(items: FailedSyncActionItem[]) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(FAILED_STORAGE_KEY, JSON.stringify(items));
    notifySubscribers();
  } catch (err) {
    console.error('[SyncQueue] Error saving failed sync items to storage:', err);
  }
}

function recordFailedSyncItem(item: SyncActionItem, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Error desconocido al sincronizar con la nube';

  const existing = getAllFailedSyncItemsRaw();
  const deduped = existing.filter((entry) => !isSameCoalesceKey(entry, item));
  deduped.push({
    ...item,
    failedAt: Date.now(),
    errorMessage: message.slice(0, 240),
  });
  saveFailedSyncItems(deduped);
}

function isSameCoalesceKey(a: SyncActionItem, b: Pick<SyncActionItem, 'type' | 'targetUid' | 'payload'>): boolean {
  if (a.targetUid !== b.targetUid) return false;
  switch (b.type) {
    case 'SAVE_SETTINGS':
      return a.type === 'SAVE_SETTINGS';
    case 'SAVE_SHIFT': {
      const shiftDate = b.payload?.shift?.date;
      return (
        (a.type === 'SAVE_SHIFT' && a.payload?.shift?.date === shiftDate) ||
        (a.type === 'DELETE_SHIFT' && a.payload?.date === shiftDate)
      );
    }
    case 'DELETE_SHIFT': {
      const targetDate = b.payload?.date;
      return (
        (a.type === 'SAVE_SHIFT' && a.payload?.shift?.date === targetDate) ||
        (a.type === 'DELETE_SHIFT' && a.payload?.date === targetDate)
      );
    }
    case 'SAVE_LEVELS':
      return a.type === 'SAVE_LEVELS' && a.payload?.year === b.payload?.year;
    case 'SAVE_PLUSES':
      return a.type === 'SAVE_PLUSES' && a.payload?.year === b.payload?.year;
    case 'DELETE_PLUS':
      return (
        a.type === 'DELETE_PLUS' &&
        a.payload?.year === b.payload?.year &&
        a.payload?.name === b.payload?.name
      );
    default:
      return false;
  }
}

function isPermanentSyncError(err: unknown): boolean {
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    code.includes('permission-denied') ||
    code.includes('invalid-argument') ||
    msg.includes('missing or insufficient permissions')
  );
}

export function getSyncQueueLength(uid?: string | null): number {
  const queue = getSyncQueue();
  const scopedUid = uid !== undefined ? uid : getActiveUid();
  if (!scopedUid) return queue.length;
  return queue.filter((item) => item.targetUid === scopedUid).length;
}

export function clearSyncQueue(): void {
  saveSyncQueue([]);
}

export function isDeviceOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

export function getSyncQueueState(uid?: string | null): SyncQueueState {
  const failedItems = getFailedSyncItems(uid);
  return {
    queueLength: getSyncQueueLength(uid),
    failedCount: failedItems.length,
    failedItems,
    isOnline: isDeviceOnline(),
    isSyncing: isProcessingQueue,
    lastSyncedAt: lastSyncedTimestamp,
  };
}

function notifySubscribers() {
  const state = getSyncQueueState();
  subscribers.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.debug('[SyncQueue] Subscriber notification error:', e);
    }
  });
}

export function subscribeToSyncQueue(cb: QueueSubscriber): () => void {
  subscribers.add(cb);
  cb(getSyncQueueState());
  return () => {
    subscribers.delete(cb);
  };
}

/**
 * Enqueue a sync action with smart coalescing/deduplication.
 * Prevents redundant updates while offline (e.g. only latest settings or latest shift per date).
 */
export function enqueueSyncAction(action: Omit<SyncActionItem, 'id' | 'createdAt' | 'retryCount'>): void {
  const currentQueue = getSyncQueue();
  const newItem: SyncActionItem = {
    ...action,
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: Date.now(),
    retryCount: 0,
  };

  const updatedQueue = currentQueue.filter((item) => !isSameCoalesceKey(item, action));
  updatedQueue.push(newItem);

  saveSyncQueue(updatedQueue);
  console.info(`[SyncQueue] Enqueued action: ${action.type}. Total pending: ${updatedQueue.length}`);
}

export interface SyncActionExecutor {
  saveSettings: (uid: string, settings: any) => Promise<any>;
  saveShift: (uid: string, shift: any) => Promise<any>;
  deleteShift: (uid: string, date: string) => Promise<any>;
  saveLevels: (uid: string, year: number, levels: any) => Promise<any>;
  savePluses: (uid: string, year: number, pluses: any) => Promise<any>;
  deletePlus: (uid: string, year: number, name: string) => Promise<any>;
}

const defaultExecutor: SyncActionExecutor = {
  saveSettings: dbSaveSettings,
  saveShift: dbSaveShift,
  deleteShift: dbDeleteShift,
  saveLevels: dbSaveLevels,
  savePluses: dbSavePluses,
  deletePlus: dbDeletePlus,
};

async function runSyncAction(item: Pick<SyncActionItem, 'type' | 'targetUid' | 'payload'>, executor: SyncActionExecutor) {
  switch (item.type) {
    case 'SAVE_SETTINGS':
      await executor.saveSettings(item.targetUid, item.payload.settings);
      break;
    case 'SAVE_SHIFT':
      await executor.saveShift(item.targetUid, item.payload.shift);
      break;
    case 'DELETE_SHIFT':
      await executor.deleteShift(item.targetUid, item.payload.date);
      break;
    case 'SAVE_LEVELS':
      await executor.saveLevels(item.targetUid, item.payload.year, item.payload.levels);
      break;
    case 'SAVE_PLUSES':
      await executor.savePluses(item.targetUid, item.payload.year, item.payload.pluses);
      break;
    case 'DELETE_PLUS':
      await executor.deletePlus(item.targetUid, item.payload.year, item.payload.name);
      break;
  }
}

/**
 * Execute an action directly if online, or automatically enqueue it if offline
 * or if the network request fails due to offline/unreachable conditions.
 */
export async function queueOrExecute(
  action: Omit<SyncActionItem, 'id' | 'createdAt' | 'retryCount'>
): Promise<void> {
  const currentUid = auth?.currentUser?.uid;
  if (!currentUid || action.targetUid !== currentUid) {
    return;
  }
  if (!isDeviceOnline()) {
    enqueueSyncAction(action);
    return;
  }

  try {
    await runSyncAction(action, defaultExecutor);
  } catch (error) {
    if (isFirestoreOfflineError(error) || !isDeviceOnline()) {
      console.warn(`[SyncQueue] Action ${action.type} failed due to network offline. Enqueuing for auto-sync:`, error);
      enqueueSyncAction(action);
    } else if (isPermanentSyncError(error)) {
      console.error(`[SyncQueue] Permanent error on ${action.type}, moving to failed rescue tray:`, error);
      recordFailedSyncItem(
        {
          ...action,
          id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          createdAt: Date.now(),
          retryCount: MAX_RETRY_ATTEMPTS,
        },
        error
      );
    } else {
      console.warn(`[SyncQueue] Warning during ${action.type}:`, error);
      enqueueSyncAction(action);
    }
  }
}

export interface ProcessQueueOptions {
  currentUid?: string | null;
  executor?: SyncActionExecutor;
  checkOfflineError?: (err: unknown) => boolean;
}

/**
 * Process the pending queue for the currently authenticated user in FIFO order.
 * Items belonging to other UIDs are left untouched so accounts never collide.
 * Items that exhaust retries or hit permanent errors are moved to the persistent failed tray.
 */
export async function processSyncQueue(
  options: ProcessQueueOptions = {}
): Promise<{ processedCount: number; remainingCount: number; failedMovedCount: number }> {
  const activeUid = options.currentUid !== undefined ? options.currentUid : auth?.currentUser?.uid;
  const executor = options.executor || defaultExecutor;
  const isOfflineErr = options.checkOfflineError || isFirestoreOfflineError;

  if (isProcessingQueue) {
    return { processedCount: 0, remainingCount: getSyncQueueLength(activeUid), failedMovedCount: 0 };
  }

  if (!isDeviceOnline() || !activeUid) {
    return { processedCount: 0, remainingCount: getSyncQueueLength(activeUid), failedMovedCount: 0 };
  }

  const allItems = getSyncQueue();
  const otherUidItems = allItems.filter((item) => item.targetUid !== activeUid);
  const userQueue = allItems.filter((item) => item.targetUid === activeUid);

  if (userQueue.length === 0) {
    return { processedCount: 0, remainingCount: 0, failedMovedCount: 0 };
  }

  isProcessingQueue = true;
  notifySubscribers();

  let processedCount = 0;
  let failedMovedCount = 0;

  try {
    while (userQueue.length > 0) {
      if (!isDeviceOnline()) {
        console.warn('[SyncQueue] Network disconnected during processing. Pausing queue.');
        break;
      }

      const item = userQueue[0];
      try {
        await runSyncAction(item, executor);
        userQueue.shift();
        saveSyncQueue([...otherUidItems, ...userQueue]);
        processedCount++;
        lastSyncedTimestamp = Date.now();
      } catch (err) {
        if (isOfflineErr(err) || !isDeviceOnline()) {
          console.warn('[SyncQueue] Network offline while processing item. Pausing queue to retry later:', err);
          break;
        }

        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount >= MAX_RETRY_ATTEMPTS || isPermanentSyncError(err)) {
          console.error(`[SyncQueue] Moving action ${item.type} to failed rescue tray:`, err);
          userQueue.shift();
          saveSyncQueue([...otherUidItems, ...userQueue]);
          recordFailedSyncItem(item, err);
          failedMovedCount++;
        } else {
          saveSyncQueue([...otherUidItems, ...userQueue]);
          break;
        }
      }
    }
  } finally {
    isProcessingQueue = false;
    notifySubscribers();
  }

  if (processedCount > 0 && onQueueProcessedToast) {
    try {
      onQueueProcessedToast(processedCount);
    } catch (e) {
      console.debug('[SyncQueue] Toast callback error:', e);
    }
  }

  return { processedCount, remainingCount: userQueue.length, failedMovedCount };
}

/**
 * Move failed sync items for the current user back into the active sync queue and retry immediately.
 */
export async function retryFailedSyncItems(
  options: ProcessQueueOptions = {}
): Promise<{ retriedCount: number; processedCount: number; remainingCount: number; failedMovedCount: number }> {
  const activeUid = options.currentUid !== undefined ? options.currentUid : auth?.currentUser?.uid;
  const allFailed = getAllFailedSyncItemsRaw();
  const toRetry = activeUid ? allFailed.filter((item) => item.targetUid === activeUid) : allFailed;
  const remainingFailed = activeUid ? allFailed.filter((item) => item.targetUid !== activeUid) : [];

  if (toRetry.length === 0) {
    return { retriedCount: 0, processedCount: 0, remainingCount: getSyncQueueLength(activeUid), failedMovedCount: 0 };
  }

  saveFailedSyncItems(remainingFailed);

  for (const failed of toRetry) {
    enqueueSyncAction({
      type: failed.type,
      targetUid: failed.targetUid,
      payload: failed.payload,
    });
  }

  const result = await processSyncQueue(options);
  return {
    retriedCount: toRetry.length,
    ...result,
  };
}

/**
 * Dismiss failed sync items for the active user (after the user has saved a backup or chosen to discard).
 */
export function dismissFailedSyncItems(uid?: string | null): void {
  const scopedUid = uid !== undefined ? uid : getActiveUid();
  if (!scopedUid) {
    saveFailedSyncItems([]);
    return;
  }
  const kept = getAllFailedSyncItemsRaw().filter((item) => item.targetUid !== scopedUid);
  saveFailedSyncItems(kept);
}

/**
 * Build a JSON-serializable backup payload containing pending actions, failed actions,
 * and a snapshot of locally cached shifts/settings so no user data is ever lost.
 */
export function exportPendingSyncBackup(uid?: string | null) {
  const storage = getStorage();
  const scopedUid = uid !== undefined ? uid : getActiveUid();

  const readJson = (key: string) => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const pendingQueue = getSyncQueue().filter((item) => !scopedUid || item.targetUid === scopedUid);
  const failedItems = getFailedSyncItems(scopedUid);

  return {
    exportedAt: new Date().toISOString(),
    source: 'offline_sync_recovery',
    uid: scopedUid || 'local',
    pendingCount: pendingQueue.length,
    failedCount: failedItems.length,
    pendingActions: pendingQueue,
    failedActions: failedItems,
    localSnapshot: {
      shifts: readJson('shifts'),
      settings: readJson('settings'),
      levels: readJson('levels'),
      pluses: readJson('pluses'),
    },
  };
}

export function downloadPendingSyncBackup(uid?: string | null): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const payload = exportPendingSyncBackup(uid);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `copia-pendientes-sync-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[SyncQueue] Failed to download sync backup:', err);
    return false;
  }
}

// Set up automatic listeners when in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[SyncQueue] Device is back online. Auto-processing sync queue...');
    notifySubscribers();
    setTimeout(() => {
      processSyncQueue();
    }, 1000);
  });

  window.addEventListener('offline', () => {
    console.info('[SyncQueue] Device went offline.');
    notifySubscribers();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isDeviceOnline() && getSyncQueueLength() > 0) {
      processSyncQueue();
    }
  });

  setInterval(() => {
    if (isDeviceOnline() && getSyncQueueLength() > 0 && !isProcessingQueue) {
      processSyncQueue();
    }
  }, 30000);
}

/**
 * React hook to reactively consume sync queue state in components.
 */
export function useSyncQueue() {
  const [state, setState] = useState<SyncQueueState>(() => getSyncQueueState());

  useEffect(() => {
    return subscribeToSyncQueue(setState);
  }, []);

  return {
    ...state,
    processQueue: () => processSyncQueue(),
    retryFailed: () => retryFailedSyncItems(),
    dismissFailed: () => dismissFailedSyncItems(),
    exportSyncBackup: () => exportPendingSyncBackup(),
    downloadSyncBackup: () => downloadPendingSyncBackup(),
  };
}
