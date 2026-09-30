import { useCallback, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNumberFormat } from '../../hooks/useNumberFormat';

export interface ReportFormat {
  /** `4,644h`, as the Dashboard writes hours. */
  hours: (value: number) => string;
  /** Revenue in 万 with one decimal: `1,168.0万円` in Japanese, `1,168.0万` elsewhere. */
  man: (yen: number) => string;
  /** The full amount: `¥11,680,000`. */
  yen: (value: number) => string;
  /** A fraction as a percentage with one decimal: `34.4%`. */
  percent: (fraction: number) => string;
  /** A whole number in the language's grouping. */
  count: (value: number) => string;
  /** `9月`, `September`, `Tháng 9`. */
  monthName: (month: number) => string;
  /** `2026-09-28` as a long date in the interface language. */
  date: (iso: string) => string;
}

/** Numbers and dates for the report, in the interface language (never the browser's). */
export function useReportFormat(): ReportFormat {
  const { language, t } = useLanguage();
  const { localeTag, format, formatDecimal, formatYen } = useNumberFormat();

  const longMonth = useMemo(() => new Intl.DateTimeFormat(localeTag, { month: 'long' }), [localeTag]);
  const longDate = useMemo(() => new Intl.DateTimeFormat(localeTag, { dateStyle: 'long' }), [localeTag]);

  const manTemplate = t('report.unit.manYen', '{value}{man}');
  const manUnit = t('catia.manYenUnit', '万');

  const man = useCallback(
    (yen: number) => manTemplate.replace('{value}', formatDecimal(yen / 10000)).replace('{man}', manUnit),
    [manTemplate, manUnit, formatDecimal],
  );

  const monthName = useCallback((month: number) => {
    if (language === 'ja') return `${month}月`;
    if (language === 'vn') return `Tháng ${month}`;
    return longMonth.format(new Date(2000, month - 1, 1));
  }, [language, longMonth]);

  const date = useCallback((iso: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return iso;
    return longDate.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }, [longDate]);

  return {
    hours: useCallback((value: number) => `${format(Math.round(value))}h`, [format]),
    man,
    yen: formatYen,
    percent: useCallback((fraction: number) => `${formatDecimal(fraction * 100)}%`, [formatDecimal]),
    count: format,
    monthName,
    date,
  };
}
