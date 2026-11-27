import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../firebase', () => ({
  auth: { currentUser: { uid: 'user-a' } },
  dbSaveSettings: vi.fn(),
  dbSaveShift: vi.fn(),
  dbDeleteShift: vi.fn(),
  dbSaveLevels: vi.fn(),
  dbSavePluses: vi.fn(),
  dbDeletePlus: vi.fn(),
  isFirestoreOfflineError: (err: any) => String(err?.code || '').includes('unavailable'),
}));

import {
  enqueueSyncAction,
  getSyncQueue,
  clearSyncQueue,
  processSyncQueue,
  getFailedSyncItems,
  retryFailedSyncItems,
  dismissFailedSyncItems,
  exportPendingSyncBackup,
  type SyncActionExecutor,
} from '../syncQueue';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function createMockExecutor(overrides: Partial<SyncActionExecutor> = {}): SyncActionExecutor {
  return {
    saveSettings: vi.fn().mockResolvedValue(undefined),
    saveShift: vi.fn().mockResolvedValue(undefined),
    deleteShift: vi.fn().mockResolvedValue(undefined),
    saveLevels: vi.fn().mockResolvedValue(undefined),
    savePluses: vi.fn().mockResolvedValue(undefined),
    deletePlus: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Cola de sincronización offline y recuperación (syncQueue.ts)', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    clearSyncQueue();
    dismissFailedSyncItems(null);
  });

  it('agrupa y deduplica cambios redundantes por usuario y fecha', () => {
    enqueueSyncAction({
      type: 'SAVE_SETTINGS',
      targetUid: 'user-a',
      payload: { settings: { irpf: 12 } },
    });
    enqueueSyncAction({
      type: 'SAVE_SETTINGS',
      targetUid: 'user-a',
      payload: { settings: { irpf: 15 } },
    });
    enqueueSyncAction({
      type: 'SAVE_SHIFT',
      targetUid: 'user-a',
      payload: { shift: { date: '2026-06-10', type: 'Laboral' } },
    });
    enqueueSyncAction({
      type: 'DELETE_SHIFT',
      targetUid: 'user-a',
      payload: { date: '2026-06-10' },
    });
    enqueueSyncAction({
      type: 'SAVE_SHIFT',
      targetUid: 'user-a',
      payload: { shift: { date: '2026-06-11', type: 'Libre' } },
    });

    const queue = getSyncQueue();
    expect(queue).toHaveLength(3);
    expect(queue.find((i) => i.type === 'SAVE_SETTINGS')?.payload.settings.irpf).toBe(15);
    expect(queue.find((i) => i.type === 'DELETE_SHIFT')?.payload.date).toBe('2026-06-10');
    expect(queue.find((i) => i.type === 'SAVE_SHIFT')?.payload.shift.date).toBe('2026-06-11');
  });

  it('aísla estrictamente la cola por UID y no ejecuta acciones de otro usuario', async () => {
    enqueueSyncAction({
      type: 'SAVE_SHIFT',
      targetUid: 'user-a',
      payload: { shift: { date: '2026-06-01', type: 'Laboral' } },
    });
    enqueueSyncAction({
      type: 'SAVE_SHIFT',
      targetUid: 'user-b',
      payload: { shift: { date: '2026-06-02', type: 'Libre' } },
    });

    const executor = createMockExecutor();
    const res = await processSyncQueue({ currentUid: 'user-a', executor });

    expect(res.processedCount).toBe(1);
    expect(res.remainingCount).toBe(0);
    expect(executor.saveShift).toHaveBeenCalledTimes(1);
    expect(executor.saveShift).toHaveBeenCalledWith('user-a', { date: '2026-06-01', type: 'Laboral' });

    // El elemento de user-b permanece intacto para cuando vuelva a iniciar sesión
    const remaining = getSyncQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].targetUid).toBe('user-b');
  });

  it('mueve cambios con error permanente a la bandeja de recuperación en lugar de descartarlos', async () => {
    enqueueSyncAction({
      type: 'SAVE_SHIFT',
      targetUid: 'user-a',
      payload: { shift: { date: '2026-06-15', type: 'Laboral' } },
    });

    const permError = Object.assign(new Error('Missing or insufficient permissions.'), {
      code: 'permission-denied',
    });
    const executor = createMockExecutor({
      saveShift: vi.fn().mockRejectedValue(permError),
    });

    const res = await processSyncQueue({ currentUid: 'user-a', executor });

    expect(res.processedCount).toBe(0);
    expect(res.failedMovedCount).toBe(1);
    expect(getSyncQueue()).toHaveLength(0);

    const failed = getFailedSyncItems('user-a');
    expect(failed).toHaveLength(1);
    expect(failed[0].payload.shift.date).toBe('2026-06-15');
    expect(failed[0].errorMessage).toContain('permissions');
  });

  it('permite reintentar elementos fallidos y exportar una copia JSON completa', async () => {
    globalThis.localStorage.setItem('shifts', JSON.stringify([{ date: '2026-06-20', type: 'Laboral' }]));

    enqueueSyncAction({
      type: 'SAVE_SETTINGS',
      targetUid: 'user-a',
      payload: { settings: { irpf: 18 } },
    });

    const failingExecutor = createMockExecutor({
      saveSettings: vi.fn().mockRejectedValue(Object.assign(new Error('Invalid data'), { code: 'invalid-argument' })),
    });
    await processSyncQueue({ currentUid: 'user-a', executor: failingExecutor });
    expect(getFailedSyncItems('user-a')).toHaveLength(1);

    // Exportar copia de respaldo antes de reintentar
    const backup = exportPendingSyncBackup('user-a');
    expect(backup.failedCount).toBe(1);
    expect(backup.failedActions[0].payload.settings.irpf).toBe(18);
    expect(backup.localSnapshot.shifts).toEqual([{ date: '2026-06-20', type: 'Laboral' }]);

    // Reintentar con éxito
    const workingExecutor = createMockExecutor();
    const retryRes = await retryFailedSyncItems({ currentUid: 'user-a', executor: workingExecutor });

    expect(retryRes.retriedCount).toBe(1);
    expect(retryRes.processedCount).toBe(1);
    expect(getFailedSyncItems('user-a')).toHaveLength(0);
    expect(workingExecutor.saveSettings).toHaveBeenCalledWith('user-a', { irpf: 18 });
  });
});
