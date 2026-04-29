import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TopPage from './TopPage';             
import ExpertsPage from './ExpertsPage';     
import BeginnersPage from './BeginnersPage'; 
import SubsidyCard from './SubsidyCard';
import Header from './Header';
import Footer from './Footer';
import PublicColumns from './PublicColumns';
import Simulator from './Simulator'; 
import './EhimeSubsidyPortal.css'; 

import { 
  EHIME_MUNICIPALITIES, 
  getPurposeTagList, 
  getItemRegionCategories, 
  isItemClosed, 
  parseAmount, 
  getSortableDateTimestamp 
} from './portalHelpers';
import { supabase } from './lib/supabaseClient';

export default function EhimeSubsidyPortal() {
  const [subsidies, setSubsidies] = useState([]);
  const [latestColumns, setLatestColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [displayMode, setDisplayMode] = useState('open');
  const [sortBy, setSortBy] = useState('deadline');
  const [keyword, setKeyword] = useState('');
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedPurposes, setSelectedPurposes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 8;
  // 🔥 未使用だった const navigate = useNavigate(); は削除しました！

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    async function fetchData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('subsidies')
          .select('*')
          .eq('is_active', true)
          .eq('crawl_status', 'published')
          .order('fetched_at', { ascending: false });

        if (error) throw error;
        setSubsidies(data || []);

        const { data: colData } = await supabase
          .from('columns')
          .select('id, title, slug, published_at, created_at, category')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(3);
        if (colData) setLatestColumns(colData);

      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, displayMode, sortBy, selectedRegions, selectedPurposes]);

  const baseItems = useMemo(() => {
    let items = [...subsidies];
    if (displayMode === 'open') items = items.filter(item => !isItemClosed(item));
    else if (displayMode === 'closed') items = items.filter(item => isItemClosed(item));
    if (keyword !== '') {
      const lowerKeyword = keyword.toLowerCase();
      items = items.filter(item => {
        const targetEntitiesText = Array.isArray(item.target_entities_arr) ? item.target_entities_arr.join(' ') : item.target_entities || '';
        return ((item.title && item.title.toLowerCase().includes(lowerKeyword)) || (item.organization && item.organization.toLowerCase().includes(lowerKeyword)) || (item.summary && item.summary.toLowerCase().includes(lowerKeyword)) || targetEntitiesText.toLowerCase().includes(lowerKeyword));
      });
    }
    return items;
  }, [subsidies, displayMode, keyword]);

  const regionCounts = useMemo(() => {
    const counts = { '県・全国 (市町村指定なし)': 0 };
    EHIME_MUNICIPALITIES.forEach(city => { counts[city] = 0; });
    let items = baseItems;
    if (selectedPurposes.length > 0) items = items.filter(item => { const pList = getPurposeTagList(item); return selectedPurposes.some(p => pList.includes(p)); });
    items.forEach(item => { const cats = getItemRegionCategories(item); cats.forEach(cat => { if (counts[cat] !== undefined) counts[cat]++; }); });
    return counts;
  }, [baseItems, selectedPurposes]);

  const purposeCounts = useMemo(() => {
    const counts = {};
    let items = baseItems;
    if (selectedRegions.length > 0) items = items.filter(item => { const cats = getItemRegionCategories(item); return cats.some(cat => selectedRegions.includes(cat)); });
    items.forEach(item => { const pList = getPurposeTagList(item); Array.from(new Set(pList)).forEach(p => { counts[p] = (counts[p] || 0) + 1; }); });
    return counts;
  }, [baseItems, selectedRegions]);

  const displayItems = useMemo(() => {
    let items = [...baseItems];
    if (selectedRegions.length > 0) items = items.filter(item => { const cats = getItemRegionCategories(item); return cats.some(cat => selectedRegions.includes(cat)); });
    if (selectedPurposes.length > 0) items = items.filter(item => { const pList = getPurposeTagList(item); return selectedPurposes.some(purpose => pList.includes(purpose)); });
    items.sort((a, b) => {
      const aClosed = isItemClosed(a); const bClosed = isItemClosed(b);
      if (displayMode === 'all' && aClosed !== bClosed) return aClosed ? 1 : -1;
      if (sortBy === 'amount') { const aVal = a.amount_max_yen || parseAmount(a.amount_text || a.amount); const bVal = b.amount_max_yen || parseAmount(b.amount_text || b.amount); return bVal - aVal; }
      const dateA = getSortableDateTimestamp(a); const dateB = getSortableDateTimestamp(b);
      if (displayMode === 'closed') return dateB - dateA;
      return dateA - dateB;
    });
    return items;
  }, [baseItems, selectedRegions, selectedPurposes, sortBy, displayMode]);

  const totalItems = displayItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startCount = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endCount = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const paginatedItems = displayItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (page) => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const getPageNumbers = () => {
    let startPage = Math.max(1, currentPage - 2); let endPage = Math.min(totalPages, currentPage + 2);
    if (endPage - startPage < 4) { if (startPage === 1) endPage = Math.min(totalPages, 5); else if (endPage === totalPages) startPage = Math.max(1, totalPages - 4); }
    const pages = []; for (let i = startPage; i <= endPage; i++) pages.push(i); return pages;
  };

  const recentSubsidies = useMemo(() => subsidies.filter(item => !isItemClosed(item)).slice(0, 5), [subsidies]);
  const colors = { primary: '#526b5d', primaryText: '#2d3b33', border: '#e4e7e5', textMain: '#4b5550', textSub: '#8b9690', pageBg: '#fafafa' };

  return (
    <div className="portal-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div style={{ flex: 1 }}>
        <Routes>
          {/* トップページ */}
          <Route path="/" element={
            <>
              <Helmet>
                <title>愛媛の補助金・助成金ポータル | 松山市・今治市など県内支援制度を検索</title>
              </Helmet>
              <TopPage recentSubsidies={recentSubsidies} latestColumns={latestColumns} />
            </>
          } />

          {/* シミュレーター */}
          <Route path="/simulator" element={
            <>
              <Helmet>
                <title>IT導入補助金シミュレーター | 愛媛の補助金ポータル</title>
                <meta name="description" content="ITツールの導入でいくら補助金がもらえる？自社の条件を選ぶだけで、受け取れる補助金の目安が30秒でわかる無料シミュレーターです。" />
              </Helmet>
              <Simulator />
            </>
          } />

          {/* 専門家を探す */}
          <Route path="/experts" element={
            <>
              <Helmet>
                <title>専門家を探す | 愛媛の補助金ポータル</title>
                <meta name="description" content="補助金の申請をサポートしてくれる愛媛県内の専門家を探せます。" />
              </Helmet>
              <ExpertsPage />
            </>
          } />

          {/* はじめての方へ */}
          <Route path="/beginners" element={
            <>
              <Helmet>
                <title>はじめての方へ | 愛媛の補助金ポータル</title>
                <meta name="description" content="補助金の基礎知識や申請の流れをわかりやすく解説します。" />
              </Helmet>
              <BeginnersPage />
            </>
          } />

          {/* コラム一覧 */}
          <Route path="/columns" element={
            <>
              <Helmet>
                <title>お役立ちコラム | 愛媛の補助金ポータル</title>
                <meta name="description" content="愛媛県の補助金・助成金に関する最新情報や活用事例をコラムで紹介します。" />
              </Helmet>
              <PublicColumns />
            </>
          } />

          {/* 検索画面 */}
          <Route path="/search" element={
            <>
              <Helmet>
                <title>補助金・助成金を検索する | 愛媛の補助金ポータル</title>
                <meta name="description" content="愛媛県内の最新の補助金・助成金を目的や地域から絞り込み検索できます。" />
              </Helmet>

              <div className="main-wrapper">
                <div className="disclaimer-text">
                  掲載している情報は、AIを活用して収集・整理したデータをもとに作成しております。そのため、内容に誤りや最新情報との相違が含まれる可能性がございます。ご利用の際は、必ず各制度・事業の公式ページにて最新かつ正確な情報をご確認くださいますようお願いいたします。
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: colors.primaryText, marginBottom: '48px', textAlign: 'center' }}>
                  愛媛県の補助金・助成金・支援金一覧
                </h1>
                <div className="title-section">
                  <p style={{ color: colors.textSub, fontSize: '15px', margin: 0 }}>
                    該当する補助金・助成金 <span style={{ fontWeight: 'bold', fontSize: '24px', color: colors.primary, padding: '0 4px' }}>{totalItems}</span> 件
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }}>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '10px 40px 10px 16px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: 'white', color: colors.textMain, fontSize: '14px', outline: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <option value="deadline">締切が近い順</option>
                      <option value="amount">上限金額が高い順</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="layout-grid">
                <aside className="sidebar">
                  <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: `1px solid ${colors.border}`, boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: colors.primaryText, display: 'flex', alignItems: 'center', gap: '8px' }}><span>🔍</span> 絞り込み検索</div>
                    <div style={{ fontSize: '13px', marginBottom: '8px', color: colors.textSub }}>キーワードを入力</div>
                    <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="例: IT, 創業" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.border}`, outline: 'none', color: colors.textMain, boxSizing: 'border-box', fontSize: '14px', backgroundColor: '#f9fafb' }} />
                  </div>

                  <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '16px', border: `1px solid ${colors.border}`, boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: colors.primaryText, marginBottom: '16px' }}>👁️ 表示設定</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: colors.textMain }}><input type="checkbox" checked={displayMode === 'open'} onChange={() => setDisplayMode('open')} style={{ accentColor: colors.primary, width: '18px', height: '18px', cursor: 'pointer' }} />募集中のみ表示</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: colors.textMain }}><input type="checkbox" checked={displayMode === 'all'} onChange={() => setDisplayMode('all')} style={{ accentColor: colors.primary, width: '18px', height: '18px', cursor: 'pointer' }} />全て表示</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: colors.textMain }}><input type="checkbox" checked={displayMode === 'closed'} onChange={() => setDisplayMode('closed')} style={{ accentColor: colors.primary, width: '18px', height: '18px', cursor: 'pointer' }} />受付終了のみ表示</label>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: `1px solid ${colors.border}`, boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: colors.primaryText, marginBottom: '8px' }}>📍 対象地域で探す</div>
                    <div style={{ fontSize: '12px', color: colors.textSub, marginBottom: '16px' }}>※チェックなしで「すべて」表示されます</div>
                    <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '280px', overflowY: 'auto', paddingRight: '8px' }}>
                      {['県・全国 (市町村指定なし)', ...EHIME_MUNICIPALITIES].map(region => {
                        const count = regionCounts[region] || 0;
                        if (count === 0) return null;
                        return (
                          <label key={region} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '8px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: colors.textMain, flex: 1, minWidth: 0 }}>
                              <input type="checkbox" checked={selectedRegions.includes(region)} onChange={(e) => { if (e.target.checked) setSelectedRegions([...selectedRegions, region]); else setSelectedRegions(selectedRegions.filter(r => r !== region)); }} style={{ width: '18px', height: '18px', accentColor: colors.primary, cursor: 'pointer', flexShrink: 0 }} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '4px' }}>{region}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSub, backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', flexShrink: 0 }}>{count}件</div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: `1px solid ${colors.border}`, boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: colors.primaryText, marginBottom: '16px' }}>🏷 利用目的を選択</div>
                    <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '280px', overflowY: 'auto', paddingRight: '8px' }}>
                      {Object.entries(purposeCounts).sort((a, b) => b[1] - a[1]).map(([purpose, count]) => (
                          <label key={purpose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '8px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: colors.textMain, flex: 1, minWidth: 0 }}>
                              <input type="checkbox" checked={selectedPurposes.includes(purpose)} onChange={(e) => { if (e.target.checked) setSelectedPurposes([...selectedPurposes, purpose]); else setSelectedPurposes(selectedPurposes.filter(p => p !== purpose)); }} style={{ width: '18px', height: '18px', accentColor: colors.primary, cursor: 'pointer', flexShrink: 0 }} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '4px' }}>{purpose}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSub, backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', flexShrink: 0 }}>{count}件</div>
                          </label>
                        ))}
                      {Object.keys(purposeCounts).length === 0 && <span style={{ fontSize: '13px', color: colors.textSub }}>データがありません</span>}
                    </div>
                  </div>
                </aside>

                <div className="content-area">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textSub, fontSize: '15px' }}>⏳ データを読み込んでいます...</div>
                  ) : (
                    <>
                      <div className="card-grid">
                        {displayItems.length === 0 ? (
                          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', backgroundColor: 'white', borderRadius: '16px', border: `1px solid ${colors.border}`, color: colors.textSub }}>条件に一致する補助金がありません</div>
                        ) : (
                          paginatedItems.map(item => (
                            <SubsidyCard 
                              key={item.id} 
                              item={item} 
                              isSelected={selectedItem?.id === item.id} 
                              onToggleSelect={() => setSelectedItem(selectedItem?.id === item.id ? null : item)} 
                            />
                          ))
                        )}
                      </div>

                      {totalPages > 1 && (
                        <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: colors.primaryText }}>{totalItems}件中 {startCount}-{endCount}件の補助金を表示</div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="page-btn">&lt;</button>
                            {getPageNumbers().map(pageNum => (
                              <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}>{pageNum}</button>
                            ))}
                            <button onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="page-btn">&gt;</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          } />
        </Routes>
      </div>

      {/* フッター */}
      <Footer />
    </div>
  );
}