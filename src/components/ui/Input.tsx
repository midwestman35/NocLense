import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; }
export default function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div style={{ marginBottom: 'var(--spacing-md)' }}>
      {label && <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>{label}</label>}
      <input className={`input ${className}`} {...props} />
    </div>
  );
}
