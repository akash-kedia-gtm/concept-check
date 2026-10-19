import React from 'react';
import { Menu, ShieldAlert } from 'lucide-react';
import { LearnerProfile } from '../types';

interface HeaderProps {
  profile: LearnerProfile | null;
  onOpenSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenSidebar,
  showSidebarToggle = false,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#ffffff]/90 backdrop-blur-xl border-b border-[#E5E7EB] z-40 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {showSidebarToggle && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="md:hidden p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
            aria-label="Open assessment history"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-[#004ac6] text-white flex items-center justify-center font-semibold text-sm shadow-sm shadow-[#004ac6]/30">
            C
          </span>
          <span className="font-semibold text-lg tracking-tight text-[#111827]">
            Concept Check
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Subtle, non-interactive Preview Mode Notice as required by Section 7 */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f1f3ff] text-[#545f73] border border-[#dce2f7] text-[11px] font-medium tracking-tight">
          <span className="w-1.5 h-1.5 rounded-full bg-[#004ac6]/80" />
          <span>Preview mode — AI & database not connected</span>
        </div>

        {profile && (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-[#d8e3fb] text-[#111c2d] flex items-center justify-center text-xs font-semibold uppercase tracking-wider"
              title={`Logged in as ${profile.name} (@${profile.username})`}
            >
              {profile.name.charAt(0)}
            </div>
            <span className="hidden md:inline-block text-xs font-medium text-[#545f73] max-w-[120px] truncate">
              {profile.name}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
