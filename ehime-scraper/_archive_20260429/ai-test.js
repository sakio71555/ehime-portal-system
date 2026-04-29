const { OpenAI } = require('openai');

// ※ここに取得済みのAPIキーを入力します
const openai = new OpenAI({
  apiKey: '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', 
});

async function formatDataWithAI() {
  console.log('AIに文章の解析を依頼しています...');

  // 行政サイトから取得したと仮定するテキストデータ
  const rawText = `
    令和8年度 松山市 中小企業DX推進補助金について。
    市内の事業者向けに、生産性向上のためのシステム導入や
    クラウドサービス利用経費の2分の1（上限50万円）を補助します。
    申請期間は令和8年5月1日から6月30日必着となります。
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // コストが安いモデルを使用
      messages: [
        {
          role: "system",
          content: "あなたは優秀なアシスタントです。提供された文章から補助金の情報を抽出し、以下のキーを持つJSON形式のみで出力してください: title(補助金名), target(対象者), amount(上限金額), deadline(締切日)"
        },
        {
          role: "user",
          content: rawText
        }
      ],
      // JSONで返すように強制する設定
      response_format: { type: "json_object" }
    });

    console.log('\n=== AIの整形結果（JSON） ===');
    console.log(response.choices[0].message.content);
    console.log('============================\n');

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  }
}

formatDataWithAI();