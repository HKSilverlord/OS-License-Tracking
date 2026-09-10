import type { SupportedLanguage } from '../contexts/LanguageContext';
import { ja } from './ja';
import { en } from './en';
import { vn } from './vn';

export const translations: Record<SupportedLanguage, Record<string, string>> = { ja, en, vn };
