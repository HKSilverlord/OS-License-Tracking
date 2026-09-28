import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { UserRoleProvider } from './contexts/UserRoleContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* Motion is decoration here, never information: follow the OS's reduced-motion setting. */}
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <UserRoleProvider>
              <App />
            </UserRoleProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </MotionConfig>
  </React.StrictMode>
);
