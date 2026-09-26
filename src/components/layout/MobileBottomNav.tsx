import React from 'react';
import { Map, Route, Image, Fuel } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';

export const MobileBottomNav: React.FC = () => {
  const { mobileActiveTab, setMobileActiveTab } = useTripStore();

  const navItems = [
    {
      id: 'map' as const,
      label: '地图方案',
      icon: Map
    },
    {
      id: 'trip' as const,
      label: '行程分段',
      icon: Route
    },
    {
      id: 'media' as const,
      label: '沿途影像',
      icon: Image
    },
    {
      id: 'facilities' as const,
      label: '沿途设施',
      icon: Fuel
    }
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="移动端底部导航">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = mobileActiveTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => setMobileActiveTab(item.id)}
            aria-pressed={isActive}
            id={`btn-mobile-nav-${item.id}`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
