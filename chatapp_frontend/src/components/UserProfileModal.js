import React from "react";
import Modal from "./Modal"; // If you have a generic Modal component, else use a div

const UserProfileModal = ({ user, open, onClose, onMessage, onCall }) => {
  if (!user) return null;
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 w-80 bg-white rounded-xl shadow-lg">
        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2">
            {user.username?.[0]?.toUpperCase() || "U"}
          </div>
          <h2 className="text-lg font-semibold mb-1">{user.username}</h2>
          <p className="text-gray-500 text-sm mb-1">{user.email}</p>
          <p className="text-gray-500 text-sm">
            {user.first_name} {user.last_name}
          </p>
        </div>
        <div className="flex justify-between mt-4">
          <button
            className="flex-1 mr-2 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold"
            onClick={onMessage}
          >
            Message
          </button>
          <button
            className="flex-1 ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-semibold"
            onClick={onCall}
            disabled
          >
            Call
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UserProfileModal;
