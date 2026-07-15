import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import {
  buildColumnSourceFacts,
  getColumnFactReadiness,
  PUBLISH_QUALITY_CHECKS,
  mergeColumnQualityReview,
  reviewColumnQuality,
  stripHtmlToText,
} from './utils/columnQualityValidator';

const FEATURE_CATEGORY = '特集';

const createImageFileName = (prefix) => `${prefix}_${Date.now()}.png`;

const subsidyFactValue = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join(' / ') : String(value || '').trim();

const scoreSubsidyForColumn = (subsidy = {}) =>
  [
    subsidy.title,
    subsidy.organization,
    subsidy.official_url || subsidy.source_url,
    subsidy.application_period_text || subsidy.deadline,
    subsidy.amount_text || subsidy.amount,
    subsidy.subsidy_rate_text || subsidy.subsidy_rate,
    subsidyFactValue(subsidy.target_entities_arr || subsidy.target_entities),
    subsidyFactValue(subsidy.target_expenses_arr || subsidy.target_expenses),
  ].filter((value) => subsidyFactValue(value)).length;

const getCandidateOfficialUrl = (subsidy = {}) =>
  String(subsidy.official_url || subsidy.source_url || '').trim();

const buildExtractedCandidateFacts = ({ subsidy, extractedFacts, officialText, resolvedUrl }) => {
  const checkedAt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const evidenceParts = [
    extractedFacts.evidence?.application_period_text,
    extractedFacts.evidence?.amount_text,
    extractedFacts.evidence?.subsidy_rate_text,
    extractedFacts.evidence?.target_entities_arr,
    extractedFacts.evidence?.target_expenses_arr,
    extractedFacts.evidence?.eligibility_conditions_arr,
    extractedFacts.evidence?.calculation_method_text,
    extractedFacts.evidence?.payment_conditions_arr,
    extractedFacts.evidence?.application_methods_arr,
    extractedFacts.evidence?.pre_start_rule_text,
    extractedFacts.summary,
    officialText,
  ].filter(Boolean);
  const officialUrl = resolvedUrl || extractedFacts.official_url || getCandidateOfficialUrl(subsidy);

  return {
    articleType: 'single_program',
    programKind: extractedFacts.program_kind || '',
    officialName: extractedFacts.title || subsidy.title || '',
    fiscalYear: extractedFacts.fiscal_year || '',
    applicationRound: '',
    administeringBody: extractedFacts.organization || subsidy.organization || '',
    supervisingBody: '',
    applicationStart: extractedFacts.application_start_date || '',
    applicationDeadline:
      extractedFacts.application_period_text || extractedFacts.application_end_date || '',
    subsidyRate: extractedFacts.subsidy_rate_text || '',
    subsidyCap: extractedFacts.amount_text || '',
    eligibleApplicants: Array.isArray(extractedFacts.target_entities_arr)
      ? extractedFacts.target_entities_arr
      : [],
    eligibleProjects: [],
    eligibleExpenses: Array.isArray(extractedFacts.target_expenses_arr)
      ? extractedFacts.target_expenses_arr
      : [],
    ineligibleExpenses: [],
    eligibilityConditions: Array.isArray(extractedFacts.eligibility_conditions_arr)
      ? extractedFacts.eligibility_conditions_arr
      : [],
    calculationMethod: extractedFacts.calculation_method_text || '',
    paymentConditions: Array.isArray(extractedFacts.payment_conditions_arr)
      ? extractedFacts.payment_conditions_arr
      : [],
    applicationMethods: Array.isArray(extractedFacts.application_methods_arr)
      ? extractedFacts.application_methods_arr
      : [],
    projectPeriod: '',
    preStartRule: {
      confirmed: Boolean(extractedFacts.pre_start_rule_text),
      allowedFrom: '',
      safeDescription: extractedFacts.pre_start_rule_text || '',
      sourceId: extractedFacts.pre_start_rule_text ? 'source-1' : '',
    },
    officialSources: officialUrl
      ? [
          {
            id: 'source-1',
            label: extractedFacts.title || subsidy.title || '公式情報',
            url: officialUrl,
            checkedAt,
            evidence: evidenceParts.join('\n').slice(0, 12000),
          },
        ]
      : [],
    unknownFields: [],
  };
};

export default function AdminColumns({ initialMode = 'columns' }) {
  const [columns, setColumns] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);
  const [editingColumn, setEditingColumn] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [regeneratingImageId, setRegeneratingImageId] = useState(null);
  const [isBackfillingImages, setIsBackfillingImages] = useState(false);
  const [isRunningQualityReview, setIsRunningQualityReview] = useState(false);
  const [isRepairingArticle, setIsRepairingArticle] = useState(false);
  const [isFetchingOfficialSource, setIsFetchingOfficialSource] = useState(false);

  const fetchColumns = useCallback(async () => {
    if (!supabase) {
      setColumns([]);
      return;
    }

    const { data, error } = await supabase
      .from('columns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setColumns(data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchColumns();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchColumns]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        msg,
        type,
        time: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
      },
    ]);
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success':
        return '#059669';
      case 'warning':
        return '#d97706';
      case 'error':
        return '#dc2626';
      default:
        return '#374151';
    }
  };

  const hasUsableOfficialSource = (sourceFacts) =>
    Boolean(
      sourceFacts?.officialSources?.some(
        (source) => source?.url && source?.evidence && source.evidence.length >= 12
      )
    );

  const buildSourceFactsForColumn = (column) =>
    buildColumnSourceFacts({
      sourceFacts: column?.quality_review?.sourceFacts,
      sourceText: column?.ai_instructions || '',
      title: column?.title || column?.seo_title || '',
      content: column?.content || '',
      category: column?.category || '',
      articleType: column?.category === FEATURE_CATEGORY ? 'feature' : 'column',
    });

  const handleFetchOfficialSource = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');

    const sourceUrl = String(editingColumn?.official_source_url || '').trim();
    if (!/^https?:\/\/[^\s]+$/i.test(sourceUrl)) {
      return alert('取得する公式ページのURLを入力してください。');
    }
    if (
      !window.confirm(
        '公式ページ本文の取得と制度情報の構造化に外部APIを使用します。\nAPI利用料が発生する可能性があります。\n実行しますか？'
      )
    ) {
      return;
    }

    setIsFetchingOfficialSource(true);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-page-text', {
        body: {
          sourceUrl,
          title: editingColumn.title || '',
        },
      });

      if (error) throw new Error(`サーバー通信エラー: ${error.message}`);
      if (data?.error) throw new Error(data.error);

      const officialText = String(data?.sourceText || '').trim();
      const resolvedUrl = String(data?.resolvedUrl || sourceUrl).trim();
      if (officialText.length < 80) {
        throw new Error('公式ページから記事作成に使える本文を十分取得できませんでした。');
      }

      const { data: extractedData, error: extractError } = await supabase.functions.invoke('extract-subsidy', {
        body: {
          extractedText: officialText,
          resolvedUrl,
          editFormTitle: editingColumn.title || '',
          org: '愛媛県',
        },
      });

      if (extractError) throw new Error(`制度情報の構造化エラー: ${extractError.message}`);
      if (extractedData?.error) throw new Error(extractedData.error);

      const extractedFacts = extractedData?.facts || {};

      const checkedAt = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const currentInstructions = String(editingColumn.ai_instructions || '')
        .replace(/【公式取得データ】[\s\S]*?【公式取得データここまで】\s*/g, '')
        .trim();
      const sourceBlock = [
        '【公式取得データ】',
        `タイトル: ${editingColumn.title || '未入力'}`,
        `公式URL: ${resolvedUrl}`,
        `確認日: ${checkedAt}`,
        '公式ページ本文:',
        officialText.slice(0, 14000),
        '【公式取得データここまで】',
      ].join('\n');
      const extractedEvidence = [
        extractedFacts.evidence?.application_period_text,
        extractedFacts.evidence?.amount_text,
        extractedFacts.evidence?.subsidy_rate_text,
        extractedFacts.evidence?.target_entities_arr,
        extractedFacts.evidence?.target_expenses_arr,
        extractedFacts.summary,
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 1600);
      const extractedSourceFacts = {
        articleType: editingColumn.category === FEATURE_CATEGORY ? 'feature' : 'single_program',
        officialName: extractedFacts.title || editingColumn.title || '',
        fiscalYear: extractedFacts.fiscal_year || '',
        applicationRound: '',
        administeringBody: extractedFacts.organization || '',
        supervisingBody: '',
        applicationStart: extractedFacts.application_start_date || '',
        applicationDeadline:
          extractedFacts.application_period_text || extractedFacts.application_end_date || '',
        subsidyRate: extractedFacts.subsidy_rate_text || '',
        subsidyCap: extractedFacts.amount_text || '',
        eligibleApplicants: Array.isArray(extractedFacts.target_entities_arr)
          ? extractedFacts.target_entities_arr
          : [],
        eligibleProjects: [],
        eligibleExpenses: Array.isArray(extractedFacts.target_expenses_arr)
          ? extractedFacts.target_expenses_arr
          : [],
        ineligibleExpenses: [],
        applicationMethods: [],
        projectPeriod: '',
        preStartRule: {
          confirmed: false,
          allowedFrom: '',
          safeDescription: '',
          sourceId: '',
        },
        officialSources: [
          {
            id: 'source-1',
            label: extractedFacts.title || editingColumn.title || '公式情報',
            url: extractedFacts.official_url || resolvedUrl,
            checkedAt,
            evidence: extractedEvidence || officialText.slice(0, 1600),
          },
        ],
        unknownFields: [],
      };

      setEditingColumn((prev) => ({
        ...prev,
        official_source_url: resolvedUrl,
        ai_instructions: [sourceBlock, currentInstructions].filter(Boolean).join('\n\n'),
        quality_review: {
          ...(prev?.quality_review || {}),
          sourceFacts: extractedSourceFacts,
          humanReviewed: false,
          humanReviewCompleted: false,
        },
        official_source_fetch: {
          url: resolvedUrl,
          checkedAt,
          textLength: officialText.length,
        },
      }));

      alert(
        `公式情報を取得・構造化しました。\n` +
          `取得文字数: ${officialText.length.toLocaleString()}文字\n` +
          `制度名: ${extractedSourceFacts.officialName || '未確認'}\n` +
          `実施機関: ${extractedSourceFacts.administeringBody || '未確認'}\n\n` +
          `生成前に公式ファクト欄と素材欄を確認してください。`
      );
    } catch (err) {
      alert(`公式情報取得エラー: ${err.message}`);
    } finally {
      setIsFetchingOfficialSource(false);
    }
  };

  const normalizeBase64Image = (base64Image) => {
    if (!base64Image) return '';

    return String(base64Image)
      .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
      .replace(/\s/g, '');
  };

  const getGeneratedBase64Image = (data) =>
    normalizeBase64Image(
      data?.base64Image ||
        data?.imageBase64 ||
        data?.thumbnailBase64 ||
        data?.image?.b64_json ||
        data?.data?.[0]?.b64_json ||
        ''
    );

  const getImageErrorMessage = (data) =>
    data?.imageError || data?.imageWarning || data?.image_error || '';

  const getQualityReviewColor = (review) => {
    if (!review) return '#64748b';
    if (review.fatalIssues?.length > 0 || review.grade === 'D') return '#dc2626';
    if (review.grade === 'C' || review.shouldRegenerate) return '#d97706';
    if (review.grade === 'B') return '#2563eb';
    return '#059669';
  };

  const getColumnHumanReviewed = (column) =>
    Boolean(column?.quality_review?.humanReviewed || column?.quality_review?.humanReviewCompleted);

  const buildGeneratedColumnDraft = (articleData, fallbackColumn = {}) => ({
    ...fallbackColumn,
    title: articleData.title || fallbackColumn.title,
    slug: articleData.slug || fallbackColumn.slug,
    seo_title: articleData.seo_title || '',
    meta_description: articleData.meta_description || '',
    content: articleData.content || '',
    category:
      fallbackColumn.category === FEATURE_CATEGORY
        ? FEATURE_CATEGORY
        : articleData.category || fallbackColumn.category || '基礎知識',
    thumbnail_text: articleData.thumbnail_text || '',
    tags: articleData.tags || [],
    is_published: false,
  });

  const buildQualityReviewForGeneratedArticle = (data, articleData, fallbackColumn = {}, articleType = 'column') => {
    const draft = {
      ...buildGeneratedColumnDraft(articleData, fallbackColumn),
      quality_review: data?.articleQualityReview || articleData?.quality_review,
    };

    return mergeColumnQualityReview(data?.articleQualityReview || articleData?.quality_review, draft, {
      articleType,
      sourceFacts: data?.sourceFacts || data?.articleQualityReview?.sourceFacts || articleData?.sourceFacts,
      sourceText: data?.sourceText || fallbackColumn.ai_instructions || '',
      humanReviewed: getColumnHumanReviewed(fallbackColumn),
    });
  };

  const formatQualityReviewForAlert = (review) => {
    if (!review) return '';

    const lines = [
      `品質スコア: ${review.qualityScore}/100（${review.grade}）`,
      `公式情報充足率: ${review.sourceCoverageScore ?? 0}/100`,
      `事実根拠スコア: ${review.factualGroundingScore ?? 0}/100`,
      review.shouldRegenerate ? '再生成推奨: はい' : '再生成推奨: いいえ',
      review.humanReviewed ? '人間確認: 完了' : '人間確認: 未完了',
      review.publishAllowed ? '公開判定: 公開可能' : '公開判定: 公開不可または要確認',
    ];

    if (review.fatalIssues?.length) {
      lines.push('', '致命的NG:', ...review.fatalIssues.map((issue) => `・${issue}`));
    }

    if (review.warnings?.length) {
      lines.push('', '警告:', ...review.warnings.map((warning) => `・${warning}`));
    }

    if (review.scoreCapsApplied?.length) {
      lines.push('', 'スコア上限:', ...review.scoreCapsApplied.map((cap) => `・${cap}`));
    }

    if (review.unsupportedClaims?.length) {
      lines.push('', '根拠不明の主張:', ...review.unsupportedClaims.map((claim) => `・${claim}`));
    }

    if (review.suggestedTitles?.length) {
      lines.push('', '安全なタイトル案:', ...review.suggestedTitles.slice(0, 3).map((item) => `・${item}`));
    }

    if (review.improvementSuggestions?.length) {
      lines.push('', '改善提案:', ...review.improvementSuggestions.slice(0, 4).map((item) => `・${item}`));
    }

    return lines.join('\n');
  };

  const base64ToBlob = (base64Image) => {
    const normalizedBase64 = normalizeBase64Image(base64Image);

    if (!normalizedBase64) {
      throw new Error('画像データが空です。');
    }

    const byteCharacters = atob(normalizedBase64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
  };

  const uploadGeneratedImage = async (base64Image, prefix = 'column') => {
    if (!base64Image) return '';

    const imgBlob = base64ToBlob(base64Image);
    const fileName = createImageFileName(prefix);

    const { error: uploadError } = await supabase.storage
      .from('column-images')
      .upload(fileName, imgBlob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`画像アップロードエラー: ${uploadError.message}`);
    }

    return supabase.storage.from('column-images').getPublicUrl(fileName).data.publicUrl;
  };

  const buildImageOnlyBody = (column) => ({
    imageOnly: true,
    title: column.title || '',
    category: column.category || '',
    thumbnailText: column.thumbnail_text || column.title || '',
    content: stripHtmlToText(column.content || '').slice(0, 500),
  });

  const updateColumnThumbnailImage = async (column) => {
    const { data, error } = await supabase.functions.invoke('auto-column', {
      body: buildImageOnlyBody(column),
    });

    if (error) throw new Error(`サーバー通信エラー: ${error.message}`);
    if (data?.error) throw new Error(data.error);

    const base64Image = getGeneratedBase64Image(data);
    const imageErrorMessage = getImageErrorMessage(data);

    if (!base64Image) {
      throw new Error(
        imageErrorMessage || '画像データが返ってきませんでした。auto-column Edge Function のログを確認してください。'
      );
    }

    const prefix = column.category === FEATURE_CATEGORY ? 'feature_image' : 'column_image';
    const finalThumbnailUrl = await uploadGeneratedImage(base64Image, prefix);
    const nextThumbnailText = column.thumbnail_text || column.title || '';

    const { error: updateError } = await supabase
      .from('columns')
      .update({
        thumbnail_url: finalThumbnailUrl,
        thumbnail_text: nextThumbnailText,
      })
      .eq('id', column.id);

    if (updateError) throw new Error(`DB保存エラー: ${updateError.message}`);

    setColumns((prev) =>
      prev.map((item) =>
        item.id === column.id
          ? {
              ...item,
              thumbnail_url: finalThumbnailUrl,
              thumbnail_text: nextThumbnailText,
            }
          : item
      )
    );

    setEditingColumn((prev) =>
      prev?.id === column.id
        ? {
            ...prev,
            thumbnail_url: finalThumbnailUrl,
            thumbnail_text: nextThumbnailText,
          }
        : prev
    );

    return finalThumbnailUrl;
  };

  const handleRegenerateColumnImage = async (column) => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');
    if (!column?.id) return alert('画像だけ再生成するには、先に記事を保存してください。');

    const hasImage = Boolean(column.thumbnail_url);
    const confirmMessage = hasImage
      ? `「${column.title || 'この記事'}」の画像だけを再生成し、現在の画像を差し替えますか？\n本文やタイトルは変更しません。`
      : `「${column.title || 'この記事'}」の画像だけを生成しますか？\n本文やタイトルは変更しません。`;

    if (!window.confirm(confirmMessage)) return;

    setRegeneratingImageId(column.id);

    try {
      await updateColumnThumbnailImage(column);
      alert('画像だけ再生成しました！');
    } catch (err) {
      alert(`画像生成エラー: ${err.message}`);
    } finally {
      setRegeneratingImageId(null);
    }
  };

  const handleBackfillMissingImages = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');

    const targets = visibleColumns.filter((col) => !col.thumbnail_url);

    if (targets.length === 0) {
      return alert('画像が未設定の記事はありません。');
    }

    if (
      !window.confirm(
        `${isFeatureMode ? '特集記事' : 'コラム'}のうち、画像がない ${targets.length} 件に画像だけを順番に生成します。\n本文やタイトルは変更しません。\n実行しますか？`
      )
    ) {
      return;
    }

    setIsBackfillingImages(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const column of targets) {
        setRegeneratingImageId(column.id);
        try {
          await updateColumnThumbnailImage(column);
          successCount += 1;
        } catch (err) {
          errorCount += 1;
          console.error(`画像バックフィル失敗: ${column.title || column.id}`, err);
        }
      }

      alert(`画像バックフィルが完了しました。\n成功: ${successCount}件\n失敗: ${errorCount}件`);
    } finally {
      setRegeneratingImageId(null);
      setIsBackfillingImages(false);
    }
  };

  const handleGenerateFromTitle = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');
    if (!editingColumn.title) {
      return alert('まずは「タイトル」を入力してください。（例：「補助率」と「補助上限額」とは？）');
    }

    const suppliedFacts = buildSourceFactsForColumn(editingColumn);
    if (!hasUsableOfficialSource(suppliedFacts)) {
      return alert(
        '公式URLと根拠本文が確認できません。\n\n「公式ページURL」を入力して「公式情報を取得」を押すか、素材欄へ公式URL・確認日・一次情報を貼り付けてください。'
      );
    }

    if (
      !window.confirm(
        `「${editingColumn.title}」というテーマで、公式情報に基づく公開前確認用のAI下書きとサムネイル画像を生成しますか？\n記事が短い場合は自動補強のためOpenAI APIを追加で1回使用します。\n（※現在入力されている本文は上書きされ、公開ステータスは下書きになります）`
      )
    ) {
      return;
    }

    setIsGeneratingTitle(true);

    try {
      const isFeatureArticle = editingColumn.category === FEATURE_CATEGORY;
      const generationPrompt = editingColumn.title.trim();

      const { data, error } = await supabase.functions.invoke('auto-column', {
        body: {
          title: generationPrompt,
          requestedTitle: editingColumn.title || '',
          sourceText: editingColumn.ai_instructions || '',
          sourceFacts: suppliedFacts,
          articleType: isFeatureArticle ? 'feature' : 'column',
          category: editingColumn.category || '',
          extraInstructions: '',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const articleData = data?.articleData;
      const base64Image = getGeneratedBase64Image(data);
      const imageErrorMessage = getImageErrorMessage(data);
      if (!articleData) {
        throw new Error('Edge Functionから記事データが返ってきませんでした。');
      }

      const articleQualityReview = buildQualityReviewForGeneratedArticle(
        data,
        articleData,
        editingColumn,
        isFeatureArticle ? 'feature' : 'column'
      );
      const expansionNotice = data?.articleExpansion?.attempted
        ? data.articleExpansion.applied
          ? `\n\n短い初稿を自動補強しました（${data.articleExpansion.before?.textLength || 0}文字 → ${data.articleExpansion.after?.textLength || 0}文字）。`
          : `\n\n自動補強は適用されませんでした。${data.articleExpansion.error ? ` 理由: ${data.articleExpansion.error}` : ''}`
        : '';

      let finalThumbnailUrl = editingColumn.thumbnail_url || '';

      if (base64Image) {
        finalThumbnailUrl = await uploadGeneratedImage(base64Image, 'column_manual');
      }

      setEditingColumn((prev) => ({
        ...buildGeneratedColumnDraft(articleData, prev),
        thumbnail_url: finalThumbnailUrl,
        quality_review: articleQualityReview,
      }));

      if (finalThumbnailUrl) {
        alert(
          'AI下書きと画像の生成が完了しました。公開前チェックを確認し、必要な公式リンク・注意点を整えてから保存してください。' +
            expansionNotice +
            `\n\n${formatQualityReviewForAlert(articleQualityReview)}`
        );
      } else {
        alert(
          `記事は生成できましたが、画像は生成できませんでした。\n` +
          `原因: ${imageErrorMessage || '画像データが返ってきませんでした。'}\n\n` +
          expansionNotice +
          `記事内容は下書きとして保存できます。公開前に公式リンク・確認日・注意点を必ず確認してください。\n\n` +
            `${formatQualityReviewForAlert(articleQualityReview)}`
        );
      }
    } catch (err) {
      alert(`❌ エラー: ${err.message}`);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleRunLlmQualityReview = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');
    if (!editingColumn?.content) return alert('レビューする本文がありません。');

    const shouldRun = window.confirm(
      'OpenAI APIを使って、意味面の品質レビューを1回実行します。\nAPI利用料が発生する可能性があります。\n実行しますか？'
    );

    if (!shouldRun) return;

    setIsRunningQualityReview(true);

    try {
      const articleType = editingColumn.category === FEATURE_CATEGORY ? 'feature' : 'column';
      const ruleBasedReview = reviewColumnQuality(editingColumn, {
        articleType,
        sourceFacts: buildSourceFactsForColumn(editingColumn),
        sourceText: editingColumn.ai_instructions || '',
        humanReviewed: getColumnHumanReviewed(editingColumn),
      });
      if (ruleBasedReview.ruleBasedScore < 80 || !hasUsableOfficialSource(ruleBasedReview.sourceFacts)) {
        return alert(
          `API品質レビューの前にルールベースの問題を修正してください。\n\n` +
            `ルールスコア: ${ruleBasedReview.ruleBasedScore}/100\n` +
            `公式根拠: ${hasUsableOfficialSource(ruleBasedReview.sourceFacts) ? '確認済み' : '不足'}\n\n` +
            `先に「指摘を反映して修正生成」または本文の手動修正を行ってください。`
        );
      }
      const { data, error } = await supabase.functions.invoke('auto-column', {
        body: {
          qualityReviewOnly: true,
          useLlmReview: true,
          confirmUsePaidApi: true,
          title: editingColumn.title || '',
          seo_title: editingColumn.seo_title || '',
          content: editingColumn.content || '',
          category: editingColumn.category || '',
          articleType,
          sourceText: editingColumn.ai_instructions || '',
          sourceFacts: ruleBasedReview.sourceFacts,
          ruleBasedReview,
        },
      });

      if (error) throw new Error(`サーバー通信エラー: ${error.message}`);
      if (data?.error && !data?.articleQualityReview) throw new Error(data.error);

      const nextQualityReview = mergeColumnQualityReview(data?.articleQualityReview, editingColumn, {
        articleType,
        sourceFacts: data?.articleQualityReview?.sourceFacts || ruleBasedReview.sourceFacts,
        sourceText: editingColumn.ai_instructions || '',
        humanReviewed: getColumnHumanReviewed(editingColumn),
      });

      setEditingColumn((prev) => ({
        ...prev,
        quality_review: nextQualityReview,
      }));

      alert(
        `${data?.usedApi ? 'API品質レビューを実行しました。' : 'API品質レビューは未実行です。'}\n\n` +
          (data?.error ? `補足: ${data.error}\n\n` : '') +
          formatQualityReviewForAlert(nextQualityReview)
      );
    } catch (err) {
      alert(`API品質レビューエラー: ${err.message}`);
    } finally {
      setIsRunningQualityReview(false);
    }
  };

  const handleRepairArticleFromReview = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');
    if (!editingColumn?.content) return alert('修正する本文がありません。');

    const articleType = editingColumn.category === FEATURE_CATEGORY ? 'feature' : 'column';
    const currentReview = mergeColumnQualityReview(editingColumn.quality_review, editingColumn, {
      articleType,
      sourceFacts: buildSourceFactsForColumn(editingColumn),
      sourceText: editingColumn.ai_instructions || '',
      humanReviewed: getColumnHumanReviewed(editingColumn),
    });
    if (!hasUsableOfficialSource(currentReview.sourceFacts)) {
      return alert('修正生成の前に公式URLと根拠本文を取得・入力してください。');
    }
    const currentIteration = Number(currentReview.repairIterations || 0);

    if (currentIteration >= 2) {
      return alert('自動修正は最大2回までです。これ以上は人間確認で修正してください。');
    }

    const shouldRun = window.confirm(
      'OpenAI APIを使って、公開前チェックの指摘を反映した修正案を1回生成します。\nAPI利用料が発生する可能性があります。\n公式ファクトにない情報は追加しません。\n実行しますか？'
    );

    if (!shouldRun) return;

    setIsRepairingArticle(true);

    try {
      const { data, error } = await supabase.functions.invoke('auto-column', {
        body: {
          repairArticleOnly: true,
          confirmUsePaidApi: true,
          originalTitle: editingColumn.title || '',
          originalBody: editingColumn.content || '',
          seo_title: editingColumn.seo_title || '',
          meta_description: editingColumn.meta_description || '',
          category: editingColumn.category || '',
          tags: editingColumn.tags || [],
          articleType,
          sourceText: editingColumn.ai_instructions || '',
          sourceFacts: currentReview.sourceFacts,
          ruleBasedReview: currentReview,
          repairIteration: currentIteration + 1,
        },
      });

      if (error) throw new Error(`サーバー通信エラー: ${error.message}`);
      if (data?.error) throw new Error(data.error);

      const articleData = data?.articleData;
      if (!articleData) throw new Error('修正済み記事データが返ってきませんでした。');

      const nextQualityReview = buildQualityReviewForGeneratedArticle(
        data,
        articleData,
        editingColumn,
        articleType
      );

      setEditingColumn((prev) => ({
        ...prev,
        ...buildGeneratedColumnDraft(articleData, prev),
        thumbnail_url: prev.thumbnail_url,
        quality_review: {
          ...nextQualityReview,
          repairIterations: currentIteration + 1,
        },
      }));

      alert(`修正生成が完了しました。\n\n${formatQualityReviewForAlert(nextQualityReview)}`);
    } catch (err) {
      alert(`修正生成エラー: ${err.message}`);
    } finally {
      setIsRepairingArticle(false);
    }
  };

  const handleStartAutoColumn = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');

    if (
      !window.confirm(
        '公開中の未記事化データから公式ページを取得し、制度情報を構造化します。ファクト充足率80点以上の候補だけ、初稿、本文補強、品質レビュー、画像生成へ進みます。\n候補確認と各生成段階で外部API料金が発生します。80点未満の記事は画像生成・DB保存しません。\n生成後は必ず人間が公式情報・断定表現・独自性を確認してください。\nよろしいですか？（約4〜10分かかります）'
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    addLog('AI下書き作成を開始しました。公開前確認を前提にデータ収集します...', 'info');

    try {
      const { data: existingCols, error: existingError } = await supabase
        .from('columns')
        .select('subsidy_id');

      if (existingError) throw new Error(`既存コラム取得エラー: ${existingError.message}`);

      const existingIds = new Set((existingCols || []).map((c) => c.subsidy_id).filter(Boolean));

      const { data: rawSubsidies, error: dbError } = await supabase
        .from('subsidies')
        .select('*')
        .eq('crawl_status', 'published')
        .eq('is_active', true)
        .order('fetched_at', { ascending: false })
        .limit(100);

      if (dbError || !rawSubsidies) throw new Error('公開中の補助金データが見つかりません。');

      const subsidies = rawSubsidies
        .filter((s) => !existingIds.has(s.id))
        .filter((s) => getCandidateOfficialUrl(s))
        .sort((left, right) => scoreSubsidyForColumn(right) - scoreSubsidyForColumn(left))
        .slice(0, 10);

      if (subsidies.length === 0) {
        throw new Error('新しくコラム化できる補助金がありません（すべて記事化済みです）。');
      }

      addLog(`公式URLを持つ未記事化候補 ${subsidies.length} 件から、ファクトが揃う制度を確認します...`, 'info');

      let preparedCandidate = null;
      const preflightCandidates = subsidies.slice(0, 6);
      for (const [index, subsidy] of preflightCandidates.entries()) {
        const sourceUrl = getCandidateOfficialUrl(subsidy);
        addLog(`公式確認 ${index + 1}/${preflightCandidates.length}: 「${subsidy.title || '名称未設定'}」`, 'info');

        try {
          const { data: sourceData, error: sourceError } = await supabase.functions.invoke('fetch-page-text', {
            body: {
              sourceUrl,
              fallbackUrl: subsidy.source_url || '',
              title: subsidy.title || '',
              organization: subsidy.organization || '愛媛県',
            },
          });
          if (sourceError) throw new Error(sourceError.message);
          if (sourceData?.error) throw new Error(sourceData.error);

          const officialText = String(sourceData?.sourceText || '').trim();
          const resolvedUrl = String(sourceData?.resolvedUrl || sourceUrl).trim();
          if (officialText.length < 300) throw new Error('公式本文が300文字未満です。');

          const { data: extractedData, error: extractError } = await supabase.functions.invoke('extract-subsidy', {
            body: {
              extractedText: officialText,
              resolvedUrl,
              editFormTitle: subsidy.title || '',
              org: subsidy.organization || '愛媛県',
              summary: subsidy.summary || '',
            },
          });
          if (extractError) throw new Error(extractError.message);
          if (extractedData?.error) throw new Error(extractedData.error);

          const sourceFacts = buildExtractedCandidateFacts({
            subsidy,
            extractedFacts: extractedData?.facts || {},
            officialText,
            resolvedUrl,
          });
          const readiness = getColumnFactReadiness(sourceFacts, {
            title: subsidy.title || '',
            content: officialText,
          });

          addLog(
            `ファクト充足率 ${readiness.score}/100・${readiness.programKindLabel}` +
              (readiness.missingFacts.length ? ` / 不足: ${readiness.missingFacts.join('、')}` : ''),
            readiness.ready ? 'success' : 'warning'
          );

          if (readiness.ready) {
            preparedCandidate = {
              subsidy,
              officialText,
              resolvedUrl,
              sourceFacts: readiness.sourceFacts,
              readiness,
            };
            break;
          }

          addLog('この記事候補は材料不足のためスキップします。', 'warning');
        } catch (candidateError) {
          addLog(`候補をスキップしました: ${candidateError.message}`, 'warning');
        }
      }

      if (!preparedCandidate) {
        throw new Error('公式ファクト充足率80点以上の記事候補が見つかりませんでした。記事生成と画像生成は実行していません。');
      }

      const { subsidy: selectedSubsidy, officialText, sourceFacts, readiness } = preparedCandidate;
      addLog(
        `✅ 記事化候補を確定: 「${sourceFacts.officialName || selectedSubsidy.title}」` +
          `（${readiness.programKindLabel}・ファクト充足率 ${readiness.score}/100）`,
        'success'
      );
      addLog('第1段階: 構造化済み公式ファクトから根拠付き初稿を作成しています...', 'info');

      const { data, error } = await supabase.functions.invoke('auto-column', {
        body: {
          title: sourceFacts.officialName || selectedSubsidy.title || '',
          requestedTitle: sourceFacts.officialName || selectedSubsidy.title || '',
          sourceText: officialText,
          sourceFacts,
          articleType: 'single_program',
          category: '補助金情報',
          subsidy_id: String(selectedSubsidy.id || ''),
          deferEnhancements: true,
        },
      });

      if (error) throw new Error(`サーバー通信エラー: ${error.message}`);
      if (data?.error) throw new Error(data.error);

      let articleData = data?.articleData;
      if (!articleData) {
        throw new Error('Edge Functionから記事データが返ってきませんでした。');
      }

      let articleQualityReview = buildQualityReviewForGeneratedArticle(data, articleData, {}, 'single_program');
      const initialTextLength = stripHtmlToText(articleData.content || '').length;
      addLog(
        `✅ 第1段階完了: ${initialTextLength}文字 / ルール品質 ${articleQualityReview.ruleBasedScore || 0}/100`,
        'success'
      );

      addLog('第2段階: 公式ファクトを固定したまま、4,000文字以上へ本文を補強しています...', 'info');
      try {
        const { data: repairData, error: repairError } = await supabase.functions.invoke('auto-column', {
          body: {
            repairArticleOnly: true,
            confirmUsePaidApi: true,
            originalTitle: articleData.title || '',
            originalBody: articleData.content || '',
            seo_title: articleData.seo_title || '',
            meta_description: articleData.meta_description || '',
            category: articleData.category || '',
            tags: articleData.tags || [],
            articleType: 'single_program',
            sourceText: officialText,
            sourceFacts: articleQualityReview.sourceFacts,
            ruleBasedReview: articleQualityReview,
            subsidy_id: articleData.subsidy_id || '',
            repairIteration: 1,
          },
        });

        if (repairError) throw new Error(`サーバー通信エラー: ${repairError.message}`);
        if (repairData?.error) throw new Error(repairData.error);
        if (!repairData?.articleData) throw new Error('補強済み記事データが返ってきませんでした。');

        const repairedArticle = repairData.articleData;
        const repairedReview = buildQualityReviewForGeneratedArticle(
          repairData,
          repairedArticle,
          {},
          'single_program'
        );
        const repairedTextLength = stripHtmlToText(repairedArticle.content || '').length;
        const isGroundedRepair =
          (repairedReview.unsupportedClaims || []).length === 0 &&
          (repairedReview.contradictoryClaims || []).length === 0;
        const improvesQuality = repairedReview.qualityScore > articleQualityReview.qualityScore;

        if (isGroundedRepair && improvesQuality) {
          articleData = repairedArticle;
          articleQualityReview = repairedReview;
          addLog(
            `✅ 第2段階完了: ${initialTextLength}文字 → ${repairedTextLength}文字、` +
              `品質 ${data?.articleQualityReview?.qualityScore || 0}点 → ${repairedReview.qualityScore}点`,
            'success'
          );
        } else {
          const reasons = [
            !isGroundedRepair ? '根拠不明または矛盾する主張が残った' : '',
            !improvesQuality ? 'ルール品質スコアが初稿を上回らなかった' : '',
          ].filter(Boolean);
          addLog(`⚠️ 第2段階の補強案は不採用です。${reasons.join(' / ')}`, 'warning');
        }
      } catch (repairError) {
        addLog(`⚠️ 本文補強を完了できませんでした。初稿を保存対象として続行します。${repairError.message}`, 'warning');
      }

      if (articleQualityReview.ruleBasedScore >= 80 && hasUsableOfficialSource(articleQualityReview.sourceFacts)) {
        addLog('第3段階: API品質レビューで検索意図・タイトル整合性・事実リスクを確認しています...', 'info');
        try {
          const { data: reviewData, error: reviewError } = await supabase.functions.invoke('auto-column', {
            body: {
              qualityReviewOnly: true,
              useLlmReview: true,
              confirmUsePaidApi: true,
              title: articleData.title || '',
              seo_title: articleData.seo_title || '',
              content: articleData.content || '',
              category: articleData.category || '',
              articleType: 'single_program',
              sourceText: officialText,
              sourceFacts: articleQualityReview.sourceFacts,
              ruleBasedReview: articleQualityReview,
            },
          });

          if (reviewError) throw new Error(`サーバー通信エラー: ${reviewError.message}`);
          if (reviewData?.error && !reviewData?.articleQualityReview) throw new Error(reviewData.error);

          if (reviewData?.usedApi && reviewData?.articleQualityReview) {
            articleQualityReview = buildQualityReviewForGeneratedArticle(
              reviewData,
              articleData,
              {},
              'single_program'
            );
            addLog(
              `✅ 第3段階完了: 意味評価 ${articleQualityReview.llmReview?.semanticScore || 0}/100、` +
                `最終品質 ${articleQualityReview.qualityScore}/100`,
              'success'
            );
          } else {
            addLog(`⚠️ API品質レビューは未実行です。${reviewData?.error || ''}`, 'warning');
          }
        } catch (reviewError) {
          addLog(`⚠️ API品質レビューを完了できませんでした。ルール採点で続行します。${reviewError.message}`, 'warning');
        }
      } else {
        addLog(
          `⚠️ 第3段階は見送りました。ルール品質 ${articleQualityReview.ruleBasedScore || 0}/100、` +
            `公式根拠 ${hasUsableOfficialSource(articleQualityReview.sourceFacts) ? 'あり' : '不足'}。`,
          'warning'
        );
      }

      if (articleQualityReview.llmReview?.usedApi) {
        addLog(
          `✅ API品質レビュー実行済み: 意味評価 ${articleQualityReview.llmReview.semanticScore || 0}/100`,
          'success'
        );
      } else if (articleQualityReview.ruleBasedScore >= 80) {
        addLog('⚠️ API品質レビューは未実行です。管理画面から手動実行できます。', 'warning');
      }

      addLog(`✨ 執筆完了！タイトル: 「${articleData.title}」`, 'success');
      addLog(
        `品質レビュー: ${articleQualityReview.qualityScore}/100（${articleQualityReview.grade}）` +
          (articleQualityReview.shouldRegenerate ? ' / 再生成推奨' : ' / 人間確認前提の下書き'),
        articleQualityReview.fatalIssues.length ? 'error' : articleQualityReview.shouldRegenerate ? 'warning' : 'success'
      );
      if (articleQualityReview.fatalIssues.length > 0) {
        addLog(`致命的NG: ${articleQualityReview.fatalIssues.join(' / ')}`, 'error');
      }
      if (articleQualityReview.warnings.length > 0) {
        addLog(`警告: ${articleQualityReview.warnings.join(' / ')}`, 'warning');
      }

      const isQualifiedDraft =
        articleQualityReview.qualityScore >= 80 &&
        articleQualityReview.fatalIssues.length === 0 &&
        (articleQualityReview.unsupportedClaims || []).length === 0 &&
        (articleQualityReview.contradictoryClaims || []).length === 0;

      if (!isQualifiedDraft) {
        addLog(
          '❌ 品質80点未満または致命的NGが残っているため、画像生成とコラムDBへの保存を中止しました。' +
            ' 公式ファクトが揃う別候補で再実行してください。',
          'error'
        );
        return;
      }

      let finalThumbnailUrl = '';

      addLog('第4段階: アイキャッチ画像を生成しています...', 'info');
      try {
        const { data: imageData, error: imageInvokeError } = await supabase.functions.invoke('auto-column', {
          body: {
            ...buildImageOnlyBody(articleData),
            articleType: 'single_program',
          },
        });

        if (imageInvokeError) throw new Error(`サーバー通信エラー: ${imageInvokeError.message}`);
        if (imageData?.error) throw new Error(imageData.error);

        const base64Image = getGeneratedBase64Image(imageData);
        const imageErrorMessage = getImageErrorMessage(imageData);
        if (!base64Image) throw new Error(imageErrorMessage || '画像データが返ってきませんでした。');

        finalThumbnailUrl = await uploadGeneratedImage(base64Image, 'column');
        addLog('✅ 第4段階完了: 画像を保存しました。', 'success');
      } catch (imageError) {
        addLog(`⚠️ 画像生成を完了できませんでした。記事のみ保存します。${imageError.message}`, 'warning');
      }

      addLog('💾 記事と画像をシステムに登録しています...', 'info');

      const { error: insertError } = await supabase.from('columns').insert([
        {
          subsidy_id: articleData.subsidy_id || null,
          slug: articleData.slug,
          title: articleData.title,
          seo_title: articleData.seo_title,
          meta_description: articleData.meta_description,
          thumbnail_text: articleData.thumbnail_text,
          thumbnail_url: finalThumbnailUrl,
          content: articleData.content,
          category: articleData.category,
          tags: articleData.tags || [],
          is_published: false,
          quality_review: articleQualityReview,
        },
      ]);

      if (insertError) throw new Error(`DB保存エラー: ${insertError.message}`);

      addLog('🎉 全ての処理が完了しました！下書きとして保存されています。', 'success');
      await fetchColumns();
    } catch (err) {
      addLog(`❌ エラー: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteColumn = async (id, title, thumbnailUrl) => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');
    if (!window.confirm(`コラム「${title}」を削除してもよろしいですか？`)) return;

    try {
      if (thumbnailUrl) {
        const fileName = thumbnailUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('column-images').remove([fileName]);
        }
      }

      await supabase.from('columns').delete().eq('id', id);
      await fetchColumns();
    } catch (err) {
      alert('削除エラー: ' + err.message);
    }
  };

  const handleUpdateColumn = async (e) => {
    e.preventDefault();

    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');

    const qualityReview = reviewColumnQuality(editingColumn, {
      articleType: editingColumn.category === FEATURE_CATEGORY ? 'feature' : 'column',
      sourceFacts: buildSourceFactsForColumn(editingColumn),
      sourceText: editingColumn.ai_instructions || '',
      humanReviewed: getColumnHumanReviewed(editingColumn),
    });

    const hardBlockReasons = [
      ...(qualityReview.fatalIssues || []),
      ...(qualityReview.unsupportedClaims || []).map((claim) => `根拠不明の主張: ${claim}`),
      ...(qualityReview.contradictoryClaims || []).map((claim) => `公式情報と矛盾する可能性: ${claim}`),
      ...(qualityReview.titleNeedsRewrite ? ['タイトル変更推奨が出ています。安全なタイトル案に修正してください。'] : []),
      ...(qualityReview.missingFacts?.length > 0
        ? [`公式ファクト不足: ${qualityReview.missingFacts.join('、')}`]
        : []),
      ...(qualityReview.qualityScore < 90
        ? [`最終品質スコアが90点未満です（${qualityReview.qualityScore}/100）。`]
        : []),
      ...(qualityReview.publishAllowed ? [] : ['公開可能判定ではありません。']),
    ];

    if (editingColumn.is_published && hardBlockReasons.length > 0) {
      alert(
        `公開不可の品質問題があるため、このまま公開状態では保存できません。\n\n` +
          hardBlockReasons.map((issue) => `・${issue}`).join('\n') +
          `\n\n下書きに戻すか、本文を修正してから保存してください。`
      );
      return;
    }

    const strongWarnings = [
      ...(qualityReview.warnings || []),
      ...(qualityReview.missingFacts || []).map((field) => `公式ファクト不足: ${field}`),
      ...(qualityReview.llmReview?.usedApi ? [] : ['API品質レビューが未実行です。']),
      ...(qualityReview.publishAllowed ? [] : ['公開可能判定ではありません。']),
    ];

    if (editingColumn.is_published && (strongWarnings.length > 0 || qualityReview.qualityScore < 90)) {
      const shouldContinue = window.confirm(
        `公開前品質チェックで確認したい項目があります。\n\n` +
          `品質スコア: ${qualityReview.qualityScore}/100（${qualityReview.grade}）\n\n` +
          strongWarnings.map((warning) => `・${warning}`).join('\n') +
          `\n\nこのまま公開状態で保存しますか？\n不安な場合は「キャンセル」して、下書きに戻してから公式リンク・注意点・独自整理を追加してください。`
      );

      if (!shouldContinue) return;
    }

    setIsSaving(true);

    try {
      const payload = {
        title: editingColumn.title,
        slug: editingColumn.slug,
        category: editingColumn.category,
        seo_title: editingColumn.seo_title,
        meta_description: editingColumn.meta_description,
        content: editingColumn.content,
        is_published: editingColumn.is_published,
        thumbnail_url: editingColumn.thumbnail_url,
        thumbnail_text: editingColumn.thumbnail_text || '',
        tags: editingColumn.tags || [],
        quality_review: qualityReview,
      };

      if (editingColumn.id) {
        const { error } = await supabase.from('columns').update(payload).eq('id', editingColumn.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('columns').insert([payload]);
        if (error) throw error;
      }

      alert('コラムを保存しました！');
      setEditingColumn(null);
      await fetchColumns();
    } catch (err) {
      alert('保存エラー: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    window.location.href = '/';
  };

  const createColumnDraft = (overrides = {}) => ({
    title: '',
    slug: `guide-${Date.now()}`,
    category: '基礎知識',
    seo_title: '',
    meta_description: '',
    content: '',
    thumbnail_url: '',
    thumbnail_text: '',
    tags: [],
    is_published: false,
    ai_instructions: '',
    official_source_url: '',
    ...overrides,
  });

  const isFeatureMode = initialMode === 'features';
  const visibleColumns = columns.filter((col) =>
    isFeatureMode ? col.category === FEATURE_CATEGORY : col.category !== FEATURE_CATEGORY
  );
  const missingImageCount = visibleColumns.filter((col) => !col.thumbnail_url).length;
  const editingQualityReview = editingColumn
    ? mergeColumnQualityReview(editingColumn.quality_review, editingColumn, {
        articleType: editingColumn.category === FEATURE_CATEGORY ? 'feature' : 'column',
        sourceFacts: buildSourceFactsForColumn(editingColumn),
        sourceText: editingColumn.ai_instructions || '',
        humanReviewed: getColumnHumanReviewed(editingColumn),
      })
    : null;
  const editingSourceFacts = editingColumn ? buildSourceFactsForColumn(editingColumn) : null;
  const editingHasOfficialSource = hasUsableOfficialSource(editingSourceFacts);
  const canRunLlmReview = Boolean(
    editingQualityReview &&
      editingQualityReview.ruleBasedScore >= 80 &&
      editingHasOfficialSource
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#111827', color: 'white', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', height: '100%' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>⚙️ 管理ダッシュボード</h1>

          <nav style={{ display: 'flex', height: '100%' }}>
            <a href="/admin" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              📊 補助金データ更新
            </a>
            <a href="/admin?tab=experts" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              🤝 専門家管理
            </a>
            <a href="/admin?tab=columns" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: isFeatureMode ? '#9ca3af' : 'white', textDecoration: 'none', fontSize: '15px', fontWeight: isFeatureMode ? '500' : 'bold', borderBottom: isFeatureMode ? '3px solid transparent' : '3px solid #10b981', backgroundColor: isFeatureMode ? 'transparent' : '#1f2937' }}>
              📝 コラム管理
            </a>
            <a href="/admin?tab=features" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: isFeatureMode ? 'white' : '#9ca3af', textDecoration: 'none', fontSize: '15px', fontWeight: isFeatureMode ? 'bold' : '500', borderBottom: isFeatureMode ? '3px solid #f59e0b' : '3px solid transparent', backgroundColor: isFeatureMode ? '#1f2937' : 'transparent' }}>
              ⭐ 特集記事制作
            </a>
            <a href="/admin?tab=expert-articles" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              💬 専門家記事
            </a>
            <a href="/admin?tab=crawler" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              🛠 クローラー管理
            </a>
          </nav>
        </div>

        <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
          ログアウト
        </button>
      </header>

      <div style={{ maxWidth: '1000px', margin: '32px auto', padding: '0 24px' }}>
        {editingColumn ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                {editingColumn.category === FEATURE_CATEGORY
                  ? '⭐ 特集記事の編集・作成'
                  : '📝 コラムの編集・作成'}
              </h2>

              <button onClick={() => setEditingColumn(null)} style={{ backgroundColor: '#f3f4f6', color: '#4b5563', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                ← 一覧へ戻る
              </button>
            </div>

            <form onSubmit={handleUpdateColumn} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                  <div style={{ width: '120px', height: '80px', borderRadius: '8px', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {editingColumn.thumbnail_url ? (
                      <img src={editingColumn.thumbnail_url} alt="サムネイル" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>No Image</span>
                    )}
                  </div>

                  {editingColumn.id && (
                    <button
                      type="button"
                      onClick={() => handleRegenerateColumnImage(editingColumn)}
                      disabled={regeneratingImageId === editingColumn.id}
                      style={{ backgroundColor: regeneratingImageId === editingColumn.id ? '#9ca3af' : '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontWeight: 'bold', cursor: regeneratingImageId === editingColumn.id ? 'not-allowed' : 'pointer' }}
                    >
                      {regeneratingImageId === editingColumn.id
                        ? '生成中...'
                        : editingColumn.thumbnail_url
                          ? '画像だけ再生成'
                          : '画像を生成'}
                    </button>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    公開ステータス
                  </label>

                  <select
                    value={editingColumn.is_published ? 'true' : 'false'}
                    onChange={(e) => setEditingColumn({ ...editingColumn, is_published: e.target.value === 'true' })}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 'bold', color: editingColumn.is_published ? '#059669' : '#4b5563', backgroundColor: editingColumn.is_published ? '#d1fae5' : 'white' }}
                  >
                    <option value="false">📝 下書き（非公開）</option>
                    <option value="true">✅ 公開する</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    タイトル（テーマ）
                  </label>

                  <input
                    type="text"
                    required
                    placeholder="例：「補助率」と「補助上限額」とは？"
                    value={editingColumn.title || ''}
                    onChange={(e) => setEditingColumn({ ...editingColumn, title: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '15px' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateFromTitle}
                  disabled={isGeneratingTitle || !editingHasOfficialSource}
                  title={editingHasOfficialSource ? '' : '先に公式情報を取得・入力してください。'}
                  style={{ backgroundColor: isGeneratingTitle || !editingHasOfficialSource ? '#9ca3af' : editingColumn.category === FEATURE_CATEGORY ? '#f59e0b' : '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: isGeneratingTitle || !editingHasOfficialSource ? 'not-allowed' : 'pointer', border: 'none', fontSize: '14px', whiteSpace: 'nowrap', transition: 'background-color 0.2s' }}
                >
                  {isGeneratingTitle
                    ? 'AI下書き・画像生成中...'
                    : editingColumn.category === FEATURE_CATEGORY
                      ? '特集のAI下書きを作成'
                      : 'タイトルからAI下書きを作成'}
                </button>
              </div>

              <div style={{ backgroundColor: editingColumn.category === FEATURE_CATEGORY ? '#fffbeb' : '#f8fafc', border: editingColumn.category === FEATURE_CATEGORY ? '1px solid #fde68a' : '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold' }}>
                  公式ページURL（AI下書き作成前に必須）
                </label>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="url"
                    placeholder="https://www.pref.ehime.jp/..."
                    value={editingColumn.official_source_url || ''}
                    onChange={(e) =>
                      setEditingColumn((prev) => ({
                        ...prev,
                        official_source_url: e.target.value,
                      }))
                    }
                    style={{ flex: '1 1 520px', minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }}
                  />
                  <button
                    type="button"
                    onClick={handleFetchOfficialSource}
                    disabled={isFetchingOfficialSource}
                    style={{ backgroundColor: isFetchingOfficialSource ? '#9ca3af' : '#0f766e', color: 'white', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: isFetchingOfficialSource ? 'not-allowed' : 'pointer', border: 'none', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    {isFetchingOfficialSource ? '公式情報を取得中...' : '公式情報を取得・構造化'}
                  </button>
                </div>

                <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '6px', backgroundColor: editingHasOfficialSource ? '#ecfdf5' : '#fff7ed', border: `1px solid ${editingHasOfficialSource ? '#a7f3d0' : '#fed7aa'}`, color: editingHasOfficialSource ? '#047857' : '#9a3412', fontSize: '12px', lineHeight: 1.6 }}>
                  {editingHasOfficialSource
                    ? `公式根拠を確認済みです。${editingColumn.official_source_fetch?.textLength ? ` 取得本文: ${editingColumn.official_source_fetch.textLength.toLocaleString()}文字` : ''}`
                    : '公式URLだけでは生成できません。公式ページ本文または根拠メモまで取得・入力してください。'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                  {[
                    ['制度名', editingSourceFacts?.officialName],
                    ['実施機関', editingSourceFacts?.administeringBody],
                    ['補助率', editingSourceFacts?.subsidyRate],
                    ['上限額', editingSourceFacts?.subsidyCap],
                    ['締切', editingSourceFacts?.applicationDeadline],
                    ['公式資料', editingSourceFacts?.officialSources?.[0]?.label],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'white', border: '1px solid #e2e8f0', color: '#334155', fontSize: '12px', lineHeight: 1.5, minWidth: 0, overflowWrap: 'break-word' }}>
                      <strong style={{ display: 'block', color: '#64748b', marginBottom: '2px' }}>{label}</strong>
                      {value || '未確認'}
                    </div>
                  ))}
                </div>

                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold' }}>
                  AI下書きに入れる公式情報・確認メモ（必須）
                </label>

                <textarea
                  rows="4"
                  placeholder={
                    editingColumn.category === FEATURE_CATEGORY
                      ? '例：公式ページURL、対象読者、愛媛県内での確認ポイント、申請前の注意点、入れたい独自見解を貼ってください。'
                      : '例：公式ページURL、確認日、対象者、注意点、読者が迷いやすい判断ポイントを貼ってください。'
                  }
                  value={editingColumn.ai_instructions || ''}
                  onChange={(e) =>
                    setEditingColumn({
                      ...editingColumn,
                      ai_instructions: e.target.value,
                    })
                  }
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical', fontSize: '14px', lineHeight: '1.6', backgroundColor: 'white' }}
                />

                <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '12px', lineHeight: 1.6 }}>
                  取得した公式情報を確認し、必要に応じて現場で迷いやすい点や独自の補足を追記してください。
                </p>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${getColumnHumanReviewed(editingColumn) ? '#bbf7d0' : '#fed7aa'}`,
                  backgroundColor: getColumnHumanReviewed(editingColumn) ? '#f0fdf4' : '#fff7ed',
                  color: getColumnHumanReviewed(editingColumn) ? '#166534' : '#9a3412',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={getColumnHumanReviewed(editingColumn)}
                  onChange={(e) =>
                    setEditingColumn((prev) => ({
                      ...prev,
                      quality_review: {
                        ...(prev?.quality_review || {}),
                        humanReviewed: e.target.checked,
                        humanReviewCompleted: e.target.checked,
                      },
                    }))
                  }
                  style={{ marginTop: '3px' }}
                />
                <span>
                  人間確認済み
                  <span style={{ display: 'block', fontWeight: 500 }}>
                    公式URL・制度名・実施機関・補助率/上限額など、本文の断定表現を人間が確認した場合だけチェックしてください。
                  </span>
                </span>
              </label>

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
	                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
	                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534' }}>
	                    AI生成記事の公開前チェック
	                  </div>

	                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
	                    {editingQualityReview && (
	                      <>
	                        <div
	                          style={{
	                            padding: '6px 10px',
	                            borderRadius: '999px',
	                            backgroundColor: '#ffffff',
	                            border: '1px solid #cbd5e1',
	                            color: '#475569',
	                            fontSize: '12px',
	                            fontWeight: 'bold',
	                          }}
	                        >
	                          ルール {editingQualityReview.ruleBasedScore ?? editingQualityReview.qualityScore}/100
	                        </div>
	                        <div
	                          style={{
	                            padding: '6px 10px',
	                            borderRadius: '999px',
	                            backgroundColor: '#ffffff',
	                            border: '1px solid #cbd5e1',
	                            color: '#475569',
	                            fontSize: '12px',
	                            fontWeight: 'bold',
	                          }}
	                        >
	                          種別 {editingQualityReview.articleTypeLabel || editingQualityReview.articleType || '未判定'}
	                        </div>
	                        <div
	                          style={{
	                            padding: '6px 10px',
	                            borderRadius: '999px',
	                            backgroundColor: '#ffffff',
	                            border: '1px solid #cbd5e1',
	                            color: '#475569',
	                            fontSize: '12px',
	                            fontWeight: 'bold',
	                          }}
	                        >
	                          公式 {editingQualityReview.sourceCoverageScore ?? 0}/100
	                        </div>
	                        <div
	                          style={{
	                            padding: '6px 10px',
	                            borderRadius: '999px',
	                            backgroundColor: '#ffffff',
	                            border: '1px solid #cbd5e1',
	                            color: '#475569',
	                            fontSize: '12px',
	                            fontWeight: 'bold',
	                          }}
	                        >
	                          根拠 {editingQualityReview.factualGroundingScore ?? 0}/100
	                        </div>
	                        <div
	                          style={{
	                            padding: '6px 10px',
	                            borderRadius: '999px',
	                            backgroundColor: '#ffffff',
	                            border: `1px solid ${getQualityReviewColor(editingQualityReview)}`,
	                            color: getQualityReviewColor(editingQualityReview),
	                            fontSize: '12px',
	                            fontWeight: 'bold',
	                          }}
	                        >
	                          最終 {editingQualityReview.qualityScore}/100・{editingQualityReview.grade}
	                          {editingQualityReview.shouldRegenerate ? '・再生成推奨' : ''}
	                          {editingQualityReview.shouldHumanReview ? '・人間確認必須' : ''}
	                        </div>
	                        <div
	                          style={{
	                            padding: '6px 10px',
	                            borderRadius: '999px',
	                            backgroundColor: editingQualityReview.llmReview?.usedApi ? '#eef2ff' : '#f8fafc',
	                            border: `1px solid ${editingQualityReview.llmReview?.usedApi ? '#c7d2fe' : '#e2e8f0'}`,
	                            color: editingQualityReview.llmReview?.usedApi ? '#3730a3' : '#64748b',
	                            fontSize: '12px',
	                            fontWeight: 'bold',
	                          }}
	                        >
	                          {editingQualityReview.llmReview?.usedApi ? 'APIレビュー実行済み' : 'APIレビュー未実行'}
	                        </div>
	                        <div
	                          style={{
	                            padding: '6px 10px',
	                            borderRadius: '999px',
	                            backgroundColor: editingQualityReview.publishAllowed ? '#ecfdf5' : '#fef2f2',
	                            border: `1px solid ${editingQualityReview.publishAllowed ? '#bbf7d0' : '#fecaca'}`,
	                            color: editingQualityReview.publishAllowed ? '#047857' : '#b91c1c',
	                            fontSize: '12px',
	                            fontWeight: 'bold',
	                          }}
	                        >
	                          {editingQualityReview.publishAllowed ? '公開可能' : '公開不可/要確認'}
	                        </div>
	                      </>
	                    )}
	                    <button
	                      type="button"
	                      onClick={handleRunLlmQualityReview}
	                      disabled={isRunningQualityReview || !canRunLlmReview}
	                      title={canRunLlmReview ? '' : 'ルール80点以上かつ公式根拠確認後に実行できます。'}
	                      style={{
	                        backgroundColor: isRunningQualityReview || !canRunLlmReview ? '#e5e7eb' : '#ffffff',
	                        color: isRunningQualityReview || !canRunLlmReview ? '#6b7280' : '#3730a3',
	                        border: '1px solid #c7d2fe',
	                        borderRadius: '999px',
	                        padding: '7px 12px',
	                        fontSize: '12px',
	                        fontWeight: 'bold',
	                        cursor: isRunningQualityReview || !canRunLlmReview ? 'not-allowed' : 'pointer',
	                      }}
	                    >
	                      {isRunningQualityReview ? 'APIレビュー中...' : 'API品質レビュー'}
	                    </button>
	                    <button
	                      type="button"
	                      onClick={handleRepairArticleFromReview}
	                      disabled={isRepairingArticle}
	                      style={{
	                        backgroundColor: isRepairingArticle ? '#e5e7eb' : '#ffffff',
	                        color: isRepairingArticle ? '#6b7280' : '#0f766e',
	                        border: '1px solid #99f6e4',
	                        borderRadius: '999px',
	                        padding: '7px 12px',
	                        fontSize: '12px',
	                        fontWeight: 'bold',
	                        cursor: isRepairingArticle ? 'not-allowed' : 'pointer',
	                      }}
	                    >
	                      {isRepairingArticle ? '修正生成中...' : '指摘を反映して修正生成'}
	                    </button>
	                  </div>
	                </div>
	                <ul style={{ margin: 0, paddingLeft: '20px', color: '#365c45', fontSize: '12px', lineHeight: 1.7 }}>
	                  {PUBLISH_QUALITY_CHECKS.map((check) => (
	                    <li key={check}>{check}</li>
	                  ))}
	                </ul>
	                {editingQualityReview?.llmReview && (
	                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontSize: '12px', lineHeight: 1.7 }}>
	                    <strong>LLM品質レビュー:</strong>
	                    <div style={{ marginTop: '6px' }}>
	                      状態: {editingQualityReview.llmReview.usedApi ? 'APIレビュー実行済み' : 'APIレビュー未実行'} / 意味評価: {editingQualityReview.llmReview.semanticScore || 0}/100
	                    </div>
	                    <div>タイトル整合性: {editingQualityReview.llmReview.titleBodyAlignment}</div>
	                    <div>事実リスク: {editingQualityReview.llmReview.factualRisk}</div>
	                    <div>検索意図: {editingQualityReview.llmReview.searchIntentFit}</div>
	                    {editingQualityReview.llmReview.reviewerComments?.length > 0 && (
	                      <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
	                        {editingQualityReview.llmReview.reviewerComments.map((comment) => (
	                          <li key={comment}>{comment}</li>
	                        ))}
	                      </ul>
	                    )}
	                  </div>
	                )}
	                {(editingQualityReview?.missingFacts?.length > 0 || editingQualityReview?.titleNeedsRewrite) && (
	                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '12px', lineHeight: 1.7 }}>
	                    <strong>公式ファクト・タイトル安全化:</strong>
	                    {editingQualityReview?.missingFacts?.length > 0 && (
	                      <div style={{ marginTop: '6px' }}>
	                        不足: {editingQualityReview.missingFacts.join('、')}
	                      </div>
	                    )}
	                    {editingQualityReview?.titleNeedsRewrite && (
	                      <div style={{ marginTop: '6px' }}>
	                        タイトル変更推奨: はい
	                        {editingQualityReview.suggestedTitles?.length > 0 && (
	                          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
	                            {editingQualityReview.suggestedTitles.slice(0, 3).map((titleOption) => (
	                              <li key={titleOption}>{titleOption}</li>
	                            ))}
	                          </ul>
	                        )}
	                      </div>
	                    )}
	                  </div>
	                )}
	                {(editingQualityReview?.unsupportedClaims?.length > 0 || editingQualityReview?.contradictoryClaims?.length > 0) && (
	                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12px', lineHeight: 1.7 }}>
	                    <strong>事実主張の照合結果:</strong>
	                    {editingQualityReview.unsupportedClaims?.length > 0 && (
	                      <>
	                        <div style={{ marginTop: '6px', fontWeight: 'bold' }}>unsupported</div>
	                        <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
	                          {editingQualityReview.unsupportedClaims.map((claim) => (
	                            <li key={claim}>{claim}</li>
	                          ))}
	                        </ul>
	                      </>
	                    )}
	                    {editingQualityReview.contradictoryClaims?.length > 0 && (
	                      <>
	                        <div style={{ marginTop: '6px', fontWeight: 'bold' }}>contradictory</div>
	                        <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
	                          {editingQualityReview.contradictoryClaims.map((claim) => (
	                            <li key={claim}>{claim}</li>
	                          ))}
	                        </ul>
	                      </>
	                    )}
	                  </div>
	                )}
	                {editingQualityReview?.scoreCapsApplied?.length > 0 && (
	                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#fefce8', border: '1px solid #fde68a', color: '#854d0e', fontSize: '12px', lineHeight: 1.7 }}>
	                    <strong>スコア上限:</strong>
	                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
	                      {editingQualityReview.scoreCapsApplied.map((cap) => (
	                        <li key={cap}>{cap}</li>
	                      ))}
	                    </ul>
	                  </div>
	                )}
	                {editingQualityReview?.fatalIssues?.length > 0 && (
	                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12px', lineHeight: 1.7 }}>
	                    <strong>致命的NG（公開前に修正してください）:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                      {editingQualityReview.fatalIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {editingQualityReview?.warnings?.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '12px', lineHeight: 1.7 }}>
                    <strong>警告・確認ポイント:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                      {editingQualityReview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {editingQualityReview?.improvementSuggestions?.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', fontSize: '12px', lineHeight: 1.7 }}>
                    <strong>改善提案:</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                      {editingQualityReview.improvementSuggestions.slice(0, 6).map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
	                    </ul>
	                  </div>
	                )}
	                {editingQualityReview?.strengths?.length > 0 && (
	                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '12px', lineHeight: 1.7 }}>
	                    <strong>良い点:</strong>
	                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
	                      {editingQualityReview.strengths.slice(0, 6).map((strength) => (
	                        <li key={strength}>{strength}</li>
	                      ))}
	                    </ul>
	                  </div>
	                )}
	              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    URLスラッグ（英数字ハイフン）
                  </label>

                  <input
                    type="text"
                    required
                    value={editingColumn.slug || ''}
                    onChange={(e) => setEditingColumn({ ...editingColumn, slug: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    カテゴリ
                  </label>

                  <input
                    type="text"
                    value={editingColumn.category || ''}
                    onChange={(e) => setEditingColumn({ ...editingColumn, category: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                  SEOタイトル (検索結果用)
                </label>

                <input
                  type="text"
                  value={editingColumn.seo_title || ''}
                  onChange={(e) => setEditingColumn({ ...editingColumn, seo_title: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                  メタディスクリプション (検索結果の説明文)
                </label>

                <textarea
                  rows="2"
                  value={editingColumn.meta_description || ''}
                  onChange={(e) => setEditingColumn({ ...editingColumn, meta_description: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                  記事本文 (HTMLタグ使用可)
                </label>

                <textarea
                  rows="15"
                  required
                  value={editingColumn.content || ''}
                  onChange={(e) => setEditingColumn({ ...editingColumn, content: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.6' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setEditingColumn(null)} style={{ padding: '12px 24px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>
                  キャンセル
                </button>

                <button type="submit" disabled={isSaving} style={{ padding: '12px 32px', backgroundColor: '#10b981', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', color: 'white', fontSize: '16px' }}>
                  {isSaving ? '保存中...' : '💾 内容を保存して更新'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '32px', borderTop: isFeatureMode ? '6px solid #f59e0b' : '6px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isFeatureMode ? '特集記事制作' : 'AI下書きコラム生成'}
                  </h2>

                  <p style={{ margin: 0, color: '#4b5563', fontSize: '14px' }}>
                    {isFeatureMode
                      ? 'トップページの「人気の特集から探す」に表示する記事を作成します。公式情報と独自の整理を入れてから公開してください。'
                      : '公開中の補助金データからAIが下書きを作成します。公開前に公式情報・独自性・断定表現を確認してください。'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleBackfillMissingImages}
                    disabled={isBackfillingImages || missingImageCount === 0}
                    style={{ backgroundColor: isBackfillingImages || missingImageCount === 0 ? '#e5e7eb' : '#f5f3ff', color: isBackfillingImages || missingImageCount === 0 ? '#6b7280' : '#6d28d9', padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: isBackfillingImages || missingImageCount === 0 ? 'not-allowed' : 'pointer', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', whiteSpace: 'nowrap' }}
                  >
                    {isBackfillingImages
                      ? '🖼 画像生成中...'
                      : `🖼 No Imageを一括生成 (${missingImageCount})`}
                  </button>

                  <button
                    onClick={() =>
                      setEditingColumn(
                        createColumnDraft(
                          isFeatureMode
                            ? {
                                slug: `feature-${Date.now()}`,
                                category: FEATURE_CATEGORY,
                              }
                            : undefined
                        )
                      )
                    }
                    style={{ backgroundColor: isFeatureMode ? '#fef3c7' : 'white', color: isFeatureMode ? '#92400e' : '#4b5563', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: isFeatureMode ? '1px solid #fde68a' : '1px solid #d1d5db', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', whiteSpace: 'nowrap' }}
                  >
                    {isFeatureMode ? '⭐ 特集記事を新規作成' : '✍️ 手動で新規作成'}
                  </button>

                  {!isFeatureMode && (
                    <button onClick={handleStartAutoColumn} disabled={isProcessing} style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', boxShadow: isProcessing ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.3)', whiteSpace: 'nowrap' }}>
                      {isProcessing ? '下書き＆画像生成中...' : 'AIでおすすめ記事の下書きを作成'}
                    </button>
                  )}
                </div>
              </div>

              {isFeatureMode ? (
                <div style={{ backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: 1.7 }}>
                  特集記事はカテゴリが「特集」の公開記事だけがトップページに表示されます。AI下書きを使う場合も、公式URL・確認日・対象読者・申請前の注意点を素材欄に入れてから作成してください。
                </div>
              ) : (
                <div style={{ backgroundColor: '#111827', borderRadius: '8px', padding: '16px', overflowY: 'auto', height: '180px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid #374151' }}>
                  {logs.length === 0 ? (
                    <div style={{ color: '#6b7280', textAlign: 'center', marginTop: '60px' }}>
                      ボタンを押すと、AI下書き作成の作業ログがここに表示されます
                    </div>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} style={{ color: getLogColor(log.type), marginBottom: '8px', lineHeight: '1.4' }}>
                        <span style={{ color: '#6b7280', marginRight: '8px' }}>[{log.time}]</span>
                        {log.msg}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
                )}
            </div>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#334155' }}>
              {isFeatureMode
                ? `⭐ 作成済みの特集記事 (${visibleColumns.length}件)`
                : `📝 作成済みのコラム (${visibleColumns.length}件)`}
            </h3>

            {visibleColumns.length === 0 ? (
              <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>
                {isFeatureMode
                  ? 'まだ作成された特集記事はありません。'
                  : 'まだ作成されたコラムはありません。'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {visibleColumns.map((col) => (
                  <div key={col.id} style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: 'white' }}>
                    <div style={{ width: '120px', height: '80px', borderRadius: '8px', backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                      {col.thumbnail_url ? (
                        <img src={col.thumbnail_url} alt="サムネイル" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                          No Image
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ backgroundColor: col.is_published ? '#d1fae5' : '#f3f4f6', color: col.is_published ? '#059669' : '#4b5563', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {col.is_published ? '✅ 公開中' : '📝 下書き'}
                        </span>

                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {col.category || 'カテゴリ未設定'}
                        </span>
                      </div>

                      <strong style={{ fontSize: '16px', color: '#111827', display: 'block', marginBottom: '4px' }}>
                        {col.title}
                      </strong>

                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        URL: /{col.slug}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleRegenerateColumnImage(col)}
                        disabled={regeneratingImageId === col.id}
                        style={{ backgroundColor: regeneratingImageId === col.id ? '#e5e7eb' : '#f5f3ff', color: regeneratingImageId === col.id ? '#6b7280' : '#6d28d9', border: '1px solid #c4b5fd', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: regeneratingImageId === col.id ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                      >
                        {regeneratingImageId === col.id
                          ? '生成中...'
                          : col.thumbnail_url
                            ? '画像を再生成'
                            : '画像を生成'}
                      </button>

                      <button onClick={() => setEditingColumn(col)} style={{ backgroundColor: 'white', color: '#3b82f6', border: '1px solid #3b82f6', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                        編集
                      </button>

                      <button onClick={() => handleDeleteColumn(col.id, col.title, col.thumbnail_url)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
