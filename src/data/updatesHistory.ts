export interface AppUpdate {
  version: string;
  date: string;
  title: string;
  isCurrent?: boolean;
  description?: string;
  changes: string[];
}

export const APP_VERSION = '2.12';

// Notificaciones de versión: se notifican inmediatamente cuando se publica una nueva versión
export const RELEASE_DAY_OF_WEEK = 3;

export function isWednesdayReleaseDay(): boolean {
  return true; // Notificación inmediata para todos los usuarios al haber nueva versión
}

export const UPDATES_HISTORY: AppUpdate[] = [
  {
    version: '2.12',
    date: '26/11/2026',
    title: 'Rotaciones mixtas, Variables Vacaciones, solicitudes de cambio de turno y nueva carga',
    isCurrent: true,
    description: 'Soporte para rotaciones mixtas en todas las herramientas del cuadrante, ajustes de divisor y deducciones completas en Variables Vacaciones, flujo completo de solicitudes de cambio de turno y pantalla de carga con avión en pista.',
    changes: [
      'Nuevas funciones: Rotaciones mixtas (por fecha de cambio como 5x2 a 6x3 o en ciclo alterno) en Vacaciones, Visualizar libranzas, Autocompletar turnos y Calendario de rotaciones',
      'Nuevas funciones: Recuadro Ajustes en Variables Vacaciones con divisor por meses trabajados (2 decimales) calculado según los días de vacaciones del año anterior',
      'Nuevas funciones: Sección Cambiar turno reorganizada en Solicitar cambio de turno (Enviadas y Recibidas con estados pendiente, aceptada, rechazada y deshecho) y Notificaciones',
      'Nuevo diseño: Pantalla inicial de carga con barra de progreso estilo pista de aeropuerto y avión visto desde arriba siguiendo el avance',
      'Mejoras: Deducciones de Contingencias Comunes, Desempleo, Formación y Mecanismo de Equidad (con porcentaje del año anterior) en Variables Vacaciones y eliminación del divisor Total',
      'Mejoras: Eliminación automática del turno sustituido al aceptar un cambio de turno y estado primero en la pestaña Enviadas',
      'Mejoras: Icono centelleante de cambio de turno integrado dentro del botón Ajustes solo al recibir solicitudes nuevas',
      'Errores corregidos: Sincronización y ocultación inmediata de notificaciones ya vistas, aceptadas o rechazadas en el banner superior y mejora de permisos al cargar pluses'
    ]
  },
  {
    version: '2.11',
    date: '14/11/2026',
    title: 'Cambios de turno colaborativos, avisos mutuos y ajustes visuales',
    isCurrent: false,
    description: 'Cambios de turno conectados con Compartir/Colab., sincronización automática y avisos en tiempo real entre compañeros autorizados, nueva llave de acceso y mejoras en Configuración y Turnos.',
    changes: [
      'Nuevas funciones: Cambio de turno desde el detalle del día o Ajustes conectado con compañeros de Compartir/Colab.',
      'Nuevas funciones: Actualización automática en ambos calendarios y notificaciones en tiempo real entre autorizados mutuos',
      'Nuevas funciones: Icono centelleante en Ajustes al recibir un cambio de turno que se oculta al visualizarlo',
      'Nuevo diseño: Ventana Compartir/Colab. renovada con Mi llave de acceso destacada, correo visible y pestañas Autorizados y Accesos',
      'Mejoras: Mini barra de progreso en Progresión de Nivel, fecha activa en Congelación Progresión y títulos más grandes en Configuración',
      'Mejoras: Etiquetas CON y SUB alineadas en las tarjetas de Turnos y Nómina sin decimales .00h innecesarios',
      'Errores corregidos: Detalle del día guarda cambios únicamente al pulsar Guardar y ver resumen y sin botón llave superior',
      'Errores corregidos: Eliminado mensaje informativo duplicado al cambiar al calendario de la 2ª empresa'
    ]
  },
  {
    version: '2.10',
    date: '13/11/2026',
    title: 'Informes PDF completos en Resumen y nueva Configuración flotante',
    isCurrent: false,
    description: 'Selector de origen e informes mensuales completos en PDF, descarga individual desde el historial y pestaña Configuración en cuadrícula con ventanas flotantes.',
    changes: [
      'Nuevas funciones: Selector previo en Resumen Anual entre nóminas de la app e Historial de Nóminas',
      'Nuevas funciones: Desglose mensual completo y pagas extras en el PDF de nóminas no guardadas',
      'Nuevas funciones: Botón Descargar PDF en el detalle de cada nómina del Historial',
      'Nuevo diseño: Pestaña Configuración en cuadrícula de 2 columnas con ventanas flotantes unificadas',
      'Mejoras: Ventanas flotantes de Configuración con pie fijo, ayuda contextual, enlaces directos y año desplegado',
      'Errores corregidos: Botón de volver arriba en Resumen muestra únicamente la flecha'
    ]
  },
  {
    version: '2.9',
    date: '12/11/2026',
    title: 'Actualizaciones manuales, mejoras en Sugerencias, nóminas y Resumen',
    isCurrent: false,
    description: 'Notificación manual de versiones, avisos en Sugerencias, calendario de rotaciones con vacaciones, mejoras en Paga Extra, copias JSON y suma anual de pluses.',
    changes: [
      'Nuevas funciones: Actualización manual con aviso naranja en el banner superior',
      'Nuevas funciones: Notificaciones en la app y opción por correo para administradores en el Buzón de Sugerencias',
      'Nuevas funciones: Días de vacaciones destacados con leyenda en el calendario de rotaciones de Herramientas',
      'Mejoras: Ventana Crear nuevo plus en 2 columnas y categoría subrogado según Configuración',
      'Mejoras: Paga Extra de junio y diciembre calculada desde PP Extra de la sección Nómina',
      'Mejoras: Pluses generados como subrogados incluidos en Variables de Vacaciones',
      'Mejoras: Importación de copias JSON y restauración completa al elegir Reemplazar todo',
      'Errores corregidos: Pluses en Resumen al cambiar de año en Contador y suma anual fiel a Pluses Generados del Mes',
      'Errores corregidos: Limpieza completa en Borrar Todo y persistencia de avisos en Sugerencias'
    ]
  },
  {
    version: '2.8',
    date: '04/11/2026',
    title: 'Privacidad de nómina, cómputo de horas y vista PC',
    isCurrent: false,
    description: 'Control de privacidad en nómina compartida, cómputo según contrato y adaptación para PC.',
    changes: [
      'Nuevo diseño: Sección Resumen',
      'Mejoras: Sección Nómina',
      'Mejoras: Sección Turnos y Nómina',
      'Mejoras: Sección Resumen'
    ]
  },
  {
    version: '2.7',
    date: '02/11/2026',
    title: 'Modo invitado y colaboración en tiempo real',
    isCurrent: false,
    description: 'Aislamiento de cuadrantes de compañeros y trabajo colaborativo.',
    changes: [
      'Nuevas funciones: Sección Modo Invitado',
      'Mejoras: Sección Modo Invitado',
      'Mejoras: Sección Turnos y Nómina'
    ]
  },
  {
    version: '2.6',
    date: '30/10/2026',
    title: 'Segundo calendario y control de solapes',
    isCurrent: false,
    description: 'Gestión en paralelo de una segunda empresa y auditoría horaria.',
    changes: [
      'Nuevas funciones: Sección Herramientas',
      'Mejoras: Sección Turnos y Nómina',
      'Mejoras: Sección Resumen'
    ]
  },
  {
    version: '2.5',
    date: '28/10/2026',
    title: 'Buzón de sugerencias e historial de versiones',
    isCurrent: false,
    description: 'Canal directo confidencial y gestión ordenada de versiones.',
    changes: [
      'Nuevas funciones: Sección Herramientas',
      'Mejoras: Sección Historial de Versiones'
    ]
  },
  {
    version: '2.4',
    date: '20/10/2026',
    title: 'Horas sindicales y descansos entre jornadas',
    isCurrent: false,
    description: 'Tramos específicos para horas sindicales y control de descansos.',
    changes: [
      'Nuevas funciones: Sección Turnos y Nómina',
      'Mejoras: Sección Turnos y Nómina'
    ]
  },
  {
    version: '2.3',
    date: '10/10/2026',
    title: 'Cálculo de nómina y pagas extraordinarias',
    isCurrent: false,
    description: 'Desglose mensual de nómina conforme al Convenio Colectivo.',
    changes: [
      'Nuevas funciones: Sección Nómina',
      'Mejoras: Sección Nómina'
    ]
  }
];
