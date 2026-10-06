import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useRoomsStore from '../../store/roomsStore';
import useAuthStore from '../../store/authStore';
import { Button, Spinner, Alert } from '../../components/ui';
import styles from './JoinRoomPage.module.css';

export default function JoinRoomPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { joinRoom } = useRoomsStore();
  
  const [status, setStatus] = useState('joining'); // joining | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    (async () => {
      const result = await joinRoom(token);
      if (result.data) {
        navigate(`/rooms/${result.data.id}`);
      } else {
        setError(result.error || 'This room no longer exists or has ended.');
        setStatus('error');
      }
    })();
  }, [token]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🔊</span>
          Rooms
        </div>

        {status === 'joining' ? (
          <>
            <Spinner size={32} />
            <p className={styles.msg}>Joining room…</p>
          </>
        ) : (
          <>
            <Alert variant="error">{error}</Alert>
            <Button variant="primary" size="md" onClick={() => navigate('/')} className={styles.btn}>
              Back to discover
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
