import React, { useState, useRef, useEffect } from 'react';

export default function AdminAutoColumnModal({ supabase, onClose }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString('ja-JP', { hour12: false }) }]);
  };

  const handleStartAutoColumn = async () => {
    const openAiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!openAiKey) {
      alert('OpenAIのAPIキーが設定されていません。');
      return;
    }

    if (!window.confirm('現在の「公開中」の補助金データから、AIが最適なものを1件選び、コラムと画像を自動生成します。よろしいですか？\n（※1〜2分かかります）')) return;

    setIsProcessing(true);
    setLogs([]);
    addLog('🚀 AI編集長を起動しました。データ収集を開始します...', 'info');

    try {
      const { data: subsidies, error: dbError } = await supabase
        .from('subsidies')
        .select('*')
        .eq('crawl_status', 'published')
        .order('fetched_at', { ascending: false })
        .limit(30);

      if (dbError || !subsidies || subsidies.length === 0) throw new Error('公開中の補助金データが見つかりません。');
      addLog(`✅ 最新の補助金データ ${subsidies.length} 件をAIに渡しました。分析中です...`, 'info');

      const dataText = subsidies.map(s => `
        ID: ${s.id}
        タイトル: ${s.title}
        機関: ${s.organization}
        地域: ${s.region_text}
        対象事業者: ${s.target_entities}
        対象経費: ${s.target_expenses}
        上限額: ${s.amount_text}
        締切: ${s.deadline}
        公式URL: ${s.official_url}
        概要: ${s.summary}
      `).join('\n---\n');

      const systemPrompt = `
あなたは、愛媛県内の中小企業・個人事業主向けに補助金情報をわかりやすく解説するWebメディアの編集者です。
以下に渡す補助金データの中から、現在公募中で、HPのコラム記事として扱う価値が高いものを1件選んでください。
選んだ補助金について、魅力的なコラム記事を作成し、JSON形式で出力してください。

【注意書き】
記事の最後には必ず「掲載している情報は、公開されている情報をもとに整理したものです。申請を検討される際は、必ず各制度の公式ページで最新情報をご確認ください。」という趣旨の注意書きを入れてください。

【JSONスキーマの厳格指定】
以下のキーを持つJSONのみを出力してください。
- "subsidy_id": 選んだ補助金のID (数字)
- "slug": URL用スラッグ (英数字とハイフンのみ。例: it-hojo-2024)
- "title": 記事のタイトル
- "seo_title": SEOタイトル (32文字前後)
- "meta_description": メタディスクリプション (120文字前後)
- "thumbnail_text": アイキャッチ画像生成用のテキスト (英語で、具体的な情景を20単語以内で)
- "content": 記事本文 (HTMLタグ <h2> <h3> <p> <ul> <li> <strong> を使用して綺麗に装飾すること)
- "category": カテゴリ名 (例: 設備投資, IT導入)
- "tags": タグの配列 (文字列の配列)
`;

      addLog('✍️ AIが最適な補助金を選定し、記事を執筆しています（約30秒〜1分）...', 'info');
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `【補助金データ】\n${dataText}` }
          ]
        })
      });

      if (!aiRes.ok) throw new Error('AIの執筆中にエラーが発生しました');
      const articleData = JSON.parse((await aiRes.json()).choices[0].message.content);
      addLog(`✨ 記事の執筆が完了しました！タイトル: 「${articleData.title}」`, 'success');

      // 🔥 UPDATE: 画像の受け取り方を url から b64_json（直接データ） に変更
      addLog(`🎨 DALL-E 3 にアイキャッチ画像を依頼しています...`, 'info');
      const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `A professional, clean, and modern flat vector illustration representing "${articleData.thumbnail_text}". Suitable for a Japanese business blog about government subsidies. No text, no letters, no numbers in the image. Soft corporate colors.`,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json" // ←ここが重要！
        })
      });

      if (!imageRes.ok) throw new Error('画像の生成に失敗しました');
      const imageData = await imageRes.json();
      const base64Image = imageData.data[0].b64_json; // 文字列データとして受け取る
      addLog(`🖼 画像が完成しました！データベースに保存しています...`, 'success');

      // 🔥 UPDATE: Base64データをBlob（画像ファイル）に変換
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const imgBlob = new Blob([byteArray], { type: 'image/png' });

      // Supabaseにアップロード
      const fileName = `column_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from('column-images').upload(fileName, imgBlob);
      if (uploadError) throw new Error(`画像アップロードエラー: ${uploadError.message}`);
      
      const { data: publicUrlData } = supabase.storage.from('column-images').getPublicUrl(fileName);
      const finalThumbnailUrl = publicUrlData.publicUrl;

      // 5. データベースにコラムを保存
      addLog(`💾 記事と画像をシステムに登録しています...`, 'info');
      const { error: insertError } = await supabase.from('columns').insert([{
        subsidy_id: articleData.subsidy_id,
        slug: articleData.slug,
        title: articleData.title,
        seo_title: articleData.seo_title,
        meta_description: articleData.meta_description,
        thumbnail_text: articleData.thumbnail_text,
        thumbnail_url: finalThumbnailUrl,
        content: articleData.content,
        category: articleData.category,
        tags: articleData.tags,
        is_published: false // 最初は下書き（非公開）状態で保存
      }]);

      if (insertError) throw new Error(`DB保存エラー: ${insertError.message}`);

      addLog(`🎉 全ての処理が完了しました！下書きとして保存されています。`, 'success');

    } catch (err) {
      addLog(`❌ エラー: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getLogColor = (type) => {
    switch(type) {
      case 'success': return '#059669'; 
      case 'warning': return '#d97706'; 
      case 'error': return '#dc2626';   
      default: return '#374151';        
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '800px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🤖</span> AI自動コラム生成
            </h2>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '13px' }}>
              現在公開中の補助金データから、AI編集長が今一番アツい制度を1つ選び出し、SEO最適化されたコラム記事とアイキャッチ画像を全自動で生成します。
            </p>
          </div>
          {!isProcessing && (
            <button onClick={onClose} style={{ backgroundColor: '#f3f4f6', color: '#4b5563', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕ 閉じる</button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <button 
            onClick={handleStartAutoColumn} 
            disabled={isProcessing}
            style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981', color: 'white', padding: '16px 32px', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', boxShadow: isProcessing ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.3)' }}
          >
            {isProcessing ? '🔄 AIが執筆＆描画中...' : '✒️ 今週のおすすめ記事をAIに書かせる'}
          </button>
        </div>

        <div style={{ flex: 1, backgroundColor: '#111827', borderRadius: '8px', padding: '16px', overflowY: 'auto', minHeight: '250px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid #374151' }}>
          {logs.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', marginTop: '100px' }}>ボタンを押すと、AI編集長の作業ログがここに表示されます</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} style={{ color: getLogColor(log.type), marginBottom: '8px', lineHeight: '1.4' }}>
                <span style={{ color: '#6b7280', marginRight: '8px' }}>[{log.time}]</span>{log.msg}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

      </div>
    </div>
  );
}