import React, { useState, useEffect } from 'react';
import AdminListItem from './AdminListItem';
import AdminDuplicateModal from './AdminDuplicateModal';
import AdminEditForm from './AdminEditForm';
import AdminBatchScraperModal from './AdminBatchScraperModal';
import { supabase } from './lib/supabaseClient';

const parseAmount = (amountStr) => {
  if (!amountStr || amountStr === '不明' || amountStr === '未定') return 0;
  const match = amountStr.match(/([0-9,.]+)(万?円)/);
  if (!match) return 0;
  let num = parseFloat(match[1].replace(/,/g, ''));
  if (match[2] === '万円') num *= 10000;
  return num;
};

const parseDeadline = (deadlineStr) => {
  if (!deadlineStr || deadlineStr === '不明' || deadlineStr === '未定') return 9999999999999;
  let s = String(deadlineStr).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  s = s.replace(/令和(\d+)年/g, (_, p1) => (parseInt(p1) + 2018) + '年');
  s = s.replace(/(\d{4})-(\d{1,2})-(\d{1,2})/g, "$1/$2/$3");
  let parts = s.split(/[〜~\-からまで]/).filter(Boolean); 
  let targetStr = parts.length > 1 ? parts[parts.length - 1] : s;

  if (!targetStr.includes('年') && parts.length > 1) {
    const yearMatch = parts[0].match(/(\d{4})年/);
    if (yearMatch) targetStr = yearMatch[1] + '年' + targetStr;
  }

  let match = targetStr.match(/(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/) || 
              targetStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; 
    const day = parseInt(match[3]);
    return new Date(year, month, day).getTime();
  }
  return 9999999999998;
};

const getPublishedSortTime = (item) => {
  const dateValue =
    item?.published_at ||
    item?.updated_at ||
    item?.fetched_at ||
    item?.created_at;

  const time = dateValue ? new Date(dateValue).getTime() : 0;

  if (Number.isFinite(time) && time > 0) return time;

  return Number(item?.id || 0);
};

const hasAdminReviewNote = (item) =>
  Boolean(item?.admin_note || item?.duplicate_of_id || item?.duplicate_reason);

const buildDuplicatePublishBlockMessage = (item) => [
  '⚠ 正データIDが設定された重複候補のため、このまま公開できません。',
  '',
  `タイトル: ${item?.title || '未記載'}`,
  item?.duplicate_of_id ? `正データID: ${item.duplicate_of_id}` : null,
  item?.duplicate_reason ? `理由: ${item.duplicate_reason}` : null,
  item?.admin_note ? `メモ: ${item.admin_note}` : null,
  '',
  '公開する場合は、編集画面で重複元ID・重複理由・管理メモを確認し、重複候補ではない状態にしてください。',
]
  .filter(Boolean)
  .join('\n');

const buildAdminReviewPublishWarning = (item) => [
  '⚠ 管理メモ・重複理由があるデータを公開しようとしています。',
  '',
  `タイトル: ${item?.title || '未記載'}`,
  item?.duplicate_of_id ? `正データID: ${item.duplicate_of_id}` : null,
  item?.duplicate_reason ? `理由: ${item.duplicate_reason}` : null,
  item?.admin_note ? `メモ: ${item.admin_note}` : null,
  '',
  '重複候補や非公開理由があるデータです。',
  '本当に公開しますか？',
]
  .filter(Boolean)
  .join('\n');

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('drafts'); 
  const [drafts, setDrafts] = useState([]);
  const [publishedItems, setPublishedItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]); 
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [sortBy, setSortBy] = useState('fetched_at_desc'); 
  const [reviewFilter, setReviewFilter] = useState('all');
  
  const [editingItem, setEditingItem] = useState(null); 
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      const { data: draftData } = await supabase.from('subsidies').select('*').eq('crawl_status', 'draft').order('fetched_at', { ascending: false });
      if (draftData) setDrafts(draftData);

      const { data: pubData } = await supabase.from('subsidies').select('*').eq('crawl_status', 'published').order('fetched_at', { ascending: false });
      if (pubData) setPublishedItems(pubData);

      const { data: archData } = await supabase.from('subsidies').select('*').eq('crawl_status', 'archived').order('fetched_at', { ascending: false });
      if (archData) setArchivedItems(archData);
    };
    fetchAllData();
  }, [refreshCounter]); 

  const getSortedItems = (items) => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      if (sortBy === 'published_at_desc') return getPublishedSortTime(b) - getPublishedSortTime(a);
      if (sortBy === 'amount_desc') return (b.amount_max_yen || parseAmount(b.amount)) - (a.amount_max_yen || parseAmount(a.amount));
      if (sortBy === 'deadline_asc') return parseDeadline(a.application_end_date || a.deadline) - parseDeadline(b.application_end_date || b.deadline);
      if (sortBy === 'region_title_asc') {
        const regionA = a.region_text || a.region || '不明';
        const regionB = b.region_text || b.region || '不明';
        const regionCompare = regionA.localeCompare(regionB, 'ja');
        if (regionCompare !== 0) return regionCompare;
        const titleA = a.title || '';
        const titleB = b.title || '';
        return titleA.localeCompare(titleB, 'ja');
      }
      return (new Date(b.fetched_at || 0).getTime()) - (new Date(a.fetched_at || 0).getTime());
    });
    return sorted;
  };

  const getVisibleItems = (items) => {
    const sortedItems = getSortedItems(items);
    if (reviewFilter !== 'review_notes') return sortedItems;
    return sortedItems.filter(hasAdminReviewNote);
  };

  const toggleVisibility = async (item) => {
    const currentActiveStatus = Boolean(item.is_active);

    if (!currentActiveStatus && item.duplicate_of_id) {
      alert(buildDuplicatePublishBlockMessage(item));
      return;
    }

    if (!currentActiveStatus && hasAdminReviewNote(item)) {
      const shouldActivate = window.confirm(
        buildAdminReviewPublishWarning(item)
      );

      if (!shouldActivate) return;
    }

    await supabase.from('subsidies').update({ is_active: !currentActiveStatus }).eq('id', item.id);
    setRefreshCounter(prev => prev + 1); 
  };

  const handleArchive = async (id) => {
    if (!window.confirm('この補助金を「募集終了」に移動しますか？')) return;
    await supabase.from('subsidies').update({ crawl_status: 'archived', is_active: false }).eq('id', id);
    setRefreshCounter(prev => prev + 1);
  };

  const handleRestore = async (item) => {
    if (!window.confirm('この補助金を再び「公開中」に戻しますか？')) return;

    if (item.duplicate_of_id) {
      alert(buildDuplicatePublishBlockMessage(item));
      return;
    }

    if (hasAdminReviewNote(item)) {
      const shouldRestore = window.confirm(
        buildAdminReviewPublishWarning(item)
      );

      if (!shouldRestore) return;
    }

    await supabase.from('subsidies').update({ crawl_status: 'published', is_active: true }).eq('id', item.id);
    setRefreshCounter(prev => prev + 1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('本当にこのデータを削除してもよろしいですか？')) return;
    await supabase.from('subsidies').delete().eq('id', id);
    setRefreshCounter(prev => prev + 1); 
  };

  const handleCheckDuplicates = async () => {
    const { data, error } = await supabase
      .from('subsidies')
      .select('id, title, source_url, official_url, source_external_id, crawl_status, fetched_at, organization, admin_note, duplicate_of_id, duplicate_reason');
    if (error) return alert('データ取得エラー: ' + error.message);

    const statusRank = { 'published': 1, 'archived': 2, 'draft': 3 };
    const sortedData = [...data].sort((a, b) => {
      const rankA = statusRank[a.crawl_status] || 99;
      const rankB = statusRank[b.crawl_status] || 99;
      if (rankA !== rankB) return rankA - rankB; 
      return new Date(b.fetched_at || 0).getTime() - new Date(a.fetched_at || 0).getTime();
    });

    const normalizeTitle = (str) => {
      if (!str || str === '未記載' || str === '不明') return null;
      let s = str.normalize("NFKC");
      s = s.replace(/\s+/g, '');
      s = s.replace(/[（(【［<＜].*?[)）】］>＞]/g, '');
      s = s.replace(/^(愛媛県|松山市|今治市|宇和島市|八幡浜市|新居浜市|西条市|大洲市|伊予市|四国中央市|西予市|東温市|上島町|久万高原町|松前町|砥部町|内子町|伊方町|松野町|鬼北町|愛南町)[：:「」『』\s]*/, '');
      s = s.replace(/(について|のお知らせ|のご案内|公募|募集開始|募集|令和\d+年度?|202\d年度?|第\d+回|次)/g, '');
      s = s.replace(/(助成金|支援金|奨励金|給付金|交付金)/g, '補助金');
      return s;
    };

    const normalizeUrl = (url) => {
      if (!url || !url.startsWith('http')) return null;
      let u = url.replace(/^https?:\/\//, '').split('#')[0].split('?')[0];
      u = u.replace(/\/(index|default)\.(html|php|aspx|jsp)$/i, '');
      u = u.replace(/\/$/, '');
      return u;
    };

    const groups = [];

    sortedData.forEach(item => {
      const nTitle = normalizeTitle(item.title);
      const nUrls = [normalizeUrl(item.official_url), normalizeUrl(item.source_url)].filter(Boolean);
      const nExternalId = item.source_external_id || null;
      let matchedGroup = null;

      for (const group of groups) {
        for (const member of group) {
          const mTitle = normalizeTitle(member.title);
          const mUrls = [normalizeUrl(member.official_url), normalizeUrl(member.source_url)].filter(Boolean);
          const mExternalId = member.source_external_id || null;
          const isUrlMatch = nUrls.length > 0 && mUrls.length > 0 && nUrls.some((url) => mUrls.includes(url));
          const isExternalIdMatch = nExternalId && mExternalId && nExternalId === mExternalId;
          const isTitleMatch = nTitle && mTitle && (
            nTitle === mTitle ||
            (nTitle.length > 7 && mTitle.length > 7 && (nTitle.includes(mTitle) || mTitle.includes(nTitle)))
          );

          if (isExternalIdMatch || isUrlMatch || isTitleMatch) {
            matchedGroup = group;
            break;
          }
        }
        if (matchedGroup) break;
      }

      if (matchedGroup) {
        matchedGroup.push(item);
      } else {
        groups.push([item]);
      }
    });

    const duplicates = groups.filter(group => group.length > 1);
    if (duplicates.length === 0) return alert('重複しているデータは見つかりませんでした！✨');

    setDuplicateGroups(duplicates);
    setShowDuplicateModal(true);
  };

  const handleDraftDuplicateItem = async (groupIndex, item) => {
    if (!window.confirm('このデータを削除せず、承認待ち・非公開に戻しますか？')) return;

    const nextAdminNote = [
      item.admin_note,
      '重複チェック画面から承認待ち・非公開に戻しました。',
    ]
      .filter(Boolean)
      .join('\n');

    const { error } = await supabase
      .from('subsidies')
      .update({
        crawl_status: 'draft',
        is_active: false,
        admin_note: nextAdminNote,
      })
      .eq('id', item.id);

    if (!error) {
      removeDuplicateItemFromUI(groupIndex, item.id);
      setRefreshCounter(prev => prev + 1);
    } else {
      alert('非公開化エラー: ' + error.message);
    }
  };

  const handleNotDuplicateItem = (groupIndex, itemId) => {
    removeDuplicateItemFromUI(groupIndex, itemId);
  };

  const handleOpenItemById = async (id) => {
    const targetId = Number(id);
    if (!Number.isFinite(targetId)) return;

    const localItem = [...drafts, ...publishedItems, ...archivedItems].find(
      (item) => Number(item.id) === targetId
    );

    if (localItem) {
      setEditingItem(localItem);
      setShowDuplicateModal(false);
      return;
    }

    const { data, error } = await supabase
      .from('subsidies')
      .select('*')
      .eq('id', targetId)
      .single();

    if (error || !data) {
      alert(`ID ${targetId} のデータが見つかりませんでした。`);
      return;
    }

    setEditingItem(data);
    setShowDuplicateModal(false);
  };

  const removeDuplicateItemFromUI = (groupIndex, itemId) => {
    setDuplicateGroups(prev => {
      const newGroups = [...prev];
      newGroups[groupIndex] = newGroups[groupIndex].filter(item => item.id !== itemId);
      if (newGroups[groupIndex].length < 2) newGroups.splice(groupIndex, 1);
      if (newGroups.length === 0) setShowDuplicateModal(false);
      return newGroups;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; 
  };

  const currentTabItems =
    activeTab === 'drafts'
      ? drafts
      : activeTab === 'published'
        ? publishedItems
        : archivedItems;
  const currentReviewCount = currentTabItems.filter(hasAdminReviewNote).length;
  const visibleDrafts = getVisibleItems(drafts);
  const visiblePublishedItems = getVisibleItems(publishedItems);
  const visibleArchivedItems = getVisibleItems(archivedItems);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#111827', color: 'white', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', height: '100%' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>⚙️ 管理ダッシュボード</h1>
          <nav style={{ display: 'flex', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'white', fontSize: '15px', fontWeight: 'bold', borderBottom: '3px solid #2563eb', backgroundColor: '#1f2937' }}>
              📊 補助金データ更新
            </div>
            <a href="/admin?tab=experts" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              🤝 専門家管理
            </a>
            <a href="/admin?tab=columns" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              📝 コラム管理
            </a>
          </nav>
        </div>
        <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
          ログアウト
        </button>
      </header>

      <div style={{ maxWidth: '1000px', margin: '32px auto', padding: '0 24px' }}>
        
        {showDuplicateModal && (
          <AdminDuplicateModal
            duplicateGroups={duplicateGroups}
            onClose={() => setShowDuplicateModal(false)}
            onDraftItem={handleDraftDuplicateItem}
            onNotDuplicate={handleNotDuplicateItem}
            onOpenItemById={handleOpenItemById}
          />
        )}

        {showBatchModal && (
          <AdminBatchScraperModal supabase={supabase} onClose={() => setShowBatchModal(false)} onRefresh={() => setRefreshCounter(prev => prev + 1)} />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>📊 補助金データ管理</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowBatchModal(true)} style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }}>
              🔗 URL一括データ収集
            </button>
            <button onClick={handleCheckDuplicates} style={{ backgroundColor: 'white', color: '#4b5563', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              🧹 重複データを一括お掃除
            </button>
          </div>
        </div>
        
        {editingItem ? (
          <AdminEditForm initialData={editingItem} supabase={supabase} onBack={() => setEditingItem(null)} onRefresh={() => setRefreshCounter(prev => prev + 1)} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={() => setActiveTab('drafts')} style={{ backgroundColor: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'drafts' ? '#2563eb' : '#6b7280', borderBottom: activeTab === 'drafts' ? '3px solid #2563eb' : 'none', paddingBottom: '8px', marginBottom: '-18px' }}>📝 承認待ち ({drafts.length})</button>
                <button onClick={() => setActiveTab('published')} style={{ backgroundColor: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'published' ? '#059669' : '#6b7280', borderBottom: activeTab === 'published' ? '3px solid #059669' : 'none', paddingBottom: '8px', marginBottom: '-18px' }}>✅ 公開中 ({publishedItems.length})</button>
                <button onClick={() => setActiveTab('archived')} style={{ backgroundColor: 'transparent', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'archived' ? '#d97706' : '#6b7280', borderBottom: activeTab === 'archived' ? '3px solid #d97706' : 'none', paddingBottom: '8px', marginBottom: '-18px' }}>📁 募集終了 ({archivedItems.length})</button>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() =>
                    setReviewFilter((current) =>
                      current === 'review_notes' ? 'all' : 'review_notes'
                    )
                  }
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: reviewFilter === 'review_notes' ? '1px solid #f59e0b' : '1px solid #d1d5db',
                    backgroundColor: reviewFilter === 'review_notes' ? '#fffbeb' : 'white',
                    color: reviewFilter === 'review_notes' ? '#92400e' : '#374151',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {reviewFilter === 'review_notes' ? '⚠ 重複候補のみ表示中' : `⚠ 重複候補のみ (${currentReviewCount})`}
                </button>

                {reviewFilter === 'review_notes' && (
                  <span style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '999px', color: '#92400e', fontSize: '12px', fontWeight: 'bold', padding: '6px 10px' }}>
                    {currentReviewCount}件に絞り込み中
                  </span>
                )}

                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                  <option value="fetched_at_desc">✨ 新着順（取得日が新しい順）</option>
                  {activeTab === 'published' && (
                    <option value="published_at_desc">✅ 公開された順（新しい順）</option>
                  )}
                  <option value="deadline_asc">⏰ 締切が近い順</option>
                  <option value="amount_desc">💰 上限金額が高い順</option>
                  <option value="region_title_asc">📍 地区別・名前順</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {activeTab === 'drafts' && (
                visibleDrafts.length === 0 ? <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>🎉 表示できる承認待ちデータはありません。</div> : visibleDrafts.map(item => <AdminListItem key={item.id} item={item} tab={activeTab} onEdit={() => setEditingItem(item)} onDelete={() => handleDelete(item.id)} onOpenDuplicateTarget={handleOpenItemById} />)
              )}

              {activeTab === 'published' && (
                visiblePublishedItems.length === 0 ? <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>表示できる公開データはありません。</div> : visiblePublishedItems.map(item => <AdminListItem key={item.id} item={item} tab={activeTab} onEdit={() => setEditingItem(item)} onToggleVisibility={() => toggleVisibility(item)} onArchive={() => handleArchive(item.id)} onOpenDuplicateTarget={handleOpenItemById} />)
              )}

              {activeTab === 'archived' && (
                visibleArchivedItems.length === 0 ? <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>表示できる募集終了データはありません。</div> : visibleArchivedItems.map(item => <AdminListItem key={item.id} item={item} tab={activeTab} onRestore={() => handleRestore(item)} onDelete={() => handleDelete(item.id)} onOpenDuplicateTarget={handleOpenItemById} />)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
