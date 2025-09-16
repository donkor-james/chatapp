import React, { useEffect, useState } from "react";
import ApiService from "../services/ApiService";
import { X } from "lucide-react";

const ContactPickerModal = ({ open, onClose, onSelect }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      ApiService.get("/contacts/")
        .then((data) => setContacts(data))
        .catch(() => setContacts([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg w-96 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold mb-4">Start Chat With...</h2>
        {loading ? (
          <div className="text-center text-gray-500">Loading contacts...</div>
        ) : (
          <ul className="space-y-2">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <button
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50"
                  onClick={() => onSelect(contact.contact_user)}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {contact.contact_user.username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="font-medium text-gray-900">
                    {contact.contact_user.username}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ContactPickerModal;
