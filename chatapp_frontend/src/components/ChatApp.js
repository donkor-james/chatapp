import React, { useContext, useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./AuthProvider";
import ApiService from "../services/ApiService";
import useWebSocket from "../hooks/useWebSocket";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import Contacts from "./Contacts";
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
  // Determine activeView from route or prop
  const activeView =
    propActiveView ||
    (location.pathname.startsWith("/contacts") ? "contacts" : "chats");

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
      console.log("Loaded messages data:", data);
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
    if (activeChat) {
      const msg = {
        type: "message",
        content,
        chat_id: activeChat.id,
      };
      console.log("handleSendMessage: sending", msg);
      sendChatMessage(msg);
    } else {
      console.warn("handleSendMessage: No activeChat");
    }
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
    <div className="h-screen flex bg-gray-100">
      <Sidebar
        activeView={activeView}
        onViewChange={handleSidebarViewChange}
        unreadCount={unreadCount}
        onLogout={logout}
      />
      {renderMainContent()}
      <ContactPickerModal
        open={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelect={handleContactSelect}
      />
    </div>
  );
};

export default ChatApp;
