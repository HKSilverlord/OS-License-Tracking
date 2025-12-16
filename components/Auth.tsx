
import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const Auth: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
        onLogin();
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md border-t-4 border-blue-600">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">{t('app.title')}</h1>
          <p className="text-slate-500 mt-2">{t('auth.subtitle')}</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 mb-4">
             <p>{t('auth.info')}</p>
          </div>

          <div>
             <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 transition-colors"
             >
                {loading ? (
                    t('auth.loading')
                ) : (
                    <>
                        <User className="w-4 h-4 mr-2" />
                        {t('auth.button')}
                    </>
                )}
             </button>
          </div>
        </form>
        <div className="mt-6 text-center text-xs text-gray-400">
          v1.0.0 Local
        </div>
      </div>
    </div>
  );
};
