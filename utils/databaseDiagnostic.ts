import { supabase } from '../lib/supabase';

/**
 * Database Diagnostic and Fix Utility
 * This tool checks for missing period_projects links and fixes them
 */

interface DiagnosticResult {
  totalProjects: number;
  totalPeriods: number;
  projectsWithPeriod: number;
  projectsWithoutLinks: number;
  linksCreated: number;
  errors: string[];
}

export async function diagnoseDatabaseLinks(): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    totalProjects: 0,
    totalPeriods: 0,
    projectsWithPeriod: 0,
    projectsWithoutLinks: 0,
    linksCreated: 0,
    errors: []
  };

  try {
    console.log('=== DATABASE DIAGNOSTIC START ===');

    // 1. Check all projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, code, name, period, unit_price, plan_price, actual_price');

    if (projectsError) {
      result.errors.push(`Projects query error: ${projectsError.message}`);
      return result;
    }

    result.totalProjects = projects?.length || 0;
    console.log(`✓ Found ${result.totalProjects} total projects`);

    // 2. Check all periods
    const { data: periods, error: periodsError } = await supabase
      .from('periods')
      .select('label, year, half');

    if (periodsError) {
      result.errors.push(`Periods query error: ${periodsError.message}`);
      return result;
    }

    result.totalPeriods = periods?.length || 0;
    console.log(`✓ Found ${result.totalPeriods} total periods`);

    if (result.totalPeriods === 0) {
      result.errors.push('No periods found! Create a period first.');
      return result;
    }

    // 3. Check projects with period field
    const projectsWithPeriod = projects?.filter(p => p.period) || [];
    result.projectsWithPeriod = projectsWithPeriod.length;
    console.log(`✓ Found ${result.projectsWithPeriod} projects with period field`);

    // 4. Check existing period_projects links
    const { data: existingLinks, error: linksError } = await supabase
      .from('period_projects')
      .select('project_id, period_label');

    if (linksError) {
      result.errors.push(`Period_projects query error: ${linksError.message}`);
      return result;
    }

    const linkedProjectIds = new Set(existingLinks?.map(l => l.project_id) || []);
    console.log(`✓ Found ${linkedProjectIds.size} projects already linked`);

    // 5. Find projects that need linking
    const projectsNeedingLinks = projectsWithPeriod.filter(p => !linkedProjectIds.has(p.id));
    result.projectsWithoutLinks = projectsNeedingLinks.length;

    if (projectsNeedingLinks.length === 0) {
      console.log('✓ All projects are properly linked!');
      return result;
    }

    console.log(`⚠ Found ${projectsNeedingLinks.length} projects needing links`);

    // 6. Create missing links
    const linksToCreate = projectsNeedingLinks.map(p => ({
      project_id: p.id,
      period_label: p.period,
      plan_price: p.plan_price || p.unit_price || null,
      actual_price: p.actual_price || p.unit_price || null
    }));

    if (linksToCreate.length > 0) {
      console.log(`Creating ${linksToCreate.length} missing period_projects links...`);

      const { error: insertError } = await supabase
        .from('period_projects')
        .insert(linksToCreate);

      if (insertError) {
        result.errors.push(`Failed to create links: ${insertError.message}`);
        console.error('✗ Error creating links:', insertError);
      } else {
        result.linksCreated = linksToCreate.length;
        console.log(`✓ Successfully created ${result.linksCreated} links`);
      }
    }

  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
    console.error('✗ Unexpected error:', error);
  }

  console.log('=== DATABASE DIAGNOSTIC END ===');
  return result;
}

/**
 * Quick check to see if database has any data at all
 */
export async function checkDatabaseHasData(): Promise<{
  hasProjects: boolean;
  hasPeriods: boolean;
  hasRecords: boolean;
  hasLinks: boolean;
}> {
  const [projectsResult, periodsResult, recordsResult, linksResult] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('periods').select('label', { count: 'exact', head: true }),
    supabase.from('monthly_records').select('id', { count: 'exact', head: true }),
    supabase.from('period_projects').select('project_id', { count: 'exact', head: true })
  ]);

  return {
    hasProjects: (projectsResult.count || 0) > 0,
    hasPeriods: (periodsResult.count || 0) > 0,
    hasRecords: (recordsResult.count || 0) > 0,
    hasLinks: (linksResult.count || 0) > 0
  };
}
