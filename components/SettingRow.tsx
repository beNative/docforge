import React from 'react';

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
  htmlFor?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, children, htmlFor }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 items-start gap-x-8 gap-y-3">
      <div className="md:col-span-1">
        <label htmlFor={htmlFor} className="font-semibold text-text-main leading-tight cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-text-secondary mt-1">{description}</p>
      </div>
      <div className="md:col-span-2 flex justify-start md:justify-end items-center w-full">
        {children}
      </div>
    </div>
  );
};

export default SettingRow;