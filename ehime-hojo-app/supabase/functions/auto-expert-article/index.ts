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
  "leadText": "記事冒頭のリード文",
  "qa": [
    { "question": "質問", "answer": "回答" }
  ],
  "closingText": "まとめ文",
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
