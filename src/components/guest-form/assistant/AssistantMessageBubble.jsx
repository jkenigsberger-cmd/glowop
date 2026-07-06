import ReactMarkdown from "react-markdown";

export default function AssistantMessageBubble({ message }) {
  const isUser = message.role === "user";
  // Hide the hidden token bootstrap message
  if (isUser && typeof message.content === "string" && message.content.startsWith("[FORM_TOKEN]")) return null;

  return (
    <div className={isUser ? "flex justify-start" : "flex justify-end"}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser ? "bg-primary text-white" : "bg-slate-100 text-slate-800"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none [&_p]:my-1">
            {message.content || "..."}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}