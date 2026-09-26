import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Layers, MapPin } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { FacilityCategory, RoutePoi } from '../../types/poi';
import { FacilityCard } from './FacilityCard';
import { searchCorridorPois, SegmentPathInfo } from '../../services/corridorSearch';
import { FACILITY_CATEGORIES } from '../../config/poiTypes';

const DEFAULT_PAGE_SIZE = 20;

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
    setSearchQuery,
    searchVersion,
    searchScope,
    showFacilitiesOnMap,
    setShowFacilitiesOnMap
  } = useTripStore();

  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const currentSeg = segments.find((s) => s.id === activeSegmentId);

  // 搜索条件变化时，默认收起并重置为展示 Top 20
  useEffect(() => {
    setIsExpanded(false);
    listRef.current?.scrollTo({ top: 0 });
  }, [searchQuery, selectedCategory, searchScope, activeSegmentId]);

  const currentSegOptId = currentSeg ? (selectedOptions[currentSeg.id] || currentSeg.chosen) : '';
  const currentSegPath = currentSeg ? routeResults[`${currentSeg.id}:${currentSegOptId}`]?.path : undefined;
  const currentSegPathPoints = currentSegPath?.length || 0;

  // 全程模式下的有效路段数与总点数
  const totalTripPoints = useMemo(() => {
    return Object.values(routeResults).reduce((acc, r) => acc + (r?.path?.length || 0), 0);
  }, [routeResults]);

  const routePathVersion = searchScope === 'trip' ? totalTripPoints : currentSegPathPoints;

  // 监听搜索词、分类、以及路段切换，触发高德走廊搜索
  useEffect(() => {
    let isCancelled = false;

    async function triggerCorridorSearch() {
      if (!currentSeg) return;

      const optId = selectedOptions[currentSeg.id] || currentSeg.chosen;
      const res = routeResults[`${currentSeg.id}:${optId}`];

      // 构建所有路段信息 (供全程模式下标注 POI 所属赛段与天数)
      const allSegmentsInfo: SegmentPathInfo[] = segments.map((seg) => {
        const segOptId = selectedOptions[seg.id] || seg.chosen;
        const segRes = routeResults[`${seg.id}:${segOptId}`];
        return {
          segmentId: seg.id,
          segmentTitle: seg.title,
          day: seg.day,
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

      console.log(
        '[FacilityTab] triggerCorridorSearch called:',
        { searchQuery, selectedCategory, searchScope, searchPathPoints: searchPath.length }
      );
      setIsSearching(true);
      try {
        const results = await searchCorridorPois(
          searchQuery,
          selectedCategory,
          searchPath,
          currentSeg.id,
          allSegmentsInfo,
          searchScope
        );
        console.log('[FacilityTab] searchCorridorPois returned:', results.length, 'isCancelled:', isCancelled);
        if (!isCancelled) {
          setFacilities(results);
        }
      } catch (err) {
        console.error('[FacilityTab] 走廊搜索失败:', err);
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
    searchVersion,
    selectedCategory,
    searchScope,
    activeSegmentId,
    routePathVersion
  ]);

  const categories: { key: FacilityCategory; label: string; emoji: string }[] = [
    { key: 'all', label: '全部', emoji: '📍' },
    { key: 'hotel', label: '酒店', emoji: '🏨' },
    { key: 'homestay', label: '民宿', emoji: '🏡' },
    { key: 'food', label: '餐饮', emoji: '🍴' },
    { key: 'gas', label: '加油站', emoji: '⛽' },
    { key: 'ev', label: '充电站', emoji: '⚡' },
    { key: 'toilet', label: '厕所', emoji: '🚾' },
    { key: 'parking', label: '停车场', emoji: '🅿️' }
  ];

  const filteredFacilities = useMemo(() => {
    if (selectedCategory === 'all') return facilities;
    return facilities.filter((p) => p.category === selectedCategory);
  }, [facilities, selectedCategory]);

  const getCategoryCount = (cat: FacilityCategory) => {
    if (cat === 'all') return facilities.length;
    return facilities.filter((p) => p.category === cat).length;
  };

  // 结果数量与排序：默认仅展示最相关的 Top 20，避免直接铺满 100+ 条
  const displayedFacilities = useMemo(() => {
    if (isExpanded) return filteredFacilities;
    return filteredFacilities.slice(0, DEFAULT_PAGE_SIZE);
  }, [filteredFacilities, isExpanded]);

  // 当地图 Marker 被点击选中时，右侧卡片列表平滑滚动并高亮
  useEffect(() => {
    if (selectedPoiId) {
      const targetIndex = filteredFacilities.findIndex((p) => p.id === selectedPoiId);
      if (targetIndex >= DEFAULT_PAGE_SIZE && !isExpanded) {
        setIsExpanded(true);
      }
      const timer = setTimeout(() => {
        const el = document.getElementById(`facility-card-${selectedPoiId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [selectedPoiId, filteredFacilities, isExpanded]);

  // 全程模式下按 Day 与 Segment 分组 (赋予旅行上下文)
  const groupedTripFacilities = useMemo(() => {
    if (searchScope !== 'trip') return null;

    const days = [1, 2];
    const dayGroups = days.map((dayNum) => {
      const daySegments = segments.filter((s) => s.day === dayNum);
      const segGroups = daySegments
        .map((seg) => {
          const segPois = displayedFacilities.filter(
            (p) => p.sourceSegmentId === seg.id
          );
          return {
            segmentId: seg.id,
            segmentTitle: seg.title,
            pois: segPois
          };
        })
        .filter((g) => g.pois.length > 0);

      const totalDayCount = segGroups.reduce((acc, g) => acc + g.pois.length, 0);

      return {
        day: dayNum,
        segments: segGroups,
        totalCount: totalDayCount
      };
    }).filter((d) => d.totalCount > 0);

    // 未归属具体赛段的 POI 兜底
    const assignedIds = new Set(
      dayGroups.flatMap((d) => d.segments.flatMap((s) => s.pois.map((p) => p.id)))
    );
    const unassigned = displayedFacilities.filter((p) => !assignedIds.has(p.id));

    return {
      dayGroups,
      unassigned
    };
  }, [searchScope, displayedFacilities, segments]);

  const handleCategorySelect = (catKey: FacilityCategory) => {
    setSelectedCategory(catKey);
    // 若当前输入词属于其他分类名称，清空以让分类默认关键词生效
    if (searchQuery && Object.values(FACILITY_CATEGORIES).some((c) => c.label === searchQuery || c.key === searchQuery)) {
      setSearchQuery('');
    }
  };

  return (
    <div className="right-tab-content facilities-tab-content">
      {/* 分类药丸过滤条 */}
      <div className="category-filter-bar">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`filter-pill ${selectedCategory === c.key ? 'active' : ''}`}
            onClick={() => handleCategorySelect(c.key)}
          >
            <span>{c.emoji}</span>
            <span>{c.label}</span>
            <span style={{ fontSize: '11px', opacity: 0.75 }}>({getCategoryCount(c.key)})</span>
          </button>
        ))}
      </div>

      {/* 检索作用域与结果提示条 */}
      <div
        className="facility-results-summary"
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
            {searchScope === 'trip' ? '全程自驾走廊' : currentSeg?.title} · 共{' '}
            <strong style={{ color: '#0f172a' }}>{filteredFacilities.length}</strong> 处顺路设施
          </span>
          {filteredFacilities.length > DEFAULT_PAGE_SIZE && !isExpanded && (
            <span style={{ color: '#64748b', marginLeft: '4px' }}>
              (默认展示前 {DEFAULT_PAGE_SIZE} 处)
            </span>
          )}
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
      <div className="facilities-scroll-list" ref={listRef} tabIndex={0} aria-label="沿途设施列表">
        {filteredFacilities.length === 0 ? (
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
        ) : searchScope === 'trip' && groupedTripFacilities ? (
          // =========================================================
          // 全程模式：按 Day 与 Segment 分组渲染 (赋予清晰自驾上下文)
          // =========================================================
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 4px' }}>
            {groupedTripFacilities.dayGroups.map((dayGroup) => (
              <div
                key={`day-${dayGroup.day}`}
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                {/* Day 标题栏 */}
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#1e293b'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Layers size={13} color="#2563eb" />
                    <span>Day {dayGroup.day} 自驾走廊</span>
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    共 {dayGroup.totalCount} 处设施
                  </span>
                </div>

                {/* 赛段子列表 */}
                <div style={{ padding: '8px' }}>
                  {dayGroup.segments.map((segGroup) => (
                    <div key={segGroup.segmentId} style={{ marginBottom: '10px' }}>
                      <div
                        style={{
                          padding: '4px 8px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#334155',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          marginBottom: '6px'
                        }}
                      >
                        <MapPin size={12} color="#059669" />
                        <span>{segGroup.segmentTitle}</span>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                          ({segGroup.pois.length}处)
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {segGroup.pois.map((poi) => (
                          <FacilityCard
                            key={poi.id}
                            poi={poi}
                            isSelected={selectedPoiId === poi.id}
                            onSelect={() => focusPoi(poi.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 兜底未匹配赛段的顺路设施 */}
            {groupedTripFacilities.unassigned.length > 0 && (
              <div style={{ padding: '8px' }}>
                <div
                  style={{
                    padding: '4px 8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#64748b',
                    marginBottom: '6px'
                  }}
                >
                  其他顺路设施 ({groupedTripFacilities.unassigned.length}处)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groupedTripFacilities.unassigned.map((poi) => (
                    <FacilityCard
                      key={poi.id}
                      poi={poi}
                      isSelected={selectedPoiId === poi.id}
                      onSelect={() => focusPoi(poi.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // =========================================================
          // 单赛段模式：直接渲染本段的顺路卡片
          // =========================================================
          displayedFacilities.map((poi) => (
            <FacilityCard
              key={poi.id}
              poi={poi}
              isSelected={selectedPoiId === poi.id}
              onSelect={() => focusPoi(poi.id)}
            />
          ))
        )}

        {/* 展开全部结果 / 收起按钮 (结果超过 20 条时呈现) */}
        {filteredFacilities.length > DEFAULT_PAGE_SIZE && (
          <div style={{ padding: '12px 14px', textAlign: 'center' }}>
            <button
              type="button"
              className="btn-expand-results"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                width: '100%',
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#1e293b',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} />
                  <span>收起至前 {DEFAULT_PAGE_SIZE} 处最相关设施</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>
                    查看全部结果 (共 {filteredFacilities.length} 处 · 已按综合相关度智能排序)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
