import React, { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { dbService } from '../../services/dbService';
import { Project, ProjectStatus } from '../../types';
import { DEFAULT_UNIT_PRICE } from '../../constants';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { describePeriod } from '../../utils/period';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

const log = createLogger('NewProjectModal');

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the created project, so the caller can show it. */
  onSuccess: (project: Project) => void;
  /** Shown for reference; empty means the service assigns one on save. */
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
  actual_price: DEFAULT_UNIT_PRICE,
});

/** Parses a number input without ever producing NaN. */
const parsePrice = (raw: string): number => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCode,
  currentPeriod,
}) => {
  const { t } = useLanguage();
  const toast = useToast();
  const formId = useId();
  const planPriceRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [priceMissing, setPriceMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // A draft left by closing the dialog is kept; only the code is refreshed.
  useEffect(() => {
    if (isOpen) setForm(prev => ({ ...prev, code: initialCode }));
  }, [isOpen, initialCode]);

  const update = <K extends keyof NewProjectForm>(key: K, value: NewProjectForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      // `required` lets a name of only spaces through: empty it, and the browser asks for one.
      const formElement = event.currentTarget;
      flushSync(() => update('name', ''));
      formElement.reportValidity();
      return;
    }
    if (!(form.plan_price > 0)) {
      setPriceMissing(true);
      planPriceRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const created = await dbService.createProject({
        code: form.code,
        name: form.name.trim(),
        type: form.type.trim(),
        software: form.software.trim(),
        status: form.status,
        period: currentPeriod,
        plan_price: form.plan_price,
        actual_price: form.actual_price,
      });

      setForm(emptyForm());
      onSuccess(created);
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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      dismissible={!submitting}
      title={t('modals.project.title', 'New project')}
      description={
        <>
          {t('modals.project.addsTo', 'Adds to {period}').replace('{period}', describePeriod(currentPeriod, t))}
          {form.code && <span className="font-mono text-slate-400 dark:text-slate-500"> · {form.code}</span>}
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form={formId} isLoading={submitting}>
            {t('modals.project.submit', 'Create project')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('modals.project.name', 'Company name')}>
          {id => (
            <Input
              id={id}
              required
              autoComplete="off"
              value={form.name}
              onChange={event => update('name', event.target.value)}
            />
          )}
        </Field>

        <Field label={t('modals.project.type', 'Business content')}>
          {id => (
            <Input
              id={id}
              autoComplete="off"
              value={form.type}
              onChange={event => update('type', event.target.value)}
              placeholder={t('modals.project.typePlaceholder', 'Mechanical design')}
            />
          )}
        </Field>

        <Field
          label={t('modals.project.software', 'Software')}
          hint={t('editProject.softwareHint', 'Separate several with commas or new lines.')}
        >
          {id => (
            <Textarea
              id={id}
              rows={2}
              className="min-h-[64px]"
              value={form.software}
              onChange={event => update('software', event.target.value)}
              placeholder={t('editProject.softwarePlaceholder', 'AutoCAD, Revit, …')}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('details.planPrice', 'Plan price')}
            aside={t('unit.yenPerHour', 'JPY/h')}
            error={priceMissing ? t('modals.project.priceRequired', 'Enter a plan price above zero.') : undefined}
          >
            {id => (
              <Input
                ref={planPriceRef}
                id={id}
                required
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="text-right tabular-nums no-spinner"
                aria-invalid={priceMissing || undefined}
                value={form.plan_price}
                onChange={event => {
                  update('plan_price', parsePrice(event.target.value));
                  setPriceMissing(false);
                }}
              />
            )}
          </Field>
          <Field label={t('details.actualPrice', 'Actual price')} aside={t('unit.yenPerHour', 'JPY/h')}>
            {id => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="text-right tabular-nums no-spinner"
                value={form.actual_price}
                onChange={event => update('actual_price', parsePrice(event.target.value))}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
};
