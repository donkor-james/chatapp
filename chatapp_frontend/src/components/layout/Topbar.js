import React from 'react';
import styles from './Topbar.module.css';

export default function Topbar({ title, subtitle, actions }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
