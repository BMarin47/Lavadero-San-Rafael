'use client';

import React from 'react';

interface AppDownloadBadgesProps {
  placement?: 'hero' | 'footer';
  onSimulateClick?: (store: string) => void;
}

export const AppDownloadBadges: React.FC<AppDownloadBadgesProps> = ({
  placement = 'hero',
  onSimulateClick,
}) => {
  const handleStoreClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    store: 'App Store' | 'Google Play'
  ) => {
    if (onSimulateClick) {
      onSimulateClick(store);
    }
  };

  const isHero = placement === 'hero';

  return (
    <div
      className={`w-full ${
        isHero
          ? 'bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg'
          : 'pt-2'
      }`}
    >
      {isHero && (
        <div className="text-center mb-2.5">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider text-blue-400">
            Próximamente en tiendas oficiales
          </span>
          <p className="text-xs text-slate-400 mt-1">
            Optimizá tu experiencia descargando nuestra app nativa:
          </p>
        </div>
      )}

      <div
        className={`grid ${
          isHero ? 'grid-cols-2 gap-2.5' : 'flex flex-wrap items-center justify-center gap-2.5'
        }`}
      >
        {/* Insignia Apple App Store */}
        <a
          href="https://apps.apple.com/app/id000000000?placeholder=true"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleStoreClick(e, 'App Store')}
          className="flex items-center justify-center gap-2.5 px-3 py-2 bg-black hover:bg-neutral-900 border border-neutral-700 rounded-xl text-white shadow transition-all active:scale-95 group"
          aria-label="Descargar en la App Store"
        >
          <svg className="w-5 h-5 fill-current flex-shrink-0" viewBox="0 0 170 170">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.66-7.85-11.92-14.42-6-9.28-10.74-19.8-14.23-31.58-3.48-11.78-5.22-22.9-5.22-33.37 0-14.12 3.69-25.75 11.08-34.89 7.39-9.13 16.63-13.78 27.71-13.95 4.35 0 9.29 1.14 14.82 3.42 5.53 2.28 9.38 3.53 11.55 3.75 1.74-.22 5.79-1.52 12.16-3.9 6.36-2.38 11.72-3.4 16.08-3.05 13.9.76 24.87 5.92 32.9 15.48-12.38 7.5-18.42 17.72-18.12 30.65.3 10.32 4.23 18.9 11.78 25.75 7.55 6.85 16.4 10.7 26.54 11.56-2.5 7.39-5.76 15.11-9.79 23.16zM119.22 31.84c0-7.28 2.61-14.12 7.82-20.53 5.22-6.41 11.73-10.59 19.55-12.55.22 1.3.33 2.5.33 3.59 0 7.39-2.83 14.4-8.47 21.03-5.65 6.63-12.28 10.7-19.89 12.22-.44-1.3-.67-2.55-.67-3.76z" />
          </svg>
          <div className="text-left leading-none">
            <span className="text-[8px] uppercase tracking-wider text-neutral-400 block font-medium">
              Descargar en la
            </span>
            <span className="text-xs font-bold tracking-tight">App Store</span>
          </div>
        </a>

        {/* Insignia Google Play Store */}
        <a
          href="https://play.google.com/store/apps/details?id=com.lavaderosrafael.app&placeholder=true"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleStoreClick(e, 'Google Play')}
          className="flex items-center justify-center gap-2.5 px-3 py-2 bg-black hover:bg-neutral-900 border border-neutral-700 rounded-xl text-white shadow transition-all active:scale-95 group"
          aria-label="Disponible en Google Play"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M3.6 1.7l9.8 9.8-3.4 3.4L3.6 1.7z" />
            <path fill="#4285F4" d="M16.8 8.5L3.6 1.7 13.4 11.5l3.4-3z" />
            <path fill="#FBBC05" d="M16.8 15.5l3.6-2.1c.9-.5.9-1.3 0-1.8l-3.6-2.1-3.4 3 3.4 3z" />
            <path fill="#34A853" d="M3.6 22.3l13.2-6.8-3.4-3.4L3.6 22.3z" />
          </svg>
          <div className="text-left leading-none">
            <span className="text-[8px] uppercase tracking-wider text-neutral-400 block font-medium">
              Disponible en
            </span>
            <span className="text-xs font-bold tracking-tight">Google Play</span>
          </div>
        </a>
      </div>
    </div>
  );
};
