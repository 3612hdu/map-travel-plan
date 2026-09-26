import React from 'react';
import { Header } from './components/layout/Header';
import { SidebarLeft } from './components/layout/SidebarLeft';
import { CenterMapArea } from './components/layout/CenterMapArea';
import { RightPanel } from './components/layout/RightPanel';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { OvernightDecisionModal } from './components/overnight/OvernightDecisionModal';
import { NavigationPlanModal } from './components/navigation/NavigationPlanModal';
import { useTripStore } from './store/useTripStore';

export const App: React.FC = () => {
  const { isNavigationPlanModalOpen, setIsNavigationPlanModalOpen, mobileActiveTab } = useTripStore();
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, '__tripStore', {
      get: () => useTripStore.getState(),
      configurable: true
    });
  }

  return (
    <div className="app-root-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Header />
      <div className={`app-workspace mobile-view-${mobileActiveTab}`}>
        <SidebarLeft />
        <CenterMapArea />
        <RightPanel />
      </div>
      <MobileBottomNav />
      <OvernightDecisionModal />
      <NavigationPlanModal
        isOpen={isNavigationPlanModalOpen}
        onClose={() => setIsNavigationPlanModalOpen(false)}
      />
    </div>
  );
};

export default App;
