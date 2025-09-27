import React from 'react';
import Spinner from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', isLoading = false, className, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center px-4 py-2 border text-sm font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150';
    
    const variantClasses = {
      primary: 'bg-primary text-primary-text border-transparent hover:bg-primary-hover focus:ring-primary',
      secondary: 'bg-secondary text-text-main border-border-color hover:bg-border-color focus:ring-primary',
      destructive: 'bg-destructive-bg text-destructive-text border-destructive-border hover:bg-destructive-bg-hover focus:ring-destructive-text',
      ghost: 'bg-transparent text-text-main border-transparent hover:bg-border-color focus:ring-primary',
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