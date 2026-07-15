export type JsonRecord = Record<string, unknown>;

export type ExtractFacts = {
  source_url?: string;
  official_url?: string;
  title?: string;
  organization?: string;
  region_text?: string;
  prefecture?: string;
  municipality?: string;

  application_status?: string;
  application_period_text?: string;
  application_start_date?: string | null;
  application_end_date?: string | null;

  amount_text?: string;
  amount_max_yen?: number;
  subsidy_rate_text?: string;

  program_kind?: "subsidy" | "incentive" | "benefit" | "loan" | "other";
  eligibility_conditions_arr?: string[];
  calculation_method_text?: string;
  payment_conditions_arr?: string[];
  application_methods_arr?: string[];
  pre_start_rule_text?: string;

  target_expenses_arr?: string[];
  target_entities_arr?: string[];

  fiscal_year?: string;
  summary?: string;
  confidence?: number;

  field_confidence?: Record<string, number>;
  warnings?: string[];
  evidence?: Record<string, string>;
};

export type ExtractResult = {
  facts: ExtractFacts;
  tags: {
    purposes: string[];
    industries: string[];
  };
  finalTitle: string;
};

export type CandidateSet = {
  lines: string[];
  titleCandidates: string[];
  periodCandidates: string[];
  amountCandidates: string[];
  rateCandidates: string[];
  targetEntityCandidates: string[];
  targetExpenseCandidates: string[];
  urlCandidates: string[];
  focusedText: string;
  sourceInfo: {
    editFormTitle: string;
    org: string;
    resolvedUrl: string;
  };
};
