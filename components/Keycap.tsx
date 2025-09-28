import React from 'react';

export const Keycap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <kbd className="px-2 py-1 text-xs font-semibold text-text-main bg-border-color/50 border border-border-color rounded-md">
      {children}
    </kbd>
  );
};
