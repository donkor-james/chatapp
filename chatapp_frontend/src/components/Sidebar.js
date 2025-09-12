import React from "react";
import { MessageCircle, Users, Bell, Settings, LogOut } from "lucide-react";

const Sidebar = ({ activeView, onViewChange, unreadCount, onLogout }) => {
  const menuItems = [
    {
      id: "chats",
      icon: MessageCircle,
      label: "Chats",
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { id: "contacts", icon: Users, label: "Contacts" },
    { id: "notifications", icon: Bell, label: "Notifications" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-4">
      <div className="mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
          <MessageCircle className="h-6 w-6 text-white" />
        </div>
      </div>
      <nav className="flex-1">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id)}
                className={`relative p-3 rounded-lg transition-colors ${
                  activeView === item.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <item.icon className="h-6 w-6" />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <button
        onClick={onLogout}
        className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
      >
        <LogOut className="h-6 w-6" />
      </button>
    </div>
  );
};

export default Sidebar;
