import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'cyber';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }[size];

  const variantStyles = {
    primary:
      'bg-cyan-500 hover:bg-cyan-400 text-cyber-950 font-semibold shadow-cyan-glow border border-cyan-300',
    cyber:
      'bg-cyber-800 hover:bg-cyber-700 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 shadow-panel-edge',
    secondary:
      'bg-cyber-800 hover:bg-cyber-700 text-cyber-100 border border-cyber-700 hover:border-cyber-600',
    danger:
      'bg-red-600 hover:bg-red-500 text-white shadow-red-glow border border-red-400',
    outline:
      'bg-transparent hover:bg-cyber-800/60 text-cyber-200 border border-cyber-700 hover:border-cyber-500',
    ghost:
      'bg-transparent hover:bg-cyber-800/50 text-cyber-300 hover:text-cyber-100',
  }[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded transition-all duration-150 select-none font-medium disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};
