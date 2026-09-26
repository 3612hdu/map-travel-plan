import React, { useEffect, useState } from 'react';
import { useTripStore } from '../../store/useTripStore';
import { FacilityCategory } from '../../types/poi';
import { FacilityCard } from './FacilityCard';
import { searchCorridorPois } from '../../services/corridorSearch';

export const FacilityTab: React.FC = () => {
  const {
    facilities,
    setFacilities,
    selectedCategory,
    setSelectedCategory,
    selectedPoiId,
    focusPoi,
    activeSegmentId,
    segments,
    selectedOptions,
    routeResults,
    searchQuery,
    searchScope
  } = useTripStore();

  const [showOnMap, setShowOnMap] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const currentSeg = segments.find((s) => s.id === activeSegmentId);

  // 监听搜索词、分类、以及路段切换，触发高德走廊搜索
  useEffect(() => {
    let isCancelled = false;

    async function triggerCorridorSearch() {
      if (!currentSeg) return;

      const optId = selectedOptions[currentSeg.id] || currentSeg.chosen;
      const res = routeResults[`${currentSeg.id}:${optId}`];

      // 如果是全程模式，拼接全程路线
      let searchPath = res?.path || [];
      if (searchScope === 'trip') {
        const fullPath: [number, number][] = [];
        segments.forEach((seg) => {
          const segOptId = selectedOptions[seg.id] || seg.chosen;
          const segRes = routeResults[`${seg.id}:${segOptId}`];
          if (segRes?.path) fullPath.push(...segRes.path);
        });
        if (fullPath.length > 0) searchPath = fullPath;
      }

      setIsSearching(true);
      try {
        const results = await searchCorridorPois(
          searchQuery,
          selectedCategory,
          searchPath,
          currentSeg.id
        );
        if (!isCancelled) {
          setFacilities(results);
        }
      } catch (err) {
        console.error('走廊搜索失败:', err);
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }

    triggerCorridorSearch();

    return () => {
      isCancelled = true;
    };
  }, [
    searchQuery,
    selectedCategory,
    searchScope,
    activeSegmentId,
    selectedOptions,
    routeResults
  ]);

  // 当地图 Marker 被点击选中时，右侧卡片列表平滑滚动并高亮
  useEffect(() => {
    if (selectedPoiId) {
      const el = document.getElementById(`facility-card-${selectedPoiId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedPoiId]);

  const categories: { key: FacilityCategory; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'hotel', label: '酒店/民宿' },
    { key: 'food', label: '餐饮' },
    { key: 'gas', label: '加油站' },
    { key: 'ev', label: '充电站' },
    { key: 'toilet', label: '厕所' },
    { key: 'parking', label: '停车场' }
  ];

  const getCategoryCount = (cat: FacilityCategory) => {
    if (cat === 'all') return facilities.length;
    return facilities.filter((p) => p.category === cat).length;
  };

  return (
    <div className="right-tab-content">
      {/* 分类药丸过滤条 */}
      <div className="category-filter-bar">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`filter-pill ${selectedCategory === c.key ? 'active' : ''}`}
            onClick={() => setSelectedCategory(c.key)}
          >
            {c.label} ({getCategoryCount(c.key)})
          </button>
        ))}
      </div>

      {/* 检索作用域与结果提示条 (对齐图 02, 03) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
          fontSize: '11.5px',
          color: '#475569'
        }}
      >
        <div>
          <span>
            {searchScope === 'trip' ? '全程自驾走廊' : currentSeg?.title} · 沿线附近 · 共{' '}
            <strong>{facilities.length}</strong> 个设施
          </span>
          {isSearching && (
            <span style={{ color: '#1875ff', marginLeft: '6px' }}>
              (正在沿道路搜索...)
            </span>
          )}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11px'
          }}
        >
          <input
            type="checkbox"
            checked={showOnMap}
            onChange={(e) => setShowOnMap(e.target.checked)}
          />
          <span>在地图上显示</span>
        </label>
      </div>

      {/* 设施卡片滚动列表 */}
      <div className="facilities-scroll-list">
        {facilities.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '13px'
            }}
          >
            本段道路沿线暂未发现对应设施，可尝试放宽搜索词或切换为“全程”。
          </div>
        ) : (
          facilities.map((poi) => (
            <FacilityCard
              key={poi.id}
              poi={poi}
              isSelected={selectedPoiId === poi.id}
              onSelect={() => focusPoi(poi.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
