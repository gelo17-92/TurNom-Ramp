import React from 'react';
import { AlertTriangle, RotateCcw, Home, Download } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  scope?: 'global' | 'tab';
  sectionName?: string;
  resetKey?: string | number;
  onNavigateHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

function readLocalJsonSafe(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function downloadEmergencyBackup(sectionName?: string) {
  try {
    const backup = {
      exportedAt: new Date().toISOString(),
      source: 'error_boundary_recovery',
      section: sectionName || 'global',
      shifts: readLocalJsonSafe('shifts'),
      settings: readLocalJsonSafe('settings'),
      levels: readLocalJsonSafe('levels'),
      pluses: readLocalJsonSafe('pluses'),
      offlineSyncQueue: readLocalJsonSafe('app_offline_sync_queue'),
      offlineSyncFailed: readLocalJsonSafe('app_offline_sync_failed'),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `copia-seguridad-turnos-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[ErrorBoundary] Could not export local backup:', err);
  }
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare readonly props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };
  declare setState: (
    next: Partial<ErrorBoundaryState> | ((prev: Readonly<ErrorBoundaryState>) => Partial<ErrorBoundaryState>)
  ) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado al renderizar la vista.',
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }): void {
    console.error(`[ErrorBoundary:${this.props.scope || 'global'}:${this.props.sectionName || 'app'}]`, error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handlePrimaryFallback = () => {
    if (this.props.scope === 'tab' && this.props.onNavigateHome) {
      this.setState({ hasError: false, errorMessage: '' });
      this.props.onNavigateHome();
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isGlobal = (this.props.scope || 'global') === 'global';
    const title = isGlobal
      ? 'Ha ocurrido un problema inesperado'
      : `No se ha podido cargar la sección ${this.props.sectionName || ''}`.trim();

    const description = isGlobal
      ? 'Tus datos locales siguen guardados en este dispositivo. Puedes reintentar, recargar la aplicación o descargar una copia de seguridad.'
      : 'El resto de secciones siguen funcionando con normalidad. Puedes reintentar esta vista, volver a Turnos o descargar una copia de tus datos locales.';

    return (
      <div
        className={
          isGlobal
            ? 'min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
            : 'w-full flex items-center justify-center py-10 px-4'
        }
        role="alert"
      >
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                {title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reintentar
            </button>

            <button
              type="button"
              onClick={this.handlePrimaryFallback}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              {isGlobal ? 'Recargar app' : 'Ir a Turnos'}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => downloadEmergencyBackup(this.props.sectionName)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Guardar copia de seguridad (JSON)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
