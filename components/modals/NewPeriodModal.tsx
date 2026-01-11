
import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { dbService } from '../../services/dbService';
import { useLanguage } from '../../contexts/LanguageContext';

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
    const [newPeriodInput, setNewPeriodInput] = useState({ year: new Date().getFullYear(), type: 'H1' });
    const [currentPeriodProjects, setCurrentPeriodProjects] = useState<any[]>([]);
    const [selectedCarryOverIds, setSelectedCarryOverIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

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
    }, [isOpen, currentPeriod]);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            console.log('[DEBUG NewPeriodModal] Fetching all projects for carryover...');
            const allProjects = await dbService.getProjectsForCarryOver();
            setCurrentPeriodProjects(allProjects);
            setSelectedCarryOverIds([]); // Reset selection
        } catch (e) {
            console.error("[DEBUG NewPeriodModal] Failed to fetch projects", e);
            alert(`Error fetching projects: ${e instanceof Error ? e.message : 'Unknown error'}. Check console for details.`);
            setCurrentPeriodProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePeriod = async (e: React.FormEvent) => {
        e.preventDefault();
        const label = `${newPeriodInput.year}-${newPeriodInput.type}`;

        // Check for duplicate period
        if (availablePeriods.includes(label)) {
            alert(t('alerts.duplicatePeriod', `Period ${label} already exists. Please select a different year or half.`));
            return;
        }

        try {
            await dbService.addPeriod(label);

            // Handle Carry Over
            if (selectedCarryOverIds.length > 0) {
                await dbService.copyProjectsToPeriod(label, selectedCarryOverIds);
            }

            onSuccess(label);
            alert(t('alerts.periodCreated', `Period ${label} created successfully!`));
            onClose();
        } catch (e) {
            console.error(e);
            alert('Failed to create period');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{t('modals.period.title', '新しい期間')}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Create a new period and select projects to include</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content - Scrollable */}
                <form onSubmit={handleCreatePeriod} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Year Input - Full Width */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {t('modals.period.year', 'Year')}
                            </label>
                            <input
                                type="number"
                                required
                                className="block w-full border-2 border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                value={newPeriodInput.year}
                                onChange={e => setNewPeriodInput({ ...newPeriodInput, year: parseInt(e.target.value) })}
                                placeholder="2025"
                            />
                        </div>

                        {/* Period Dropdown - Full Width */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {t('modals.period.half', 'Period')}
                            </label>
                            <select
                                required
                                className="block w-full border-2 border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-white"
                                value={newPeriodInput.type}
                                onChange={e => setNewPeriodInput({ ...newPeriodInput, type: e.target.value })}
                            >
                                <option value="H1">{t('modals.period.option.h1', 'H1 (1月-6月 / Jan-Jun)')}</option>
                                <option value="H2">{t('modals.period.option.h2', 'H2 (7月-12月 / Jul-Dec)')}</option>
                            </select>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200 pt-6">
                            {/* Projects Selection Header */}
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700">
                                        既存プロジェクトを選択
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Select existing projects to include in this period
                                    </p>
                                </div>
                            </div>

                            {/* Projects List */}
                            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                                <div className="max-h-64 overflow-y-auto">
                                    {loading ? (
                                        <div className="text-center py-12 px-4 text-gray-500">Loading projects...</div>
                                    ) : currentPeriodProjects.length === 0 ? (
                                        <div className="text-center py-12 px-4">
                                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-4">
                                                <Plus className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <p className="text-sm text-gray-600 font-medium mb-1">
                                                プロジェクトがまだありません
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                先にプロジェクトを作成してください。
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-200">
                                            {currentPeriodProjects.map(p => (
                                                <label
                                                    key={p.id}
                                                    className="flex items-center space-x-3 p-3 hover:bg-blue-50 cursor-pointer transition-colors group"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                                                        checked={selectedCarryOverIds.includes(p.id)}
                                                        onChange={() => {
                                                            setSelectedCarryOverIds(prev =>
                                                                prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                                            );
                                                        }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
                                                            {p.name}
                                                        </p>
                                                        {p.type && (
                                                            <p className="text-xs text-gray-500 truncate">
                                                                {p.type}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-mono text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                                        {p.code}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selection Controls - Inside the border */}
                                {currentPeriodProjects.length > 0 && (
                                    <div className="flex justify-between items-center px-3 py-2 bg-gray-100 border-t border-gray-300">
                                        <button
                                            type="button"
                                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                            onClick={() => {
                                                if (selectedCarryOverIds.length === currentPeriodProjects.length) {
                                                    setSelectedCarryOverIds([]);
                                                } else {
                                                    setSelectedCarryOverIds(currentPeriodProjects.map(p => p.id));
                                                }
                                            }}
                                        >
                                            {selectedCarryOverIds.length === currentPeriodProjects.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                        <span className="text-sm font-semibold text-gray-700">
                                            {selectedCarryOverIds.length} selected
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
                            className="w-full bg-blue-600 text-white py-3 rounded-lg text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md hover:shadow-lg"
                        >
                            {t('modals.period.submit', '期間を追加')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
