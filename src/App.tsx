import React, { useState, useEffect } from 'react';
import { LearnerProfile, RoundSession, ScreenState } from './types';
import { identityService } from './services/identityService';
import { assessmentService } from './services/assessmentService';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SignupScreen } from './components/SignupScreen';
import { StartScreen } from './components/StartScreen';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ThankYouScreen } from './components/ThankYouScreen';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('signup');
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [activeRound, setActiveRound] = useState<RoundSession | null>(null);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  // Restore session state on refresh if available locally
  useEffect(() => {
    const hydrateState = async () => {
      try {
        const existingProfile = await identityService.getExistingProfile();
        if (existingProfile) {
          setProfile(existingProfile);

          // Check if an active assessment run was started
          const rounds = await assessmentService.getAllActiveRounds();
          if (rounds.length > 0) {
            const lastRound = rounds[rounds.length - 1];
            if (lastRound.questionNumber === 10 && lastRound.status === 'completed') {
              setScreen('thank_you');
            } else {
              setActiveRound(lastRound);
              setScreen('chat_workspace');
            }
          } else {
            setScreen('start');
          }
        } else {
          setScreen('signup');
        }
      } catch {
        setScreen('signup');
      } finally {
        setIsHydrating(false);
      }
    };

    hydrateState();
  }, []);

  const handleProfileCreated = (newProfile: LearnerProfile) => {
    setProfile(newProfile);
    setScreen('start');
  };

  const handleAssessmentStarted = (firstRound: RoundSession) => {
    setActiveRound(firstRound);
    setScreen('chat_workspace');
  };

  const handleAssessmentCompleted = () => {
    setScreen('thank_you');
  };

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-[#f9f9ff] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-medium text-[#6B7280]">
          <span className="w-2 h-2 rounded-full bg-[#004ac6] animate-pulse" />
          <span>Restoring session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#141b2b] flex flex-col font-sans">
      {/* Top Header */}
      <Header
        profile={profile}
        showSidebarToggle={screen === 'chat_workspace'}
        onOpenSidebar={() => setIsSidebarOpenMobile(true)}
      />

      {/* Main Screen Router */}
      <main className="flex-1 w-full pt-16 flex flex-col">
        {screen === 'signup' && (
          <div className="flex-1 px-4 flex items-center justify-center">
            <SignupScreen onProfileCreated={handleProfileCreated} />
          </div>
        )}

        {screen === 'start' && profile && (
          <div className="flex-1 px-4 flex items-center justify-center">
            <StartScreen
              profile={profile}
              onAssessmentStarted={handleAssessmentStarted}
            />
          </div>
        )}

        {screen === 'chat_workspace' && profile && activeRound && (
          <ChatWorkspace
            profile={profile}
            initialRound={activeRound}
            onAssessmentCompleted={handleAssessmentCompleted}
            isSidebarOpenMobile={isSidebarOpenMobile}
            onCloseSidebarMobile={() => setIsSidebarOpenMobile(false)}
          />
        )}

        {screen === 'thank_you' && (
          <div className="flex-1 px-4 flex items-center justify-center">
            <ThankYouScreen />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
