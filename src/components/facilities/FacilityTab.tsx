import React, { useEffect, useState } from 'react';
import { useTripStore } from '../../store/useTripStore';
import { FacilityCategory } from '../../types/poi';
import { FacilityCard } from './FacilityCard';
import { searchCorridorPois, SegmentPathInfo } from '../../services/corridorSearch';
import { FACILITY_CATEGORIES } from '../../config/poiTypes';

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
    searchScope,
    showFacilitiesOnMap,
    setShowFacilitiesOnMap
  } = useTripStore();

  const [isSearching, setIsSearching] = useState(false);
  const currentSeg = segments.find((s) => s.id === activeSegmentId);

  // 监听搜索词、分类、以及路段切换，触发高德走廊搜索
  useEffect(() => {
    let isCancelled = false;

    async function triggerCorridorSearch() {
      if (!currentSeg) return;

      const optId = selectedOptions[currentSeg.id] || currentSeg.chosen;
      const res = routeResults[`${currentSeg.id}:${optId}`];

      // 构建所有路段信息 (供全程模式下标注 POI 所属赛段)
      const allSegmentsInfo: SegmentPathInfo[] = segments.map((seg) => {
        const segOptId = selectedOptions[seg.id] || seg.chosen;
        const segRes = routeResults[`${seg.id}:${segOptId}`];
        return {
          segmentId: seg.id,
          segmentTitle: seg.title,
          path: segRes?.path || []
        };
      });

      // 如果是全程模式，拼接全程路线
      let searchPath = res?.path || [];
      if (searchScope === 'trip') {
        const fullPath: [number, number][] = [];
        allSegmentsInfo.forEach((info) => {
          if (info.path.length > 0) fullPath.push(...info.path);
        });
        if (fullPath.length > 0) searchPath = fullPath;
      }

      setIsSearching(true);
      try {
        const results = await searchCorridorPois(
          searchQuery,
          selectedCategory,
          searchPath,
          currentSeg.id,
          allSegmentsInfo
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

  const categories: { key: FacilityCategory; label: string; emoji: string }[] = [
    { key: 'all', label: '全部', emoji: '📍' },
    { key: 'hotel', label: '酒店/民宿', emoji: '🏨' },
    { key: 'food', label: '餐饮', emoji: '🍴' },
    { key: 'gas', label: '加油站', emoji: '⛽' },
    { key: 'ev', label: '充电站', emoji: '⚡' },
    { key: 'toilet', label: '厕所', emoji: '🚾' },
    { key: 'parking', label: '停车场', emoji: '🅿️' }
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
            <span>{c.emoji}</span>
            <span>{c.label}</span>
            <span style={{ fontSize: '11px', opacity: 0.75 }}>({getCategoryCount(c.key)})</span>
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
            {searchScope === 'trip' ? '全程自驾走廊' : currentSeg?.title} · 顺路设施 · 共{' '}
            <strong style={{ color: '#0f172a' }}>{facilities.length}</strong> 处
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
            fontWeight: 650,
            fontSize: '11.5px',
            color: '#334155'
          }}
        >
          <input
            type="checkbox"
            checked={showFacilitiesOnMap}
            onChange={(e) => setShowFacilitiesOnMap(e.target.checked)}
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
