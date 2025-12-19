import React from 'react';
import Spinner from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', isLoading = false, className, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center px-3 py-1.5 border text-xs font-semibold rounded-sm focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100';

    const variantClasses = {
      primary: 'bg-primary text-primary-text border-transparent hover:bg-primary-hover focus:ring-primary/50',
      secondary: 'bg-secondary text-text-main border-border-color hover:bg-border-color/50 focus:ring-primary/50',
      destructive: 'bg-destructive-bg text-destructive-text border-destructive-border hover:bg-destructive-bg-hover focus:ring-destructive-text/50',
      ghost: 'bg-transparent text-text-secondary border-transparent hover:text-text-main focus:ring-primary/30',
    };

    const disabled = props.disabled || isLoading;

    return (
      <button ref={ref} className={`${baseClasses} ${variantClasses[variant]} ${className}`} disabled={disabled} {...props}>
        {isLoading && <span className="mr-2"><Spinner /></span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;