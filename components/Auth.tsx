
import React, { useState } from 'react';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Button } from '../src/ui/components/Button';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      // Auth state change in App.tsx will handle the redirect/view switch
    } catch (err) {
      const error = err as Error;
      console.error('Login error:', error);
      setError(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  // Generate public URLs from Supabase storage
  const logoUrl = supabase.storage.from('public').getPublicUrl('logo.png').data.publicUrl;
  const bgUrl = supabase.storage.from('public').getPublicUrl('auth-bg.jpg').data.publicUrl;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Left Panel - Branding (Hidden on small screens) */}
      <div className="hidden md:flex flex-col flex-1 bg-slate-950 text-white relative overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950" />
          <img src={bgUrl} alt="Background" className="w-full h-full object-cover mix-blend-overlay" onError={(e) => e.currentTarget.style.display = 'none'} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-start h-full p-16 lg:p-24">
          <img 
            src={logoUrl} 
            alt="Company Logo" 
            className="h-12 mb-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              // Fallback if logo fails to load
              e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', `<div class="h-12 w-12 bg-blue-600 rounded-lg mb-auto flex items-center justify-center font-bold text-xl">OS</div>`);
            }}
          />
          
          <div className="mb-20">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 text-white text-balance leading-tight">
              Manage your engineering projects with precision.
            </h1>
            <p className="text-lg text-slate-300 max-w-lg text-balance">
              Streamline operations, track period profitability, and manage license allocation—all in one place.
            </p>
          </div>
          
          <div className="mt-auto">
            <p className="text-sm font-medium text-slate-400">OS Management System v2.0</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="w-full max-w-sm space-y-8 animate-fade-up">
          <div className="text-center md:text-left">
            {/* Mobile Logo Fallback */}
            <div className="md:hidden flex justify-center mb-6">
              <img src={logoUrl} alt="Logo" className="h-10" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t('app.title')}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('auth.subtitle')}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 p-4 rounded-xl flex items-start text-sm">
                <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all sm:text-sm"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              isLoading={loading}
              className="w-full h-12 text-base font-semibold"
            >
              {t('auth.button')}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 md:hidden pt-8">
            OS Management System v2.0
          </p>
        </div>
      </div>
    </div>
  );
};
