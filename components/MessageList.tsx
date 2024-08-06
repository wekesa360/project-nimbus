import React, { useEffect, useRef } from 'react'
import Image from 'next/image'
import { format, isToday, isYesterday } from 'date-fns'
import { Message, UserData } from '@/types'

interface MessageListProps {
  messages: Message[];
  participants: {[key: string]: UserData};
  currentUserId: string | undefined;
  chatType: 'private' | 'group' | 'ai';
  hasMore: boolean;
  lastMessageRef: React.RefObject<HTMLDivElement>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  renderMessage: (message: Message) => string;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  participants, 
  currentUserId, 
  chatType, 
  hasMore, 
  lastMessageRef, 
  chatContainerRef,
  renderMessage
}) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const renderDateDivider = (date: Date) => {
    let dateString;
    if (isToday(date)) {
      dateString = 'Today';
    } else if (isYesterday(date)) {
      dateString = 'Yesterday';
    } else {
      dateString = format(date, 'MMMM d, yyyy');
    }
    return (
      <div className="text-center my-4">
        <span className="bg-base-300 text-base-content px-2 py-1 rounded-full text-sm">
          {dateString}
        </span>
      </div>
    );
  };

  const renderUserAvatar = (userId: string) => {
    const user = participants[userId]
    if (!user) return null

    if (user.image) {
      return (
        <Image src={user.image} alt={user.username} width={40} height={40} className="rounded-full" />
      )
    } else {
      return (
        <div className="avatar placeholder">
          <div className="bg-neutral-focus text-neutral-content rounded-full w-10">
            <span className="text-xl">{user.username.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      )
    }
  }

  const groupMessagesByDay = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach((message) => {
      const date = message.timestamp?.toDate();
      if (date) {
        const key = format(date, 'yyyy-MM-dd');
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(message);
      }
    });
    return groups;
  };

  const groupedMessages = groupMessagesByDay(messages)

  return (
    <div ref={chatContainerRef} className="h-[60vh] overflow-y-auto p-4 scrollbar-hide">
      {hasMore && (
        <div ref={lastMessageRef} className="text-center my-4">
          <span className="loading loading-dots loading-sm"></span>
        </div>
      )}
      {Object.entries(groupedMessages).map(([date, msgs]) => (
        <div key={date}>
          {renderDateDivider(new Date(date))}
          {msgs.map((message) => (
            <div 
              key={message.id} 
              className={`chat ${message.senderId === currentUserId ? 'chat-end' : 'chat-start'}`}
            >
              {chatType === 'group' && message.senderId !== currentUserId && (
                <div className="chat-image avatar">
                  {renderUserAvatar(message.senderId)}
                </div>
              )}
              <div className="chat-header mb-1">
                {chatType === 'group' && message.senderId !== currentUserId && (
                  <span className="text-xs font-bold">{participants[message.senderId]?.username}</span>
                )}
              </div>
              <div className={`chat-bubble ${message.senderId === currentUserId ? 'chat-bubble-primary' : 'chat-bubble-secondary'}`}>
                {message.type === 'text' && renderMessage(message)}
                {message.type === 'image' && (
                  <Image src={message.fileUrl!} alt="Uploaded image" width={200} height={200} />
                )}
                {message.type === 'file' && (
                  <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="link">
                    {typeof message.content === 'string' ? message.content : 'File'}
                  </a>
                )}
              </div>
              <div className="chat-footer opacity-50 text-xs">
                {format(new Date(message.timestamp?.toDate()), 'h:mm a')}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div ref={endOfMessagesRef} />
    </div>
  )
}

export default MessageList