import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Button, FormGroup, Input, Alert } from '../../components/ui';
import styles from './Auth.module.css';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [twoFA, setTwoFA] = useState(null); // { tempToken }
  const [code, setCode] = useState('');
  const { login, verify2FA, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const f = (k) => (e) => { clearError(); setForm((p) => ({ ...p, [k]: e.target.value })); };

  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await login(form);
    if (result.requires2FA) setTwoFA({ tempToken: result.tempToken });
    else if (result.success) navigate('/');
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    const result = await verify2FA({ code, tempToken: twoFA.tempToken });
    if (result.success) navigate('/');
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🔊</span>
          Rooms
        </div>

        {!twoFA ? (
          <>
            <h1 className={styles.heading}>Welcome back</h1>
            <p className={styles.sub}>Sign in to join the conversation.</p>

            {error && <Alert variant="error">{error}</Alert>}

            <form onSubmit={handleLogin}>
              <FormGroup label="Email">
                <Input type="email" placeholder="you@example.com" value={form.email} onChange={f('email')} required autoFocus />
              </FormGroup>
              <FormGroup label="Password">
                <Input type="password" placeholder="••••••••" value={form.password} onChange={f('password')} required />
              </FormGroup>
              <Button type="submit" variant="primary" size="lg" loading={loading} className={styles.fullBtn}>
                Sign in
              </Button>
            </form>

            <p className={styles.switch}>
              Don't have an account? <Link to="/register">Sign up</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Two-factor verification</h1>
            <p className={styles.sub}>Check your email for a 6-digit code.</p>

            {error && <Alert variant="error">{error}</Alert>}

            <form onSubmit={handle2FA}>
              <FormGroup label="Verification code">
                <Input
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  autoFocus
                />
              </FormGroup>
              <Button type="submit" variant="primary" size="lg" loading={loading} className={styles.fullBtn}>
                Verify
              </Button>
            </form>

            <p className={styles.switch}>
              <button onClick={() => setTwoFA(null)}>← Back to login</button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
