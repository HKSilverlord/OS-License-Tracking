import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Project } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../src/core/logger';
import { resolvePrices } from '../services/pricing';

const log = createLogger('EditProjectModal');

interface EditProjectModalProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Project>) => Promise<void>;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, isOpen, onClose, onSave }) => {
    const { t } = useLanguage();
    const toast = useToast();
    const [formData, setFormData] = useState<Partial<Project>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && project) {
            setFormData({
                name: project.name,
                software: project.software,
                type: project.type,
                plan_price: resolvePrices(null, project).plan,
                actual_price: resolvePrices(null, project).actual,
                exclusion_mark: project.exclusion_mark,
                notes: project.notes
            });
        }
    }, [isOpen, project]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(project.id, formData);
            toast.success(t('editProject.saved', 'Project updated'));
            onClose();
        } catch (error) {
            log.error('Failed to save project', error);
            toast.error(t('editProject.saveFailed', 'Failed to update project'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {t('modal.editProject', 'Edit Project')} - {project.code}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">

                    {/* Company Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('tracker.projectName', 'Company Name')}</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    {/* Software (Multi-line) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('tracker.software', 'Software')}</label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all custom-scrollbar resize-y min-h-[80px]"
                            value={formData.software || ''}
                            onChange={e => setFormData({ ...formData, software: e.target.value })}
                            placeholder={t('editProject.softwarePlaceholder', 'AutoCAD, Revit, etc.')}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('editProject.softwareHint', 'Enter multiple software names, separated by commas or new lines.')}</p>
                    </div>

                    {/* Exclusion & Note */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('tracker.exclusion', 'Exclusion')}</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                value={formData.exclusion_mark || ''}
                                onChange={e => setFormData({ ...formData, exclusion_mark: e.target.value })}
                                placeholder="-"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('tracker.notes', 'Note')}</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                value={formData.notes || ''}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder={t('editProject.notesPlaceholder', 'Notes...')}
                            />
                        </div>
                    </div>

                    {/* Business Content */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('tracker.businessContent', 'Business Content')}</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={formData.type || ''}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                        />
                    </div>

                    {/* Prices Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('details.planPrice', 'Plan Price')} (JPY/h)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-3 py-2 pl-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                                    value={formData.plan_price || 0}
                                    onChange={e => setFormData({ ...formData, plan_price: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('details.actualPrice', 'Actual Price')} (JPY/h)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-3 py-2 pl-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-mono"
                                    value={formData.actual_price || 0}
                                    onChange={e => setFormData({ ...formData, actual_price: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>

                </form>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shadow-sm"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('common.saving', 'Saving...')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {t('common.save', 'Save Changes')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
