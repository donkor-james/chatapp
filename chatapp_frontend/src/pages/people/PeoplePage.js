import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsAPI } from '../../api/services';
import useAuthStore from '../../store/authStore';
import useConversationsStore from '../../store/conversationsStore';
import Topbar from '../../components/layout/Topbar';
import { Avatar, Button, Empty, Spinner, Alert } from '../../components/ui';
import styles from './PeoplePage.module.css';

export default function PeoplePage() {
  const { user } = useAuthStore();
  const { startConversation, setActiveConversation } = useConversationsStore();
  const navigate = useNavigate();

  const [tab, setTab] = useState('following');
  const [following, setFollowing] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [followRes, discoverRes] = await Promise.all([
        contactsAPI.following(user.id),
        contactsAPI.discover(),
      ]);
      setFollowing(followRes.data);
      setDiscover(discoverRes.data);
    } catch { setError('Failed to load people.'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const follow = async (u) => {
    setActionLoading((p) => ({ ...p, [u.id]: true }));
    try {
      await contactsAPI.follow(u.id);
      setFollowing((p) => [...p, u]);
      setDiscover((p) => p.filter((d) => d.id !== u.id));
    } catch {}
    setActionLoading((p) => ({ ...p, [u.id]: false }));
  };

  const unfollow = async (u) => {
    setActionLoading((p) => ({ ...p, [u.id]: true }));
    try {
      await contactsAPI.unfollow(u.id);
      setFollowing((p) => p.filter((f) => f.id !== u.id));
      setDiscover((p) => [...p, u]);
    } catch {}
    setActionLoading((p) => ({ ...p, [u.id]: false }));
  };

  const openDM = async (u) => {
    const result = await startConversation(u.id);
    if (result.data) {
      setActiveConversation(result.data);
      navigate('/messages');
    }
  };

  const list = tab === 'following' ? following : discover;

  return (
    <div className={styles.page}>
      <Topbar
        title="People"
        actions={
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'following' ? styles.tabActive : ''}`}
              onClick={() => setTab('following')}
            >
              Following {following.length > 0 && <span className={styles.tabCount}>{following.length}</span>}
            </button>
            <button
              className={`${styles.tab} ${tab === 'discover' ? styles.tabActive : ''}`}
              onClick={() => setTab('discover')}
            >
              Discover
            </button>
          </div>
        }
      />

      <div className={styles.scroll}>
        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div className={styles.centered}><Spinner size={32} /></div>
        ) : list.length === 0 ? (
          <Empty
            icon="👥"
            title={tab === 'following' ? 'Not following anyone yet' : 'No suggestions'}
            subtitle={tab === 'following' ? 'Find people in rooms and follow them.' : 'Check back later for more suggestions.'}
          />
        ) : (
          <div className={styles.peopleList}>
            {list.map((u) => {
              const name = `${u.first_name} ${u.last_name}`;
              const busy = actionLoading[u.id];
              return (
                <div key={u.id} className={styles.personRow}>
                  <Avatar name={name} />
                  <div className={styles.personInfo}>
                    <div className={styles.personName}>{name}</div>
                    <div className={styles.personHandle}>@{u.username}</div>
                  </div>
                  <div className={styles.personActions}>
                    <Button variant="ghost" size="sm" onClick={() => openDM(u)}>
                      Message
                    </Button>
                    {tab === 'following' ? (
                      <Button variant="outline" size="sm" onClick={() => unfollow(u)} loading={busy}>
                        Unfollow
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => follow(u)} loading={busy}>
                        Follow
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
