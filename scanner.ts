import { DetectionResult, MatchDetail, KeywordCategory, Severity } from './types';

export class KeywordScanner {
  private categories: KeywordCategory[] = [
    {
      keywords: [
        "verify account", "verify your account", "account suspended", "account locked",
        "confirm identity", "update payment", "payment failed", "billing problem",
        "unusual activity", "suspicious activity", "unauthorized access",
        "security alert", "verify payment", "confirm payment"
      ],
      severity: "critical",
      weight: 10
    },
    {
      keywords: [
        "urgent", "immediate action", "act now", "limited time", "expires today",
        "verify now", "click here now", "respond immediately", "final notice",
        "last chance", "time sensitive", "action required"
      ],
      severity: "high",
      weight: 8
    },
    {
      keywords: [
        "gift card", "gift cards", "iTunes card", "Google Play card", "Amazon card",
        "prepaid card", "wire transfer", "send money", "western union", "moneygram",
        "bitcoin", "cryptocurrency", "crypto wallet"
      ],
      severity: "critical",
      weight: 10
    },
    {
      keywords: [
        "password", "social security", "ssn", "social security number",
        "bank account", "routing number", "credit card", "cvv", "pin number",
        "bank login", "online banking", "account number", "tax id"
      ],
      severity: "critical",
      weight: 10
    },
    {
      keywords: [
        "IRS", "internal revenue service", "tax refund", "tax return",
        "tax investigation", "federal agent", "government official",
        "department of justice", "FBI", "police department"
      ],
      severity: "high",
      weight: 9
    },
    {
      keywords: [
        "Apple ID", "iCloud account", "Microsoft account", "Google account",
        "Amazon account", "PayPal account", "Netflix account", "Facebook account"
      ],
      severity: "high",
      weight: 8
    },
    {
      keywords: [
        "click this link", "click here", "download attachment", "open attachment",
        "verify here", "login here", "reset password", "change password",
        "update information", "confirm details"
      ],
      severity: "medium",
      weight: 6
    },
    {
      keywords: [
        "congratulations", "you've won", "prize", "lottery", "winner",
        "claim your", "free gift", "bonus", "reward", "compensation"
      ],
      severity: "medium",
      weight: 7
    },
    {
      keywords: [
        "refund", "reimbursement", "overpayment", "owed money",
        "unclaimed funds", "pending payment", "payment processing"
      ],
      severity: "medium",
      weight: 6
    },
    {
      keywords: [
        "suspended", "deactivated", "disabled", "restricted", "blocked",
        "terminated", "cancelled", "expired", "invalid"
      ],
      severity: "medium",
      weight: 5
    },
    {
      keywords: [
        "confirm", "verify", "validate", "authenticate", "review",
        "update", "renew", "reactivate"
      ],
      severity: "low",
      weight: 3
    }
  ];

  private severityScores: Record<Severity, number> = {
    low: 1,
    medium: 3,
    high: 6,
    critical: 10
  };

  scan(text: string): DetectionResult {
    const normalizedText = text.toLowerCase();
    const details: MatchDetail[] = [];
    const matchedKeywords = new Set<string>();
    let totalScore = 0;

    for (const category of this.categories) {
      for (const keyword of category.keywords) {
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const position = match.index;
          const context = this.extractContext(text, position, keyword.length);
          
          details.push({
            keyword,
            severity: category.severity,
            position,
            context
          });

          matchedKeywords.add(keyword);
          totalScore += this.severityScores[category.severity] * category.weight;
        }
      }
    }

    const flagged = details.length > 0;
    const severity = this.calculateOverallSeverity(details);

    return {
      flagged,
      score: totalScore,
      matches: Array.from(matchedKeywords),
      severity,
      details
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractContext(text: string, position: number, length: number): string {
    const start = Math.max(0, position - 30);
    const end = Math.min(text.length, position + length + 30);
    let context = text.substring(start, end);
    
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  private calculateOverallSeverity(details: MatchDetail[]): Severity {
    if (details.length === 0) return "low";

    const severityRanks: Record<Severity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };

    let maxRank = 0;
    let criticalCount = 0;
    let highCount = 0;

    for (const detail of details) {
      const rank = severityRanks[detail.severity];
      if (rank > maxRank) maxRank = rank;
      if (detail.severity === "critical") criticalCount++;
      if (detail.severity === "high") highCount++;
    }

    if (criticalCount >= 2 || (criticalCount >= 1 && highCount >= 1)) {
      return "critical";
    }

    if (maxRank === 4) return "critical";
    if (maxRank === 3) return "high";
    if (maxRank === 2) return "medium";
    return "low";
  }

  addCustomKeyword(keyword: string, severity: Severity, weight: number = 5): void {
    let category = this.categories.find(cat => cat.severity === severity);
    
    if (!category) {
      category = { keywords: [], severity, weight };
      this.categories.push(category);
    }
    
    if (!category.keywords.includes(keyword.toLowerCase())) {
      category.keywords.push(keyword.toLowerCase());
    }
  }

  removeKeyword(keyword: string): boolean {
    const normalized = keyword.toLowerCase();
    let removed = false;

    for (const category of this.categories) {
      const index = category.keywords.indexOf(normalized);
      if (index > -1) {
        category.keywords.splice(index, 1);
        removed = true;
      }
    }

    return removed;
  }

  getAllKeywords(): Record<Severity, string[]> {
    const result: Record<Severity, string[]> = {
      low: [],
      medium: [],
      high: [],
      critical: []
    };

    for (const category of this.categories) {
      result[category.severity].push(...category.keywords);
    }

    return result;
  }
}
