// Helper to access environment variables in various environments (Vite, CRA, Node)
function getEnvVar(key: string): string {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[`VITE_${key}`] || import.meta.env[key];
      if (val) return val;
    }
  } catch (e) {}

  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      const val = process.env[`REACT_APP_${key}`] || process.env[key];
      if (val) return val;
    }
  } catch (e) {}

  return '';
}

export const SUPABASE_URL = getEnvVar('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnvVar('SUPABASE_ANON_KEY');

export const DEFAULT_UNIT_PRICE = 2300;

export const MONTHS_H1 = [1, 2, 3, 4, 5, 6];
export const MONTHS_H2 = [7, 8, 9, 10, 11, 12];

export const PROJECT_TYPES = ['Mechanical Design', 'Electrical Design', 'Software Development', 'Translation', 'Other'];
export const SOFTWARE_OPTIONS = ['AutoCAD', 'SolidWorks', 'CATIA', 'NX', 'Excel', 'Other'];