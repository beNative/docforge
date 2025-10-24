import React from 'react';

export interface HintProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon?: React.ReactNode;
}

const Hint = React.forwardRef<HTMLSpanElement, HintProps>(({ icon, children, className = '', ...rest }, ref) => {
  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1 rounded-full bg-border-color/50 px-2 py-0.5 text-[11px] font-medium text-text-secondary ${className}`.trim()}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
});

Hint.displayName = 'Hint';

export default Hint;
