import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useRoomsStore from "../../store/roomsStore";
import useAuthStore from "../../store/authStore";
import useConversationsStore from "../../store/conversationsStore";
import { useWebSocket } from "../../hooks/useWebSocket";
import { roomsAPI, contactsAPI } from "../../api/services";
import Topbar from "../../components/layout/Topbar";
import { Avatar, Button, Empty, Spinner } from "../../components/ui";
import styles from "./RoomPage.module.css";

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ── User profile card (shown when clicking an avatar) ────────────────────────
function UserProfileCard({ targetUser, currentUser, onDM, onClose }) {
  const [stats, setStats] = useState(null);
  const [following, setFollowing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const cardRef = useRef(null);
  const name = `${targetUser.first_name} ${targetUser.last_name}`;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await contactsAPI.stats(targetUser.id);
        setStats(data);
        setFollowing(data.you_follow_them);
      } catch {}
    })();
  }, [targetUser.id]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleFollow = async () => {
    setActionLoading(true);
    try {
      if (following) {
        await contactsAPI.unfollow(targetUser.id);
        setFollowing(false);
        setStats((s) =>
          s ? { ...s, followers_count: s.followers_count - 1 } : s,
        );
      } else {
        await contactsAPI.follow(targetUser.id);
        setFollowing(true);
        setStats((s) =>
          s ? { ...s, followers_count: s.followers_count + 1 } : s,
        );
      }
    } catch {}
    setActionLoading(false);
  };

  return (
    <div className={styles.profileCard} ref={cardRef}>
      <button className={styles.profileClose} onClick={onClose}>
        ✕
      </button>
      <div className={styles.profileHeader}>
        <Avatar name={name} size="lg" />
        <div>
          <div className={styles.profileName}>{name}</div>
          <div className={styles.profileHandle}>@{targetUser.username}</div>
        </div>
      </div>

      {stats && (
        <div className={styles.profileStats}>
          <div className={styles.profileStat}>
            <span className={styles.profileStatNum}>
              {stats.followers_count}
            </span>
            <span className={styles.profileStatLabel}>Followers</span>
          </div>
          <div className={styles.profileStat}>
            <span className={styles.profileStatNum}>
              {stats.following_count}
            </span>
            <span className={styles.profileStatLabel}>Following</span>
          </div>
        </div>
      )}

      <div className={styles.profileActions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDM}
          className={styles.profileBtn}
        >
          Message
        </Button>
        <Button
          variant={following ? "outline" : "primary"}
          size="sm"
          onClick={handleFollow}
          loading={actionLoading}
          className={styles.profileBtn}
        >
          {following ? "Unfollow" : "Follow"}
        </Button>
      </div>
    </div>
  );
}

// ── Message actions popover (edit / delete) ──────────────────────────────────
function MessageActions({ onEdit, onDelete, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className={styles.actionsPopover} ref={ref}>
      <button className={styles.actionItem} onClick={onEdit}>
        ✏ Edit
      </button>
      <button
        className={`${styles.actionItem} ${styles.actionDelete}`}
        onClick={onDelete}
      >
        🗑 Delete
      </button>
    </div>
  );
}

// ── Main RoomPage ────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    setActiveRoom,
    handleMemberJoined,
    handleMemberLeft,
    handleRoomEnded,
    leaveRoom,
    endRoom,
  } = useRoomsStore();

  const { user } = useAuthStore();
  const { startConversation, setActiveConversation } = useConversationsStore();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Message actions state
  const [activeActions, setActiveActions] = useState(null); // message id
  const [editingId, setEditingId] = useState(null);
  const [editInput, setEditInput] = useState("");

  // User profile card state
  const [profileUser, setProfileUser] = useState(null); // user object
  const [profileAnchor, setProfileAnchor] = useState(null); // { top, left }

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const navigateRef = useRef(navigate);
  const handleMemberJoinedRef = useRef(handleMemberJoined);
  const handleMemberLeftRef = useRef(handleMemberLeft);
  const handleRoomEndedRef = useRef(handleRoomEnded);
  const setRoomRef = useRef(setRoom);
  navigateRef.current = navigate;
  handleMemberJoinedRef.current = handleMemberJoined;
  handleMemberLeftRef.current = handleMemberLeft;
  handleRoomEndedRef.current = handleRoomEnded;
  setRoomRef.current = setRoom;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [roomRes, msgsRes] = await Promise.all([
          roomsAPI.detail(id),
          roomsAPI.messages(id),
        ]);
        if (!cancelled) {
          setRoom(roomRes.data);
          setActiveRoom(roomRes.data);
          setMessages(msgsRes.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          setError(
            status === 403 || status === 404
              ? "This room does not exist or you are not a member."
              : "Could not load room. Please try again.",
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setActiveRoom]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onWsMessage = useCallback(
    (data) => {
      switch (data.type) {
        case "message":
          setMessages((p) =>
            p.some((m) => m.id === data.message.id) ? p : [...p, data.message],
          );
          break;
        case "message_updated":
          setMessages((p) =>
            p.map((m) => (m.id === data.message.id ? data.message : m)),
          );
          break;
        case "message_deleted":
          setMessages((p) =>
            p.map((m) => (m.id === data.message.id ? data.message : m)),
          );
          break;
        case "member_joined":
          handleMemberJoinedRef.current(id, data.user);
          setRoomRef.current((prev) => {
            if (!prev || prev.members?.some((m) => m?.id === data.user?.id))
              return prev;
            return {
              ...prev,
              members: [
                ...(prev.members || []),
                { user: data.user, role: "member" },
              ],
              member_count: (prev.member_count || 0) + 1,
            };
          });
          break;
        case "member_left":
          handleMemberLeftRef.current(id, data.user_id);
          setRoomRef.current((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              members: (prev.members || []).filter(
                (m) => m?.id !== data.user_id,
              ),
              member_count: Math.max(0, (prev.member_count || 1) - 1),
            };
          });
          break;
        case "room_ended":
          handleRoomEndedRef.current(id);
          navigateRef.current("/");
          break;
        case "typing":
          setTypingUsers((p) => ({
            ...p,
            [data.user_id]: data.is_typing ? data.username : null,
          }));
          break;
        default:
          break;
      }
    },
    [id],
  );

  const { send } = useWebSocket(`rooms/${id}/`, {
    enabled: !!id && !loading && !error,
    onMessage: onWsMessage,
  });

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    inputRef.current?.focus();
    setSending(true);
    try {
      await roomsAPI.sendMessage(id, content);
    } catch {
      setInput(content);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    send({ type: "typing", is_typing: true });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(
      () => send({ type: "typing", is_typing: false }),
      1500,
    );
  };

  // ── Edit message ──────────────────────────────────────────────────────────
  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditInput(msg.content);
    setActiveActions(null);
  };

  const submitEdit = async (msgId) => {
    if (!editInput.trim()) return;
    try {
      await roomsAPI.editMessage(id, msgId, editInput.trim());
      // WS message_updated event will update the list
    } catch {}
    setEditingId(null);
    setEditInput("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditInput("");
  };

  // ── Delete message ────────────────────────────────────────────────────────
  const deleteMessage = async (msgId) => {
    setActiveActions(null);
    try {
      await roomsAPI.deleteMessage(id, msgId);
      // WS message_deleted event will remove it from list
    } catch {}
  };

  // ── Avatar click → profile card ───────────────────────────────────────────
  const handleAvatarClick = (e, senderUser) => {
    if (senderUser.id === user?.id) return; // don't show card for yourself
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setProfileAnchor({ top: rect.bottom + 8, left: rect.left });
    setProfileUser(senderUser);
  };

  const handleProfileDM = async () => {
    if (!profileUser) return;
    const result = await startConversation(profileUser.id);
    if (result.data) {
      setActiveConversation(result.data);
      navigate("/messages");
    }
    setProfileUser(null);
  };

  const inviteToken = room?.invite_token || "";
  const inviteLink = inviteToken
    ? `${window.location.origin}/join/${inviteToken}`
    : "";

  const copyInvite = () => {
    if (!inviteLink) return;
    navigator.clipboard?.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    await leaveRoom(id);
    navigate("/");
  };
  const handleEnd = async () => {
    await endRoom(id);
    navigate("/");
  };

  const handleMemberDM = async (member) => {
    if (!member?.user || member.user.id === user?.id) return;
    const result = await startConversation(member.user.id);
    if (result.data) {
      setActiveConversation(result.data);
      navigate("/messages");
    }
  };

  const isHost = room?.host?.id === user?.id;
  const activeTyping = Object.values(typingUsers).filter(Boolean);

  // Group consecutive messages from same sender within 5 min
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const isCont =
      prev &&
      prev.sender?.id === msg.sender?.id &&
      new Date(msg.created_at) - new Date(prev.created_at) < 300_000;
    acc.push({ ...msg, isContinuation: isCont });
    return acc;
  }, []);

  if (loading)
    return (
      <div className={styles.centered}>
        <Spinner size={32} />
      </div>
    );

  if (error) {
    return (
      <div className={styles.centered}>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorMsg}>{error}</div>
          <Button variant="ghost" size="md" onClick={() => navigate("/")}>
            Back to discover
          </Button>
        </div>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className={styles.page}>
      <Topbar
        title={room.topic}
        subtitle={`${room.member_count} in room · hosted by ${room.host?.first_name}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyInvite}
              disabled={!inviteLink}
            >
              {copied ? "✓ Copied" : "🔗 Invite"}
            </Button>
            {isHost ? (
              <Button variant="danger" size="sm" onClick={handleEnd}>
                End room
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleLeave}>
                Leave
              </Button>
            )}
          </>
        }
      />

      <div className={styles.layout}>
        {/* ── Messages ── */}
        <div className={styles.messagesPane}>
          <div className={styles.messagesList}>
            {messages.length === 0 && (
              <Empty
                icon="💬"
                title="No messages yet"
                subtitle="Be the first to say something."
              />
            )}

            {grouped.map((msg) => {
              const isMine = msg.sender?.id === user?.id;
              const isEditing = editingId === msg.id;
              const showActions = activeActions === msg.id;
              const senderName = `${msg.sender?.first_name} ${msg.sender?.last_name}`;

              if (msg.isContinuation) {
                return (
                  <div
                    key={msg.id}
                    className={`${styles.continuation} ${isMine ? styles.contMine : ""}`}
                    onMouseEnter={() => isMine && setActiveActions(msg.id)}
                    onMouseLeave={() => !isEditing && setActiveActions(null)}
                  >
                    {isMine && (
                      <span className={styles.contTime}>
                        {fmtTime(msg.created_at)}
                      </span>
                    )}

                    {msg.is_deleted ? (
                      <div
                        className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther} ${styles.bubbleDeleted}`}
                      >
                        <p className={styles.msgTextDeleted}>
                          🚫 This message was deleted
                        </p>
                      </div>
                    ) : isEditing ? (
                      <div className={styles.editWrap}>
                        <input
                          className={styles.editInput}
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitEdit(msg.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                        <button
                          className={styles.editSave}
                          onClick={() => submitEdit(msg.id)}
                        >
                          Save
                        </button>
                        <button
                          className={styles.editCancel}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}
                      >
                        <p className={styles.msgText}>{msg.content}</p>
                        {msg.is_edited && (
                          <span className={styles.editedTag}>edited</span>
                        )}
                        {isMine &&
                          showActions &&
                          !isEditing &&
                          !msg.is_deleted && (
                            <MessageActions
                              onEdit={() => startEdit(msg)}
                              onDelete={() => deleteMessage(msg.id)}
                              onClose={() => setActiveActions(null)}
                            />
                          )}
                      </div>
                    )}

                    {!isMine && (
                      <span className={styles.contTime}>
                        {fmtTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <div
                  key={msg.id}
                  className={`${styles.msgGroup} ${isMine ? styles.msgGroupMine : ""}`}
                  onMouseEnter={() => isMine && setActiveActions(msg.id)}
                  onMouseLeave={() => !isEditing && setActiveActions(null)}
                >
                  {!isMine && (
                    <div
                      className={styles.avatarBtn}
                      onClick={(e) => handleAvatarClick(e, msg.sender)}
                      title={`View ${senderName}'s profile`}
                    >
                      <Avatar name={senderName} size="sm" />
                    </div>
                  )}

                  <div
                    className={`${styles.msgBody} ${isMine ? styles.msgBodyMine : ""}`}
                  >
                    {!isMine && (
                      <div className={styles.msgHeader}>
                        <span className={styles.msgAuthor}>{senderName}</span>
                      </div>
                    )}

                    <div
                      className={`${styles.bubbleRow} ${isMine ? styles.bubbleRowMine : ""}`}
                    >
                      {isMine && (
                        <span className={styles.contTime}>
                          {fmtTime(msg.created_at)}
                        </span>
                      )}

                      {msg.is_deleted ? (
                        <div
                          className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther} ${styles.bubbleDeleted}`}
                        >
                          <p className={styles.msgTextDeleted}>
                            🚫 This message was deleted
                          </p>
                        </div>
                      ) : isEditing ? (
                        <div className={styles.editWrap}>
                          <input
                            className={styles.editInput}
                            value={editInput}
                            onChange={(e) => setEditInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitEdit(msg.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                          />
                          <button
                            className={styles.editSave}
                            onClick={() => submitEdit(msg.id)}
                          >
                            Save
                          </button>
                          <button
                            className={styles.editCancel}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}
                        >
                          <p className={styles.msgText}>{msg.content}</p>
                          {msg.is_edited && (
                            <span className={styles.editedTag}>edited</span>
                          )}
                          {isMine &&
                            showActions &&
                            !isEditing &&
                            !msg.is_deleted && (
                              <MessageActions
                                onEdit={() => startEdit(msg)}
                                onDelete={() => deleteMessage(msg.id)}
                                onClose={() => setActiveActions(null)}
                              />
                            )}
                        </div>
                      )}

                      {!isMine && (
                        <span className={styles.contTime}>
                          {fmtTime(msg.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className={styles.typingBar}>
            {activeTyping.length > 0 &&
              `${activeTyping.join(", ")} ${activeTyping.length === 1 ? "is" : "are"} typing…`}
          </div>

          <div className={styles.inputArea}>
            <div className={styles.inputWrap}>
              <textarea
                ref={inputRef}
                className={styles.input}
                placeholder="Say something…"
                value={input}
                rows={1}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
              />
              <button
                className={styles.sendBtn}
                onClick={sendMessage}
                disabled={!input.trim() || sending}
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        {/* ── Members panel ── */}
        <div className={styles.membersPanel}>
          <div className={styles.panelLabel}>In this room</div>
          {(room.members || []).map((m) => (
            <div
              key={m?.id}
              className={styles.memberRow}
              onClick={() => handleMemberDM(m)}
            >
              <div className={styles.memberAvatar}>
                <Avatar name={`${m?.first_name} ${m?.last_name}`} size="sm" />
                <span className={styles.onlineDot} />
              </div>
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>
                  {m?.first_name} {m?.last_name}
                </div>
                <div className={styles.memberRole}>{m.role}</div>
              </div>
              {m?.id !== user?.id && <span className={styles.dmHint}>DM</span>}
            </div>
          ))}
          <div className={styles.divider} />
          <div className={styles.panelLabel}>Invite link</div>
          <div className={styles.inviteBox}>
            <span className={styles.inviteLink}>
              {inviteLink || "Loading…"}
            </span>
            <button
              className={styles.copyBtn}
              onClick={copyInvite}
              disabled={!inviteLink}
            >
              {copied ? "✓" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* ── User profile card (portal-like, positioned by avatar click) ── */}
      {profileUser && profileAnchor && (
        <div
          className={styles.profileCardWrap}
          style={{ top: profileAnchor.top, left: profileAnchor.left }}
        >
          <UserProfileCard
            targetUser={profileUser}
            currentUser={user}
            onDM={handleProfileDM}
            onClose={() => setProfileUser(null)}
          />
        </div>
      )}
    </div>
  );
}
