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

    if (!title && !subsidiesText) {
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

    const systemPrompt = `
あなたは、愛媛県内の中小企業・個人事業主向けに補助金・助成金情報をわかりやすく解説するWebメディアの編集者です。

【重要ルール】
- 読者は愛媛県内の事業者です。
- 実在企業の成功事例を断定しないこと。
- 「必ず採択される」「必ず受給できる」などの断定表現を避けること。
- 初心者にもわかりやすい日本語にすること。
- 本文はHTMLで出力すること。
- 使用してよいHTMLタグは <h2>, <h3>, <p>, <ul>, <li>, <strong> のみ。
- 本文の最後に、必ず公式情報確認を促す注意書きを入れること。
- 画像プロンプトには「文字を入れない」指定を含めること。
- 追加指示がある場合は、法令・事実・安全性に反しない範囲で必ず本文に反映すること。

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

この中から、愛媛県内の事業者にとって記事化する価値が高い制度を1つ選び、コラム記事を作成してください。

選んだ制度の ID を subsidy_id に必ず入れてください。

【補助金データ】
${subsidiesText}
${extraInstructionBlock}
`
      : `
以下のテーマで、補助金・助成金に関するコラム記事を作成してください。

【テーマ】
${title}

${articleType === "feature"
  ? `
この記事はトップページの「人気の特集から探す」に表示する特集記事です。
通常のコラムよりも、対象読者・探せる制度・次に取る行動がすぐ分かる構成にしてください。
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

    let base64Image = "";
    let imageError = "";
    const imageModel = Deno.env.get("OPENAI_IMAGE_MODEL")?.trim() || "gpt-image-1-mini";
    const imageQuality = Deno.env.get("OPENAI_IMAGE_QUALITY")?.trim() || "low";

    try {
      const imagePrompt = `
A clean modern flat vector illustration for a Japanese small business subsidy blog.
Theme: ${articleData.thumbnail_text}.
No text, no letters, no numbers, no logo.
Soft corporate colors, simple composition, business support, local community.
`;

      const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
          quality: imageQuality,
        }),
      });

      const imageJson = await imageRes.json();

      if (imageRes.ok) {
        base64Image = imageJson?.data?.[0]?.b64_json || "";
        if (!base64Image) {
          imageError = "画像生成APIは成功しましたが、画像データが返りませんでした。";
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

    return jsonResponse({
      articleData,
      base64Image,
      imageError,
      imageModel,
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
