import React, { useEffect, useRef, useCallback, useState } from "react";
import useConversationsStore from "../../store/conversationsStore";
import useAuthStore from "../../store/authStore";
import { useWebSocket } from "../../hooks/useWebSocket";
import { conversationsAPI } from "../../api/services";
import Topbar from "../../components/layout/Topbar";
import { Avatar, Empty, Spinner } from "../../components/ui";
import styles from "./MessagesPage.module.css";

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
};

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

export default function MessagesPage() {
  const {
    conversations,
    fetchConversations,
    activeConversation,
    setActiveConversation,
    messages,
    fetchMessages,
    sendMessage,
    receiveMessage,
    updateMessage,
    clearUnread,
  } = useConversationsStore();
  const { user } = useAuthStore();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const activeConvId = activeConversation?.id;

  // Message actions state
  const [activeActions, setActiveActions] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editInput, setEditInput] = useState("");

  useEffect(() => {
    (async () => {
      await fetchConversations();
      setLoading(false);
    })();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
      clearUnread(activeConvId);
    }
  }, [activeConvId, fetchMessages, clearUnread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages[activeConvId]]); // eslint-disable-line react-hooks/exhaustive-deps

  const onWsMessage = useCallback(
    (data) => {
      if (!activeConvId) return;
      if (data.type === "message") {
        receiveMessage(activeConvId, data.message);
      }
      if (data.type === "message_updated" || data.type === "message_deleted") {
        updateMessage(activeConvId, data.message);
      }
      if (data.type === "typing") setTyping(data.is_typing);
    },
    [activeConvId, receiveMessage, updateMessage],
  );

  const { send } = useWebSocket(
    activeConvId ? `conversations/${activeConvId}/` : null,
    { enabled: !!activeConvId, onMessage: onWsMessage },
  );

  const handleSend = async () => {
    if (!input.trim() || !activeConvId) return;
    const content = input.trim();
    setInput("");
    await sendMessage(activeConvId, content);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  // ── Edit / delete ────────────────────────────────────────────────────────
  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditInput(msg.content);
    setActiveActions(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditInput("");
  };

  const submitEdit = async (msgId) => {
    if (!editInput.trim() || !activeConvId) return;
    try {
      await conversationsAPI.editMessage(activeConvId, msgId, editInput.trim());
      // WS message_updated event will update the list
    } catch {}
    setEditingId(null);
    setEditInput("");
  };

  const deleteMessage = async (msgId) => {
    if (!activeConvId) return;
    setActiveActions(null);
    try {
      await conversationsAPI.deleteMessage(activeConvId, msgId);
      // WS message_deleted event will update the list
    } catch {}
  };

  const activeMessages = messages[activeConvId] || [];
  const other = activeConversation?.other_participant;
  const otherName = other ? `${other.first_name} ${other.last_name}` : "";

  const grouped = activeMessages.reduce((acc, msg, i) => {
    const prev = activeMessages[i - 1];
    const isCont =
      prev &&
      prev.sender?.id === msg.sender?.id &&
      new Date(msg.created_at) - new Date(prev.created_at) < 300_000;
    acc.push({ ...msg, isContinuation: isCont });
    return acc;
  }, []);

  return (
    <div className={styles.page}>
      {/* Conversation list */}
      <div className={styles.list}>
        <Topbar title="Messages" />
        {loading ? (
          <div className={styles.centered}>
            <Spinner />
          </div>
        ) : conversations.length === 0 ? (
          <Empty
            icon="✉️"
            title="No conversations yet"
            subtitle="Message someone from a room to start here."
          />
        ) : (
          <div className={styles.convList}>
            {conversations.map((c) => {
              const name = `${c.other_participant.first_name} ${c.other_participant.last_name}`;
              const isMe = c.last_message?.sender?.id === user?.id;

              return (
                <div
                  key={c.id}
                  className={`${styles.convItem} ${activeConvId === c.id ? styles.convActive : ""}`}
                  onClick={() => setActiveConversation(c)}
                >
                  <Avatar name={name} />
                  <div className={styles.convBody}>
                    <div className={styles.convName}>{name}</div>
                    {c.last_message && (
                      <div className={styles.convPreview}>
                        {isMe ? "You: " : ""}
                        {c.last_message.content}
                      </div>
                    )}
                  </div>
                  <div className={styles.convMeta}>
                    {c.last_message_at && (
                      <div className={styles.convTime}>
                        {timeAgo(c.last_message_at)}
                      </div>
                    )}
                    {c.unread_count > 0 && (
                      <div className={styles.unread}>{c.unread_count}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Thread */}
      {activeConversation ? (
        <div className={styles.thread}>
          <Topbar title={otherName} subtitle={`@${other?.username}`} />
          <div className={styles.messagesList}>
            {activeMessages.length === 0 && (
              <Empty icon="👋" title={`Say hi to ${other?.first_name}`} />
            )}
            {grouped.map((msg) => {
              const isMine = msg.sender?.id === user?.id;
              const isEditing = editingId === msg.id;
              const showActions = activeActions === msg.id;

              const bubbleContent = msg.is_deleted ? (
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
                  <button className={styles.editCancel} onClick={cancelEdit}>
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
                  {isMine && showActions && !isEditing && !msg.is_deleted && (
                    <MessageActions
                      onEdit={() => startEdit(msg)}
                      onDelete={() => deleteMessage(msg.id)}
                      onClose={() => setActiveActions(null)}
                    />
                  )}
                </div>
              );

              if (msg.isContinuation) {
                return (
                  <div
                    key={msg.id}
                    className={`${styles.continuation} ${isMine ? styles.contMine : ""}`}
                    onMouseEnter={() => isMine && setActiveActions(msg.id)}
                    onMouseLeave={() => !isEditing && setActiveActions(null)}
                  >
                    {bubbleContent}
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
                    <Avatar
                      name={`${msg.sender?.first_name} ${msg.sender?.last_name}`}
                      size="sm"
                    />
                  )}
                  <div
                    className={`${styles.msgBody} ${isMine ? styles.msgBodyMine : ""}`}
                  >
                    {!isMine && (
                      <div className={styles.msgHeader}>
                        <span className={styles.msgAuthor}>
                          {msg.sender?.first_name} {msg.sender?.last_name}
                        </span>
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
                      {bubbleContent}
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
            {typing && (
              <div className={styles.typingBar}>{otherName} is typing…</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputArea}>
            <div className={styles.inputWrap}>
              <textarea
                ref={inputRef}
                className={styles.input}
                placeholder={`Message ${other?.first_name}…`}
                value={input}
                rows={1}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!input.trim()}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.threadEmpty}>
          <Empty
            icon="💬"
            title="Select a conversation"
            subtitle="Pick one from the left to read and reply."
          />
        </div>
      )}
    </div>
  );
}
