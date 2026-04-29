import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AdminListItem from './AdminListItem';
import AdminDuplicateModal from './AdminDuplicateModal';
import AdminEditForm from './AdminEditForm';
import AdminBatchScraperModal from './AdminBatchScraperModal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('drafts'); 
  const [drafts, setDrafts] = useState([]);
  const [publishedItems, setPublishedItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]); 
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [sortBy, setSortBy] = useState('fetched_at_desc'); 
  
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

  const toggleVisibility = async (id, currentActiveStatus) => {
    await supabase.from('subsidies').update({ is_active: !currentActiveStatus }).eq('id', id);
    setRefreshCounter(prev => prev + 1); 
  };

  const handleArchive = async (id) => {
    if (!window.confirm('この補助金を「募集終了」に移動しますか？')) return;
    await supabase.from('subsidies').update({ crawl_status: 'archived', is_active: false }).eq('id', id);
    setRefreshCounter(prev => prev + 1);
  };

  const handleRestore = async (id) => {
    if (!window.confirm('この補助金を再び「公開中」に戻しますか？')) return;
    await supabase.from('subsidies').update({ crawl_status: 'published', is_active: true }).eq('id', id);
    setRefreshCounter(prev => prev + 1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('本当にこのデータを削除してもよろしいですか？')) return;
    await supabase.from('subsidies').delete().eq('id', id);
    setRefreshCounter(prev => prev + 1); 
  };

  const handleCheckDuplicates = async () => {
    const { data, error } = await supabase.from('subsidies').select('id, title, source_url, crawl_status, fetched_at, organization');
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
      let u = url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('#')[0].split('?')[0];
      u = u.replace(/\/(index|default)\.(html|php|aspx|jsp)$/i, '');
      return u;
    };

    const groups = [];

    sortedData.forEach(item => {
      const nTitle = normalizeTitle(item.title);
      const nUrl = normalizeUrl(item.source_url);
      let matchedGroup = null;

      for (const group of groups) {
        for (const member of group) {
          const mTitle = normalizeTitle(member.title);
          const mUrl = normalizeUrl(member.source_url);
          const isUrlMatch = nUrl && mUrl && nUrl === mUrl;
          const isTitleMatch = nTitle && mTitle && (
            nTitle === mTitle ||
            (nTitle.length > 7 && mTitle.length > 7 && (nTitle.includes(mTitle) || mTitle.includes(nTitle)))
          );

          if (isUrlMatch || isTitleMatch) {
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

  const handleDeleteDuplicateItem = async (groupIndex, itemId) => {
    if (!window.confirm('本当にこのデータを削除してもよろしいですか？（データベースから完全に消去されます）')) return;
    const { error } = await supabase.from('subsidies').delete().eq('id', itemId);
    if (!error) {
      removeDuplicateItemFromUI(groupIndex, itemId);
      setRefreshCounter(prev => prev + 1);
    } else {
      alert('削除エラー: ' + error.message);
    }
  };

  const handleNotDuplicateItem = (groupIndex, itemId) => {
    removeDuplicateItemFromUI(groupIndex, itemId);
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
          <AdminDuplicateModal duplicateGroups={duplicateGroups} onClose={() => setShowDuplicateModal(false)} onDeleteItem={handleDeleteDuplicateItem} onNotDuplicate={handleNotDuplicateItem} />
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

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                <option value="fetched_at_desc">✨ 新着順（取得日が新しい順）</option>
                <option value="deadline_asc">⏰ 締切が近い順</option>
                <option value="amount_desc">💰 上限金額が高い順</option>
                <option value="region_title_asc">📍 地区別・名前順</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {activeTab === 'drafts' && (
                getSortedItems(drafts).length === 0 ? <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>🎉 承認待ちのデータはありません。</div> : getSortedItems(drafts).map(item => <AdminListItem key={item.id} item={item} tab={activeTab} onEdit={() => setEditingItem(item)} onDelete={() => handleDelete(item.id)} />)
              )}

              {activeTab === 'published' && (
                getSortedItems(publishedItems).length === 0 ? <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>公開されているデータはありません。</div> : getSortedItems(publishedItems).map(item => <AdminListItem key={item.id} item={item} tab={activeTab} onEdit={() => setEditingItem(item)} onToggleVisibility={() => toggleVisibility(item.id, item.is_active)} onArchive={() => handleArchive(item.id)} />)
              )}

              {activeTab === 'archived' && (
                getSortedItems(archivedItems).length === 0 ? <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>募集終了になったデータはありません。</div> : getSortedItems(archivedItems).map(item => <AdminListItem key={item.id} item={item} tab={activeTab} onRestore={() => handleRestore(item.id)} onDelete={() => handleDelete(item.id)} />)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}