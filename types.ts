export type Severity = "low" | "medium" | "high" | "critical";

export interface DetectionResult {
  flagged: boolean;
  score: number;
  matches: string[];
  severity: Severity;
  details: MatchDetail[];
}

export interface MatchDetail {
  keyword: string;
  severity: Severity;
  position: number;
  context: string;
}

export interface AIVerdict {
  isSuspicious: boolean;
  reason: string;
  confidence: number;
}

export interface CombinedAnalysis {
  isSuspicious: boolean;
  overallSeverity: Severity;
  keywordDetection: DetectionResult;
  aiDetection: AIVerdict;
  finalScore: number;
  recommendation: string;
  timestamp: number;
  messageText: string;
}

export interface StoredAnalysis extends CombinedAnalysis {
  id: string;
}

export interface KeywordCategory {
  keywords: string[];
  severity: Severity;
  weight: number;
}

export interface MessageFromContent {
  type: 'ANALYZE_TEXT';
  text: string;
  source: 'selection' | 'input';
}

export interface MessageFromBackground {
  type: 'ANALYSIS_COMPLETE';
  analysis: CombinedAnalysis;
}
