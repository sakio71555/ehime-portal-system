import React, { useEffect, useState } from 'react';
import { PURPOSE_TAGS, INDUSTRY_TAGS } from './subsidyTags';
import {
  forceApplicationStatusByPeriod,
  normalizeDateForDB,
} from './adminEditHelpers';
import AdminEditHeader from './components/AdminEditHeader';
import AdminAIAssistPanel from './components/AdminAIAssistPanel';
import AdminAIDiagnostics from './components/AdminAIDiagnostics';
import AdminBasicFields from './components/AdminBasicFields';
import AdminDetailFields from './components/AdminDetailFields';
import AdminTagSelector from './components/AdminTagSelector';

export default function AdminEditForm({
  initialData,
  supabase,
  onBack,
  onRefresh,
}) {
  const [editForm, setEditForm] = useState(() =>
    forceApplicationStatusByPeriod({
      ...initialData,
      purposes: initialData.purposes || [],
      industries: initialData.industries || [],
      tags: initialData.tags || [],
    })
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
      setEditForm(
        forceApplicationStatusByPeriod({
          ...initialData,
          purposes: initialData.purposes || [],
          industries: initialData.industries || [],
          tags: initialData.tags || [],
        })
      );

      const defaultUrl = initialData.official_url || initialData.source_url;

      if (defaultUrl && defaultUrl.startsWith('http')) {
        setAiSourceUrl(defaultUrl);
      } else {
        setAiSourceUrl('');
      }

      setAiRawText('');
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
    const currentList = editForm[field] || [];

    if (currentList.includes(value)) {
      updateEditForm({
        [field]: currentList.filter((tag) => tag !== value),
      });
    } else {
      updateEditForm({
        [field]: [...currentList, value],
      });
    }
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
        application_status: fixedEditForm.application_status,
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

      const facts = forceApplicationStatusByPeriod(data?.facts || {});
      const tags = data?.tags || {};
      const finalTitle = data?.finalTitle || '';

      setAiDiagnostics({
        fieldConfidence: facts.field_confidence || {},
        warnings: Array.isArray(facts.warnings) ? facts.warnings : [],
        evidence: facts.evidence || {},
        candidateDebug: data?.candidate_debug || {},
      });

      if ((facts.confidence || 100) < 70) {
        const proceed = window.confirm(
          `⚠️ AIの抽出信頼度が低いです（${facts.confidence}%）。\n別制度の案内やヘッダー情報が混入している可能性があります。\n\n抽出されたデータをフォームに反映しますか？`
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

          if (val === undefined || val === '不明' || val === '未記載') {
            return prev[key];
          }

          if (val === null) {
            return '';
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

        const nextForm = {
          ...prev,
          source_url: facts.source_url || resolvedUrl || prev.source_url,
          official_url: nextOfficialUrl,
          title: finalTitle || facts.title || prev.title,
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

        return forceApplicationStatusByPeriod(nextForm);
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