import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Button, FormGroup, Input, Alert } from '../../components/ui';
import styles from './Auth.module.css';

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', username: '',
    email: '', password: '', confirm_password: '',
  });
  const [done, setDone] = useState(false);
  const { register, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const f = (k) => (e) => { clearError(); setForm((p) => ({ ...p, [k]: e.target.value })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await register(form);
    if (result.success) setDone(true);
  };

  if (done) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.logo}><span className={styles.logoIcon}>🔊</span>Rooms</div>
          <div className={styles.successIcon}>✉️</div>
          <h1 className={styles.heading}>Check your email</h1>
          <p className={styles.sub}>We sent a verification link to <strong>{form.email}</strong>. Click it to activate your account.</p>
          <Button variant="ghost" size="md" onClick={() => navigate('/login')} className={styles.fullBtn}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}><span className={styles.logoIcon}>🔊</span>Rooms</div>
        <h1 className={styles.heading}>Create your account</h1>
        <p className={styles.sub}>Join live text rooms with people who share your interests.</p>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <div className={styles.row}>
            <FormGroup label="First name">
              <Input placeholder="Ada" value={form.first_name} onChange={f('first_name')} required />
            </FormGroup>
            <FormGroup label="Last name">
              <Input placeholder="Lovelace" value={form.last_name} onChange={f('last_name')} required />
            </FormGroup>
          </div>
          <FormGroup label="Username">
            <Input placeholder="@yourhandle" value={form.username} onChange={f('username')} required />
          </FormGroup>
          <FormGroup label="Email">
            <Input type="email" placeholder="you@example.com" value={form.email} onChange={f('email')} required />
          </FormGroup>
          <FormGroup label="Password">
            <Input type="password" placeholder="••••••••" value={form.password} onChange={f('password')} required />
          </FormGroup>
          <FormGroup label="Confirm password">
            <Input type="password" placeholder="••••••••" value={form.confirm_password} onChange={f('confirm_password')} required />
          </FormGroup>
          <Button type="submit" variant="primary" size="lg" loading={loading} className={styles.fullBtn}>
            Create account
          </Button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
