import React from 'react';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'default' | 'primary'; children: React.ReactNode; }
export default function Button({ variant = 'default', children, className = '', ...props }: ButtonProps) {
  return <button className={`btn ${variant === 'primary' ? 'btn-primary' : ''} ${className}`} {...props}>{children}</button>;
}
