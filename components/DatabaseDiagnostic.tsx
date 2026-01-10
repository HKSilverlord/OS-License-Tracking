import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Wrench } from 'lucide-react';
import { diagnoseDatabaseLinks, checkDatabaseHasData } from '../utils/databaseDiagnostic';

export const DatabaseDiagnostic: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [quickCheck, setQuickCheck] = useState<any>(null);

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

        <div className="flex gap-4 mb-6">
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
