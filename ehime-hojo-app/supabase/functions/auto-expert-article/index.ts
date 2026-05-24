import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const toText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(3, Math.min(12, Math.round(parsed)));
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI応答をJSONとして解析できませんでした。");
    return JSON.parse(match[0]);
  }
};

const buildExpertArticleImagePrompt = ({
  title,
  theme,
  targetReader,
  region,
  industry,
  imageTheme,
}: Record<string, string>) => `
Create a refined editorial hero image for a Japanese subsidy and grant advisory article.

Subject:
${imageTheme || title || theme}

Context:
- Region: ${region || "Ehime, Japan"}
- Audience: ${targetReader || "small business owners and local residents in Ehime"}
- Industry or topic: ${industry || "subsidies, grants, business support"}

Visual direction:
- Trustworthy, calm, modern public-service editorial style
- People reviewing documents or discussing support programs in a bright office or local Ehime-inspired setting
- Subtle hints of Ehime such as citrus, Seto Inland Sea colors, or local business atmosphere
- Clean composition suitable for a web article thumbnail
- No text, no logos, no UI screenshots, no distorted hands, no exaggerated expressions
- Photorealistic or polished editorial illustration style
`.trim();

const imageQualityOrDefault = (value: string) => {
  const quality = value.trim();
  return ["low", "medium", "high", "auto"].includes(quality) ? quality : "low";
};

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
  const output = Array.isArray(imageJson?.output) ? imageJson.output : [];
  const outputContentTypes = output.flatMap((outputItem) => {
    if (!outputItem || typeof outputItem !== "object") return [];
    const content = Array.isArray((outputItem as Record<string, unknown>).content)
      ? ((outputItem as Record<string, unknown>).content as unknown[])
      : [];
    return content
      .filter((item) => item && typeof item === "object")
      .map((item) => toText((item as Record<string, unknown>).type))
      .filter(Boolean);
  });
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
    outputLength: output.length,
    outputContentTypes,
    error,
  };
};

const generateImage = async ({
  openAiKey,
  prompt,
}: {
  openAiKey: string;
  prompt: string;
}) => {
  const imageModel = Deno.env.get("OPENAI_IMAGE_MODEL")?.trim() || "gpt-image-1-mini";
  const imageQuality = imageQualityOrDefault(Deno.env.get("OPENAI_IMAGE_QUALITY") || "low");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: imageModel,
      prompt,
      size: "1024x1024",
      quality: imageQuality,
      output_format: "png",
      n: 1,
    }),
  });

  const result = await response.json();
  const imageDebug = buildImageDebug(result, response);

  console.log("image generation response summary", imageDebug);

  if (!response.ok) {
    return {
      base64Image: "",
      imageError:
        result?.error?.message ||
        "OpenAIでのアイキャッチ画像生成に失敗しました。",
      imageDebug,
      imageModel,
    };
  }

  const base64Image = extractImageBase64(result);
  const imageUrl = extractImageUrl(result);

  if (base64Image) {
    return {
      base64Image,
      imageUrl,
      imageError: "",
      imageDebug,
      imageModel,
    };
  }

  if (imageUrl) {
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return {
          base64Image: "",
          imageUrl,
          imageError: `画像URLの取得に失敗しました。status: ${imageResponse.status}`,
          imageDebug,
          imageModel,
        };
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      return {
        base64Image: arrayBufferToBase64(imageBuffer),
        imageUrl,
        imageError: "",
        imageDebug: {
          ...imageDebug,
          fetchedUrlBytes: imageBuffer.byteLength,
        },
        imageModel,
      };
    } catch (err) {
      return {
        base64Image: "",
        imageUrl,
        imageError: err instanceof Error ? err.message : "画像URLの取得に失敗しました。",
        imageDebug,
        imageModel,
      };
    }
  }

  return {
    base64Image: "",
    imageUrl: "",
    imageError: "画像生成APIは成功しましたが、b64_json がありませんでした。",
    imageDebug,
    imageModel,
  };
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
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      return jsonResponse(
        { error: "Supabase Secrets に OPENAI_API_KEY が設定されていません。" },
        200
      );
    }

    const expertName = toText(body?.expertName) || "補助金の専門家";
    const theme = toText(body?.theme);
    const targetReader = toText(body?.targetReader);
    const region = toText(body?.region) || "愛媛県";
    const industry = toText(body?.industry);
    const goal = toText(body?.goal);
    const tone = toText(body?.tone) || "やさしく、専門用語を少なめに";
    const questionCount = toNumber(body?.questionCount, 6);
    const imageOnly = Boolean(body?.imageOnly);
    const titleForImage = toText(body?.title);
    const imageTheme = toText(body?.imageTheme) || titleForImage || theme;
    const recommendedSubsidies = Array.isArray(body?.recommendedSubsidies)
      ? body.recommendedSubsidies
          .slice(0, 8)
          .map((item: Record<string, unknown>) => ({
            id: item?.id,
            title: toText(item?.title),
            organization: toText(item?.organization),
            region_text: toText(item?.region_text),
            application_period_text: toText(item?.application_period_text),
            amount_text: toText(item?.amount_text),
          }))
          .filter((item) => item.title)
      : [];

    if (imageOnly) {
      if (!imageTheme) {
        return jsonResponse(
          { error: "画像生成にはタイトル、テーマ、または画像テーマが必要です。" },
          200
        );
      }

      const mainImagePrompt = buildExpertArticleImagePrompt({
        title: titleForImage,
        theme,
        targetReader,
        region,
        industry,
        imageTheme,
      });
      const image = await generateImage({ openAiKey, prompt: mainImagePrompt });

      return jsonResponse({
        ...image,
        mainImagePrompt,
      });
    }

    if (!theme) {
      return jsonResponse({ error: "テーマを入力してください。" }, 200);
    }

    const systemPrompt = `
あなたは愛媛県の補助金・助成金ポータルで、専門家Q&A記事を編集する日本語編集者です。

【重要ルール】
- インタビュアーと専門家の会話形式で、読みやすいQ&A記事を作成してください。
- 専門家本人が実際に断言したような表現は避け、「専門家視点では」「一般的には」などの表現にしてください。
- 採択可否、受給可否、税務・法務判断を断定しないでください。
- 架空の補助金名、金額、申請期間を作らないでください。
- おすすめ補助金として渡された制度以外を断定的に紹介しないでください。
- 申請条件・募集期間・対象経費は変更されるため、公式情報と専門家確認が必要と明記してください。
- 回答は短いFAQではなく、専門家が丁寧に説明している読み物にしてください。
- 各回答は目安として5〜8文程度にし、結論、背景、実務上の注意点、愛媛県内の事業者・利用者が気をつけたい視点を自然に含めてください。
- 毎回同じ言い回しで締めず、質問ごとに答え方のリズムを変えてください。
- 文章はやさしく丁寧にしつつ、内容は具体的にしてください。
- JSONだけを返してください。Markdownのコードフェンスは禁止です。
`;

    const userPrompt = `
以下の条件で、愛媛県向けの専門家Q&A記事を作成してください。

専門家: ${expertName}
テーマ: ${theme}
対象読者: ${targetReader || "愛媛県内で補助金・助成金を探している方"}
地域: ${region}
業種: ${industry || "指定なし"}
記事の狙い: ${goal || "補助金の理解を深め、専門家相談につなげる"}
質問数: ${questionCount}
口調: ${tone}

おすすめ補助金:
${recommendedSubsidies.length ? JSON.stringify(recommendedSubsidies, null, 2) : "指定なし"}

出力JSONのキー:
{
  "title": "記事タイトル",
  "slug": "英数字とハイフンのみのURLスラッグ",
  "summary": "一覧用の短い説明文",
  "leadText": "記事冒頭のリード文。2〜3文で読者の課題とこの記事で分かることを説明",
  "qa": [
    {
      "question": "自然なインタビュー質問",
      "answer": "読み応えのある回答。結論、背景、注意点、地域・業種の視点、公式確認への促しを含む。5〜8文程度"
    }
  ],
  "closingText": "まとめ文。2〜4文で次の行動につなげる",
  "metaTitle": "SEOタイトル",
  "metaDescription": "SEO説明文",
  "recommendedSubsidyText": "この記事で紹介する補助金の説明文",
  "mainImagePrompt": "文字なしのアイキャッチ画像生成用英語プロンプト",
  "disclaimer": "注意書き"
}
`;

    const model = Deno.env.get("OPENAI_TEXT_MODEL")?.trim() || "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        response_format: { type: "json_object" },
        max_tokens: 7000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return jsonResponse(
        {
          error:
            result?.error?.message ||
            "OpenAIでの記事生成に失敗しました。",
        },
        200
      );
    }

    const content = result?.choices?.[0]?.message?.content || "{}";
    const parsed = safeJsonParse(content);

    return jsonResponse({
      title: toText(parsed.title),
      slug: toText(parsed.slug),
      summary: toText(parsed.summary),
      leadText: toText(parsed.leadText),
      qa: Array.isArray(parsed.qa) ? parsed.qa : [],
      closingText: toText(parsed.closingText),
      metaTitle: toText(parsed.metaTitle),
      metaDescription: toText(parsed.metaDescription),
      recommendedSubsidyText: toText(parsed.recommendedSubsidyText),
      mainImagePrompt: toText(parsed.mainImagePrompt),
      disclaimer:
        toText(parsed.disclaimer) ||
        "制度内容・申請期間・金額は変更される可能性があります。最終的な申請可否や条件は、公式情報および専門家への確認が必要です。",
      model,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "専門家記事生成中に不明なエラーが発生しました。";

    return jsonResponse({ error: message }, 200);
  }
});
