import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Wrench, Database, Search } from 'lucide-react';
import { diagnoseDatabaseLinks, checkDatabaseHasData } from '../utils/databaseDiagnostic';
import { runDetailedDiagnostic, testTrackingViewQuery, testYearlyDataViewQuery, type DetailedDiagnosticResult } from '../utils/detailedDiagnostic';

export const DatabaseDiagnostic: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [quickCheck, setQuickCheck] = useState<any>(null);
  const [detailedResult, setDetailedResult] = useState<DetailedDiagnosticResult | null>(null);
  const [testPeriod, setTestPeriod] = useState('');
  const [testYear, setTestYear] = useState('2025');
  const [queryTest, setQueryTest] = useState<any>(null);

  const runQuickCheck = async () => {
    setRunning(true);
    try {
      const check = await checkDatabaseHasData();
      setQuickCheck(check);
    } catch (error) {
      console.error('Quick check failed:', error);
    } finally {
      setRunning(false);
    }
  };

  const runFullDiagnostic = async () => {
    setRunning(true);
    setResult(null);
    try {
      const diagnosticResult = await diagnoseDatabaseLinks();
      setResult(diagnosticResult);

      // Also run quick check after fix
      const check = await checkDatabaseHasData();
      setQuickCheck(check);
    } catch (error) {
      console.error('Diagnostic failed:', error);
      setResult({ errors: ['Diagnostic failed: ' + (error as any).message] });
    } finally {
      setRunning(false);
    }
  };

  const runDetailedDiagnosticCheck = async () => {
    setRunning(true);
    setDetailedResult(null);
    try {
      const detailed = await runDetailedDiagnostic();
      setDetailedResult(detailed);

      // Auto-populate test fields
      if (detailed.periods.list.length > 0) {
        setTestPeriod(detailed.periods.list[0].label);
      }
    } catch (error) {
      console.error('Detailed diagnostic failed:', error);
    } finally {
      setRunning(false);
    }
  };

  const runQueryTest = async () => {
    setRunning(true);
    setQueryTest(null);
    try {
      const trackingTest = testPeriod ? await testTrackingViewQuery(testPeriod) : null;
      const yearlyTest = testYear ? await testYearlyDataViewQuery(parseInt(testYear)) : null;

      setQueryTest({
        tracking: trackingTest,
        yearly: yearlyTest
      });
    } catch (error) {
      console.error('Query test failed:', error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Wrench className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-800">Database Diagnostic Tool</h2>
        </div>

        <p className="text-slate-600 mb-6">
          This tool checks if your projects are properly linked to periods and fixes any missing links.
          Run this if your tabs are showing no data.
        </p>

        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={runQuickCheck}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
            Quick Check
          </button>

          <button
            onClick={runFullDiagnostic}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            Run Full Diagnostic & Fix
          </button>

          <button
            onClick={runDetailedDiagnosticCheck}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Show Database Content
          </button>
        </div>

        {/* Quick Check Results */}
        {quickCheck && (
          <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Quick Check Results:</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatusItem label="Projects" status={quickCheck.hasProjects} />
              <StatusItem label="Periods" status={quickCheck.hasPeriods} />
              <StatusItem label="Monthly Records" status={quickCheck.hasRecords} />
              <StatusItem label="Period Links" status={quickCheck.hasLinks} />
            </div>
          </div>
        )}

        {/* Full Diagnostic Results */}
        {result && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">Diagnostic Results:</h3>
            <div className="space-y-2 mb-4">
              <ResultRow label="Total Projects" value={result.totalProjects} />
              <ResultRow label="Total Periods" value={result.totalPeriods} />
              <ResultRow label="Projects with Period Field" value={result.projectsWithPeriod} />
              <ResultRow label="Projects Without Links" value={result.projectsWithoutLinks} alert={result.projectsWithoutLinks > 0} />
              <ResultRow label="Links Created" value={result.linksCreated} success={result.linksCreated > 0} />
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {result.errors.map((error: string, index: number) => (
                    <li key={index} className="text-red-600 text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.linksCreated > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2 mt-4">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-700">Success!</p>
                  <p className="text-green-600 text-sm">
                    Created {result.linksCreated} missing period_projects links.
                    Your data should now appear in all tabs. Refresh the page if needed.
                  </p>
                </div>
              </div>
            )}

            {result.projectsWithoutLinks === 0 && result.linksCreated === 0 && result.errors.length === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-700">All Good!</p>
                  <p className="text-blue-600 text-sm">
                    All projects are properly linked to their periods. If you're still not seeing data,
                    make sure you have created some monthly records in the Tracking tab.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detailed Diagnostic Results */}
        {detailedResult && (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 mt-4">
            <h3 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Content Summary
            </h3>

            <div className="space-y-4">
              {/* Projects */}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h4 className="font-medium text-sm text-purple-800 mb-2">
                  Projects: {detailedResult.projects.total}
                </h4>
                {detailedResult.projects.sample.length > 0 ? (
                  <div className="space-y-1 text-xs">
                    {detailedResult.projects.sample.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between gap-2 p-2 bg-slate-50 rounded">
                        <span className="font-mono text-slate-600">{p.code}</span>
                        <span className="text-slate-700 truncate flex-1">{p.name}</span>
                        <span className="text-slate-500">{p.period || 'No period'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">⚠ No projects found!</p>
                )}
              </div>

              {/* Periods */}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h4 className="font-medium text-sm text-purple-800 mb-2">
                  Periods: {detailedResult.periods.total}
                </h4>
                {detailedResult.periods.list.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detailedResult.periods.list.map((p: any, i: number) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {p.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">⚠ No periods found! Create one first.</p>
                )}
              </div>

              {/* Period-Projects Links */}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h4 className="font-medium text-sm text-purple-800 mb-2">
                  Period-Projects Links: {detailedResult.periodProjects.total}
                </h4>
                {detailedResult.periodProjects.total > 0 ? (
                  <div>
                    <div className="text-xs space-y-1 mb-2">
                      {Object.entries(detailedResult.periodProjects.byPeriod).map(([period, count]) => (
                        <div key={period} className="flex justify-between p-1 bg-slate-50 rounded">
                          <span className="text-slate-700">{period}:</span>
                          <span className="font-medium text-slate-900">{count} projects</span>
                        </div>
                      ))}
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-purple-600 hover:text-purple-800">Show sample links</summary>
                      <div className="mt-2 space-y-1">
                        {detailedResult.periodProjects.sample.slice(0, 5).map((pp: any, i: number) => (
                          <div key={i} className="p-2 bg-slate-50 rounded font-mono text-xs">
                            {pp.period_label} → {pp.project_id.substring(0, 8)}...
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : (
                  <p className="text-xs text-red-600">✗ No period-projects links! This is why tabs show nothing.</p>
                )}
              </div>

              {/* Monthly Records */}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h4 className="font-medium text-sm text-purple-800 mb-2">
                  Monthly Records: {detailedResult.monthlyRecords.total}
                </h4>
                {detailedResult.monthlyRecords.total > 0 ? (
                  <div className="text-xs space-y-1">
                    {Object.entries(detailedResult.monthlyRecords.byYear).map(([year, count]) => (
                      <div key={year} className="flex justify-between p-1 bg-slate-50 rounded">
                        <span className="text-slate-700">Year {year}:</span>
                        <span className="font-medium text-slate-900">{count} records</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">⚠ No monthly records. Add data in Tracking tab.</p>
                )}
              </div>

              {/* Errors */}
              {detailedResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <h4 className="font-medium text-sm text-red-800 mb-2">Errors:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {detailedResult.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Query Test Section */}
              <div className="border-t border-purple-200 pt-4 mt-4">
                <h4 className="font-medium text-sm text-purple-800 mb-3">Test Actual Queries:</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Period Label:</label>
                    <input
                      type="text"
                      value={testPeriod}
                      onChange={(e) => setTestPeriod(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      placeholder="e.g. 2025-H1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Year:</label>
                    <input
                      type="text"
                      value={testYear}
                      onChange={(e) => setTestYear(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      placeholder="e.g. 2025"
                    />
                  </div>
                </div>
                <button
                  onClick={runQueryTest}
                  disabled={running}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Test TrackingView & YearlyDataView Queries
                </button>

                {queryTest && (
                  <div className="mt-3 space-y-3">
                    {queryTest.tracking && (
                      <div className="bg-white rounded p-2 border border-slate-200">
                        <h5 className="text-xs font-semibold text-slate-700 mb-1">TrackingView Query ({testPeriod}):</h5>
                        {queryTest.tracking.success ? (
                          <p className="text-xs text-green-600">✓ Success: Found {queryTest.tracking.data?.length || 0} projects</p>
                        ) : (
                          <p className="text-xs text-red-600">✗ Error: {queryTest.tracking.error}</p>
                        )}
                      </div>
                    )}
                    {queryTest.yearly && (
                      <div className="bg-white rounded p-2 border border-slate-200">
                        <h5 className="text-xs font-semibold text-slate-700 mb-1">YearlyDataView Query ({testYear}):</h5>
                        {queryTest.yearly.success ? (
                          <div className="text-xs space-y-1">
                            <p className="text-green-600">✓ Success:</p>
                            <p className="text-slate-600">- Periods: {queryTest.yearly.periods?.length || 0}</p>
                            <p className="text-slate-600">- Projects: {queryTest.yearly.projects?.length || 0}</p>
                            <p className="text-slate-600">- Records: {queryTest.yearly.records?.length || 0}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-red-600">✗ Error: {queryTest.yearly.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusItem: React.FC<{ label: string; status: boolean }> = ({ label, status }) => (
  <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
    <span className="text-sm text-slate-700">{label}</span>
    <div className="flex items-center gap-2">
      {status ? (
        <>
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-xs font-medium text-green-600">Found</span>
        </>
      ) : (
        <>
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-amber-600">Empty</span>
        </>
      )}
    </div>
  </div>
);

const ResultRow: React.FC<{ label: string; value: number; alert?: boolean; success?: boolean }> = ({
  label,
  value,
  alert,
  success
}) => (
  <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
    <span className="text-sm text-slate-700">{label}</span>
    <span className={`text-sm font-semibold ${
      alert ? 'text-amber-600' : success ? 'text-green-600' : 'text-slate-900'
    }`}>
      {value}
    </span>
  </div>
);
