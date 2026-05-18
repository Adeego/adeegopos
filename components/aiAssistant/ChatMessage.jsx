import { Bot, User } from 'lucide-react';

export default function ChatMessage({ role, content }) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-emerald-100 text-emerald-700'
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted text-foreground'
      }`}>
        <MessageContent content={content} />
      </div>
    </div>
  );
}

function MessageContent({ content }) {
  if (!content) return null;

  // Simple markdown-like rendering: bold, bullet points, line breaks
  const lines = content.split('\n');

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <div key={i} className="flex gap-1.5 ml-1">
              <span className="mt-0.5">•</span>
              <span>{formatInline(line.trim().slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numberedMatch = line.trim().match(/^(\d+)\.\s(.+)/);
        if (numberedMatch) {
          return (
            <div key={i} className="flex gap-1.5 ml-1">
              <span className="font-medium">{numberedMatch[1]}.</span>
              <span>{formatInline(numberedMatch[2])}</span>
            </div>
          );
        }

        return <p key={i}>{formatInline(line)}</p>;
      })}
    </div>
  );
}

function formatInline(text) {
  // Handle **bold** and *bold* patterns
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Match **bold** first
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Then *italic/bold*
    const singleBoldMatch = !boldMatch ? remaining.match(/\*(.+?)\*/) : null;

    const match = boldMatch || singleBoldMatch;
    if (match) {
      const beforeText = remaining.substring(0, match.index);
      if (beforeText) parts.push(<span key={key++}>{beforeText}</span>);
      parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
      remaining = remaining.substring(match.index + match[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts.length > 0 ? parts : text;
}
