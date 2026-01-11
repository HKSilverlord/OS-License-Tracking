
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { dbService } from '../../services/dbService';
import { ProjectStatus } from '../../types';
import { DEFAULT_UNIT_PRICE } from '../../constants';
import { useLanguage } from '../../contexts/LanguageContext';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialCode: string;
    currentPeriod: string;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialCode,
    currentPeriod
}) => {
    const { t } = useLanguage();
    const [newProject, setNewProject] = useState({
        code: '',
        name: '',
        type: '',
        status: ProjectStatus.ACTIVE,
        software: 'AutoCAD',
        unit_price: DEFAULT_UNIT_PRICE
    });

    useEffect(() => {
        if (isOpen) {
            setNewProject(prev => ({ ...prev, code: initialCode }));
        }
    }, [isOpen, initialCode]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.createProject({
                ...newProject,
                period: currentPeriod
            });

            // Reset form
            setNewProject({
                code: '',
                name: '',
                type: '',
                status: ProjectStatus.ACTIVE,
                software: 'AutoCAD',
                unit_price: DEFAULT_UNIT_PRICE
            });

            onSuccess();
            alert(t('alerts.projectCreated', 'Project created successfully!'));
            onClose();
        } catch (err) {
            alert(t('alerts.projectCreateError'));
            console.error(err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">{t('modals.project.title')}</h3>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600" /></button>
                </div>
                <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.code')}</label>
                            <input required readOnly type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed focus:ring-blue-500 focus:border-blue-500" value={newProject.code} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.name')}</label>
                            <input required type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.type')}</label>
                            <input type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.type} onChange={e => setNewProject({ ...newProject, type: e.target.value })} placeholder={t('modals.project.typePlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.software')}</label>
                            <input type="text" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.software} onChange={e => setNewProject({ ...newProject, software: e.target.value })} placeholder={t('modals.project.softwarePlaceholder')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 uppercase mb-1">{t('modals.project.unitPrice')}</label>
                            <input required type="number" className="block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={newProject.unit_price} onChange={e => setNewProject({ ...newProject, unit_price: parseInt(e.target.value) })} />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">{t('modals.actions.cancel')}</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">{t('modals.project.submit')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
