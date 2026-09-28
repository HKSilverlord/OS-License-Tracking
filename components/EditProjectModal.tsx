import React, { useEffect, useId, useState } from 'react';
import { Project } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { resolvePrices } from '../services/pricing';
import { Button } from './ui/Button';
import { Field, Input, Textarea } from './ui/Field';
import { Modal } from './ui/Modal';

const log = createLogger('EditProjectModal');

interface EditProjectModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Project>) => Promise<void>;
}

const toNumber = (raw: string): number => {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, isOpen, onClose, onSave }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const formId = useId();
  const [formData, setFormData] = useState<Partial<Project>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && project) {
      const prices = resolvePrices(null, project);
      setFormData({
        name: project.name,
        software: project.software,
        type: project.type,
        plan_price: prices.plan,
        actual_price: prices.actual,
        exclusion_mark: project.exclusion_mark,
        notes: project.notes,
      });
    }
  }, [isOpen, project]);

  const update = <K extends keyof Project>(key: K, value: Project[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    <Modal
      open={isOpen}
      onClose={onClose}
      dismissible={!saving}
      title={t('modal.editProject', 'Edit project')}
      description={<span className="font-mono">{project.code}</span>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form={formId} isLoading={saving}>
            {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('tracker.projectName', 'Company name')}>
          {id => (
            <Input
              id={id}
              required
              autoComplete="off"
              value={formData.name ?? ''}
              onChange={event => update('name', event.target.value)}
            />
          )}
        </Field>

        <Field label={t('tracker.businessContent', 'Business content')}>
          {id => (
            <Input
              id={id}
              autoComplete="off"
              value={formData.type ?? ''}
              onChange={event => update('type', event.target.value)}
            />
          )}
        </Field>

        <Field
          label={t('tracker.software', 'Software')}
          hint={t('editProject.softwareHint', 'Separate several with commas or new lines.')}
        >
          {id => (
            <Textarea
              id={id}
              value={formData.software ?? ''}
              onChange={event => update('software', event.target.value)}
              placeholder={t('editProject.softwarePlaceholder', 'AutoCAD, Revit, …')}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label={t('tracker.exclusion', 'Excl.')}>
            {id => (
              <Input
                id={id}
                autoComplete="off"
                value={formData.exclusion_mark ?? ''}
                onChange={event => update('exclusion_mark', event.target.value)}
                placeholder="—"
              />
            )}
          </Field>
          <Field label={t('tracker.notes', 'Notes')}>
            {id => (
              <Input
                id={id}
                autoComplete="off"
                value={formData.notes ?? ''}
                onChange={event => update('notes', event.target.value)}
                placeholder={t('editProject.notesPlaceholder', 'Optional')}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('details.planPrice', 'Plan price')} aside={t('unit.yenPerHour', 'JPY/h')}>
            {id => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                className="text-right tabular-nums no-spinner"
                value={formData.plan_price ?? 0}
                onChange={event => update('plan_price', toNumber(event.target.value))}
              />
            )}
          </Field>
          <Field label={t('details.actualPrice', 'Actual price')} aside={t('unit.yenPerHour', 'JPY/h')}>
            {id => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                className="text-right tabular-nums no-spinner"
                value={formData.actual_price ?? 0}
                onChange={event => update('actual_price', toNumber(event.target.value))}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
};
