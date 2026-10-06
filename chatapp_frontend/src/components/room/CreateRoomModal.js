import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRoomsStore from '../../store/roomsStore';
import useAuthStore from '../../store/authStore';
import { contactsAPI } from '../../api/services';
import { Modal, Button, FormGroup, Input, Textarea, Alert, Avatar } from '../ui';
import styles from './CreateRoomModal.module.css';

export default function CreateRoomModal({ onClose }) {
  const [step, setStep] = useState(1); // 1 = details, 2 = invite
  const [form, setForm] = useState({ topic: '', description: '' });
  const [following, setFollowing] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { createRoom } = useRoomsStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const goToInvite = async () => {
    if (!form.topic.trim()) { setError('Topic is required.'); return; }
    setError('');
    // Fetch who the user is following for the invite picker
    try {
      const { data } = await contactsAPI.following(user.id);
      setFollowing(data);
    } catch {}
    setStep(2);
  };

  const toggleSelect = (id) => {
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const handleCreate = async () => {
    setLoading(true);
    const result = await createRoom({
      topic: form.topic.trim(),
      description: form.description.trim(),
      invite_user_ids: selected,
    });
    setLoading(false);
    if (result.error) { setError('Could not create room. Try again.'); return; }
    onClose();
    navigate(`/rooms/${result.data.id}`);
  };

  return (
    <Modal title={step === 1 ? 'Start a room' : 'Invite people'} onClose={onClose}>
      {error && <Alert variant="error">{error}</Alert>}

      {step === 1 ? (
        <>
          <FormGroup label="Topic">
            <Input
              placeholder="What's the conversation about?"
              value={form.topic}
              onChange={f('topic')}
              autoFocus
            />
          </FormGroup>
          <FormGroup label="Description (optional)">
            <Textarea
              placeholder="A bit more context for people deciding whether to join…"
              value={form.description}
              onChange={f('description')}
              rows={3}
            />
          </FormGroup>
          <div className={styles.actions}>
            <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="md" onClick={goToInvite} disabled={!form.topic.trim()}>
              Next →
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.inviteNote}>
            Select people to notify now. They can also join later via your invite link.
          </p>
          {following.length === 0 ? (
            <p className={styles.noFollowing}>You're not following anyone yet — skip and share your invite link from the room.</p>
          ) : (
            <div className={styles.followList}>
              {following.map((u) => {
                const name = `${u.first_name} ${u.last_name}`;
                const isSelected = selected.includes(u.id);
                return (
                  <div
                    key={u.id}
                    className={`${styles.followRow} ${isSelected ? styles.followSelected : ''}`}
                    onClick={() => toggleSelect(u.id)}
                  >
                    <Avatar name={name} size="sm" />
                    <div className={styles.followInfo}>
                      <div className={styles.followName}>{name}</div>
                      <div className={styles.followHandle}>@{u.username}</div>
                    </div>
                    <div className={`${styles.check} ${isSelected ? styles.checkActive : ''}`}>
                      {isSelected && '✓'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className={styles.actions}>
            <Button variant="ghost" size="md" onClick={() => setStep(1)}>← Back</Button>
            <Button variant="primary" size="md" onClick={handleCreate} loading={loading}>
              {selected.length > 0 ? `Create & invite ${selected.length}` : 'Create room'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
