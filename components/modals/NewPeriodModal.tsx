
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { dbService } from '../../services/dbService';
import { Project } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';

const log = createLogger('NewPeriodModal');

interface NewPeriodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newPeriodLabel: string) => void;
    availablePeriods: string[];
    currentPeriod: string;
}

export const NewPeriodModal: React.FC<NewPeriodModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    availablePeriods,
    currentPeriod
}) => {
    const { t } = useLanguage();
    const toast = useToast();
    const [newPeriodInput, setNewPeriodInput] = useState({ year: new Date().getFullYear(), type: 'H1' });
    const [currentPeriodProjects, setCurrentPeriodProjects] = useState<Project[]>([]);
    const [selectedCarryOverIds, setSelectedCarryOverIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // `t` is memoised per language; reading it through a ref keeps the error
    // toast localised without making the fetch depend on the current language.
    const tRef = useRef(t);
    useEffect(() => {
        tRef.current = t;
    }, [t]);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        try {
            log.debug('Fetching all projects for carryover...');
            const allProjects = await dbService.getProjectsForCarryOver();
            setCurrentPeriodProjects(allProjects);
            setSelectedCarryOverIds([]); // Reset selection
        } catch (e) {
            log.error('Failed to fetch projects', e);
            toast.error(tRef.current('alerts.projectsLoadFailed', 'Failed to load projects'));
            setCurrentPeriodProjects([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (isOpen) {
            // Initialize Default Values
            if (currentPeriod) {
                const [yearStr, half] = currentPeriod.split('-');
                const year = parseInt(yearStr);
                if (half === 'H1') {
                    setNewPeriodInput({ year, type: 'H2' });
                } else {
                    setNewPeriodInput({ year: year + 1, type: 'H1' });
                }
            } else {
                setNewPeriodInput({ year: new Date().getFullYear(), type: 'H1' });
            }

            // Fetch Projects
            fetchProjects();
        }
    }, [isOpen, currentPeriod, fetchProjects]);

    const handleCreatePeriod = async (e: React.FormEvent) => {
        e.preventDefault();
        const label = `${newPeriodInput.year}-${newPeriodInput.type}`;

        // Check for duplicate period
        if (availablePeriods.includes(label)) {
            toast.error(t('alerts.duplicatePeriod', 'This period already exists'));
            return;
        }

        try {
            await dbService.addPeriod(label);

            // Handle Carry Over
            if (selectedCarryOverIds.length > 0) {
                await dbService.copyProjectsToPeriod(label, selectedCarryOverIds);
            }

            onSuccess(label);
            toast.success(t('alerts.periodCreated', 'Period created'));
            onClose();
        } catch (e) {
            log.error('Failed to create period', e);
            toast.error(t('alerts.periodCreateFailed', 'Failed to create period'));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('modals.period.title', '新しい期間')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('modals.period.subtitle', 'Create a new period and select projects to include')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content - Scrollable */}
                <form onSubmit={handleCreatePeriod} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Year Input - Full Width */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                {t('modals.period.year', 'Year')}
                            </label>
                            <input
                                type="number"
                                required
                                className="block w-full border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                value={newPeriodInput.year}
                                onChange={e => {
                                    // Clearing the field yields NaN, which would build a "NaN-H1" period label.
                                    const parsed = parseInt(e.target.value, 10);
                                    setNewPeriodInput({ ...newPeriodInput, year: Number.isNaN(parsed) ? new Date().getFullYear() : parsed });
                                }}
                                placeholder="2025"
                            />
                        </div>

                        {/* Period Dropdown - Full Width */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                {t('modals.period.half', 'Period')}
                            </label>
                            <select
                                required
                                className="block w-full border-2 border-slate-300 dark:border-slate-600 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                value={newPeriodInput.type}
                                onChange={e => setNewPeriodInput({ ...newPeriodInput, type: e.target.value })}
                            >
                                <option value="H1">{t('modals.period.option.h1', 'H1 (1月-6月 / Jan-Jun)')}</option>
                                <option value="H2">{t('modals.period.option.h2', 'H2 (7月-12月 / Jul-Dec)')}</option>
                            </select>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                            {/* Projects Selection Header */}
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {t('modals.period.selectProjects', 'Select existing projects')}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {t('modals.period.selectProjectsHint', 'Select existing projects to include in this period')}
                                    </p>
                                </div>
                            </div>

                            {/* Projects List */}
                            <div className="border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900">
                                <div className="max-h-64 overflow-y-auto">
                                    {loading ? (
                                        <div className="text-center py-12 px-4 text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading...')}</div>
                                    ) : currentPeriodProjects.length === 0 ? (
                                        <div className="text-center py-12 px-4">
                                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 mb-4">
                                                <Plus className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-1">
                                                {t('modals.period.noProjects', 'No projects yet')}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {t('modals.period.noProjectsHint', 'Create a project first.')}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {currentPeriodProjects.map(p => (
                                                <label
                                                    key={p.id}
                                                    className="flex items-center space-x-3 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors group"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 w-5 h-5 cursor-pointer"
                                                        checked={selectedCarryOverIds.includes(p.id)}
                                                        onChange={() => {
                                                            setSelectedCarryOverIds(prev =>
                                                                prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                                            );
                                                        }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                                            {p.name}
                                                        </p>
                                                        {p.type && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                                {p.type}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                                                        {p.code}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selection Controls - Inside the border */}
                                {currentPeriodProjects.length > 0 && (
                                    <div className="flex justify-between items-center px-3 py-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-600">
                                        <button
                                            type="button"
                                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                                            onClick={() => {
                                                if (selectedCarryOverIds.length === currentPeriodProjects.length) {
                                                    setSelectedCarryOverIds([]);
                                                } else {
                                                    setSelectedCarryOverIds(currentPeriodProjects.map(p => p.id));
                                                }
                                            }}
                                        >
                                            {selectedCarryOverIds.length === currentPeriodProjects.length ? t('deselectAll', 'Deselect All') : t('selectAll', 'Select All')}
                                        </button>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            {selectedCarryOverIds.length} {t('projectsSelected', 'projects selected')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Submit Button - Fixed at bottom */}
                    <div className="p-6 pt-0">
                        <button
                            type="submit"
                            className="w-full bg-blue-600 dark:bg-blue-500 text-white py-3 rounded-lg text-base font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                        >
                            {t('modals.period.submit', '期間を追加')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
