import React, { useState, useEffect } from "react";
import ApiService from "../services/ApiService";
import { X, UserPlus } from "lucide-react";
import UserProfileModal from "./UserProfileModal";

const Contacts = ({ onClose, onStartChat }) => {
  const [contacts, setContacts] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeTab, setActiveTab] = useState("contacts");
  const [selectedContact, setSelectedContact] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    loadContacts();
    loadFriendRequests();
    loadSuggestions();
  }, [activeTab]);

  const loadContacts = async () => {
    try {
      const data = await ApiService.get("/contacts/");
      setContacts(data);
    } catch (error) {
      console.error("Failed to load contacts:", error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const data = await ApiService.get("/contacts/requests/?type=received");
      console.log("my requests", data);
      setFriendRequests(data);
    } catch (error) {
      console.error("Failed to load friend requests:", error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const data = await ApiService.get("/contacts/suggestions/");
      setSuggestions(data);
    } catch (error) {
      console.error("Failed to load contact suggestions:", error);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await ApiService.post(`/contacts/requests/${requestId}/accept/`, {});
      loadFriendRequests();
      loadContacts();
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await ApiService.post(`/contacts/requests/${requestId}/decline/`, {});
      loadFriendRequests();
    } catch (error) {
      console.error("Failed to decline friend request:", error);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      console.log("Sending friend request to user ID:", userId);
      const response = await ApiService.post(`/contacts/requests/send/`, {
        user_id: userId,
      });
      console.log("Friend request response:", response);
      loadSuggestions();
      // Reload friend requests to see the pending request
      loadFriendRequests();
    } catch (error) {
      console.error("Failed to send contact request:", error);
      console.error("Error details:", error);
    }
  };

  // Handler for opening the profile modal
  const handleContactClick = (contact) => {
    setSelectedContact(contact.contact_user);
    setShowProfileModal(true);
  };

  // Handler for messaging from the modal
  const handleMessage = async () => {
    if (selectedContact) {
      onStartChat(selectedContact);
    }
  };

  // Handler for call (placeholder)
  const handleCall = () => {
    alert("Call feature coming soon!");
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Contacts</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === "contacts"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Contacts
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === "requests"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Requests ({friendRequests.length})
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "contacts" ? (
          <div className="p-4 space-y-3">
            {contacts &&
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                  onClick={() => handleContactClick(contact)}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {contact.contact_user.username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {contact.contact_user.username}
                    </h3>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <>
            <div className="p-4 space-y-3">
              {friendRequests.length > 0 ? (
                friendRequests.map((request) => (
                  <div key={request.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {request.from_user?.username?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {request.from_user?.username}
                        </h3>
                        <p className="text-sm text-gray-500">
                          wants to connect
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="flex-1 bg-blue-500 text-white py-2 px-3 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-3 rounded-lg text-sm hover:bg-gray-400 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-700 ">No Request</div>
              )}
            </div>
            {/* Suggestions Section */}
            <div className="border-t border-gray-200 mt-2 pt-4 px-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                <UserPlus className="h-5 w-5 mr-2 text-blue-500" />
                Suggestions
              </h4>
              {suggestions.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {suggestions.map((user) => (
                    <div
                      key={user.id}
                      className="bg-gray-50 rounded-lg p-3 flex flex-col items-center"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2">
                        {user.username?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-900">
                          {user.username}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.first_name} {user.last_name}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        className="mt-2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-600 transition-colors"
                      >
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center">
                  No suggestions available
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {/* User Profile Modal */}
      <UserProfileModal
        user={selectedContact}
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onMessage={handleMessage}
        onCall={handleCall}
      />
    </div>
  );
};

export default Contacts;
