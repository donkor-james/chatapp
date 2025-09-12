import React from "react";

const Notifications = () => {
  // This would typically fetch and display user notifications from the backend
  // For now, we'll show a placeholder UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Notifications</h2>
        <p className="text-gray-600">You have no new notifications.</p>
        {/* Later, map over notifications and display them here */}
      </div>
    </div>
  );
};

export default Notifications;
