import { AIVerdict } from './types';

export class AIClassifier {
  private apiEndpoint: string = '';
  private apiKey: string = '';
  private mockMode: boolean = true;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    chrome.storage.local.get(['aiEndpoint', 'aiKey', 'mockMode'], (result) => {
      this.apiEndpoint = result.aiEndpoint || '';
      this.apiKey = result.aiKey || '';
      this.mockMode = result.mockMode !== false;
    });
  }

  async classifyWithAI(message: string): Promise<AIVerdict> {
    if (this.mockMode || !this.apiEndpoint) {
      return this.mockClassify(message);
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ text: message })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        isSuspicious: data.isSuspicious || false,
        reason: data.reason || 'No explanation provided',
        confidence: data.confidence || 0.5
      };
    } catch (error) {
      console.error('AI classification error:', error);
      return this.mockClassify(message);
    }
  }

  private mockClassify(message: string): AIVerdict {
    const lowerMsg = message.toLowerCase();
    let suspicionScore = 0;
    const reasons: string[] = [];

    if (lowerMsg.includes('urgent') || lowerMsg.includes('immediate')) {
      suspicionScore += 0.3;
      reasons.push('Uses urgent language');
    }

    if (lowerMsg.includes('click') && lowerMsg.includes('link')) {
      suspicionScore += 0.25;
      reasons.push('Contains clickable link request');
    }

    if (lowerMsg.includes('verify') || lowerMsg.includes('confirm')) {
      suspicionScore += 0.2;
      reasons.push('Requests verification');
    }

    if (lowerMsg.includes('account') && (lowerMsg.includes('suspend') || lowerMsg.includes('lock'))) {
      suspicionScore += 0.4;
      reasons.push('Threatens account suspension');
    }

    if (lowerMsg.includes('password') || lowerMsg.includes('credit card') || lowerMsg.includes('ssn')) {
      suspicionScore += 0.5;
      reasons.push('Requests sensitive information');
    }

    if (lowerMsg.includes('gift card') || lowerMsg.includes('wire transfer')) {
      suspicionScore += 0.6;
      reasons.push('Requests unusual payment method');
    }

    const urlCount = (message.match(/https?:\/\//g) || []).length;
    if (urlCount >= 2) {
      suspicionScore += 0.2;
      reasons.push('Contains multiple URLs');
    }

    if (message.length > 500 && suspicionScore > 0.3) {
      suspicionScore += 0.1;
      reasons.push('Long message with suspicious content');
    }

    const isSuspicious = suspicionScore >= 0.4;
    const confidence = Math.min(suspicionScore, 1.0);

    return {
      isSuspicious,
      reason: isSuspicious 
        ? reasons.join('; ') 
        : 'No significant suspicious patterns detected',
      confidence
    };
  }

  configureAPI(endpoint: string, apiKey: string): void {
    this.apiEndpoint = endpoint;
    this.apiKey = apiKey;
    this.mockMode = false;

    chrome.storage.local.set({
      aiEndpoint: endpoint,
      aiKey: apiKey,
      mockMode: false
    });
  }

  enableMockMode(): void {
    this.mockMode = true;
    chrome.storage.local.set({ mockMode: true });
  }

  disableMockMode(): void {
    this.mockMode = false;
    chrome.storage.local.set({ mockMode: false });
  }
}
