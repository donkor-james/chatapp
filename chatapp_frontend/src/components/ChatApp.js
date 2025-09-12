import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "./AuthProvider";
import ApiService from "../services/ApiService";
import useWebSocket from "../hooks/useWebSocket";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import Contacts from "./Contacts";
import Sidebar from "./Sidebar";

const ChatApp = () => {
  const { user, logout } = useContext(AuthContext);
  const [activeView, setActiveView] = useState("chats");
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // WebSocket for real-time notifications
  const { sendMessage: sendNotification } = useWebSocket(
    "/notifications/",
    (data) => {
      if (data.type === "unread_count") {
        setUnreadCount(data.count);
      }
    }
  );

  // WebSocket for active chat
  const { sendMessage: sendChatMessage } = useWebSocket(
    activeChat ? `/chat/${activeChat.id}/` : null,
    (data) => {
      if (data.type === "message") {
        setMessages((prev) => [...prev, data.message]);
      }
    }
  );

  useEffect(() => {
    loadChats();
    loadUnreadCount();
  }, []);

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
      setMessages(data);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleChatSelect = (chat) => {
    setActiveChat(chat);
    loadMessages(chat.id);
  };

  const handleSendMessage = (content) => {
    if (activeChat) {
      sendChatMessage({
        type: "message",
        content,
        chat_id: activeChat.id,
      });
    }
  };

  const handleNewChat = () => {
    // Implementation for creating new chat
    console.log("Create new chat");
  };

  const renderMainContent = () => {
    switch (activeView) {
      case "contacts":
        return <Contacts onClose={() => setActiveView("chats")} />;
      case "chats":
      default:
        return (
          <>
            <ChatList
              chats={chats}
              activeChat={activeChat}
              onChatSelect={handleChatSelect}
              onNewChat={handleNewChat}
            />
            <ChatWindow
              chat={activeChat}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          </>
        );
    }
  };

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        unreadCount={unreadCount}
        onLogout={logout}
      />
      {renderMainContent()}
    </div>
  );
};

export default ChatApp;
