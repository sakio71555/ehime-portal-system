import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

const createSlug = (value: string) => {
  const base = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ぁ-んァ-ン一-龥]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || `column-${Date.now()}`;
};

const stripHtml = (value: string) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractLinks = (value: string) =>
  Array.from(String(value || "").matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter(Boolean);

const countExternalOfficialLinks = (value: string) =>
  extractLinks(value).filter((href) => /^https?:\/\//i.test(href) && !/ehime-hojokin\.jp/i.test(href)).length;

const buildArticleQualityWarnings = (articleData: { content?: string }) => {
  const content = articleData.content || "";
  const text = stripHtml(content);
  const warnings: string[] = [];

  if (text.length < 1200) {
    warnings.push("本文が短めです。一般論だけの記事に見えないか公開前に確認してください。");
  }

  if (countExternalOfficialLinks(content) === 0) {
    warnings.push("公式ページ・募集要項・自治体などへの外部リンクが見つかりません。");
  }

  if (!/(公式|募集要項|公募要領|自治体|窓口|申請前|最新情報)/.test(text)) {
    warnings.push("公式情報確認や申請前確認の案内が弱い可能性があります。");
  }

  if (/(必ず|絶対).{0,12}(採択|受給|支給|もらえ|通る|使える)|誰でも.{0,12}(もらえ|使える|受給)/.test(text)) {
    warnings.push("補助金の受給や採択を断定する表現が含まれている可能性があります。");
  }

  return warnings;
};

const toText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const imageQualityOrDefault = (value: string) => {
  const quality = value.trim();
  return ["low", "medium", "high", "auto"].includes(quality) ? quality : "medium";
};

const imageSizeOrDefault = (value: string) => {
  const size = value.trim();
  return ["1024x1024", "1536x1024", "1024x1536", "auto"].includes(size) ? size : "1536x1024";
};

const buildImagePrompt = ({
  theme,
  title,
  category,
  articleType,
  contentContext,
}: {
  theme: string;
  title: string;
  category: string;
  articleType: string;
  contentContext: string;
}) => `
Create a high-quality editorial hero image for a Japanese subsidy and grant information article.

Article:
- Title: ${title || theme}
- Category: ${category || "補助金情報"}
- Type: ${articleType || "column"}
- Theme: ${theme}
- Context: ${contentContext}

Visual direction:
- Premium Japanese web media thumbnail, calm and trustworthy
- Soft editorial illustration with a refined public-service feeling
- Local Ehime atmosphere, small business support, consultation, documents, planning, community, or public assistance
- Warm but restrained colors: ivory, deep teal, soft orange, muted blue, gentle green
- Clean 16:9 composition with clear focal point and generous whitespace
- Modern, polished, not childish, not clip-art, not a flyer, not a poster
- Suitable for a government-adjacent subsidy information portal

Strict constraints:
- No text
- No Japanese characters
- No letters, numbers, logos, watermarks, signs, screenshots, UI panels, or fake documents with readable text
- Do not create distorted currency symbols or giant yen marks
- Avoid extra fingers, distorted hands, uncanny faces, or celebrity-like people
- Avoid crowded collage layouts and over-saturated colors
`.trim();

const outputImageItem = (imageJson: Record<string, unknown>) => {
  const output = Array.isArray(imageJson?.output) ? imageJson.output : [];
  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== "object") continue;
    const content = Array.isArray((outputItem as Record<string, unknown>).content)
      ? ((outputItem as Record<string, unknown>).content as unknown[])
      : [];
    const imageItem = content.find(
      (item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "output_image"
    );
    if (imageItem && typeof imageItem === "object") {
      return imageItem as Record<string, unknown>;
    }
  }
  return null;
};

const nestedImageValue = (item: Record<string, unknown> | null, key: string) => {
  if (!item) return "";
  const image = item.image;
  if (image && typeof image === "object") {
    return toText((image as Record<string, unknown>)[key]);
  }
  return "";
};

const extractImageBase64 = (imageJson: Record<string, unknown>) => {
  const firstData = Array.isArray(imageJson?.data) && imageJson.data[0]
    ? imageJson.data[0] as Record<string, unknown>
    : null;
  const outputImage = outputImageItem(imageJson);

  return (
    toText(firstData?.b64_json) ||
    nestedImageValue(firstData, "b64_json") ||
    toText(outputImage?.b64_json) ||
    nestedImageValue(outputImage, "b64_json")
  );
};

const extractImageUrl = (imageJson: Record<string, unknown>) => {
  const firstData = Array.isArray(imageJson?.data) && imageJson.data[0]
    ? imageJson.data[0] as Record<string, unknown>
    : null;
  const outputImage = outputImageItem(imageJson);

  return (
    toText(firstData?.url) ||
    nestedImageValue(firstData, "url") ||
    toText(outputImage?.url) ||
    nestedImageValue(outputImage, "url")
  );
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const buildImageDebug = (imageJson: Record<string, unknown>, response: Response) => {
  const firstData = Array.isArray(imageJson?.data) && imageJson.data[0]
    ? imageJson.data[0] as Record<string, unknown>
    : null;
  const error = imageJson?.error && typeof imageJson.error === "object"
    ? toText((imageJson.error as Record<string, unknown>).message)
    : null;

  return {
    ok: response.ok,
    status: response.status,
    hasDataArray: Array.isArray(imageJson?.data),
    dataLength: Array.isArray(imageJson?.data) ? imageJson.data.length : 0,
    firstKeys: firstData ? Object.keys(firstData) : [],
    hasB64: Boolean(toText(firstData?.b64_json) || nestedImageValue(firstData, "b64_json")),
    b64Length: (toText(firstData?.b64_json) || nestedImageValue(firstData, "b64_json")).length,
    hasUrl: Boolean(toText(firstData?.url) || nestedImageValue(firstData, "url")),
    error,
  };
};

const generateImage = async ({
  openAiKey,
  imageModel,
  imageQuality,
  imageSize,
  imageTheme,
  imageTitle,
  imageCategory,
  articleType,
  contentContext,
}: {
  openAiKey: string;
  imageModel: string;
  imageQuality: string;
  imageSize: string;
  imageTheme: string;
  imageTitle: string;
  imageCategory: string;
  articleType: string;
  contentContext: string;
}) => {
  let base64Image = "";
  let imageError = "";
  let imageUrl = "";
  let imageDebug: Record<string, unknown> | null = null;

  try {
    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: imageModel,
        prompt: buildImagePrompt({
          theme: imageTheme,
          title: imageTitle,
          category: imageCategory,
          articleType,
          contentContext,
        }),
        n: 1,
        size: imageSize,
        quality: imageQuality,
        output_format: "png",
      }),
    });

    const imageJson = await imageRes.json();
    imageDebug = buildImageDebug(imageJson, imageRes);
    console.log("column image generation response summary", {
      ...imageDebug,
      imageModel,
      imageQuality,
      imageSize,
    });

    if (imageRes.ok) {
      base64Image = extractImageBase64(imageJson);
      imageUrl = extractImageUrl(imageJson);
      if (!base64Image && imageUrl) {
        try {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            base64Image = arrayBufferToBase64(await imageResponse.arrayBuffer());
          } else {
            imageError = `画像URLの取得に失敗しました。status: ${imageResponse.status}`;
          }
        } catch (err) {
          imageError = err instanceof Error ? err.message : "画像URLの取得に失敗しました。";
        }
      }
      if (!base64Image) {
        imageError = imageError || "画像生成APIは成功しましたが、画像データが返りませんでした。";
      }
    } else {
      imageError =
        imageJson?.error?.message ||
        "OpenAIでの画像生成に失敗しました。";
      console.warn("画像生成エラー:", imageError);
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "画像生成処理で不明なエラーが発生しました。";
    imageError = message;
    console.warn("画像生成処理でエラー:", message);
  }

  return { base64Image, imageError, imageUrl, imageDebug };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POSTメソッドで呼び出してください。" }, 405);
  }

  try {
    const body = await req.json();

    const title =
      typeof body?.title === "string" ? body.title.trim() : "";

    const subsidiesText =
      typeof body?.subsidiesText === "string" ? body.subsidiesText.trim() : "";
    const articleType =
      typeof body?.articleType === "string" ? body.articleType.trim() : "column";
    const preferredCategory =
      typeof body?.category === "string" ? body.category.trim() : "";
    const extraInstructions =
      typeof body?.extraInstructions === "string"
        ? body.extraInstructions.trim()
        : "";
    const imageOnly = body?.imageOnly === true;
    const thumbnailText =
      typeof body?.thumbnailText === "string" ? body.thumbnailText.trim() : "";
    const contentText =
      typeof body?.content === "string" ? body.content.trim() : "";

    if (imageOnly && !title && !thumbnailText && !contentText) {
      return jsonResponse(
        { error: "画像生成用のタイトルまたは本文が指定されていません。" },
        200
      );
    }

    if (!imageOnly && !title && !subsidiesText) {
      return jsonResponse(
        { error: "タイトル、または補助金データが指定されていません。" },
        200
      );
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      return jsonResponse(
        { error: "Supabase Secrets に OPENAI_API_KEY が設定されていません。" },
        200
      );
    }

    const isAutoMode = Boolean(subsidiesText);
    const imageModel = Deno.env.get("OPENAI_IMAGE_MODEL")?.trim() || "gpt-image-1";
    const imageQuality = imageQualityOrDefault(Deno.env.get("OPENAI_IMAGE_QUALITY") || "medium");
    const imageSize = imageSizeOrDefault(Deno.env.get("OPENAI_IMAGE_SIZE") || "1536x1024");

    if (imageOnly) {
      const fallbackTheme = stripHtml(contentText).slice(0, 180);
      const imageTheme =
        thumbnailText ||
        title ||
        fallbackTheme ||
        "Ehime subsidy support and local business assistance";
      const { base64Image, imageError, imageUrl, imageDebug } = await generateImage({
        openAiKey,
        imageModel,
        imageQuality,
        imageSize,
        imageTheme,
        imageTitle: title,
        imageCategory: preferredCategory,
        articleType,
        contentContext: fallbackTheme,
      });

      return jsonResponse({
        base64Image,
        imageError,
        imageUrl,
        imageDebug,
        imageModel,
        imageQuality,
        imageSize,
      });
    }

    const systemPrompt = `
あなたは、愛媛県内の中小企業・個人事業主向けに補助金・助成金情報をわかりやすく整理するWebメディアの編集者です。
AIの役割は公開前の下書き作成です。公開前に人間が公式情報、断定表現、独自性を確認する前提で、確認しやすい記事を作ってください。

【重要ルール】
- 読者は愛媛県内の事業者です。
- 公式ページや入力データの要約・言い換えだけで終わらせず、読者が次に判断できる整理を加えてください。
- 文字数稼ぎの一般論、長い前置き、同じ内容の繰り返し、キーワードだけを差し替えた文章は禁止です。
- 入力データにない日付、受付状況、金額、補助率、採択率、企業名、成功事例、URLを作らないでください。
- 公式URLが入力データにある場合は、本文中に必ず公式情報へのリンクを入れてください。
- 公式URLがない場合は、架空URLを作らず「公式ページや自治体窓口で確認」と書いてください。
- 実在企業の成功事例を断定しないこと。
- 「必ず採択される」「必ず受給できる」などの断定表現を避けること。
- 初心者にもわかりやすい日本語にすること。
- 本文はHTMLで出力すること。
- 使用してよいHTMLタグは <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <a> のみ。
- 本文の最後に、必ず公式情報確認を促す注意書きを入れること。
- 画像プロンプトには「文字を入れない」指定を含めること。
- 追加指示がある場合は、法令・事実・安全性に反しない範囲で必ず本文に反映すること。

【本文に必ず入れる内容】
- この記事でわかること
- 対象になる可能性がある人
- 申請前に確認すること
- 公式情報の確認先
- 注意点
- 愛媛県内の読者が次に取る行動

【出力JSON】
次のキーだけを持つJSONを返してください。

{
  "subsidy_id": "自動生成の場合は選んだ補助金のID。手動タイトル生成の場合は空文字",
  "slug": "URL用スラッグ。英数字とハイフンのみ",
  "title": "記事タイトル",
  "seo_title": "SEOタイトル。32文字前後",
  "meta_description": "メタディスクリプション。120文字前後",
  "thumbnail_text": "画像生成用の英語プロンプト。20単語以内。文字・数字なしの絵にする",
  "content": "HTML本文",
  "category": "カテゴリ名",
  "tags": ["タグ1", "タグ2"]
}

【カテゴリ候補】
特集、基礎知識、用語解説、農業支援、IT・デジタル、設備投資、販路開拓、創業支援、事業承継、人材育成、補助金情報
`;

    const extraInstructionBlock = extraInstructions
      ? `
【必ず反映したい文章・観点】
${extraInstructions}
`
      : "";

    const userPrompt = isAutoMode
      ? `
以下は、現在公開中の補助金データです。

この中から、愛媛県内の事業者にとって記事化する価値が高く、公式URLや申請前の判断材料を本文に入れやすい制度を1つ選び、公開前確認用のコラム下書きを作成してください。

選んだ制度の ID を subsidy_id に必ず入れてください。
公式URLがある制度を優先してください。公式URLがない制度を選ぶ場合は、本文内で公式確認先が未確認であることを明記してください。

【補助金データ】
${subsidiesText}
${extraInstructionBlock}
`
      : `
以下のテーマで、補助金・助成金に関する公開前確認用のコラム下書きを作成してください。

【テーマ】
${title}

${articleType === "feature"
  ? `
この記事はトップページの「人気の特集から探す」に表示する特集記事です。
通常のコラムよりも、対象読者・探せる制度・次に取る行動・公式確認先がすぐ分かる構成にしてください。
category は必ず「特集」にしてください。
`
  : ""}
${preferredCategory ? `希望カテゴリ：${preferredCategory}` : ""}
${extraInstructionBlock}
`;

    const articleRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "column_article",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subsidy_id: { type: "string" },
                slug: { type: "string" },
                title: { type: "string" },
                seo_title: { type: "string" },
                meta_description: { type: "string" },
                thumbnail_text: { type: "string" },
                content: { type: "string" },
                category: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "subsidy_id",
                "slug",
                "title",
                "seo_title",
                "meta_description",
                "thumbnail_text",
                "content",
                "category",
                "tags",
              ],
              additionalProperties: false,
            },
          },
        },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    const articleJson = await articleRes.json();

    if (!articleRes.ok) {
      return jsonResponse(
        {
          error:
            articleJson?.error?.message ||
            "OpenAIでの記事生成に失敗しました。",
        },
        200
      );
    }

    const rawContent = articleJson?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return jsonResponse(
        { error: "OpenAIから記事本文が返ってきませんでした。" },
        200
      );
    }

    let articleData: {
      subsidy_id: string;
      slug: string;
      title: string;
      seo_title: string;
      meta_description: string;
      thumbnail_text: string;
      content: string;
      category: string;
      tags: string[];
    };

    try {
      articleData = JSON.parse(rawContent);
    } catch {
      return jsonResponse(
        { error: "OpenAIの返却JSONを解析できませんでした。" },
        200
      );
    }

    articleData.subsidy_id = articleData.subsidy_id || "";
    articleData.title = articleData.title || title || "補助金に関するお役立ちコラム";
    articleData.slug = createSlug(articleData.slug || articleData.title);
    articleData.seo_title = articleData.seo_title || articleData.title;
    articleData.meta_description = articleData.meta_description || "";
    articleData.thumbnail_text =
      articleData.thumbnail_text || "Japanese small business subsidy support";
    articleData.content =
      articleData.content ||
      "<p>現在、記事本文を準備中です。詳細は公式情報をご確認ください。</p>";
    articleData.category = articleData.category || "補助金情報";
    if (preferredCategory) {
      articleData.category = preferredCategory;
    }
    articleData.tags = Array.isArray(articleData.tags) ? articleData.tags : [];
    const articleQualityWarnings = buildArticleQualityWarnings(articleData);

    const { base64Image, imageError, imageUrl, imageDebug } = await generateImage({
      openAiKey,
      imageModel,
      imageQuality,
      imageSize,
      imageTheme: articleData.thumbnail_text,
      imageTitle: articleData.title,
      imageCategory: articleData.category,
      articleType,
      contentContext: stripHtml(articleData.content).slice(0, 280),
    });

    return jsonResponse({
      articleData,
      articleQualityWarnings,
      base64Image,
      imageError,
      imageUrl,
      imageDebug,
      imageModel,
      imageQuality,
      imageSize,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "不明なエラーが発生しました。",
      },
      200
    );
  }
});
