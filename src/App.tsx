import React from 'react';
import { Header } from './components/layout/Header';
import { SidebarLeft } from './components/layout/SidebarLeft';
import { CenterMapArea } from './components/layout/CenterMapArea';
import { RightPanel } from './components/layout/RightPanel';
import { OvernightDecisionModal } from './components/overnight/OvernightDecisionModal';
import { useTripStore } from './store/useTripStore';

export const App: React.FC = () => {
  const store = useTripStore();
  if (typeof window !== 'undefined') {
    (window as any).__tripStore = store;
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
