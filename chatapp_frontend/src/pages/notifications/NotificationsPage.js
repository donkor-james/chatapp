import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useNotificationsStore from "../../store/notificationsStore";
import Topbar from "../../components/layout/Topbar";
import { Avatar, Button, Empty, Spinner } from "../../components/ui";
import styles from "./NotificationsPage.module.css";

const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
};

const nameOf = (sender) =>
  sender
    ? `${sender.first_name} ${sender.last_name}`.trim() || sender.username
    : "Rooms";

export default function NotificationsPage() {
  const { notifications, loading, fetchNotifications, markRead, markAllRead } =
    useNotificationsStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unread = notifications.filter((n) => !n.is_read).length;

  const handleClick = (n) => {
    if (!n.is_read) markRead(n.id);
    if (n.notification_type === "chat_invite" && n.data?.invite_token) {
      navigate(`/join/${n.data.invite_token}`);
    }
  };

  return (
    <div className={styles.page}>
      <Topbar
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up"}
        actions={
          unread > 0 ? (
            <Button variant="primary" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className={styles.scroll}>
        {loading && notifications.length === 0 ? (
          <div className={styles.centered}>
            <Spinner size={32} />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            icon="🔔"
            title="No notifications yet"
            subtitle="Room invites and other updates will show up here."
          />
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`${styles.item} ${n.is_read ? "" : styles.itemUnread}`}
              onClick={() => handleClick(n)}
            >
              <Avatar name={nameOf(n.sender)} size="sm" />
              <div className={styles.body}>
                <div className={styles.title}>{n.title}</div>
                <div className={styles.message}>{n.message}</div>
              </div>
              <div className={styles.meta}>
                <span className={styles.time}>{timeAgo(n.created_at)}</span>
                {!n.is_read && <span className={styles.dot} />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
