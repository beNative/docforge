import React, { createContext } from 'react';

type IconSet = 'heroicons' | 'lucide' | 'feather' | 'tabler' | 'material';

interface IconContextType {
  iconSet: IconSet;
}

export const IconContext = createContext<IconContextType | undefined>(undefined);

export const IconProvider: React.FC<{ children: React.ReactNode; value: IconContextType }> = ({ children, value }) => {
  return (
    <IconContext.Provider value={value}>
      {children}
    </IconContext.Provider>
  );
};
