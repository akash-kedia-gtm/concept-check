import React from 'react';
import { Terminal, Clock } from 'lucide-react';
import { ChatMessage } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  topic?: string;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, topic }) => {
  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full">
      {messages.map((msg, index) => {
        const isAssistant = msg.role === 'assistant';

        if (isAssistant) {
          const isInitialPrompt = msg.type === 'question';

          return (
            <article
              key={msg.id || index}
              className="flex flex-col gap-1.5 w-full bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6 shadow-sm transition-all"
            >
              {/* Speaker header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded bg-[#004ac6] text-white flex items-center justify-center text-[10px] font-semibold">
                  C
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#004ac6]">
                  {msg.speakerName}
                </span>
                <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
                <span className="text-[11px] text-[#9CA3AF]">
                  {isInitialPrompt ? 'Primary Prompt' : 'Follow-up Inquiry'}
                </span>
              </div>

              {/* Message text content */}
              <div className="text-base sm:text-[17px] text-[#111827] font-normal leading-relaxed pt-0.5 whitespace-pre-wrap">
                {msg.content}
              </div>

              {/* Metadata tags for primary question prompt */}
              {isInitialPrompt && topic && (
                <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex flex-wrap items-center gap-4 text-[#6B7280] text-xs">
                  <span className="flex items-center gap-1.5 font-normal">
                    <Terminal className="w-3.5 h-3.5 text-[#004ac6]" />
                    <span>Topic: {topic}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[#9CA3AF]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Untimed reflection</span>
                  </span>
                </div>
              )}
            </article>
          );
        }

        // Learner Message
        const isRetry = msg.type === 'retry';
        const initial = msg.speakerName ? msg.speakerName.trim().charAt(0).toUpperCase() : 'L';

        return (
          <article
            key={msg.id || index}
            className="flex flex-col gap-1.5 w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-5 sm:p-6 shadow-xs transition-all"
          >
            {/* Learner Speaker Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#d8e3fb] text-[#111c2d] flex items-center justify-center text-[10px] font-semibold uppercase">
                {initial}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                {msg.speakerName}
              </span>
              <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
              <span className="text-[11px] text-[#9CA3AF]">
                {isRetry ? 'Follow-up Revision' : 'Initial Explanation'}
              </span>
            </div>

            {/* Message text */}
            <div className="text-base text-[#111827] font-normal leading-relaxed pt-0.5 whitespace-pre-wrap">
              {msg.content}
            </div>
          </article>
        );
      })}
    </div>
  );
};
