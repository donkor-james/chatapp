import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Phone, Video, MoreVertical, Send } from "lucide-react";
import Message from "./Message";

const ChatWindow = ({ chat, messages, onSendMessage, currentUser }) => {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  console.log("ChatWindow props - messages:", messages);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage("");
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            Select a conversation to start messaging
          </p>
        </div>
      </div>
    );
  }

  // Defensive check: show error if messages is not an array
  if (!Array.isArray(messages)) {
    console.error(
      "ChatWindow: messages prop is not an array! Value:",
      messages
    );
    return (
      <div className="flex-1 flex items-center justify-center bg-red-50">
        <div className="text-center">
          <p className="text-red-500 font-bold">
            Error: messages prop is not an array!
          </p>
          <pre
            className="text-xs text-red-700 bg-red-100 p-2 rounded mt-2 overflow-x-auto"
            style={{ maxWidth: 600, margin: "0 auto" }}
          >
            {JSON.stringify(messages, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // Log and filter messages before rendering
  console.log("Rendering messages:", messages);
  const safeMessages = messages
    .filter((m, i) => {
      const valid =
        m &&
        typeof m === "object" &&
        !Array.isArray(m) &&
        typeof m.content === "string";
      if (!valid) {
        console.warn("Skipping invalid message at index", i, m);
      }
      return valid;
    })
    .reverse();
  // console.log("-------- safeMessages: ", safeMessages.reverse());

  // const handleIsOwn = (sender) => {
  //   return message.sender && message.sender.id === currentUser.id;
  // };

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
              {chat.chat_type === "private"
                ? chat.other_member.username?.[0]?.toUpperCase()
                : "G"}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                {chat.chat_type === "private"
                  ? chat.other_member?.username
                  : chat.name}
              </h3>
              <p className="text-sm text-gray-500">Online</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <Phone className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <Video className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {safeMessages.map((message) => {
          console.log(
            "Rendering message:",
            message.sender.id,
            currentUser.id,
            message.sender.id === currentUser.id ? true : false
          );
          return (
            <Message
              key={message.id}
              message={message}
              isOwn={message.sender.id === currentUser.id ? true : false}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
