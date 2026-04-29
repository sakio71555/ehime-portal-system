import React, { useEffect, useState } from 'react';
import { PURPOSE_TAGS, INDUSTRY_TAGS } from './subsidyTags';
import {
  forceApplicationStatusByPeriod,
  normalizeDateForDB,
} from './adminEditHelpers';
import {
  mergeAIResultSafely,
  sanitizeAIResultBeforeMerge,
  explainAIMergeProtection,
} from './adminAIMergeRules';

import AdminEditHeader from './components/AdminEditHeader';
import AdminAIAssistPanel from './components/AdminAIAssistPanel';
import AdminAIDiagnostics from './components/AdminAIDiagnostics';
import AdminBasicFields from './components/AdminBasicFields';
import AdminDetailFields from './components/AdminDetailFields';
import AdminTagSelector from './components/AdminTagSelector';

function toSafeArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (value === null || value === undefined || value === '') {
    return [];
  }

  return String(value)
    .split(/[、,\n/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildInitialEditForm(initialData) {
  const data = initialData || {};

  const purposes = Array.isArray(data.purposes) ? data.purposes : [];
  const industries = Array.isArray(data.industries) ? data.industries : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];

  const targetExpensesArr = Array.isArray(data.target_expenses_arr)
    ? data.target_expenses_arr
    : toSafeArray(data.target_expenses);

  const targetEntitiesArr = Array.isArray(data.target_entities_arr)
    ? data.target_entities_arr
    : toSafeArray(data.target_entities);

  return forceApplicationStatusByPeriod({
    ...data,

    purposes,
    industries,
    tags,

    region_text: data.region_text || data.region || data.prefecture || '',
    region: data.region || data.region_text || data.prefecture || '',

    application_period_text:
      data.application_period_text || data.deadline || '',

    amount_text: data.amount_text || data.amount || '',
    amount: data.amount || data.amount_text || '',

    subsidy_rate_text: data.subsidy_rate_text || data.subsidy_rate || '',
    subsidy_rate: data.subsidy_rate || data.subsidy_rate_text || '',

    target_expenses_arr: targetExpensesArr,
    target_expenses:
      data.target_expenses || targetExpensesArr.join(' / ') || '',

    target_entities_arr: targetEntitiesArr,
    target_entities:
      data.target_entities || targetEntitiesArr.join(' / ') || '',

    crawl_status: data.crawl_status || 'draft',
    is_active: Boolean(data.is_active),
  });
}

function isJgrantsData(form) {
  return String(form?.source_type || '').trim() === 'jgrants';
}

function isUsableArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function uniqueArray(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function makeTagsFromPurposesAndIndustries(purposes, industries, previousTags = []) {
  return uniqueArray([
    ...(previousTags || []),
    ...(purposes || []),
    ...(industries || []),
  ]);
}

export default function AdminEditForm({
  initialData,
  supabase,
  onBack,
  onRefresh,
}) {
  const [editForm, setEditForm] = useState(() =>
    buildInitialEditForm(initialData)
  );

  const [aiSourceUrl, setAiSourceUrl] = useState('');
  const [aiRawText, setAiRawText] = useState('');
  const [step, setStep] = useState(1);
  const [extractedText, setExtractedText] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiDiagnostics, setAiDiagnostics] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextForm = buildInitialEditForm(initialData);

      setEditForm(nextForm);

      const defaultUrl = nextForm.official_url || nextForm.source_url;

      if (defaultUrl && String(defaultUrl).startsWith('http')) {
        setAiSourceUrl(defaultUrl);
      } else {
        setAiSourceUrl('');
      }

      setAiRawText('');
      setExtractedText('');
      setResolvedUrl('');
      setStep(1);
      setAiDiagnostics(null);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [initialData]);

  const updateEditForm = (patch) => {
    setEditForm((prev) => forceApplicationStatusByPeriod({ ...prev, ...patch }));
  };

  const handleCheckboxChange = (field, value) => {
    setEditForm((prev) => {
      const currentList = Array.isArray(prev[field]) ? prev[field] : [];

      const nextList = currentList.includes(value)
        ? currentList.filter((tag) => tag !== value)
        : [...currentList, value];

      const nextForm = {
        ...prev,
        [field]: nextList,
      };

      if (field === 'purposes') {
        nextForm.tags = makeTagsFromPurposesAndIndustries(
          nextList,
          prev.industries || [],
          prev.tags || []
        );
      }

      if (field === 'industries') {
        nextForm.tags = makeTagsFromPurposesAndIndustries(
          prev.purposes || [],
          nextList,
          prev.tags || []
        );
      }

      return forceApplicationStatusByPeriod(nextForm);
    });
  };

  const handleSave = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    const fixedEditForm = forceApplicationStatusByPeriod(editForm);

    const { error } = await supabase
      .from('subsidies')
      .update({
        title: fixedEditForm.title,
        region: fixedEditForm.region,
        region_text: fixedEditForm.region_text,
        prefecture: fixedEditForm.prefecture,
        municipality: fixedEditForm.municipality,
        organization: fixedEditForm.organization,

        deadline: fixedEditForm.application_period_text || fixedEditForm.deadline,
        application_period_text: fixedEditForm.application_period_text,
        application_start_date: normalizeDateForDB(
          fixedEditForm.application_start_date
        ),
        application_end_date: normalizeDateForDB(
          fixedEditForm.application_end_date
        ),
        application_status: fixedEditForm.application_status,

        amount: fixedEditForm.amount,
        amount_text: fixedEditForm.amount_text,
        amount_max_yen: fixedEditForm.amount_max_yen || 0,

        subsidy_rate: fixedEditForm.subsidy_rate,
        subsidy_rate_text: fixedEditForm.subsidy_rate_text,

        target_expenses: fixedEditForm.target_expenses,
        target_expenses_arr: fixedEditForm.target_expenses_arr || [],
        target_entities: fixedEditForm.target_entities,
        target_entities_arr: fixedEditForm.target_entities_arr || [],

        summary: fixedEditForm.summary,

        source_url: fixedEditForm.source_url,
        official_url: fixedEditForm.official_url,

        purposes: fixedEditForm.purposes || [],
        industries: fixedEditForm.industries || [],
        tags: fixedEditForm.tags || [],

        fiscal_year: fixedEditForm.fiscal_year,

        source_type: fixedEditForm.source_type || null,
        source_external_id: fixedEditForm.source_external_id || null,
      })
      .eq('id', initialData.id);

    if (!error) {
      setEditForm(fixedEditForm);
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

    const safeUpdateData = forceApplicationStatusByPeriod({ ...editForm });

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
    setAiDiagnostics(null);

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
          source_type: editForm.source_type || '',
          currentData: editForm,
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
          `⚠️ 抽出された本文が ${sourceText.length} 文字しかありません。\n一覧ページやメニュー部分だけを取得してしまった可能性があります。\n内容をプレビューで確認してください。`
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

    if (!extractedText || extractedText.trim().length < 50) {
      alert('AIに送る本文が短すぎます。本文を取得するか、テキストを貼り付けてください。');
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
          source_url: resolvedUrl || aiSourceUrl || editForm.source_url || '',
          official_url: editForm.official_url || '',
          editFormTitle: editForm.title,
          title: editForm.title,
          org,
          summary: editForm.summary,
          source_type: editForm.source_type || '',
          currentData: editForm,
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

      /**
       * 注意:
       * data.facts をここで forceApplicationStatusByPeriod に通さない。
       * AIが application_period_text にタイトル文字列を入れた場合、
       * 既存の正しいJグランツ値を壊す可能性があるため。
       */
      const facts = data?.facts || {};
      const tags = data?.tags || {};
      const finalTitle = data?.finalTitle || '';

      const tagPurposes = Array.isArray(tags.purposes) ? tags.purposes : [];
      const tagIndustries = Array.isArray(tags.industries) ? tags.industries : [];

      const aiResultRaw = {
        ...facts,

        title: finalTitle || facts.title,

        purposes: isUsableArray(facts.purposes)
          ? facts.purposes
          : tagPurposes,

        industries: isUsableArray(facts.industries)
          ? facts.industries
          : tagIndustries,

        tags: uniqueArray([
          ...(Array.isArray(facts.tags) ? facts.tags : []),
          ...tagPurposes,
          ...tagIndustries,
          ...(Array.isArray(facts.purposes) ? facts.purposes : []),
          ...(Array.isArray(facts.industries) ? facts.industries : []),
        ]),
      };

      const safeAIResult = sanitizeAIResultBeforeMerge(aiResultRaw);
      const protection = explainAIMergeProtection(editForm);
      const isJgrants = isJgrantsData(editForm);

      const fieldConfidence = facts.field_confidence || {};
      const baseWarnings = Array.isArray(facts.warnings) ? facts.warnings : [];
      const warnings = [...baseWarnings];

      if (protection.protected) {
        warnings.unshift(
          'Jグランツ由来データのため、タイトル・地域・申請期間・公式URLなどの確定項目はAIで上書きしません。'
        );
      }

      setAiDiagnostics({
        fieldConfidence,
        warnings,
        evidence: facts.evidence || {},
        candidateDebug: data?.candidate_debug || {},
      });

      const confidence = Number(facts.confidence ?? 100);

      if (confidence < 70) {
        const proceed = window.confirm(
          `⚠️ AIの抽出信頼度が低いです（${facts.confidence}%）。\n別制度の案内やヘッダー情報が混入している可能性があります。\n\n抽出されたデータをフォームに反映しますか？`
        );

        if (!proceed) {
          setIsLoading(false);
          return;
        }
      }

      setEditForm((prev) => {
        const merged = mergeAIResultSafely(prev, safeAIResult);
        return forceApplicationStatusByPeriod(merged);
      });

      /**
       * Jグランツ由来では、取得元URL欄もJグランツURLのままにする。
       */
      if (!isJgrants) {
        if (facts.source_url && facts.source_url !== aiSourceUrl) {
          setAiSourceUrl(facts.source_url);
        } else if (resolvedUrl && resolvedUrl !== aiSourceUrl) {
          setAiSourceUrl(resolvedUrl);
        }
      }

      setStep(1);

      alert(
        isJgrants
          ? '🎉 Jグランツ由来の確定項目を保護したまま、AI補完を反映しました！'
          : '🎉 バックエンドでの安全なAI解析が完了しました！'
      );
    } catch (err) {
      alert('AIエラー: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const statusFixedForm = forceApplicationStatusByPeriod(editForm);
  const currentApplicationStatus =
    statusFixedForm.application_status || editForm.application_status || '不明';

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      }}
    >
      <AdminEditHeader
        editForm={editForm}
        onBack={onBack}
        handleDelete={handleDelete}
        handleSave={handleSave}
        handleTogglePublish={handleTogglePublish}
      />

      <div style={{ padding: '32px' }}>
        {isJgrantsData(editForm) && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '18px',
              fontSize: '13px',
              lineHeight: 1.7,
            }}
          >
            <strong>取得元：Jグランツ</strong>
            <br />
            AI自動入力を実行しても、タイトル・地域・申請期間・公式URLなどの確定項目は上書きしません。
          </div>
        )}

        <AdminAIAssistPanel
          step={step}
          setStep={setStep}
          aiSourceUrl={aiSourceUrl}
          setAiSourceUrl={setAiSourceUrl}
          aiRawText={aiRawText}
          setAiRawText={setAiRawText}
          extractedText={extractedText}
          setExtractedText={setExtractedText}
          resolvedUrl={resolvedUrl}
          isLoading={isLoading}
          handleFetchText={handleFetchText}
          handleRunAI={handleRunAI}
        />

        <AdminAIDiagnostics aiDiagnostics={aiDiagnostics} />

        <AdminBasicFields
          editForm={editForm}
          updateEditForm={updateEditForm}
          setEditForm={setEditForm}
          currentApplicationStatus={currentApplicationStatus}
        />

        <AdminDetailFields editForm={editForm} updateEditForm={updateEditForm} />

        <AdminTagSelector
          editForm={editForm}
          handleCheckboxChange={handleCheckboxChange}
        />
      </div>
    </div>
  );
}