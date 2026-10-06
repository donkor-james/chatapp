import React, { useEffect } from 'react';
import styles from './ui.module.css';

// ── Avatar ────────────────────────────────────────────────────────────────────
const COLORS = ['#6C63FF','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4'];
const avatarColor = (name = '') => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
};
const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export function Avatar({ name = '', size = 'md', className = '' }) {
  const sizes = { sm: 26, md: 32, lg: 40, xl: 52 };
  const px = sizes[size] || 32;
  return (
    <div
      className={`${styles.avatar} ${className}`}
      style={{
        width: px,
        height: px,
        fontSize: px * 0.38,
        background: avatarColor(name),
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  onClick,
  type = 'button',
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`${styles.btn} ${styles[`btn-${variant}`]} ${styles[`btn-${size}`]} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? <span className={styles.spinner} /> : children}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 440 }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ maxWidth: width }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Form components ───────────────────────────────────────────────────────────
export function FormGroup({ label, children, error }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.formLabel}>{label}</label>}
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`${styles.input} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${styles.input} ${styles.textarea} ${className}`} {...props} />;
}

// ── Pill / Badge ──────────────────────────────────────────────────────────────
export function Pill({ children, variant = 'default' }) {
  return <span className={`${styles.pill} ${styles[`pill-${variant}`]}`}>{children}</span>;
}

export function Badge({ count }) {
  if (!count) return null;
  return <span className={styles.badge}>{count > 99 ? '99+' : count}</span>;
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export function Alert({ children, variant = 'error' }) {
  return <div className={`${styles.alert} ${styles[`alert-${variant}`]}`}>{children}</div>;
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ icon, title, subtitle, action }) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <div className={styles.emptyTitle}>{title}</div>
      {subtitle && <div className={styles.emptySub}>{subtitle}</div>}
      {action}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <div
      className={styles.spinner}
      style={{ width: size, height: size }}
    />
  );
}
