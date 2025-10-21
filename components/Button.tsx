import React from 'react';
import Spinner from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  isLoading?: boolean;
  size?: 'sm' | 'md';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', isLoading = false, size = 'md', className = '', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center border font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150';
    
    const variantClasses = {
      primary: 'bg-primary text-primary-text border-transparent hover:bg-primary-hover focus:ring-primary',
      secondary: 'bg-secondary text-text-main border-border-color hover:bg-border-color focus:ring-primary',
      destructive: 'bg-destructive-bg text-destructive-text border-destructive-border hover:bg-destructive-bg-hover focus:ring-destructive-text',
      ghost: 'bg-transparent text-text-main border-transparent hover:bg-border-color focus:ring-primary',
    };

    const sizeClasses: Record<typeof size, string> = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-xs',
    };

    const disabled = props.disabled || isLoading;

    return (
      <button ref={ref} className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} disabled={disabled} {...props}>
        {isLoading && <span className="mr-2"><Spinner /></span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;