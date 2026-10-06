import React, { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import useConversationsStore from "../../store/conversationsStore";
import useRoomsStore from "../../store/roomsStore";
import { Avatar, Badge } from "../ui";
import styles from "./Layout.module.css";

const NAV = [
  { to: "/", icon: "⬡", label: "Discover" },
  { to: "/messages", icon: "✉", label: "Messages", badge: true },
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

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

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
              {badge && totalUnread > 0 && <Badge count={totalUnread} />}
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
