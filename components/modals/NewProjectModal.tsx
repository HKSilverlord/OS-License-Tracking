
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { dbService } from '../../services/dbService';
import { ProjectStatus } from '../../types';
import { DEFAULT_UNIT_PRICE } from '../../constants';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../src/core/logger';

const log = createLogger('NewProjectModal');

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialCode: string;
    currentPeriod: string;
}

interface NewProjectForm {
    code: string;
    name: string;
    type: string;
    status: ProjectStatus;
    software: string;
    /** JPY per hour used for planned revenue. Written to `projects` AND `period_projects`. */
    plan_price: number;
    /** JPY per hour used for actual revenue. Written to `projects` AND `period_projects`. */
    actual_price: number;
}

const emptyForm = (): NewProjectForm => ({
    code: '',
    name: '',
    type: '',
    status: ProjectStatus.ACTIVE,
    software: 'AutoCAD',
    plan_price: DEFAULT_UNIT_PRICE,
    actual_price: DEFAULT_UNIT_PRICE
});

/** Parses a number input without ever producing NaN. */
const parsePrice = (raw: string): number => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const INPUT_CLASS =
    'block w-full border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm ' +
    'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ' +
    'placeholder:text-slate-400 dark:placeholder:text-slate-500 ' +
    'focus:ring-blue-500 focus:border-blue-500';

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialCode,
    currentPeriod
}) => {
    const { t } = useLanguage();
    const toast = useToast();
    const [newProject, setNewProject] = useState<NewProjectForm>(emptyForm);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setNewProject(prev => ({ ...prev, code: initialCode }));
        }
    }, [isOpen, initialCode]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!(newProject.plan_price > 0)) {
            toast.error(t('modals.project.priceRequired', 'Plan price is required'));
            return;
        }

        setSubmitting(true);
        try {
            await dbService.createProject({
                code: newProject.code,
                name: newProject.name,
                type: newProject.type,
                software: newProject.software,
                status: newProject.status,
                period: currentPeriod,
                plan_price: newProject.plan_price,
                actual_price: newProject.actual_price
            });

            // Reset form
            setNewProject(emptyForm());

            onSuccess();
            toast.success(t('modals.project.created', 'Project created'));
            window.dispatchEvent(new CustomEvent('dataUpdated'));
            onClose();
        } catch (err) {
            log.error('Failed to create project', err);
            toast.error(t('modals.project.createFailed', 'Failed to create project'));
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('modals.project.title')}</h3>
                    <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
                        <X className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" />
                    </button>
                </div>
                <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-1">{t('modals.project.code')}</label>
                            <input required readOnly type="text" className="block w-full border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed focus:ring-blue-500 focus:border-blue-500" value={newProject.code} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-1">{t('modals.project.name')}</label>
                            <input required type="text" className={INPUT_CLASS} value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-1">{t('modals.project.type')}</label>
                            <input type="text" className={INPUT_CLASS} value={newProject.type} onChange={e => setNewProject({ ...newProject, type: e.target.value })} placeholder={t('modals.project.typePlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-1">{t('modals.project.software')}</label>
                            <input type="text" className={INPUT_CLASS} value={newProject.software} onChange={e => setNewProject({ ...newProject, software: e.target.value })} placeholder={t('modals.project.softwarePlaceholder')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="new-project-plan-price" className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-1">{t('modals.project.planPrice', 'Plan price (JPY/h)')}</label>
                            <input
                                id="new-project-plan-price"
                                required
                                type="number"
                                min={0}
                                step={1}
                                className={`${INPUT_CLASS} font-mono`}
                                value={newProject.plan_price}
                                onChange={e => setNewProject({ ...newProject, plan_price: parsePrice(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label htmlFor="new-project-actual-price" className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-1">{t('modals.project.actualPrice', 'Actual price (JPY/h)')}</label>
                            <input
                                id="new-project-actual-price"
                                type="number"
                                min={0}
                                step={1}
                                className={`${INPUT_CLASS} font-mono`}
                                value={newProject.actual_price}
                                onChange={e => setNewProject({ ...newProject, actual_price: parsePrice(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">{t('modals.actions.cancel')}</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed">{t('modals.project.submit')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
