import React, { useState, useRef } from 'react';
import { Download, Check, Copy } from 'lucide-react';
import { copyChartToClipboard } from '../utils/chartExport';
import { useLanguage } from '../contexts/LanguageContext';

interface ExportSection {
    id: string;
    labelKey: string;
    defaultLabel: string;
}

interface SectionExportMenuProps {
    sections: ExportSection[];
    className?: string;
}

export const SectionExportMenu: React.FC<SectionExportMenuProps> = ({
    sections,
    className = ''
}) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copyingId, setCopyingId] = useState<string | null>(null);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isOpen && !target.closest('.section-export-menu')) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);


    // The 2s "Copied!" reset must not fire into an unmounted component: the menu
    // lives on views the user can navigate away from mid-countdown.
    React.useEffect(() => () => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    }, []);

    const handleCopy = async (sectionId: string) => {
        // A capture takes seconds; without this a second click queued another one.
        if (copyingId) return;
        setCopyingId(sectionId);
        // Called before any await so the clipboard write stays inside the click.
        const ok = await copyChartToClipboard(sectionId).finally(() => setCopyingId(null));
        if (!ok) {
            // copyChartToClipboard already raised the error toast; just close.
            setIsOpen(false);
            return;
        }
        setCopiedId(sectionId);
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
            setCopiedId(null);
            setIsOpen(false);
        }, 2000);
    };

    return (
        <div data-html2canvas-ignore="true" className={`relative inline-block text-left section-export-menu ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
                <Download className="w-4 h-4" />
                <span>{t('export.sections', 'Export Section')}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 ring-1 ring-black/5 dark:ring-white/10 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    <div className="py-2" role="menu">
                        <div className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                            {t('export.copyAsImage', 'Copy to Clipboard')}
                        </div>
                        <div className="max-h-80 overflow-y-auto p-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => handleCopy(section.id)}
                                    disabled={copyingId !== null}
                                    className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center justify-between transition-colors group disabled:opacity-60"
                                    role="menuitem"
                                >
                                    <span className="font-medium">{t(section.labelKey, section.defaultLabel)}</span>
                                    {copiedId === section.id ? (
                                        <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
