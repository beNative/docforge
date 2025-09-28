import React from 'react';

export const Keycap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <kbd className="px-1.5 py-0.5 text-xs font-semibold text-text-main bg-border-color/50 border border-border-color rounded-md">
      {children}
    </kbd>
  );
};