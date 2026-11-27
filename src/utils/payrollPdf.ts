import { eachDayOfInterval, endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { SavedPayroll } from '../types';
import {
  formatCurrency as originalFormatCurrency,
  formatNumber,
  getShiftDuration,
  isExtraPayroll,
  safeFormat
} from '../utils';

export const exportSinglePayrollPdf = async (
  savedPayroll: SavedPayroll,
  options: { shifts?: any[]; hideAmounts?: boolean } = {}
) => {
  const { jsPDF } = await import('jspdf');
  const { shifts = [], hideAmounts = false } = options;
  const formatCurrency = (val: any) => {
    if (hideAmounts) return '•••• €';
    return originalFormatCurrency(val);
  };

  const baseMonthKey = savedPayroll.monthKey.split('-extra')[0].split('-vacaciones')[0];
  const [yearStr, mStr] = baseMonthKey.split('-');
  const year = parseInt(yearStr) || new Date().getFullYear();
  const monthIdx = parseInt(mStr) ? parseInt(mStr) - 1 : 0;
  const monthDate = new Date(year, monthIdx, 1);
  const monthName = safeFormat(monthDate, 'MMMM yyyy', { locale: es });
  const isExtra = isExtraPayroll(savedPayroll);
  const isVacVars = savedPayroll.monthKey.includes('vacaciones');

  const pDevengos = (savedPayroll.devengos || []).filter(d => d.value !== 0 || d.isProrrata);
  const pDeducciones = (savedPayroll.deducciones || []).filter(d => d.value !== 0);
  const pConceptosADescontar = (savedPayroll.conceptosADescontar || []).filter(c => c.value !== 0);
  const pTotalDevengado = savedPayroll.totals?.totalDevengado || 0;
  const pTotalDeducciones = savedPayroll.totals?.totalDeducciones || 0;
  const pLiquido = savedPayroll.totals?.liquido || 0;
  const pBaseCotizacion = savedPayroll.totals?.baseCotizacion ?? 0;
  const pContract = savedPayroll.settings?.contractType || 'Completo';
  const pLevel = savedPayroll.settings?.level || 1;
  const pPagas = savedPayroll.settings?.pagas || 12;
  const pIrpf = savedPayroll.settings?.irpf ?? 0;
  const savedDateFormatted = savedPayroll.saveDate ? safeFormat(parseISO(savedPayroll.saveDate), 'dd/MM/yyyy HH:mm') : '-';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186 mm

  // Header banner
  doc.setFillColor(0, 78, 137);
  doc.roundedRect(margin, margin, contentWidth, 22, 2.5, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  const headerTitle = isExtra
    ? 'RECIBO DE PAGA EXTRAORDINARIA GUARDADA'
    : isVacVars
      ? 'RECIBO DE VARIABLES DE VACACIONES GUARDADAS'
      : 'HOJA MENSUAL DE TURNOS Y RECIBO DE NÓMINA';
  doc.text(headerTitle, margin + 6, margin + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(224, 242, 254);
  doc.text(`Período: ${monthName.toUpperCase()}  •  Guardada: ${savedDateFormatted}`, margin + 6, margin + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Contrato: ${pContract}  •  Nivel: ${pLevel}  •  ${pPagas} pagas`, pageWidth - margin - 6, margin + 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(224, 242, 254);
  doc.text(`IRPF aplicado: ${formatNumber(pIrpf, 2)}%  •  Emisión PDF: ${safeFormat(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin - 6, margin + 15, { align: 'right' });

  let curY = margin + 25;

  if (!isExtra && !isVacVars) {
    // Regular monthly payroll: include KPI bar + monthly shift calendar
    const monthDays = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
    const monthShifts = monthDays.map(day => {
      const dKey = safeFormat(day, 'yyyy-MM-dd');
      const found = shifts.find((s: any) => s.date === dKey);
      return {
        date: day,
        dKey,
        dayNum: day.getDate(),
        dayName: safeFormat(day, 'EEEEEE', { locale: es }).toUpperCase(),
        type: found?.type || 'Laboral',
        shifts: (found?.shifts || []).filter((s: any) => s && s.start && s.end),
        extraShifts: (found?.extraShifts || []).filter((s: any) => s && s.start && s.end),
      };
    });

    const kpiH = 13;
    const kpiCount = 4;
    const kpiW = (contentWidth - 3 * (kpiCount - 1)) / kpiCount;

    const totWorkedH = monthShifts.reduce((acc, ms) => {
      const ord = ms.shifts.reduce((sAcc: number, s: any) => sAcc + getShiftDuration(s.start, s.end), 0);
      const ext = ms.extraShifts.reduce((sAcc: number, s: any) => sAcc + getShiftDuration(s.start, s.end), 0);
      return acc + ord + ext;
    }, 0);

    const labDays = monthShifts.filter(ms => ms.shifts.length > 0 || ms.extraShifts.length > 0).length;
    const freeDays = monthShifts.filter(ms => ms.type === 'Libre' || ms.type === 'Libranza').length;
    const vacDays = monthShifts.filter(ms => ms.type === 'Vacaciones').length;

    const kpiData = [
      { label: 'HORAS TRABAJADAS', val: `${formatNumber(totWorkedH, 2)} h`, highlight: false },
      { label: 'DÍAS TRABAJADOS', val: `${labDays} días`, highlight: false },
      { label: 'DÍAS LIBRES / VAC', val: `${freeDays} / ${vacDays}`, highlight: false },
      { label: 'LÍQUIDO A PERCIBIR', val: formatCurrency(pLiquido), highlight: true }
    ];

    kpiData.forEach((kpi, i) => {
      const kX = margin + i * (kpiW + 3);
      if (kpi.highlight) {
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(kX, curY, kpiW, kpiH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(236, 253, 245);
        doc.text(kpi.label, kX + kpiW / 2, curY + 4.5, { align: 'center' });
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(kpi.val, kX + kpiW / 2, curY + 10, { align: 'center' });
      } else {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(kX, curY, kpiW, kpiH, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, kX + kpiW / 2, curY + 4.5, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(kpi.val, kX + kpiW / 2, curY + 10, { align: 'center' });
      }
    });

    curY += kpiH + 5;

    // SECTION 1: CUADRANTE DE TURNOS DEL MES
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, curY, contentWidth, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. CUADRANTE DE TURNOS DEL MES', margin + 3, curY + 4);
    curY += 6.5;

    const cols = 3;
    const colWidth = (contentWidth - 4) / cols;
    const daysPerCol = Math.ceil(monthShifts.length / cols);
    const rowH = 4.2;

    for (let c = 0; c < cols; c++) {
      const colX = margin + c * (colWidth + 2);
      doc.setFillColor(226, 232, 240);
      doc.rect(colX, curY, colWidth, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);
      doc.text('DÍA', colX + 2, curY + 3);
      doc.text('TURNO / ESTADO', colX + 16, curY + 3);
      doc.text('HORAS', colX + colWidth - 2, curY + 3, { align: 'right' });

      const colDays = monthShifts.slice(c * daysPerCol, (c + 1) * daysPerCol);
      colDays.forEach((cd, rIdx) => {
        const rY = curY + 4 + rIdx * rowH;
        if (rIdx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(colX, rY, colWidth, rowH, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(15, 23, 42);
        doc.text(`${cd.dayName} ${String(cd.dayNum).padStart(2, '0')}`, colX + 2, rY + 3);

        let turnDesc = cd.type;
        let dayHours = 0;
        if (cd.shifts.length > 0) {
          turnDesc = cd.shifts.map((s: any) => `${s.start}-${s.end}`).join(' / ');
          dayHours = cd.shifts.reduce((sum: number, s: any) => sum + getShiftDuration(s.start, s.end), 0);
          if (cd.extraShifts.length > 0) {
            turnDesc += ` +H.Ext`;
            dayHours += cd.extraShifts.reduce((sum: number, s: any) => sum + getShiftDuration(s.start, s.end), 0);
          }
        }

        doc.setFont('helvetica', cd.shifts.length > 0 ? 'bold' : 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(cd.shifts.length > 0 ? 0 : 120, cd.shifts.length > 0 ? 78 : 120, cd.shifts.length > 0 ? 137 : 120);
        doc.text(turnDesc.substring(0, 24), colX + 16, rY + 3);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(15, 23, 42);
        doc.text(dayHours > 0 ? `${formatNumber(dayHours, 1)}h` : '-', colX + colWidth - 2, rY + 3, { align: 'right' });
      });
    }

    curY += 4 + daysPerCol * rowH + 6;
  } else {
    // KPI bar for Paga Extra / Vacation Variables
    const kpiH = 14;
    const kpiW = (contentWidth - 6) / 3;
    const kpis = [
      { label: 'TOTAL DEVENGADO (BRUTO)', val: formatCurrency(pTotalDevengado), highlight: false },
      { label: 'TOTAL DEDUCCIONES', val: `-${formatCurrency(pTotalDeducciones)}`, highlight: false },
      { label: 'LÍQUIDO A PERCIBIR', val: formatCurrency(pLiquido), highlight: true }
    ];
    kpis.forEach((kpi, i) => {
      const kX = margin + i * (kpiW + 3);
      if (kpi.highlight) {
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(kX, curY, kpiW, kpiH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(236, 253, 245);
        doc.text(kpi.label, kX + kpiW / 2, curY + 5, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(kpi.val, kX + kpiW / 2, curY + 10.5, { align: 'center' });
      } else {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(kX, curY, kpiW, kpiH, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, kX + kpiW / 2, curY + 5, { align: 'center' });
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(kpi.val, kX + kpiW / 2, curY + 10.5, { align: 'center' });
      }
    });
    curY += kpiH + 6;
  }

  // SECTION: DESGLOSE DEL RECIBO DE NÓMINA
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(!isExtra && !isVacVars ? '2. DESGLOSE DEL RECIBO DE NÓMINA' : 'DESGLOSE DEL RECIBO', margin + 3, curY + 4);
  curY += 7;

  const halfW = (contentWidth - 4) / 2;
  const devX = margin;
  doc.setFillColor(240, 253, 244);
  doc.rect(devX, curY, halfW, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 101, 52);
  doc.text('DEVENGOS (PERCEPCIONES)', devX + 2, curY + 3.2);
  doc.text('IMPORTE', devX + halfW - 2, curY + 3.2, { align: 'right' });

  let devY = curY + 5;
  pDevengos.forEach((d, idx) => {
    if (devY > pageHeight - 36) return;
    if (idx % 2 === 0) {
      doc.setFillColor(252, 252, 252);
      doc.rect(devX, devY, halfW, 4.4, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(30, 41, 59);
    const qtyLabel = typeof d.qty === 'number' ? formatNumber(d.qty, 2).replace(/,00$/, '') : d.qty;
    const suffix = d.isProrrata ? ' (Prorr.)' : '';
    doc.text(`${d.name}${suffix} [${qtyLabel}]`.substring(0, 38), devX + 2, devY + 3.1);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(d.isProrrata ? 148 : 15, d.isProrrata ? 163 : 23, d.isProrrata ? 184 : 42);
    doc.text(formatCurrency(d.value), devX + halfW - 2, devY + 3.1, { align: 'right' });
    devY += 4.4;
  });

  doc.setFillColor(236, 253, 245);
  doc.rect(devX, devY, halfW, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(6, 95, 70);
  doc.text('TOTAL DEVENGADO (BRUTO)', devX + 2, devY + 3.5);
  doc.text(formatCurrency(pTotalDevengado), devX + halfW - 2, devY + 3.5, { align: 'right' });
  devY += 5;

  const dedX = margin + halfW + 4;
  doc.setFillColor(254, 242, 242);
  doc.rect(dedX, curY, halfW, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(153, 27, 27);
  doc.text('DEDUCCIONES Y RETENCIONES', dedX + 2, curY + 3.2);
  doc.text('IMPORTE', dedX + halfW - 2, curY + 3.2, { align: 'right' });

  let dedY = curY + 5;
  pDeducciones.forEach((d, idx) => {
    if (dedY > pageHeight - 36) return;
    if (idx % 2 === 0) {
      doc.setFillColor(252, 252, 252);
      doc.rect(dedX, dedY, halfW, 4.4, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(30, 41, 59);
    const rateStr = d.rate ? ` (${formatNumber(d.rate, 2)}%)` : '';
    doc.text(`${d.name}${rateStr}`.substring(0, 36), dedX + 2, dedY + 3.1);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(`-${formatCurrency(d.value)}`, dedX + halfW - 2, dedY + 3.1, { align: 'right' });
    dedY += 4.4;
  });

  pConceptosADescontar.forEach((c, idx) => {
    if (dedY > pageHeight - 36) return;
    if ((pDeducciones.length + idx) % 2 === 0) {
      doc.setFillColor(252, 252, 252);
      doc.rect(dedX, dedY, halfW, 4.4, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(30, 41, 59);
    doc.text(c.name.substring(0, 36), dedX + 2, dedY + 3.1);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(formatCurrency(c.value), dedX + halfW - 2, dedY + 3.1, { align: 'right' });
    dedY += 4.4;
  });

  doc.setFillColor(254, 226, 226);
  doc.rect(dedX, dedY, halfW, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(153, 27, 27);
  doc.text('TOTAL A DEDUCIR', dedX + 2, dedY + 3.5);
  doc.text(`-${formatCurrency(pTotalDeducciones)}`, dedX + halfW - 2, dedY + 3.5, { align: 'right' });
  dedY += 5;

  curY = Math.max(devY, dedY) + 4;

  // BASES Y LÍQUIDO FINAL
  const bW = (contentWidth - 6) / 3;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, bW, 12, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('BASE COTIZACIÓN SEG. SOCIAL', margin + 3, curY + 4.5);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(pBaseCotizacion), margin + 3, curY + 9.5);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin + bW + 3, curY, bW, 12, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('BASE IRPF / TRIBUTABLE', margin + bW + 6, curY + 4.5);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(pTotalDevengado), margin + bW + 6, curY + 9.5);

  const liqX = margin + 2 * (bW + 3);
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(liqX, curY, bW, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(236, 253, 245);
  doc.text('LÍQUIDO TOTAL A PERCIBIR', liqX + bW / 2, curY + 4.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(pLiquido), liqX + bW / 2, curY + 9.5, { align: 'center' });

  curY += 16;

  if (savedPayroll.notes && curY < pageHeight - 25) {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    const notesText = doc.splitTextToSize(savedPayroll.notes, contentWidth - 8);
    const boxH = Math.min(24, 7 + notesText.length * 3.8);
    doc.roundedRect(margin, curY, contentWidth, boxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9);
    doc.text('ANOTACIONES:', margin + 4, curY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(146, 64, 14);
    doc.text(notesText.slice(0, 4), margin + 4, curY + 8.5);
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento informativo generado por la aplicación de Gestión de Turnos y Nóminas del Sector de Handling. Página 1 de 1.`,
    margin,
    pageHeight - 8
  );

  const filePrefix = isExtra
    ? 'Paga_Extra'
    : isVacVars
      ? 'Variables_Vacaciones'
      : 'Nomina';
  doc.save(`${filePrefix}_${baseMonthKey.replace('-', '_')}.pdf`);
};
