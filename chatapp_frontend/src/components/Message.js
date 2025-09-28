import React from "react";

const Message = ({ message, isOwn }) => {
  // console.log("Message object being rendered:", message);
  return (
    <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-xs lg:max-w-2xl px-4 pr-16 py-2 rounded-2xl ${
          isOwn
            ? "bg-blue-500 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        {/* {console.log("msg file: ", message)} */}
        {/* Render reply_to if present and is an object with content */}
        {/* {message.reply_to &&
          typeof message.reply_to === "object" &&
          typeof message.reply_to.content === "string" && (
            <div className="text-xs text-gray-400 mb-1">
              Replying to: {message.reply_to.content}
            </div>
          )} */}
        {/* Show sender username if available and not own message */}
        {!isOwn &&
          message.sender &&
          typeof message.sender.username === "string" && (
            <div className="text-xs text-gray-500 font-semibold mb-1">
              {message.sender.username}
            </div>
          )}
        <p className="text-sm">
          {typeof message.content === "string"
            ? message.content
            : "[Invalid message content]"}
        </p>
        <p
          className={`text-xs mt-1 ${
            isOwn ? "text-blue-100" : "text-gray-500"
          }`}
        >
          {typeof message.created_at === "string" ||
          typeof message.created_at === "number"
            ? new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </p>
      </div>
    </div>
  );
};

export default Message;
