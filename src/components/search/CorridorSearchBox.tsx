import React, { useState } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';

export const CorridorSearchBox: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    setActiveContentTab,
    isSearching
  } = useTripStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(inputValue);
    // 触发搜索时，根据需求必须自动切到“沿途设施”Tab展示结果
    setActiveContentTab('facilities');
  };

  const selectScope = (scope: 'trip' | 'segment') => {
    setSearchScope(scope);
    setIsDropdownOpen(false);
    setActiveContentTab('facilities');
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '560px' }}>
      <form onSubmit={handleSearchSubmit} className="search-corridor-wrapper">
        <Search size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
        <input
          type="text"
          className="search-input"
          placeholder="搜索沿途的酒店、餐厅、加油站、充电站、景点、厕所等..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button
          type="button"
          className="scope-selector-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span>{searchScope === 'trip' ? '全程' : '当前路段'}</span>
          <ChevronDown size={14} color="#64748b" />
        </button>
      </form>

      {/* 搜索作用域下拉菜单 */}
      {isDropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: '46px',
            right: '0',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            zIndex: 110,
            width: '160px',
            overflow: 'hidden',
            padding: '4px'
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              color: '#94a3b8',
              fontWeight: 700
            }}
          >
            搜索搜索范围
          </div>
          <button
            type="button"
            onClick={() => selectScope('segment')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              fontSize: '12.5px',
              fontWeight: 650,
              color: searchScope === 'segment' ? '#1875ff' : '#1e293b',
              background: searchScope === 'segment' ? '#eff6ff' : 'transparent',
              borderRadius: '8px',
              textAlign: 'left'
            }}
          >
            <span>当前路段沿途</span>
            {searchScope === 'segment' && <Check size={14} color="#1875ff" />}
          </button>
          <button
            type="button"
            onClick={() => selectScope('trip')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              fontSize: '12.5px',
              fontWeight: 650,
              color: searchScope === 'trip' ? '#1875ff' : '#1e293b',
              background: searchScope === 'trip' ? '#eff6ff' : 'transparent',
              borderRadius: '8px',
              textAlign: 'left'
            }}
          >
            <span>全程走廊搜索</span>
            {searchScope === 'trip' && <Check size={14} color="#1875ff" />}
          </button>
        </div>
      )}
    </div>
  );
};
