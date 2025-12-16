import { DEFAULT_UNIT_PRICE } from '../constants';
import { MonthlyRecord, Project, ProjectStatus } from '../types';

type PeriodLabel = '2024-H2' | '2025-H1' | '2025-H2';

type ParsedRow = {
  plan: number[];
  actual: number[];
};

type PeriodDataset = {
  label: PeriodLabel;
  year: number;
  months: number[];
  rows: ParsedRow[];
};

const RAW_2024_H2: any[][] = [["No","社名","業務内容","使用\r\nソフト","Column1","8月","9月","10月","11月","12月"],[1,"ISJ\r\n(日本オンサイト)","設備設計","ー","計画",0,50,50,100,100],[null,null,null,null,"実績"],[2,"ISJ\r\n(部品設計)","自動車部品","CATIA","計画",0,50,50,100,100],[null,null,null,null,"実績"],[3,"ISJ\r\n（生産設備)","図面化","ICAD","計画",0,50,50,100,100],[null,null,null,null,"実績"],[4,"GLW\r\n(LM)","電気自動車の\r\nベースデザイン","CATIA","計画",0,150,150,0,0],[null,null,null,null,"実績",3,74,109,150,446],[5,"GLW\r\n(FALTEC)","外装部品設計","CATIA","計画","CATIAトライアル","CATIAトライアル","CATIAトライアル"],[null,null,null,null,"実績","CATIAトライアル","CATIAトライアル","CATIAトライアル"],[6,"GLW\r\n(河西テクノ)","内装部品設計","CATIA","計画","CATIAトライアル","CATIAトライアル","CATIAトライアル"],[null,null,null,null,"実績","CATIAトライアル","CATIAトライアル","CATIAトライアル"],[7,"テクノハマ","金型データ作成","NX\r\nCATIA","計画"],[null,null,null,null,"実績"],[8,"GNN（5P45）\r\n(河西テクノ)","内装部品設計","CATIA","計画","受託検討中","受託検討中","受託検討中"],[null,null,null,null,"実績","受託検討中","受託検討中","受託検討中"],[9,"GNN（H60E）\r\n(河西テクノ)","内装部品設計","CATIA","計画","受託検討中","受託検討中","受託検討中"],[null,null,null,null,"実績","受託検討中","受託検討中","受託検討中"],[10,"GNN（L53M）\r\n(河西テクノ)","内装部品設計","CATIA","計画","受託検討中","受託検討中","受託検討中"],[null,null,null,null,"実績","受託検討中","受託検討中","受託検討中"],[11,"GNN（33FY）\r\n(河西テクノ)","内装部品設計","CATIA","計画","受託検討中","受託検討中","受託検討中"],[null,null,null,null,"実績","受託検討中","受託検討中","受託検討中"],[12,"日泉化学","内装部品設計","CATIA","計画"],[null,null,null,null,"実績"],[13,"VUTEQ​\r\nインドネシア","内装部品設計","CATIA","計画"],[null,null,null,null,"実績"],[14,"GNN（W13G）\r\n(河西工業)","内装部品設計","CATIA","計画"],[null,null,null,null,"実績"],[15,"GNN（W13G）\r\n(河西工業オンサイト)","内装部品設計","CATIA","計画"],[null,null,null,null,"実績"],[16,"啓装工業","生産設備","ICAD","計画"],[null,null,null,null,"実績"]];

const RAW_2025_H1: any[][] = [["No","社名","業務内容","使用\r\nソフト","計画/実績","1月","2月","3月","4月","5月","6月"],[1,"ISJ\r\n(日本オンサイト)","設備設計","ー","計画",130,160,160,160,105,160],[null,null,null,null,"実績",80,152,160,152,161,170.5],[2,"ISJ\r\n(部品設計)","自動車部品","CATIA","計画",120,150,150,150,100,150],[null,null,null,null,"実績",32,56,"-","-"],[3,"ISJ\r\n（生産設備)","図面化","ICAD","計画",100,100,100,100,80,100],[null,null,null,null,"実績",8,"-",8,"-"],[4,"GLW\r\n(LM)","電気自動車の\r\nベースデザイン","CATIA","計画",0,50,50,50,50,50],[null,null,null,null,"実績","-","-","-","-"],[5,"GLW\r\n(FALTEC)","外装部品設計","CATIA","計画",100,100,140,140,120,140],[null,null,null,null,"実績","-","-","-","-"],[6,"GLW\r\n(河西テクノ)","内装部品設計","CATIA","計画",100,100,100,100,80,100],[null,null,null,null,"実績","-","-","-","-"],[7,"テクノハマ","金型データ作成","NX\r\nCATIA","計画","-","-","-",100,80,100],[null,null,null,null,"実績","-","-","-","-",3],[8,"GNN（5P45）\r\n(河西テクノ)","内装部品設計","CATIA","計画",100,100,100,100,80,100],[null,null,null,null,"実績",74,72,208,10,"-"],[9,"GNN（H60E）\r\n(河西テクノ)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績","-","-",85,"-","-"],[10,"GNN（L53M）\r\n(河西テクノ)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績","-","-","-","-",110,"-"],[11,"GNN（33FY）\r\n(河西テクノ)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績","-","-","-","-",null,"-"],[12,"日泉化学","内装部品設計","CATIA","計画","-","-",150,250,150,0],[null,null,null,null,"実績","-","-","-","-"],[13,"VUTEQ​\r\nインドネシア","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績","-","-","-","-","-"],[14,"GNN（W13G）\r\n(河西工業)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績","-","-","-","-","-"],[15,"GNN（W13G）\r\n(河西工業オンサイト)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績","-","-","-","-","-"],[16,"啓装工業","生産設備","ICAD","計画","-","-","-","-","-","-"],[null,null,null,null,"実績","-","-","-","-","-"]];

const RAW_2025_H2: any[][] = [["No","社名","業務内容","使用\r\nソフト","Column1","7月","8月","9月","10月","11月","12月"],[1,"ISJ\r\n(日本オンサイト)","設備設計","ー","計画",160,120,160,160,160,135],[null,null,null,null,"実績",160,153.5,160,181.75,80],[2,"ISJ\r\n(部品設計)","自動車部品","CATIA","計画",200,180,200,200,200,180],[null,null,null,null,"実績"],[3,"ISJ\r\n（生産設備)","図面化","ICAD","計画"],[null,null,null,null,"実績"],[4,"GLW\r\n(LM)","電気自動車の\r\nベースデザイン","CATIA","計画",50,30,50,50,50,30],[null,null,null,null,"実績"],[5,"GLW\r\n(FALTEC)","外装部品設計","CATIA","計画",140,120,140,140,140,120],[null,null,null,null,"実績"],[6,"GLW\r\n(河西テクノ)","内装部品設計","CATIA","計画",100,80,100,100,100,80],[null,null,null,null,"実績"],[7,"テクノハマ","金型データ作成","NX\r\nCATIA","計画",100,80,100,100,100,80],[null,null,null,null,"実績"],[8,"GNN（5P45）\r\n(河西テクノ)","内装部品設計","CATIA","計画",100,80,100,100,100,80],[null,null,null,null,"実績",null,null,8,15],[9,"GNN（H60E）\r\n(河西テクノ)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績"],[10,"GNN（L53M）\r\n(河西テクノ)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績",null,77.5],[11,"GNN（33FY）\r\n(河西テクノ)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績",null,null,null,43],[12,"日泉化学","内装部品設計","CATIA","計画",0,0,150,250,150,0],[null,null,null,null,"実績"],[13,"VUTEQ​\r\nインドネシア","内装部品設計","CATIA","計画",50,30,50,50,50,30],[null,null,null,null,"実績"],[14,"GNN（W13G）\r\n(河西工業)","内装部品設計","CATIA","計画","-","-",30,40,40,20],[null,null,null,null,"実績",null,null,null,78.5,140],[15,"GNN（W13G）\r\n(河西工業オンサイト)","内装部品設計","CATIA","計画","-","-","-","-","-","-"],[null,null,null,null,"実績",null,null,null,null,40],[16,"啓装工業","生産設備","ICAD","計画",100,80,100,100,100,80],[null,null,null,null,"実績"]];

const toNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === '計画' || str.toLowerCase() === '実績') return 0;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const parseDataset = (raw: any[][], months: number[], label: PeriodLabel): PeriodDataset => {
  const rows: ParsedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const marker = row[4];
    if (marker !== '計画') continue;
    const plan = months.map((_, idx) => toNumber(row[5 + idx]));
    const actualRow = raw[i + 1] || [];
    const actual = months.map((_, idx) => toNumber(actualRow[5 + idx]));
    rows.push({ plan, actual });
    i += 1; // skip paired actual row
  }
  const year = parseInt(label.split('-')[0], 10);
  return { label, year, months, rows };
};

const DATASETS: Record<PeriodLabel, PeriodDataset> = {
  '2024-H2': parseDataset(RAW_2024_H2, [8, 9, 10, 11, 12], '2024-H2'),
  '2025-H1': parseDataset(RAW_2025_H1, [1, 2, 3, 4, 5, 6], '2025-H1'),
  '2025-H2': parseDataset(RAW_2025_H2, [7, 8, 9, 10, 11, 12], '2025-H2'),
};
const RAW_LOOKUP: Record<PeriodLabel, any[][]> = {
  '2024-H2': RAW_2024_H2,
  '2025-H1': RAW_2025_H1,
  '2025-H2': RAW_2025_H2,
};

const makeProjectId = (name: string, idx: number) => {
  const slug = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  return `${slug || 'proj'}-${idx}`;
};

export const getSeedData = () => {
  const projectMap = new Map<string, Project>();
  const records: MonthlyRecord[] = [];
  const periods: string[] = [];

  (Object.values(DATASETS) as PeriodDataset[]).forEach(dataset => {
    if (!periods.includes(dataset.label)) periods.push(dataset.label);

    const raw = RAW_LOOKUP[dataset.label];
    dataset.rows.forEach((row, idx) => {
      const nameCell = raw[idx * 2 + 1]?.[1]; // plan row is at odd indexes due to paired rows
      const name = String(nameCell || `Project ${idx + 1}`).replace(/\r?\n/g, ' ').trim();
      const mapKey = name || `project-${idx}`;
      if (!projectMap.has(mapKey)) {
        projectMap.set(mapKey, {
          id: makeProjectId(mapKey, projectMap.size + 1),
          code: `PRJ-${String(projectMap.size + 1).padStart(3, '0')}`,
          name: mapKey || `Project ${projectMap.size + 1}`,
          type: 'Mechanical Design',
          software: 'CATIA',
          status: ProjectStatus.ACTIVE,
          unit_price: DEFAULT_UNIT_PRICE,
          created_at: new Date().toISOString()
        });
      }
      const project = projectMap.get(mapKey)!;
      dataset.months.forEach((month, mIdx) => {
        const planned = row.plan[mIdx] || 0;
        const actual = row.actual[mIdx] || 0;
        if (planned === 0 && actual === 0) return;
        records.push({
          id: `${project.id}-${dataset.label}-${month}`,
          project_id: project.id,
          period_label: dataset.label,
          year: dataset.year,
          month,
          planned_hours: planned,
          actual_hours: actual
        });
      });
    });
  });

  return {
    projects: Array.from(projectMap.values()),
    records,
    periods: periods.sort().reverse()
  };
};

export const getAvailableYears = (): number[] => {
  const years = Array.from(new Set(Object.values(DATASETS).map(d => d.year)));
  return years.sort((a, b) => b - a);
};

export const getYearHours = (year: number) => {
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    plannedHours: 0,
    actualHours: 0,
  }));

  Object.values(DATASETS)
    .filter(d => d.year === year)
    .forEach(d => {
      d.rows.forEach(row => {
        d.months.forEach((m, idx) => {
          const target = monthlyData[m - 1];
          target.plannedHours += row.plan[idx] || 0;
          target.actualHours += row.actual[idx] || 0;
        });
      });
    });

  // Derive revenue with a consistent unit price
  const monthlyWithRevenue = monthlyData.map(m => ({
    ...m,
    plannedRevenue: m.plannedHours * DEFAULT_UNIT_PRICE,
    actualRevenue: m.actualHours * DEFAULT_UNIT_PRICE,
  }));

  return { monthly: monthlyWithRevenue };
};
