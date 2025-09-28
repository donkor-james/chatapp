import React, {
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./AuthProvider";
import ApiService from "../services/ApiService";
import useWebSocket from "../hooks/useWebSocket";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import Contacts from "./Contacts";
import Notifications from "./Notifications";
import Sidebar from "./Sidebar";
import ContactPickerModal from "./ContactPickerModal";

const ChatApp = ({ activeView: propActiveView }) => {
  const { user, logout } = useContext(AuthContext);
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  // Determine activeView from route or prop
  const activeView =
    propActiveView ||
    (location.pathname.startsWith("/contacts")
      ? "contacts"
      : location.pathname.startsWith("/settings")
      ? "settings"
      : "chats");

  // Notification WebSocket - always connected
  const notificationConfig = useMemo(
    () => ({
      debug: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
    }),
    []
  );

  // WebSocket for real-time notifications
  const { sendMessage: sendNotification } = useWebSocket(
    "/notifications/",
    useCallback((data) => {
      console.log("Notification received:", data);
      if (data.type === "unread_count") {
        setUnreadCount(data.count);
      }
    }, []),
    notificationConfig
  );

  // Global Chat WebSocket - receives messages from ALL user's chats
  const globalChatConfig = useMemo(
    () => ({
      debug: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
    }),
    []
  );
  const { sendMessage: sendChatMessage } = useWebSocket(
    "/user-chats/", // Global WebSocket endpoint for all user's chats
    useCallback(
      (data) => {
        console.log("🔥 RAW WebSocket data received:", data);
        console.log("🔥 Data type:", typeof data);
        console.log("🔥 Data stringified:", JSON.stringify(data));

        if (data.type === "message") {
          console.log("✅ Processing message:", data.message);

          // Only add to messages if it's for the currently active chat
          if (activeChat && data.message.chat_id == activeChat.id) {
            setMessages((prev) => {
              console.log("📝 Current messages count:", prev.length);
              const exists = prev.some((msg) => msg.id === data.message.id);
              if (exists) {
                console.log("⚠️ Duplicate message detected, skipping");
                return prev;
              }
              console.log("➕ Adding new message to active chat messages");
              return [...prev, data.message];
            });
          }

          // Always update the chat list with the latest message (for all chats)
          setChats((prevChats) =>
            prevChats.map((chat) =>
              chat.id == data.message.chat_id
                ? { ...chat, last_message: data.message }
                : chat
            )
          );
        } else {
          console.log("❓ Unknown message type:", data.type);
        }
      },
      [activeChat]
    ),
    globalChatConfig
  );
  useEffect(() => {
    loadChats();
    loadUnreadCount();
  }, []);

  // Set activeChat based on chatId param
  useEffect(() => {
    if (chatId && chats.length > 0) {
      const found = chats.find((c) => String(c.id) === String(chatId));
      setActiveChat(found || null);
      if (found) loadMessages(found.id);
    } else {
      setActiveChat(null);
      setMessages([]);
    }
  }, [chatId, chats]);

  const loadChats = async () => {
    try {
      const data = await ApiService.get("/chats/");
      setChats(data);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const data = await ApiService.get("/notifications/unread-count/");
      setUnreadCount(data.count);
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  };

  const loadMessages = async (chatId) => {
    try {
      const data = await ApiService.get(`/chats/${chatId}/messages/`);
      // console.log("Loaded messages data:", data);
      // If data is {messages: [...]}, use data.messages, else use data
      if (Array.isArray(data)) {
        setMessages(data);
      } else if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleChatSelect = (chat) => {
    navigate(`/chats/${chat.id}`);
  };

  const handleSendMessage = (content) => {
    if (!activeChat) {
      console.warn("No active chat selected");
      return;
    }

    const message = {
      type: "message",
      content,
      chat_id: activeChat.id,
    };

    console.log("Sending message:", message);
    sendChatMessage(message);
  };

  const handleNewChat = () => {
    setShowContactPicker(true);
  };

  const handleContactSelect = async (contactUser) => {
    setShowContactPicker(false);
    try {
      console.log("Selected contactUser:", contactUser, contactUser.id);
      const response = await ApiService.request("/chats/create/", {
        method: "POST",
        body: JSON.stringify({
          chat_type: "private",
          member_ids: [contactUser.id],
        }),
      });
      const chatData = await response.json();
      if (!response.ok) {
        console.error("Chat creation failed:", chatData);
        // alert("Chat creation failed: " + JSON.stringify(chatData));
        return;
      }
      setChats((prev) => {
        const exists = prev.find((c) => c.id === chatData.id);
        if (exists) return prev;
        return [chatData, ...prev];
      });
      navigate(`/chats/${chatData.id}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
      alert("Failed to create chat: " + error);
    }
  };

  const handleSidebarViewChange = (view) => {
    if (view === "contacts") {
      navigate("/contacts");
    } else if (view === "chats") {
      navigate("/chats");
    } else if (view === "notifications") {
      setShowNotifications(true);
    } else if (view === "settings") {
      navigate("/settings");
    } // Add more views as needed
  };

  // Define renderMainContent function
  const renderMainContent = () => {
    switch (activeView) {
      case "contacts":
        return <Contacts onClose={() => navigate("/chats")} />;
      case "chats":
      default:
        return (
          <>
            <ChatList
              chats={chats}
              activeChat={activeChat}
              onChatSelect={handleChatSelect}
              onNewChat={handleNewChat}
              currentUser={user}
            />
            <ChatWindow
              chat={activeChat}
              messages={messages}
              onSendMessage={handleSendMessage}
              currentUser={user}
            />
          </>
        );
    }
  };

  return (
    <div className="h-screen flex bg-gray-100 relative">
      <Sidebar
        activeView={showNotifications ? "notifications" : activeView}
        onViewChange={handleSidebarViewChange}
        unreadCount={unreadCount}
        onLogout={logout}
      />
      {renderMainContent()}
      {/* Notifications Modal Overlay */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fade-in-up">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
              onClick={() => setShowNotifications(false)}
              aria-label="Close notifications"
            >
              &times;
            </button>
            <Notifications />
          </div>
        </div>
      )}
      <ContactPickerModal
        open={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelect={handleContactSelect}
      />
    </div>
  );
};

export default ChatApp;
