import { CombinedAnalysis, StoredAnalysis } from './types';

let currentAnalysis: CombinedAnalysis | null = null;

document.addEventListener('DOMContentLoaded', () => {
  loadLastAnalysis();
  setupEventListeners();
  loadHistory();
});

function setupEventListeners(): void {
  const analyzeBtn = document.getElementById('analyzeBtn') as HTMLButtonElement;
  const textInput = document.getElementById('textInput') as HTMLTextAreaElement;
  const clearHistoryBtn = document.getElementById('clearHistory') as HTMLButtonElement;
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  if (analyzeBtn && textInput) {
    analyzeBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (text.length >= 10) {
        chrome.runtime.sendMessage({
          type: 'ANALYZE_TEXT',
          text: text,
          source: 'input'
        });
        setTimeout(loadLastAnalysis, 1000);
      } else {
        showError('Please enter at least 10 characters');
      }
    });
  }
  
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
        loadHistory();
      });
    });
  }
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tabName = target.dataset.tab;
      if (tabName) {
        switchTab(tabName);
      }
    });
  });
}

function switchTab(tabName: string): void {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
  const activeContent = document.getElementById(tabName);
  
  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.classList.add('active');
  
  if (tabName === 'history') {
    loadHistory();
  }
}

function loadLastAnalysis(): void {
  chrome.runtime.sendMessage({ type: 'GET_LAST_ANALYSIS' }, (response) => {
    if (response && response.analysis) {
      currentAnalysis = response.analysis;
      displayAnalysis(currentAnalysis);
    }
  });
}

function displayAnalysis(analysis: CombinedAnalysis): void {
  const resultDiv = document.getElementById('result') as HTMLDivElement;
  if (!resultDiv) return;
  
  const severityClass = getSeverityClass(analysis.overallSeverity);
  const severityEmoji = getSeverityEmoji(analysis.overallSeverity);
  
  let html = `
    <div class="analysis-card ${severityClass}">
      <div class="severity-badge ${severityClass}">
        ${severityEmoji} ${analysis.overallSeverity.toUpperCase()}
      </div>
      
      <div class="recommendation">
        ${analysis.recommendation}
      </div>
      
      <div class="score-section">
        <h3>Risk Score: ${Math.round(analysis.finalScore)}/100</h3>
      </div>
      
      <div class="message-preview">
        <h3>Message:</h3>
        <p>${escapeHtml(analysis.messageText.substring(0, 200))}${analysis.messageText.length > 200 ? '...' : ''}</p>
      </div>
      
      <div class="keyword-matches">
        <h3>Suspicious Keywords Found (${analysis.keywordDetection.matches.length}):</h3>
        <div class="keyword-list">
          ${analysis.keywordDetection.matches.slice(0, 10).map(kw => `<span class="keyword-tag">${escapeHtml(kw)}</span>`).join('')}
          ${analysis.keywordDetection.matches.length > 10 ? `<span class="keyword-tag">+${analysis.keywordDetection.matches.length - 10} more</span>` : ''}
        </div>
      </div>
      
      <div class="ai-analysis">
        <h3>AI Analysis:</h3>
        <p><strong>Suspicious:</strong> ${analysis.aiDetection.isSuspicious ? 'YES' : 'NO'}</p>
        <p><strong>Confidence:</strong> ${Math.round(analysis.aiDetection.confidence * 100)}%</p>
        <p><strong>Reason:</strong> ${escapeHtml(analysis.aiDetection.reason)}</p>
      </div>
    </div>
  `;
  
  resultDiv.innerHTML = html;
}

function loadHistory(): void {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (response) => {
    if (response && response.history) {
      displayHistory(response.history);
    }
  });
}

function displayHistory(history: StoredAnalysis[]): void {
  const historyDiv = document.getElementById('historyList') as HTMLDivElement;
  if (!historyDiv) return;
  
  if (history.length === 0) {
    historyDiv.innerHTML = '<p class="no-history">No scans yet</p>';
    return;
  }
  
  let html = '';
  history.slice(0, 20).forEach(item => {
    const date = new Date(item.timestamp).toLocaleString();
    const severityClass = getSeverityClass(item.overallSeverity);
    const preview = item.messageText.substring(0, 80);
    
    html += `
      <div class="history-item ${severityClass}">
        <div class="history-header">
          <span class="severity-badge-small ${severityClass}">${item.overallSeverity}</span>
          <span class="history-date">${date}</span>
        </div>
        <div class="history-preview">${escapeHtml(preview)}...</div>
        <div class="history-score">Score: ${Math.round(item.finalScore)}</div>
      </div>
    `;
  });
  
  historyDiv.innerHTML = html;
}

function getSeverityClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'severity-critical';
    case 'high': return 'severity-high';
    case 'medium': return 'severity-medium';
    default: return 'severity-low';
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '⚡';
    default: return '✅';
  }
}

function showError(message: string): void {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 3000);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
