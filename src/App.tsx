import React from 'react';
import { Header } from './components/layout/Header';
import { SidebarLeft } from './components/layout/SidebarLeft';
import { CenterMapArea } from './components/layout/CenterMapArea';
import { RightPanel } from './components/layout/RightPanel';
import { OvernightDecisionModal } from './components/overnight/OvernightDecisionModal';
import { useTripStore } from './store/useTripStore';

export const App: React.FC = () => {
  useTripStore();
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, '__tripStore', {
      get: () => useTripStore.getState(),
      configurable: true
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Header />
      <div className="app-workspace">
        <SidebarLeft />
        <CenterMapArea />
        <RightPanel />
      </div>
      <OvernightDecisionModal />
    </div>
  );
};

export default App;
