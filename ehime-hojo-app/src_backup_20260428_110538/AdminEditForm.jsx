import React, { useState, useEffect } from 'react';
import { PURPOSE_TAGS, INDUSTRY_TAGS, isMissingValue } from './subsidyTags';

const normalizeJapaneseNumber = (value) => {
  return String(value || '').replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
};

const toLocalTodayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const warekiDateToISO = (text) => {
  if (!text) return '';

  const s = normalizeJapaneseNumber(text);

  const reiwa = s.match(/令和(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/);

  if (reiwa) {
    const year = reiwa[1] === '元' ? 2019 : 2018 + Number(reiwa[1]);
    return `${year}-${String(reiwa[2]).padStart(2, '0')}-${String(reiwa[3]).padStart(2, '0')}`;
  }

  const western = s.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);

  if (western) {
    return `${western[1]}-${String(western[2]).padStart(2, '0')}-${String(western[3]).padStart(2, '0')}`;
  }

  return '';
};

const cleanPeriodLine = (line) => {
  return normalizeJapaneseNumber(line || '')
    .replace(/^#+\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/^[-・●■◆]\s*/g, '')
    .trim();
};

const extractApplicationPeriodFromText = (text) => {
  if (!text) return '';

  const lines = String(text)
    .split('\n')
    .map((line) => cleanPeriodLine(line))
    .filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/(募集期間|申請期間|受付期間|公募期間)/.test(line)) {
      const candidates = [
        line.replace(/^(募集期間|申請期間|受付期間|公募期間)[:：]?\s*/, ''),
        lines[i + 1] || '',
        lines[i + 2] || '',
      ]
        .map(cleanPeriodLine)
        .filter(Boolean);

      const found = candidates.find((candidate) =>
        /(令和|平成|\d{4}年|\d{1,2}月\s*\d{1,2}日)/.test(candidate)
      );

      if (found) {
        return found;
      }
    }
  }

  const joined = lines.join('\n');

  const rangeMatch = joined.match(
    /(令和(?:元|\d+)年\s*\d{1,2}月\s*\d{1,2}日(?:（[^）]+）)?\s*(?:～|〜|-|から)\s*[^\n。]+?(?:まで|次第|通年)?)/m
  );

  if (rangeMatch) {
    return cleanPeriodLine(rangeMatch[1]);
  }

  return '';
};

const applyApplicationPeriodRules = (facts, sourceText) => {
  if (!facts) return facts;

  const periodText = extractApplicationPeriodFromText(sourceText);

  if (!periodText) return facts;

  const startDate = warekiDateToISO(periodText);

  const isOpenEnded =
    /(助成枠に達するまで|予算額に達するまで|予算に達するまで|上限に達するまで|なくなり次第|達し次第|予算がなくなり次第|随時|通年)/.test(
      periodText
    );

  facts.application_period_text = periodText;
  facts.deadline = periodText;

  if (startDate) {
    facts.application_start_date = startDate;
  }

  if (isOpenEnded) {
    facts.application_end_date = '';
  }

  const today = toLocalTodayISO();

  if (startDate && today < startDate) {
    facts.application_status = '予告';
  } else if (isOpenEnded) {
    facts.application_status = '公募中';
  }

  return facts;
};

const parseAmountMaxYen = (text) => {
  if (!text) return 0;

  let s = normalizeJapaneseNumber(text);

  s = s.replace(/,/g, '').replace(/\s+/g, '');

  let maxVal = 0;
  const regex = /(\d+(?:\.\d+)?)(万?円)/g;
  let match;

  while ((match = regex.exec(s)) !== null) {
    let num = parseFloat(match[1]);

    if (match[2] === '万円') {
      num *= 10000;
    }

    if (num > maxVal) {
      maxVal = num;
    }
  }

  return Math.round(maxVal);
};

const parseDatesFromText = (text) => {
  if (!text) return { start: null, end: null };

  let s = normalizeJapaneseNumber(text);

  s = s.replace(/令和([元0-9]+)年/g, (_, p1) => {
    const year = p1 === '元' ? 2019 : 2018 + parseInt(p1, 10);
    return `${year}年`;
  });

  const currentYear = new Date().getFullYear();

  let start = null;
  let end = null;

  const range = s.match(
    /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?\s*(?:〜|～|-|から)\s*(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?/
  );

  if (range) {
    start = `${range[1] || currentYear}-${String(range[2]).padStart(2, '0')}-${String(range[3]).padStart(2, '0')}`;
    end = `${range[4] || range[1] || currentYear}-${String(range[5]).padStart(2, '0')}-${String(range[6]).padStart(2, '0')}`;
  } else {
    const match = /(?:(\d{4})[年/.-])?(\d{1,2})[月/.-](\d{1,2})日?/g;
    let m;

    while ((m = match.exec(s)) !== null) {
      end = `${m[1] || currentYear}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    }
  }

  return { start, end };
};

export default function AdminEditForm({
  initialData,
  supabase,
  onBack,
  onRefresh,
}) {
  const [editForm, setEditForm] = useState({
    ...initialData,
    purposes: initialData.purposes || [],
    industries: initialData.industries || [],
    tags: initialData.tags || [],
  });

  const [aiSourceUrl, setAiSourceUrl] = useState('');
  const [aiRawText, setAiRawText] = useState('');

  const [step, setStep] = useState(1);
  const [extractedText, setExtractedText] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const defaultUrl = initialData.official_url || initialData.source_url;

      if (defaultUrl && defaultUrl.startsWith('http')) {
        setAiSourceUrl(defaultUrl);
      } else {
        setAiSourceUrl('');
      }

      setAiRawText('');
      setStep(1);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [initialData.id, initialData.official_url, initialData.source_url]);

  const normalizeDateForDB = (value) => {
    if (!value) return null;

    const s = String(value).trim();

    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  const handleCheckboxChange = (field, value) => {
    const currentList = editForm[field] || [];

    if (currentList.includes(value)) {
      setEditForm({
        ...editForm,
        [field]: currentList.filter((tag) => tag !== value),
      });
    } else {
      setEditForm({
        ...editForm,
        [field]: [...currentList, value],
      });
    }
  };

  const handleSave = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    const { error } = await supabase
      .from('subsidies')
      .update({
        title: editForm.title,
        region: editForm.region,
        region_text: editForm.region_text,
        prefecture: editForm.prefecture,
        municipality: editForm.municipality,
        organization: editForm.organization,
        deadline: editForm.application_period_text || editForm.deadline,
        application_period_text: editForm.application_period_text,
        application_start_date: normalizeDateForDB(editForm.application_start_date),
        application_end_date: normalizeDateForDB(editForm.application_end_date),
        amount: editForm.amount,
        amount_text: editForm.amount_text,
        amount_max_yen: editForm.amount_max_yen || 0,
        subsidy_rate: editForm.subsidy_rate,
        subsidy_rate_text: editForm.subsidy_rate_text,
        target_expenses: editForm.target_expenses,
        target_expenses_arr: editForm.target_expenses_arr || [],
        target_entities: editForm.target_entities,
        target_entities_arr: editForm.target_entities_arr || [],
        summary: editForm.summary,
        source_url: editForm.source_url,
        official_url: editForm.official_url,
        purposes: editForm.purposes || [],
        industries: editForm.industries || [],
        tags: editForm.tags || [],
        fiscal_year: editForm.fiscal_year,
        application_status: editForm.application_status,
      })
      .eq('id', initialData.id);

    if (!error) {
      alert('内容を保存しました！');
      onRefresh();
    } else {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  const handleTogglePublish = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    const isCurrentlyPublished = editForm.crawl_status === 'published';
    const newStatus = isCurrentlyPublished ? 'draft' : 'published';

    const safeUpdateData = { ...editForm };

    delete safeUpdateData.id;
    delete safeUpdateData.created_at;
    delete safeUpdateData.updated_at;

    safeUpdateData.application_start_date = normalizeDateForDB(
      safeUpdateData.application_start_date
    );

    safeUpdateData.application_end_date = normalizeDateForDB(
      safeUpdateData.application_end_date
    );

    const { error } = await supabase
      .from('subsidies')
      .update({
        ...safeUpdateData,
        crawl_status: newStatus,
        is_active: !isCurrentlyPublished,
      })
      .eq('id', initialData.id);

    if (!error) {
      alert(isCurrentlyPublished ? '記事を「承認待ち」に戻しました！' : '公開しました！');
      onRefresh();
      onBack();
    } else {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    if (!window.confirm('本当にこのデータを削除してもよろしいですか？')) {
      return;
    }

    const { error } = await supabase
      .from('subsidies')
      .delete()
      .eq('id', initialData.id);

    if (!error) {
      onRefresh();
      onBack();
    } else {
      alert('削除に失敗しました: ' + error.message);
    }
  };

  const handleFetchText = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    setIsLoading(true);

    try {
      const fallbackUrl = editForm.official_url || editForm.source_url || '';

      const organization =
        editForm.organization ||
        editForm.region_text ||
        editForm.region ||
        '愛媛県';

      const { data, error } = await supabase.functions.invoke('fetch-page-text', {
        body: {
          rawText: aiRawText,
          sourceUrl: aiSourceUrl,
          fallbackUrl,
          title: editForm.title,
          organization,
        },
      });

      if (error) {
        throw new Error(`サーバー通信エラー: ${error.message}`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const sourceText = data?.sourceText || '';
      const newUrl = data?.resolvedUrl || aiSourceUrl || fallbackUrl || '';

      if (!sourceText) {
        throw new Error('本文テキストを取得できませんでした。');
      }

      if (sourceText.length < 500) {
        alert(
          `⚠️ 抽出された本文が ${sourceText.length} 文字しかありません。\n詳細ページではなく、一覧ページやメニュー部分だけを取得してしまった可能性があります。\n内容をプレビューで確認してください。`
        );
      }

      setExtractedText(sourceText);
      setResolvedUrl(newUrl);
      setStep(2);
    } catch (err) {
      alert('取得エラー: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAI = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    setIsLoading(true);

    try {
      const org =
        editForm.organization ||
        editForm.region_text ||
        editForm.region ||
        '愛媛県';

      const { data, error } = await supabase.functions.invoke('extract-subsidy', {
        body: {
          extractedText,
          resolvedUrl,
          editFormTitle: editForm.title,
          org,
          summary: editForm.summary,
          purposesTags: PURPOSE_TAGS.join(','),
          industryTags: INDUSTRY_TAGS.join(','),
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      let facts = data?.facts || {};
      const tags = data?.tags || {};
      const finalTitle = data?.finalTitle || '';

      facts = applyApplicationPeriodRules(facts, extractedText);

      if ((facts.confidence || 100) < 70) {
        const proceed = window.confirm(
          `⚠️ AIの抽出信頼度が低いです（${facts.confidence}%）。\n別制度の案内やヘッダー情報が混入している可能性があります。\n\n抽出されたデータをフォームに強行反映しますか？`
        );

        if (!proceed) {
          setIsLoading(false);
          return;
        }
      }

      setEditForm((prev) => {
        const getNewValue = (key) => {
          const val = facts[key];

          if (
            val === undefined ||
            val === null ||
            val === '不明' ||
            val === '未記載' ||
            val === ''
          ) {
            return prev[key];
          }

          if (Array.isArray(val) && val.length === 0) {
            return prev[key];
          }

          return val;
        };

        const getDateValue = (key) => {
          const val = facts[key];

          if (
            val === undefined ||
            val === null ||
            val === '不明' ||
            val === '未記載'
          ) {
            return prev[key];
          }

          return val;
        };

        const newTargetExpensesArr = getNewValue('target_expenses_arr') || [];
        const newTargetEntitiesArr = getNewValue('target_entities_arr') || [];

        const nextOfficialUrl =
          (facts.official_url &&
          facts.official_url !== '不明' &&
          facts.official_url !== '未記載'
            ? facts.official_url
            : '') ||
          facts.source_url ||
          resolvedUrl ||
          prev.official_url;

        return {
          ...prev,
          source_url: facts.source_url || resolvedUrl || prev.source_url,
          official_url: nextOfficialUrl,
          title: finalTitle || prev.title,
          organization: getNewValue('organization'),
          region_text: getNewValue('region_text'),
          prefecture: getNewValue('prefecture'),
          municipality: getNewValue('municipality'),
          application_status: getNewValue('application_status'),
          application_period_text: getNewValue('application_period_text'),
          deadline: getNewValue('application_period_text'),
          application_start_date: getDateValue('application_start_date'),
          application_end_date: getDateValue('application_end_date'),
          amount_text: getNewValue('amount_text'),
          amount: getNewValue('amount_text'),
          amount_max_yen: getNewValue('amount_max_yen'),
          subsidy_rate_text: getNewValue('subsidy_rate_text'),
          subsidy_rate: getNewValue('subsidy_rate_text'),
          target_expenses_arr: newTargetExpensesArr,
          target_expenses:
            newTargetExpensesArr.length > 0
              ? newTargetExpensesArr.join(' / ')
              : prev.target_expenses,
          target_entities_arr: newTargetEntitiesArr,
          target_entities:
            newTargetEntitiesArr.length > 0
              ? newTargetEntitiesArr.join(' / ')
              : prev.target_entities,
          fiscal_year: getNewValue('fiscal_year'),
          summary: getNewValue('summary'),
          purposes: Array.from(
            new Set([...(prev.purposes || []), ...(tags.purposes || [])])
          ),
          industries: Array.from(
            new Set([...(prev.industries || []), ...(tags.industries || [])])
          ),
          tags: Array.from(
            new Set([
              ...(prev.tags || []),
              ...(tags.purposes || []),
              ...(tags.industries || []),
            ])
          ),
        };
      });

      if (facts.source_url && facts.source_url !== aiSourceUrl) {
        setAiSourceUrl(facts.source_url);
      } else if (resolvedUrl !== aiSourceUrl) {
        setAiSourceUrl(resolvedUrl);
      }

      setStep(1);
      alert('🎉 バックエンドでの安全なAI解析が完了しました！');
    } catch (err) {
      alert('AIエラー: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#374151',
    fontSize: '14px',
  };

  const getDynamicInputStyle = (value) => ({
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#1f2937',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: isMissingValue(value) ? '#fee2e2' : 'white',
    borderColor: isMissingValue(value) ? '#fca5a5' : '#d1d5db',
  });

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }}
      >
        <h2
          style={{
            fontSize: '18px',
            margin: 0,
            color: '#1f2937',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}
        >
          ✏️ データ編集・タグ付け
        </h2>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={onBack}
            style={{
              backgroundColor: 'white',
              color: '#4b5563',
              padding: '10px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            🔙 戻る
          </button>

          <button
            onClick={handleDelete}
            style={{
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              padding: '10px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: 'none',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            🗑 削除
          </button>

          <button
            onClick={handleSave}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '10px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: 'none',
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            💾 保存
          </button>

          <button
            onClick={handleTogglePublish}
            style={{
              backgroundColor:
                editForm.crawl_status === 'published' ? '#6b7280' : '#059669',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: 'none',
              fontSize: '14px',
              boxShadow:
                editForm.crawl_status === 'published'
                  ? '0 2px 4px rgba(107, 114, 128, 0.3)'
                  : '0 2px 4px rgba(16, 185, 129, 0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            {editForm.crawl_status === 'published'
              ? '📝 承認待ちに戻す'
              : '✅ 公開する'}
          </button>
        </div>
      </div>

      <div style={{ padding: '32px' }}>
        <div
          style={{
            backgroundColor: '#f5f3ff',
            border: '1px solid #c4b5fd',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '20px' }}>🤖</span>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#5b21b6',
              }}
            >
              AI自動入力 ＆ タグ付けアシスト
            </h3>
          </div>

          {step === 1 && (
            <>
              <p
                style={{
                  fontSize: '13px',
                  color: '#6d28d9',
                  margin: '0 0 16px 0',
                  lineHeight: '1.6',
                }}
              >
                <strong>【STEP 1】</strong>
                解析したいページのURLか、PDFのテキストを入力して「本文を取得」を押してください。
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <input
                  type="text"
                  placeholder="🌐 読み込ませたい公式ページのURL (空欄の場合はタイトルから自動検索します)"
                  value={aiSourceUrl}
                  onChange={(e) => setAiSourceUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #ddd6fe',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                <textarea
                  placeholder="📄 または、PDFの文章などをここに直接コピペしてください"
                  value={aiRawText}
                  onChange={(e) => setAiRawText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #ddd6fe',
                    fontSize: '13px',
                    outline: 'none',
                    minHeight: '80px',
                    boxSizing: 'border-box',
                    fontFamily: 'sans-serif',
                  }}
                />

                <button
                  onClick={handleFetchText}
                  disabled={isLoading}
                  style={{
                    backgroundColor: isLoading ? '#d1d5db' : '#8b5cf6',
                    color: 'white',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    border: 'none',
                    fontSize: '14px',
                    alignSelf: 'flex-end',
                    boxShadow: '0 4px 6px rgba(139, 92, 246, 0.2)',
                  }}
                >
                  {isLoading ? '🔄 取得中...' : '📝 STEP 1: 本文を取得する'}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <p
                style={{
                  fontSize: '13px',
                  color: '#b91c1c',
                  margin: '0 0 16px 0',
                  lineHeight: '1.6',
                  backgroundColor: '#fee2e2',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #fca5a5',
                }}
              >
                <strong>【STEP 2: プレビュー確認】</strong>
                以下のテキストをAIに送信します。
                <br />
                不要なヘッダー、フッター、別制度の案内などが含まれていると
                <strong>精度が著しく低下</strong>
                します。関係ない部分は手動で削除してから実行してください！
                <br />
                抽出元: {resolvedUrl} ({extractedText.length}文字)
              </p>

              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #f87171',
                  fontSize: '12px',
                  outline: 'none',
                  minHeight: '200px',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  backgroundColor: '#fff5f5',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '12px',
                }}
              >
                <button
                  onClick={() => setStep(1)}
                  style={{
                    backgroundColor: 'white',
                    color: '#4b5563',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                  }}
                >
                  🔙 やり直す
                </button>

                <button
                  onClick={handleRunAI}
                  disabled={isLoading}
                  style={{
                    backgroundColor: isLoading ? '#d1d5db' : '#ec4899',
                    color: 'white',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    border: 'none',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px rgba(236, 72, 153, 0.3)',
                  }}
                >
                  {isLoading
                    ? '🤖 データを解析・抽出中...'
                    : '✨ STEP 2: この本文でAI解析を実行する'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <label
              style={{
                fontWeight: 'bold',
                color: '#374151',
                fontSize: '14px',
                margin: 0,
              }}
            >
              タイトル
            </label>

            {editForm.title && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  window.open(
                    `https://www.google.com/search?q=${encodeURIComponent(editForm.title)}`,
                    '_blank'
                  );
                }}
                style={{
                  fontSize: '12px',
                  color: '#2563eb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 12px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '4px',
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer',
                }}
              >
                <span>🔍</span> Google検索
              </button>
            )}
          </div>

          <input
            type="text"
            value={editForm.title || ''}
            onChange={(e) =>
              setEditForm({ ...editForm, title: e.target.value })
            }
            style={getDynamicInputStyle(editForm.title)}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '20px',
          }}
        >
          <div>
            <label style={labelStyle}>地域</label>
            <input
              type="text"
              value={editForm.region_text || editForm.region || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, region_text: e.target.value })
              }
              style={getDynamicInputStyle(editForm.region_text || editForm.region)}
            />
          </div>

          <div>
            <label style={labelStyle}>実施機関</label>
            <input
              type="text"
              value={editForm.organization || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, organization: e.target.value })
              }
              style={getDynamicInputStyle(editForm.organization)}
            />
          </div>

          <div>
            <label style={labelStyle}>公募ステータス</label>
            <select
              value={editForm.application_status || '不明'}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  application_status: e.target.value,
                })
              }
              style={getDynamicInputStyle(editForm.application_status)}
            >
              <option value="公募中">🟢 公募中</option>
              <option value="予告">🟡 予告 (開始前)</option>
              <option value="受付終了">🔴 受付終了</option>
              <option value="不明">⚪️ 不明</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>申請期間</label>
            <input
              type="text"
              value={editForm.application_period_text || editForm.deadline || ''}
              onChange={(e) => {
                const val = e.target.value;
                const parsedDates = parseDatesFromText(val);

                const shouldClearDates =
                  /(前日|前営業日|\d+日前|当日消印有効|必着|以内|以前|以後|随時|常時|通年|達し次第|助成枠に達するまで|予算額に達するまで|なくなり次第)/.test(
                    val
                  );

                const nextStart = shouldClearDates
                  ? warekiDateToISO(val) || editForm.application_start_date || ''
                  : parsedDates.start !== null
                    ? parsedDates.start
                    : parsedDates.end
                      ? ''
                      : editForm.application_start_date;

                const nextEnd = shouldClearDates
                  ? ''
                  : parsedDates.end !== null
                    ? parsedDates.end
                    : parsedDates.start
                      ? ''
                      : editForm.application_end_date;

                setEditForm({
                  ...editForm,
                  application_period_text: val,
                  deadline: val,
                  application_start_date: nextStart,
                  application_end_date: nextEnd,
                });
              }}
              style={getDynamicInputStyle(
                editForm.application_period_text || editForm.deadline
              )}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '20px',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <label
                style={{
                  fontWeight: 'bold',
                  color: '#374151',
                  fontSize: '14px',
                  margin: 0,
                }}
              >
                ✨ 公式公募ページ (ユーザー向け)
              </label>

              {editForm.official_url &&
                editForm.official_url.startsWith('http') && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(editForm.official_url, '_blank');
                    }}
                    style={{
                      fontSize: '12px',
                      color: '#2563eb',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      backgroundColor: '#eff6ff',
                      borderRadius: '4px',
                      border: '1px solid #bfdbfe',
                      cursor: 'pointer',
                    }}
                  >
                    <span>↗</span> 開く
                  </button>
                )}
            </div>

            <input
              type="text"
              value={editForm.official_url || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, official_url: e.target.value })
              }
              style={getDynamicInputStyle(editForm.official_url)}
              placeholder="https://..."
            />
          </div>

          <div
            style={{
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              border: '1px dashed #d1d5db',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <label
                style={{
                  fontWeight: 'bold',
                  color: '#6b7280',
                  fontSize: '12px',
                  margin: 0,
                }}
              >
                🔗 取得元URL (システム管理・追跡用)
              </label>

              {editForm.source_url && editForm.source_url.startsWith('http') && (
                <a
                  href={editForm.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: '#6b7280' }}
                >
                  元ページを確認
                </a>
              )}
            </div>

            <div
              style={{
                fontSize: '13px',
                color: '#9ca3af',
                marginTop: '4px',
                wordBreak: 'break-all',
              }}
            >
              {editForm.source_url || 'なし'}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '20px',
            backgroundColor: '#f8fafc',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div>
            <label style={labelStyle}>上限金額・助成額</label>
            <input
              type="text"
              value={editForm.amount_text || editForm.amount || ''}
              onChange={(e) => {
                const val = e.target.value;

                setEditForm({
                  ...editForm,
                  amount_text: val,
                  amount: val,
                  amount_max_yen: parseAmountMaxYen(val),
                });
              }}
              style={getDynamicInputStyle(editForm.amount_text || editForm.amount)}
            />
          </div>

          <div>
            <label style={labelStyle}>補助率</label>
            <input
              type="text"
              value={editForm.subsidy_rate_text || editForm.subsidy_rate || ''}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  subsidy_rate_text: e.target.value,
                  subsidy_rate: e.target.value,
                })
              }
              style={getDynamicInputStyle(
                editForm.subsidy_rate_text || editForm.subsidy_rate
              )}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>対象経費</label>
          <input
            type="text"
            value={
              editForm.target_expenses_arr &&
              editForm.target_expenses_arr.length > 0
                ? editForm.target_expenses_arr.join(' / ')
                : editForm.target_expenses || ''
            }
            onChange={(e) => {
              const val = e.target.value;
              const parts = val
                .split('/')
                .map((s) => s.trim())
                .filter(Boolean);

              setEditForm({
                ...editForm,
                target_expenses: val,
                target_expenses_arr: parts,
              });
            }}
            style={getDynamicInputStyle(
              editForm.target_expenses_arr?.length
                ? 'OK'
                : editForm.target_expenses
            )}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>対象事業者</label>
          <input
            type="text"
            value={
              editForm.target_entities_arr &&
              editForm.target_entities_arr.length > 0
                ? editForm.target_entities_arr.join(' / ')
                : editForm.target_entities || ''
            }
            onChange={(e) => {
              const val = e.target.value;
              const parts = val
                .split('/')
                .map((s) => s.trim())
                .filter(Boolean);

              setEditForm({
                ...editForm,
                target_entities: val,
                target_entities_arr: parts,
              });
            }}
            style={getDynamicInputStyle(
              editForm.target_entities_arr?.length
                ? 'OK'
                : editForm.target_entities
            )}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={labelStyle}>概要 (目的など)</label>
          <textarea
            value={editForm.summary || ''}
            onChange={(e) =>
              setEditForm({ ...editForm, summary: e.target.value })
            }
            style={{ ...getDynamicInputStyle(editForm.summary), minHeight: '80px' }}
          />
        </div>

        <hr
          style={{
            border: '0',
            borderTop: '1px dashed #d1d5db',
            marginBottom: '24px',
          }}
        />

        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontWeight: 'bold',
                color: '#374151',
                fontSize: '16px',
                margin: 0,
              }}
            >
              🏷 利用目的タグ
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '10px',
            }}
          >
            {PURPOSE_TAGS.map((tag) => (
              <label
                key={tag}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#4b5563',
                }}
              >
                <input
                  type="checkbox"
                  checked={(editForm.purposes || []).includes(tag)}
                  onChange={() => handleCheckboxChange('purposes', tag)}
                  style={{
                    cursor: 'pointer',
                    width: '16px',
                    height: '16px',
                  }}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#374151',
              fontSize: '16px',
            }}
          >
            🏢 業種タグ
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '10px',
            }}
          >
            {INDUSTRY_TAGS.map((tag) => (
              <label
                key={tag}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#4b5563',
                }}
              >
                <input
                  type="checkbox"
                  checked={(editForm.industries || []).includes(tag)}
                  onChange={() => handleCheckboxChange('industries', tag)}
                  style={{
                    cursor: 'pointer',
                    width: '16px',
                    height: '16px',
                  }}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}