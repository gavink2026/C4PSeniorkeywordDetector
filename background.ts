import { KeywordScanner } from './scanner';
import { AIClassifier } from './aiWrapper';
import { CombinedAnalysis, MessageFromContent, Severity, StoredAnalysis } from './types';

const scanner = new KeywordScanner();
const aiClassifier = new AIClassifier();
let lastAnalysis: CombinedAnalysis | null = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'scanText',
    title: 'Scan for Scams',
    contexts: ['selection']
  });

  chrome.storage.local.set({
    scanHistory: [],
    totalScans: 0,
    scamsDetected: 0
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'scanText' && info.selectionText && tab?.id) {
    analyzeText(info.selectionText, 'selection');
  }
});

chrome.runtime.onMessage.addListener((message: MessageFromContent, sender, sendResponse) => {
  if (message.type === 'ANALYZE_TEXT') {
    analyzeText(message.text, message.source).then(analysis => {
      sendResponse({ success: true, analysis });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'GET_LAST_ANALYSIS') {
    sendResponse({ analysis: lastAnalysis });
    return true;
  }

  if (message.type === 'GET_SCAN_HISTORY') {
    chrome.storage.local.get(['scanHistory'], (result) => {
      sendResponse({ history: result.scanHistory || [] });
    });
    return true;
  }

  if (message.type === 'CLEAR_HISTORY') {
    chrome.storage.local.set({ scanHistory: [], totalScans: 0, scamsDetected: 0 }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_STATS') {
    chrome.storage.local.get(['totalScans', 'scamsDetected'], (result) => {
      sendResponse({ 
        totalScans: result.totalScans || 0,
        scamsDetected: result.scamsDetected || 0
      });
    });
    return true;
  }
});

async function analyzeText(text: string, source: 'selection' | 'input'): Promise<CombinedAnalysis> {
  const keywordResult = scanner.scan(text);
  const aiResult = await aiClassifier.classifyWithAI(text);
  
  const keywordScore = normalizeScore(keywordResult.score);
  const aiScore = aiResult.confidence;
  const combinedScore = (keywordScore * 0.6) + (aiScore * 0.4);
  
  const isSuspicious = combinedScore >= 0.5 || keywordResult.severity === 'critical' || aiResult.isSuspicious;
  const overallSeverity = determineOverallSeverity(keywordResult.severity, aiResult.isSuspicious, combinedScore);
  const recommendation = generateRecommendation(isSuspicious, overallSeverity, keywordResult, aiResult);

  const analysis: CombinedAnalysis = {
    isSuspicious,
    overallSeverity,
    keywordDetection: keywordResult,
    aiDetection: aiResult,
    finalScore: combinedScore,
    recommendation,
    timestamp: Date.now(),
    messageText: text
  };

  lastAnalysis = analysis;

  if (isSuspicious) {
    showNotification(overallSeverity);
  }

  saveToHistory(analysis);
  updateStats(isSuspicious);

  return analysis;
}

function normalizeScore(rawScore: number): number {
  const maxExpectedScore = 200;
  return Math.min(rawScore / maxExpectedScore, 1.0);
}

function determineOverallSeverity(keywordSeverity: Severity, aiSuspicious: boolean, score: number): Severity {
  if (keywordSeverity === 'critical' || (aiSuspicious && score >= 0.8)) {
    return 'critical';
  }
  if (keywordSeverity === 'high' || (aiSuspicious && score >= 0.6)) {
    return 'high';
  }
  if (keywordSeverity === 'medium' || score >= 0.4) {
    return 'medium';
  }
  return 'low';
}

function generateRecommendation(isSuspicious: boolean, severity: Severity, keywordResult: any, aiResult: any): string {
  if (!isSuspicious) {
    return 'This message appears safe. No significant scam indicators detected.';
  }

  const recommendations: string[] = [];

  if (severity === 'critical') {
    recommendations.push('⛔ HIGH RISK: Do not respond or take any action.');
  } else if (severity === 'high') {
    recommendations.push('⚠️ WARNING: Exercise extreme caution.');
  } else {
    recommendations.push('⚡ CAUTION: This message shows some suspicious signs.');
  }

  if (keywordResult.matches.some((m: string) => m.includes('gift card') || m.includes('wire transfer'))) {
    recommendations.push('Never pay with gift cards or wire transfers for legitimate services.');
  }

  if (keywordResult.matches.some((m: string) => m.includes('password') || m.includes('social security'))) {
    recommendations.push('Never share passwords or personal information via message.');
  }

  if (keywordResult.matches.some((m: string) => m.includes('urgent') || m.includes('immediate'))) {
    recommendations.push('Legitimate organizations rarely demand immediate action.');
  }

  if (aiResult.isSuspicious) {
    recommendations.push(`AI Analysis: ${aiResult.reason}`);
  }

  recommendations.push('When in doubt, contact the organization directly using official contact information.');

  return recommendations.join(' ');
}

function showNotification(severity: Severity): void {
  const titles = {
    low: '⚡ Potential Scam Detected',
    medium: '⚠️ Suspicious Message Detected',
    high: '🚨 Warning: Likely Scam',
    critical: '⛔ DANGER: Scam Detected'
  };

  const messages = {
    low: 'This message shows some suspicious signs.',
    medium: 'This message contains multiple scam indicators.',
    high: 'This message is very likely a scam attempt.',
    critical: 'This message is almost certainly a scam. Do not respond!'
  };

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: titles[severity],
    message: messages[severity],
    priority: severity === 'critical' ? 2 : 1,
    requireInteraction: severity === 'critical'
  });
}

function saveToHistory(analysis: CombinedAnalysis): void {
  chrome.storage.local.get(['scanHistory'], (result) => {
    const history: StoredAnalysis[] = result.scanHistory || [];
    const newEntry: StoredAnalysis = {
      ...analysis,
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    history.unshift(newEntry);
    
    if (history.length > 100) {
      history.splice(100);
    }

    chrome.storage.local.set({ scanHistory: history });
  });
}

function updateStats(wasScam: boolean): void {
  chrome.storage.local.get(['totalScans', 'scamsDetected'], (result) => {
    const totalScans = (result.totalScans || 0) + 1;
    const scamsDetected = (result.scamsDetected || 0) + (wasScam ? 1 : 0);
    
    chrome.storage.local.set({ totalScans, scamsDetected });
  });
}
