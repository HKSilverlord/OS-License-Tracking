import { supabase } from '../lib/supabase';

/**
 * Enhanced Database Diagnostic - Shows actual data content
 */

export interface DetailedDiagnosticResult {
  projects: {
    total: number;
    sample: any[];
  };
  periods: {
    total: number;
    list: any[];
  };
  periodProjects: {
    total: number;
    sample: any[];
    byPeriod: Record<string, number>;
  };
  monthlyRecords: {
    total: number;
    sample: any[];
    byYear: Record<number, number>;
  };
  errors: string[];
}

export async function runDetailedDiagnostic(): Promise<DetailedDiagnosticResult> {
  const result: DetailedDiagnosticResult = {
    projects: { total: 0, sample: [] },
    periods: { total: 0, list: [] },
    periodProjects: { total: 0, sample: [], byPeriod: {} },
    monthlyRecords: { total: 0, sample: [], byYear: {} },
    errors: []
  };

  try {
    console.log('=== DETAILED DIAGNOSTIC START ===');

    // 1. Check Projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, code, name, period, unit_price, plan_price, actual_price, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (projectsError) {
      result.errors.push(`Projects error: ${projectsError.message}`);
    } else {
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      result.projects.total = count || 0;
      result.projects.sample = projects || [];
      console.log(`✓ Projects: ${result.projects.total} total, showing ${projects?.length || 0} samples`);
    }

    // 2. Check Periods
    const { data: periods, error: periodsError } = await supabase
      .from('periods')
      .select('label, year, half, created_at')
      .order('year', { ascending: false });

    if (periodsError) {
      result.errors.push(`Periods error: ${periodsError.message}`);
    } else {
      result.periods.total = periods?.length || 0;
      result.periods.list = periods || [];
      console.log(`✓ Periods: ${result.periods.total} total`);
    }

    // 3. Check Period-Projects Links
    const { data: periodProjects, error: ppError } = await supabase
      .from('period_projects')
      .select('period_label, project_id, plan_price, actual_price, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (ppError) {
      result.errors.push(`Period-Projects error: ${ppError.message}`);
    } else {
      const { count } = await supabase
        .from('period_projects')
        .select('*', { count: 'exact', head: true });

      result.periodProjects.total = count || 0;
      result.periodProjects.sample = periodProjects || [];

      // Count by period
      if (periodProjects) {
        const byPeriod: Record<string, number> = {};
        periodProjects.forEach(pp => {
          byPeriod[pp.period_label] = (byPeriod[pp.period_label] || 0) + 1;
        });
        result.periodProjects.byPeriod = byPeriod;
      }

      console.log(`✓ Period-Projects Links: ${result.periodProjects.total} total`);
    }

    // 4. Check Monthly Records
    const { data: records, error: recordsError } = await supabase
      .from('monthly_records')
      .select('project_id, period_label, year, month, planned_hours, actual_hours')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(10);

    if (recordsError) {
      result.errors.push(`Monthly Records error: ${recordsError.message}`);
    } else {
      const { count } = await supabase
        .from('monthly_records')
        .select('*', { count: 'exact', head: true });

      result.monthlyRecords.total = count || 0;
      result.monthlyRecords.sample = records || [];

      // Count by year
      if (records) {
        const byYear: Record<number, number> = {};
        records.forEach(r => {
          byYear[r.year] = (byYear[r.year] || 0) + 1;
        });
        result.monthlyRecords.byYear = byYear;
      }

      console.log(`✓ Monthly Records: ${result.monthlyRecords.total} total`);
    }

    console.log('=== DETAILED DIAGNOSTIC END ===');
  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
    console.error('✗ Unexpected error:', error);
  }

  return result;
}

/**
 * Test the exact queries used by TrackingView
 */
export async function testTrackingViewQuery(periodLabel: string) {
  console.log(`=== TESTING TRACKING VIEW QUERY FOR PERIOD: ${periodLabel} ===`);

  try {
    // This is the exact query used in dbService.getProjects(period)
    const { data, error } = await supabase
      .from('period_projects')
      .select('plan_price, actual_price, projects(*)')
      .eq('period_label', periodLabel)
      .order('projects(display_order)', { ascending: true });

    console.log('Query result:', {
      error: error,
      dataCount: data?.length || 0,
      sampleData: data?.slice(0, 3)
    });

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return { success: true, error: null, data: data || [] };
  } catch (err: any) {
    console.error('Query failed:', err);
    return { success: false, error: err.message, data: null };
  }
}

/**
 * Test the exact queries used by YearlyDataView
 */
export async function testYearlyDataViewQuery(year: number) {
  console.log(`=== TESTING YEARLY DATA VIEW QUERY FOR YEAR: ${year} ===`);

  try {
    // 1. Get periods for this year
    const { data: periodsData, error: periodsError } = await supabase
      .from('periods')
      .select('label')
      .eq('year', year);

    console.log('Periods query:', {
      error: periodsError,
      periodsCount: periodsData?.length || 0,
      periods: periodsData
    });

    if (periodsError) {
      return { success: false, error: periodsError.message, periods: [], projects: [], records: [] };
    }

    const yearPeriods = periodsData?.map(p => p.label) || [];

    // 2. Get projects for these periods
    let allProjects: any[] = [];
    for (const period of yearPeriods) {
      const { data: projectsData, error: projectsError } = await supabase
        .from('period_projects')
        .select('plan_price, actual_price, projects(*)')
        .eq('period_label', period);

      if (!projectsError && projectsData) {
        allProjects.push(...projectsData);
      }
    }

    console.log('Projects query:', {
      totalProjects: allProjects.length,
      sampleProjects: allProjects.slice(0, 3)
    });

    // 3. Get monthly records for this year
    const { data: recordsData, error: recordsError } = await supabase
      .from('monthly_records')
      .select('*')
      .eq('year', year);

    console.log('Records query:', {
      error: recordsError,
      recordsCount: recordsData?.length || 0,
      sampleRecords: recordsData?.slice(0, 3)
    });

    if (recordsError) {
      return {
        success: false,
        error: recordsError.message,
        periods: yearPeriods,
        projects: allProjects,
        records: []
      };
    }

    return {
      success: true,
      error: null,
      periods: yearPeriods,
      projects: allProjects,
      records: recordsData || []
    };
  } catch (err: any) {
    console.error('Query failed:', err);
    return { success: false, error: err.message, periods: [], projects: [], records: [] };
  }
}
