import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

import EhimeSubsidyPortal from './EhimeSubsidyPortal';
import AdminDashboard from './AdminDashboard';
import AdminExperts from './AdminExperts';
import AdminColumns from './AdminColumns';
import ColumnArticle from './ColumnArticle'; 
import SubsidyDetail from './SubsidyDetail';
import Login from './Login';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 管理画面の振り分け用ラッパー（元のロジックをキープ）
function AdminRouter({ session }) {
  if (!session) return <Login />;
  const searchParams = new URLSearchParams(window.location.search);
  const tab = searchParams.get('tab');
  if (tab === 'experts') return <AdminExperts />;
  if (tab === 'columns') return <AdminColumns />;
  return <AdminDashboard />;
}

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Routes>
      {/* 管理画面のルーティング */}
      <Route path="/admin/*" element={<AdminRouter session={session} />} />

      {/* 独立した詳細ページ */}
      <Route path="/subsidy/:id" element={<SubsidyDetail />} />
      <Route path="/column/:slug" element={<ColumnArticle />} />

      {/* ポータルサイト全体（/search, /simulator 等のルーティングは内部で処理） */}
      <Route path="*" element={<EhimeSubsidyPortal />} />
    </Routes>
  );
}

export default App;