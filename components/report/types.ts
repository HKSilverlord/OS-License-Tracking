import type { ReportContent, ReportFigures } from '../../utils/reportModel';

/** Applies one change to the draft being edited. */
export type ReportEdit = (update: (content: ReportContent) => ReportContent) => void;

export interface ReportSectionProps {
  figures: ReportFigures;
  content: ReportContent;
  /** Present while an admin is editing: the section shows fields instead of text. */
  onEdit?: ReportEdit;
  /**
   * False while the written parts are unavailable (still loading, not loadable,
   * or no table to hold them): the section shows its figures only.
   */
  written?: boolean;
}
