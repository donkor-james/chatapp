import React, { useState, useEffect } from "react";
import ApiService from "../services/ApiService";
import { X } from "lucide-react";

const Contacts = ({ onClose }) => {
  const [contacts, setContacts] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("contacts");

  useEffect(() => {
    loadContacts();
    loadFriendRequests();
  }, []);

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
      const data = await ApiService.get("/contacts/requests/");
      setFriendRequests(data);
    } catch (error) {
      console.error("Failed to load friend requests:", error);
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
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {contact.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{contact.name}</h3>
                  <p className="text-sm text-gray-500">{contact.email}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {friendRequests.map((request) => (
              <div key={request.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {request.from_user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {request.from_user?.name}
                    </h3>
                    <p className="text-sm text-gray-500">wants to connect</p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Contacts;
