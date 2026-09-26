import React, { useState } from 'react';
import { Search, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { QUICK_SEARCH_CHIPS } from '../../config/poiTypes';

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

  React.useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchQuery(inputValue);
    setActiveContentTab('facilities');
  };

  const handleClear = () => {
    setInputValue('');
    setSearchQuery('');
  };

  const handleChipClick = (query: string) => {
    setInputValue(query);
    setSearchQuery(query);
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
        <button
          type="submit"
          aria-label="搜索沿途设施"
          style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
        >
          {isSearching ? (
            <Loader2 size={16} color="#1875ff" className="animate-spin" />
          ) : (
            <Search size={16} color="#94a3b8" />
          )}
        </button>
        <input
          type="text"
          className="search-input"
          placeholder="搜索沿途的酒店、民宿、餐厅、加油站、充电站、公厕..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center'
            }}
            title="清空搜索词"
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          className="scope-selector-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span>{searchScope === 'trip' ? '全程走廊' : '当前路段'}</span>
          <ChevronDown size={14} color="#64748b" />
        </button>
      </form>

      {/* 快捷推荐词 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '4px',
          paddingLeft: '4px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}
      >
        <span style={{ fontSize: '10.5px', color: '#94a3b8', flexShrink: 0 }}>顺路推荐:</span>
        {QUICK_SEARCH_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => handleChipClick(chip.query)}
            style={{
              background: searchQuery === chip.query ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${searchQuery === chip.query ? '#bfdbfe' : '#e2e8f0'}`,
              color: searchQuery === chip.query ? '#1875ff' : '#475569',
              fontSize: '10.5px',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: '99px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

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
            搜索范围
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
