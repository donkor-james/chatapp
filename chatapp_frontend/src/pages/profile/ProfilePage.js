import React, { useState } from 'react';
import useAuthStore from '../../store/authStore';
import Topbar from '../../components/layout/Topbar';
import { Avatar, Button, FormGroup, Input, Alert } from '../../components/ui';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    username:   user?.username   || '',
  });
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);
    const result = await updateProfile(form);
    setLoading(false);
    if (result.success) { setSuccess(true); setEditing(false); }
    else setError('Could not save changes.');
  };

  const fullName = user ? `${user.first_name} ${user.last_name}` : '';

  return (
    <div className={styles.page}>
      <Topbar
        title="Profile"
        actions={
          editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={save} loading={loading}>Save changes</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit profile</Button>
          )
        }
      />

      <div className={styles.scroll}>
        <div className={styles.content}>
          {error   && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">Profile updated.</Alert>}

          <div className={styles.header}>
            <Avatar name={fullName} size="xl" />
            <div>
              <div className={styles.name}>{fullName}</div>
              <div className={styles.handle}>@{user?.username}</div>
            </div>
          </div>

          {editing ? (
            <div className={styles.form}>
              <div className={styles.row}>
                <FormGroup label="First name">
                  <Input value={form.first_name} onChange={f('first_name')} />
                </FormGroup>
                <FormGroup label="Last name">
                  <Input value={form.last_name} onChange={f('last_name')} />
                </FormGroup>
              </div>
              <FormGroup label="Username">
                <Input value={form.username} onChange={f('username')} />
              </FormGroup>
            </div>
          ) : (
            <div className={styles.fields}>
              {[
                ['Email',    user?.email],
                ['Username', `@${user?.username}`],
                ['Name',     fullName],
              ].map(([label, val]) => (
                <div key={label} className={styles.field}>
                  <div className={styles.fieldLabel}>{label}</div>
                  <div className={styles.fieldValue}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
