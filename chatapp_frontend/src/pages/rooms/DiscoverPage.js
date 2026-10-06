import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useRoomsStore from "../../store/roomsStore";
import useAuthStore from "../../store/authStore";
import Topbar from "../../components/layout/Topbar";
import CreateRoomModal from "../../components/room/CreateRoomModal";
import { Avatar, Button, Empty, Spinner, Pill } from "../../components/ui";
import styles from "./DiscoverPage.module.css";

export default function DiscoverPage() {
  const { rooms, fetchRooms, setActiveRoom, loading } = useRoomsStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleJoin = async (room) => {
    setActiveRoom(room);
    navigate(`/rooms/${room.id}`);
  };

  const activeRooms = rooms.filter((r) => r.status === "active");

  return (
    <div className={styles.page}>
      <Topbar
        title="Discover rooms"
        subtitle={`${activeRooms.length} room${activeRooms.length !== 1 ? "s" : ""} open right now`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreate(true)}
          >
            + New room
          </Button>
        }
      />

      <div className={styles.scroll}>
        {loading ? (
          <div className={styles.centered}>
            <Spinner size={32} />
          </div>
        ) : rooms.length === 0 ? (
          <Empty
            icon="🔊"
            title="No rooms yet"
            subtitle="Be the first to start a conversation."
            action={
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowCreate(true)}
              >
                Create a room
              </Button>
            }
          />
        ) : (
          <div className={styles.grid}>
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                currentUser={user}
                onJoin={() => handleJoin(room)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => {
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function RoomCard({ room, currentUser, onJoin }) {
  const hostName = room.host
    ? `${room.host.first_name} ${room.host.last_name}`
    : "";
  const visibleMembers = (room.members || []).slice(0, 3);

  return (
    <div className={styles.card} onClick={onJoin}>
      <div className={styles.cardTop}>
        <h3 className={styles.topic}>{room.topic}</h3>
        <Pill variant={room.status === "active" ? "live" : "ended"}>
          <span className={styles.dot} />
          {room.status === "active" ? "Live" : "Ended"}
        </Pill>
      </div>

      {room.description && <p className={styles.desc}>{room.description}</p>}

      <div className={styles.cardFooter}>
        <div className={styles.host}>
          <Avatar name={hostName} size="sm" />
          <span>{hostName}</span>
        </div>
        <div className={styles.members}>
          <div className={styles.memberStack}>
            {visibleMembers.map((m) => (
              <Avatar
                key={m?.id}
                name={`${m?.first_name} ${m?.last_name}`}
                size="sm"
                className={styles.stackedAvatar}
              />
            ))}
          </div>
          <span>{room.member_count}</span>
        </div>
      </div>
    </div>
  );
}
