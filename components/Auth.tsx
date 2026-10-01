import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { SUPPORTED_LANGUAGES, useLanguage } from '../contexts/LanguageContext';
import type { SupportedLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { createLogger } from '../utils/logger';
import { AppIcon } from './ui/AppIcon';
import { Button } from './ui/Button';
import { cardClasses } from './ui/Card';
import { Field, Input } from './ui/Field';
import { SegmentedControl } from './ui/SegmentedControl';

const log = createLogger('Auth');

/**
 * What went wrong, said the way a person would say it. Supabase's own messages
 * ("Invalid login credentials") are English-only and written for developers.
 * Kept as a key and worded when shown, so the message follows a language change.
 */
const SIGN_IN_ERRORS = {
  invalid: ['auth.error.invalid', "That email and password don't match. Check both and try again."],
  unconfirmed: ['auth.error.unconfirmed', 'This account has not been confirmed yet. Ask an administrator to confirm it.'],
  rateLimited: ['auth.error.rateLimited', 'Too many attempts. Wait a minute, then try again.'],
  network: ['auth.error.network', "Can't reach the server. Check your connection and try again."],
  generic: ['auth.error.generic', "Sign-in didn't work. Try again, or ask an administrator for help."],
} as const;

type SignInError = keyof typeof SIGN_IN_ERRORS;

const classifySignInError = (error: unknown): SignInError => {
  const { code, status, message, name } = (error ?? {}) as {
    code?: string;
    status?: number;
    message?: string;
    name?: string;
  };
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message ?? '')) return 'invalid';
  if (code === 'email_not_confirmed') return 'unconfirmed';
  if (status === 429 || code === 'over_request_rate_limit') return 'rateLimited';
  if (name === 'AuthRetryableFetchError' || /fetch|network/i.test(message ?? '') || !navigator.onLine) return 'network';
  return 'generic';
};

/**
 * The front door. One card, two fields, one button — and the language picker
 * in the corner, because the first person to see this page may not read
 * Japanese.
 */
export const Auth: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // A phone keyboard popping up before the page has even been read is rude;
  // on a desktop the caret belongs in the first field.
  const [autoFocusEmail] = useState(() => window.matchMedia('(min-width: 640px)').matches);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      // The session listener in useAuthSession switches to the app.
    } catch (err) {
      log.error('Sign-in failed', err);
      setError(classifySignInError(err));
      passwordRef.current?.select();
    } finally {
      setLoading(false);
    }
  };

  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* A soft light from above: the only decoration on the page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_55%_60%_at_50%_0%,rgb(59_130_246/0.14),transparent)] dark:bg-[radial-gradient(ellipse_55%_60%_at_50%_0%,rgb(59_130_246/0.2),transparent)]"
      />

      <div className="relative flex justify-end p-4 sm:p-6">
        <SegmentedControl<SupportedLanguage>
          size="sm"
          ariaLabel={t('language.select', 'Select language')}
          value={language}
          onChange={setLanguage}
          options={SUPPORTED_LANGUAGES.map(({ code, label }) => ({ value: code, label }))}
          className="bg-slate-200/60 dark:bg-slate-800/80"
        />
      </div>

      <main className="relative flex justify-center px-4 pb-24 pt-[6vh] sm:pt-[10vh]">
        <div className="w-full max-w-[380px] animate-fade-up">
          <div className="mb-8 text-center">
            <AppIcon size={56} className="mx-auto mb-5 drop-shadow-[0_10px_24px_rgb(37_99_235/0.35)]" />
            <h1 className="text-[28px] font-bold leading-9 tracking-tight text-slate-900 dark:text-white">
              {t('app.title', 'OS Manager')}
            </h1>
            <p className="mt-1.5 text-[15px] text-slate-500 dark:text-slate-400">
              {t('auth.welcome', 'Sign in to continue')}
            </p>
          </div>

          <div className={`${cardClasses} p-6 sm:p-7`}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-[15px] leading-6 text-rose-700 animate-fade-in dark:bg-rose-500/10 dark:text-rose-300"
                >
                  <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{t(SIGN_IN_ERRORS[error][0], SIGN_IN_ERRORS[error][1])}</p>
                </div>
              )}

              <Field label={t('auth.email', 'Email')}>
                {id => (
                  <Input
                    id={id}
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    autoFocus={autoFocusEmail}
                    controlSize="lg"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="name@esuhai.com"
                  />
                )}
              </Field>

              <Field
                label={t('auth.password', 'Password')}
                hint={capsLock ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {t('auth.capsLock', 'Caps Lock is on')}
                  </span>
                ) : undefined}
              >
                {id => (
                  <div className="relative">
                    <Input
                      ref={passwordRef}
                      id={id}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      controlSize="lg"
                      className="pr-11"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      onKeyDown={trackCapsLock}
                      onKeyUp={trackCapsLock}
                      onBlur={() => setCapsLock(false)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(shown => !shown)}
                      aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                      aria-pressed={showPassword}
                      title={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                      className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      {showPassword
                        ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
                        : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
                    </button>
                  </div>
                )}
              </Field>

              <Button
                type="submit"
                size="lg"
                isLoading={loading}
                className="mt-2 w-full"
              >
                {loading ? t('auth.signingIn', 'Signing in…') : t('auth.signIn', 'Sign in')}
                {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </form>
          </div>

          <p className="mx-auto mt-6 max-w-[320px] text-center text-sm leading-5 text-slate-500 dark:text-slate-400">
            {t('auth.adminHint', 'Accounts are created by an administrator. If you need access, ask yours.')}
          </p>
        </div>
      </main>

      <p className="absolute inset-x-0 bottom-0 pb-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
        {t('app.subtitle', 'Esuhai Group')}
      </p>
    </div>
  );
};
