import type { CandidateSet } from "./types.ts";

export const buildPrompt = ({
  candidateSet,
  purposesTags,
  industryTags,
}: {
  candidateSet: CandidateSet;
  purposesTags: string;
  industryTags: string;
}) => {
  return `
あなたは日本の自治体補助金・給付金・助成金データを構造化する専門家です。
以下の本文から、制度情報をJSONで抽出してください。

重要：
- 必ず「候補文セット」を最優先してください。
- 本文全体よりも、候補文セットに含まれる申請期間・金額・補助率・対象者・対象経費を優先してください。
- ヘッダー、フッター、検索メニュー、問い合わせ先だけの情報、別制度の案内には引っ張られないでください。
- わからない項目は「不明」ではなく空文字または空配列にしてください。
- JSON以外の文章は返さないでください。

【地域・実施機関のルール】
- region_text は原則「愛媛」としてください。
- URLが市町村ドメインの場合、organization と municipality はその市町村を優先してください。
- 例：city.matsuyama.ehime.jp → region_text「愛媛」、organization「松山市」、municipality「松山市」。
- 例：town.ikata.ehime.jp → region_text「愛媛」、organization「伊方町」、municipality「伊方町」。
- 例：pref.ehime.jp → region_text「愛媛」、organization「愛媛県」、municipality「」。

【申請期間・公募ステータスの最重要ルール】
- 「対象児童」「給付対象者」「出生した児童」「新生児」「児童手当」「住民登録」などの文に含まれる日付は、申請期間ではなく対象条件なので application_period_text に入れない。
- 「令和7年10月1日から令和8年3月31日までに出生した新生児分」のような文は application_period_text ではなく target_entities_arr 側の根拠にしてください。
- 申請期間が明記されていない場合は application_period_text を空文字にしてください。
- 「令和8年5月1日（金曜日）～助成枠に達するまで」のように、開始日はあるが終了日が「達するまで」「なくなり次第」「予算額に達するまで」の場合、開始日を締切日として扱わない。
- この場合、application_period_text には原文をできるだけそのまま入れる。
- application_start_date には開始日を YYYY-MM-DD で入れる。
- application_end_date は null にする。
- 現在日より開始日が未来の場合、application_status は「予告」にする。
- 「助成枠に達するまで」は締切日ではなく、終了条件である。
- 「終了しました」「受付終了」が明記されている場合は「受付終了」を優先する。

【金額・補助率のルール】
- 「上限」「限度額」「補助限度額」「1事業者あたり」「給付額」「支給額」付近の金額を amount_text に入れる。
- 「補助率」「助成率」「対象経費の2分の1以内」などは subsidy_rate_text に入れる。
- 給付金・手当のように補助率が存在しない制度では subsidy_rate_text は空文字でよい。
- 金額と補助率を混ぜない。
- amount_max_yen は数値の円換算で入れる。例：20万円 → 200000、2万円 → 20000。

【対象経費・対象者のルール】
- 「対象経費」「補助対象経費」「対象事業」「補助対象事業」付近の文を優先する。
- 給付金・手当制度で対象経費が存在しない場合、target_expenses_arr は空配列でよい。
- 「対象児童」「給付対象者」「支給対象者」付近の文は target_entities_arr に入れる。
- 問い合わせ先、提出先、申請期間、補助率、金額上限は対象経費に混ぜない。

【制度種別・交付条件のルール】
- program_kind は、補助金・助成金なら subsidy、奨励金なら incentive、給付金・支援金・手当なら benefit、融資・貸付・利子補給なら loan、それ以外は other とする。
- 奨励金では対象経費を無理に作らず、立地要件・雇用要件・操業開始要件などを eligibility_conditions_arr に入れる。
- 給付金・支援金では対象経費を無理に作らず、支給条件を payment_conditions_arr に入れる。
- calculation_method_text には、補助率、床面積、雇用人数、賃借料など金額算定の基準を原文に忠実に入れる。
- application_methods_arr には提出方法・申請先・必要な事前相談など、本文で確認できる内容だけを入れる。
- pre_start_rule_text には契約、発注、購入、着手、操業開始などの時期に関する公式記載だけを入れる。見つからなければ空文字にする。

【返却JSON形式】
{
  "facts": {
    "source_url": "",
    "official_url": "",
    "title": "",
    "organization": "",
    "region_text": "愛媛",
    "prefecture": "愛媛県",
    "municipality": "",
    "application_status": "公募中 または 予告 または 受付終了 または 不明",
    "application_period_text": "",
    "application_start_date": "YYYY-MM-DD または null",
    "application_end_date": "YYYY-MM-DD または null",
    "amount_text": "",
    "amount_max_yen": 0,
    "subsidy_rate_text": "",
    "program_kind": "subsidy または incentive または benefit または loan または other",
    "eligibility_conditions_arr": [],
    "calculation_method_text": "",
    "payment_conditions_arr": [],
    "application_methods_arr": [],
    "pre_start_rule_text": "",
    "target_expenses_arr": [],
    "target_entities_arr": [],
    "fiscal_year": "",
    "summary": "",
    "confidence": 0,
    "evidence": {
      "application_period_text": "",
      "amount_text": "",
      "subsidy_rate_text": "",
      "target_entities_arr": "",
      "target_expenses_arr": "",
      "eligibility_conditions_arr": "",
      "calculation_method_text": "",
      "payment_conditions_arr": "",
      "application_methods_arr": "",
      "pre_start_rule_text": "",
      "official_url": ""
    }
  },
  "tags": {
    "purposes": [],
    "industries": []
  },
  "finalTitle": ""
}

【利用目的タグ候補】
${purposesTags || "なし"}

【業種タグ候補】
${industryTags || "なし"}

【候補文セット】
タイトル候補:
${candidateSet.titleCandidates.join("\n") || "なし"}

申請期間候補:
${candidateSet.periodCandidates.join("\n---\n") || "なし"}

金額候補:
${candidateSet.amountCandidates.join("\n---\n") || "なし"}

補助率候補:
${candidateSet.rateCandidates.join("\n---\n") || "なし"}

対象者候補:
${candidateSet.targetEntityCandidates.join("\n---\n") || "なし"}

対象経費候補:
${candidateSet.targetExpenseCandidates.join("\n---\n") || "なし"}

公式URL候補:
${candidateSet.urlCandidates.join("\n") || "なし"}

入力元情報:
${JSON.stringify(candidateSet.sourceInfo, null, 2)}

【本文全体の短縮版】
${candidateSet.focusedText}
`;
};
