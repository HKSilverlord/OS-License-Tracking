import React, { useState } from 'react';
import { Download, Copy, Image as ImageIcon, FileSpreadsheet, MoreVertical, Check } from 'lucide-react';
import { exportChartToSVG, exportChartToPNG, exportChartDataToCSV, generateChartFilename, copyChartToClipboard } from '../utils/chartExport';
import { useLanguage } from '../contexts/LanguageContext';

interface ChartExportMenuProps {
    chartId: string;
    filenameRequest: string; // Base filename without extension
    data?: any[]; // Data for CSV export
    onExport?: () => void;
    className?: string;
    hideLabel?: boolean; // If true, only shows icon
}

export const ChartExportMenu: React.FC<ChartExportMenuProps> = ({
    chartId,
    filenameRequest,
    data,
    onExport,
    className = '',
    hideLabel = false
}) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Close menu when clicking outside - simple implementation
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isOpen && !target.closest('.chart-export-menu')) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleCopy = async () => {
        await copyChartToClipboard(chartId);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
            setIsOpen(false);
        }, 2000);
    };

    const handleExportPNG = () => {
        exportChartToPNG(chartId, generateChartFilename(filenameRequest, 'png'));
        setIsOpen(false);
        onExport?.();
    };

    const handleExportSVG = () => {
        exportChartToSVG(chartId, generateChartFilename(filenameRequest, 'svg'));
        setIsOpen(false);
        onExport?.();
    };

    const handleExportCSV = () => {
        if (data) {
            exportChartDataToCSV(data, generateChartFilename(`${filenameRequest}_data`, 'csv'));
        }
        setIsOpen(false);
        onExport?.();
    };

    return (
        <div className={`relative inline-block text-left chart-export-menu ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                title={t('buttons.export', 'Export')}
            >
                <Download className="w-4 h-4" />
                {!hideLabel && <span>{t('buttons.export', 'Export')}</span>}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-slate-900 rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/10 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            {t('export.options', 'Export Options')}
                        </div>

                        <button
                            onClick={handleCopy}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-3 transition-colors"
                            role="menuitem"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? t('export.copied', 'Copied!') : t('export.copyImage', 'Copy Image')}</span>
                        </button>

                        <button
                            onClick={handleExportPNG}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-3 transition-colors"
                            role="menuitem"
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span>{t('export.savePNG', 'Save as PNG')}</span>
                        </button>

                        <button
                            onClick={handleExportSVG}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-3 transition-colors"
                            role="menuitem"
                        >
                            <MoreVertical className="w-4 h-4 rotate-90" />
                            <span>{t('export.saveSVG', 'Save as SVG')}</span>
                        </button>

                        {data && (
                            <>
                                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                                <button
                                    onClick={handleExportCSV}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-3 transition-colors"
                                    role="menuitem"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    <span>{t('export.downloadData', 'Download Excel/CSV')}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
