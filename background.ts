import { KeywordScanner } from './scanner';
import { AIClassifier } from './aiWrapper';
import { CombinedAnalysis, MessageFromContent, DetectionResult, AIVerdict, Severity, StoredAnalysis } from './types';

const scanner = new KeywordScanner();
const aiClassifier = new AIClassifier();
let lastAnalysis: CombinedAnalysis | null = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'scanText',
    title: 'Scan for scams',
    contexts: ['selection']
  });

  chrome.storage.local.set({
    analysisHistory: [],
    settingsInitialized: true,
    mockMode: true
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'scanText' && info.selectionText && tab?.id) {
    analyzeText(info.selectionText, 'selection', tab.id);
  }
});

chrome.runtime.onMessage.addListener((message: MessageFromContent | any, sender, sendResponse) => {
  if (message.type === 'ANALYZE_TEXT') {
    handleAnalyzeRequest(message.text, message.source, sender.tab?.id);
  } else if (message.type === 'GET_LAST_ANALYSIS') {
    sendResponse({ analysis: lastAnalysis });
  } else if (message.type === 'GET_HISTORY') {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      sendResponse({ history: result.analysisHistory || [] });
    });
    return true;
  } else if (message.type === 'CLEAR_HISTORY') {
    chrome.storage.local.set({ analysisHistory: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  return true;
});

async function handleAnalyzeRequest(text: string, source: 'selection' | 'input', tabId?: number): Promise<void> {
  await analyzeText(text, source, tabId);
}

async function analyzeText(text: string, source: string, tabId?: number): Promise<void> {
  try {
    const keywordResult: DetectionResult = scanner.scan(text);
    const aiResult: AIVerdict = await aiClassifier.classifyWithAI(text);
    
    const analysis: CombinedAnalysis = combineResults(keywordResult, aiResult, text);
    lastAnalysis = analysis;
    
    await saveToHistory(analysis);
    
    if (analysis.isSuspicious && analysis.overallSeverity !== 'low') {
      showNotification(analysis);
    }
    
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_COMPLETE',
      analysis: analysis
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
  }
}

function combineResults(keywordResult: DetectionResult, aiResult: AIVerdict, text: string): CombinedAnalysis {
  const keywordScore = keywordResult.score;
  const aiScore = aiResult.confidence * 100;
  const finalScore = (keywordScore * 0.6) + (aiScore * 0.4);
  
  const isSuspicious = keywordResult.flagged || aiResult.isSuspicious;
  
  let overallSeverity: Severity = 'low';
  if (keywordResult.severity === 'critical' || (aiResult.isSuspicious && aiResult.confidence > 0.8)) {
    overallSeverity = 'critical';
  } else if (keywordResult.severity === 'high' || (aiResult.isSuspicious && aiResult.confidence > 0.6)) {
    overallSeverity = 'high';
  } else if (keywordResult.severity === 'medium' || aiResult.isSuspicious) {
    overallSeverity = 'medium';
  }
  
  let recommendation = '';
  if (overallSeverity === 'critical') {
    recommendation = '🚨 DANGER: This is very likely a scam. Do NOT respond or provide any information.';
  } else if (overallSeverity === 'high') {
    recommendation = '⚠️ HIGH RISK: This message shows many signs of a scam. Be extremely cautious.';
  } else if (overallSeverity === 'medium') {
    recommendation = '⚡ CAUTION: This message has some suspicious elements. Verify before taking action.';
  } else {
    recommendation = '✅ This message appears safe, but always stay vigilant.';
  }
  
  return {
    isSuspicious,
    overallSeverity,
    keywordDetection: keywordResult,
    aiDetection: aiResult,
    finalScore,
    recommendation,
    timestamp: Date.now(),
    messageText: text
  };
}

async function saveToHistory(analysis: CombinedAnalysis): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      const history: StoredAnalysis[] = result.analysisHistory || [];
      const storedAnalysis: StoredAnalysis = {
        ...analysis,
        id: Date.now().toString() + Math.random().toString(36)
      };
      history.unshift(storedAnalysis);
      if (history.length > 100) {
        history.pop();
      }
      chrome.storage.local.set({ analysisHistory: history }, () => {
        resolve();
      });
    });
  });
}

function showNotification(analysis: CombinedAnalysis): void {
  const title = analysis.overallSeverity === 'critical' 
    ? '🚨 SCAM ALERT!' 
    : '⚠️ Suspicious Message Detected';
  
  const message = analysis.recommendation;
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}
