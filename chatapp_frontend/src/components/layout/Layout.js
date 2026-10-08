import React, { useEffect, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import useConversationsStore from "../../store/conversationsStore";
import useRoomsStore from "../../store/roomsStore";
import useNotificationsStore from "../../store/notificationsStore";
import { useWebSocket } from "../../hooks/useWebSocket";
import { Avatar, Badge } from "../ui";
import styles from "./Layout.module.css";

const NAV = [
  { to: "/", icon: "⬡", label: "Discover" },
  { to: "/messages", icon: "✉", label: "Messages", badge: "messages" },
  {
    to: "/notifications",
    icon: "🔔",
    label: "Notifications",
    badge: "notifications",
  },
  { to: "/people", icon: "👥", label: "People" },
  { to: "/profile", icon: "◯", label: "Profile" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const conversations = useConversationsStore((s) => s.conversations);
  const totalUnread = conversations.reduce(
    (n, c) => n + (c.unread_count || 0),
    0,
  );
  const { rooms, activeRoom, setActiveRoom, fetchRooms } = useRoomsStore();

  const unreadNotifications = useNotificationsStore(
    (s) => s.notifications.filter((n) => !n.is_read).length,
  );
  const fetchNotifications = useNotificationsStore((s) => s.fetchNotifications);
  const receiveNotification = useNotificationsStore(
    (s) => s.receiveNotification,
  );

  useEffect(() => {
    fetchRooms();
    fetchNotifications();
  }, [fetchRooms, fetchNotifications]);

  const onNotificationMessage = useCallback(
    (data) => {
      if (data.type === "notification") receiveNotification(data.notification);
    },
    [receiveNotification],
  );
  useWebSocket("notifications/", { onMessage: onNotificationMessage });

  const badgeCounts = {
    messages: totalUnread,
    notifications: unreadNotifications,
  };

  const myRooms = rooms.filter(
    (r) => r.status === "active" && r.members?.some((m) => m.id === user?.id),
  );
  const fullName = user ? `${user.first_name} ${user.last_name}` : "";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🔊</span>
          Rooms
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ""}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
              {badge && badgeCounts[badge] > 0 && (
                <Badge count={badgeCounts[badge]} />
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles.section}>
          <span>My rooms</span>
          <button
            className={styles.sectionBtn}
            onClick={() => navigate("/")}
            title="Create a room"
          >
            +
          </button>
        </div>

        <div className={styles.roomList}>
          {myRooms.length === 0 ? (
            <p className={styles.emptyRooms}>No active rooms</p>
          ) : (
            myRooms.map((r) => (
              <div
                key={r.id}
                className={`${styles.roomItem} ${activeRoom?.id === r.id ? styles.roomActive : ""}`}
                onClick={() => {
                  setActiveRoom(r);
                  navigate(`/rooms/${r.id}`);
                }}
              >
                <span className={styles.roomDot} />
                <span className={styles.roomName}>{r.topic}</span>
                <span className={styles.roomCount}>{r.member_count}</span>
              </div>
            ))
          )}
        </div>

        <div className={styles.userBar}>
          <Avatar name={fullName} size="sm" />
          <div className={styles.userInfo}>
            <div className={styles.userName}>{fullName}</div>
            <div className={styles.userHandle}>@{user?.username}</div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Sign out"
          >
            ⏻
          </button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
