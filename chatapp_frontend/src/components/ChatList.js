import React from "react";
import { UserPlus, Search } from "lucide-react";

const ChatList = ({
  chats,
  activeChat,
  onChatSelect,
  onNewChat,
  currentUser,
  chatsWithUnseenMessages,
}) => {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
          <button
            onClick={onNewChat}
            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <UserPlus className="h-5 w-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => {
          const hasUnseenMessages = chatsWithUnseenMessages?.has(chat.id);
          const isActive = activeChat?.id === chat.id;

          return (
            <div
              key={chat.id}
              onClick={() => onChatSelect(chat)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                isActive
                  ? "bg-blue-50 border-r-2 border-r-blue-500"
                  : hasUnseenMessages
                  ? "bg-blue-100 border-l-4 border-l-blue-500 shadow-sm"
                  : ""
              }`}
            >
              {console.log("chatt", chat)}
              <div className="flex items-start space-x-3">
                <div
                  className={`w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold ${
                    hasUnseenMessages
                      ? "ring-2 ring-blue-400 ring-offset-1"
                      : ""
                  }`}
                >
                  {chat.chat_type === "private"
                    ? chat.other_member?.username?.[0]?.toUpperCase() || "U"
                    : "G"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3
                      className={`${
                        hasUnseenMessages ? "font-bold" : "font-medium"
                      } text-gray-900 truncate`}
                    >
                      {chat.chat_type === "private"
                        ? chat.other_member?.username || "Unknown User"
                        : chat.name || "Unknown"}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {chat.created_at
                        ? new Date(chat.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  {chat.last_message && (
                    <p
                      className={`text-sm ${
                        hasUnseenMessages
                          ? "text-gray-800 font-semibold"
                          : "text-gray-500"
                      } truncate mt-1`}
                    >
                      {currentUser.id === chat.last_message.sender.id
                        ? "You: "
                        : ""}
                      {chat.last_message &&
                      typeof chat.last_message === "object"
                        ? chat.last_message.content || "No content"
                        : chat.last_message || "No messages yet"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatList;
