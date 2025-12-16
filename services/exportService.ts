import * as XLSX from 'xlsx';
import { ProjectRow, PeriodType } from '../types';

export const exportToExcel = (projects: ProjectRow[], currentPeriodLabel: string) => {
  // Define headers
  const headers = [
    'Project Code',
    'Project Name',
    'Type',
    'Status',
    'Unit Price',
    'Total Planned (Hrs)',
    'Total Actual (Hrs)',
    'Revenue (JPY)'
  ];

  const data = projects.map(p => {
    let totalPlanned = 0;
    let totalActual = 0;

    // Sum up hours for the current view
    Object.values(p.records).forEach(r => {
      if (r.period_label === currentPeriodLabel) {
        totalPlanned += r.planned_hours || 0;
        totalActual += r.actual_hours || 0;
      }
    });

    const revenue = totalActual * p.unit_price;

    return [
      p.code,
      p.name,
      p.type,
      p.status,
      p.unit_price,
      totalPlanned,
      totalActual,
      revenue
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Project Data");
  
  XLSX.writeFile(wb, `OS_Management_${currentPeriodLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
