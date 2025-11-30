import { MessageFromContent } from './types';

let selectedText: string = '';

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    selectedText = selection.toString().trim();
    if (selectedText.length >= 10) {
      chrome.runtime.sendMessage({
        type: 'ANALYZE_TEXT',
        text: selectedText,
        source: 'selection'
      } as MessageFromContent);
    }
  }
});

document.addEventListener('input', (e: Event) => {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement;
  if ((target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target.value.length > 50) {
    chrome.runtime.sendMessage({
      type: 'ANALYZE_TEXT',
      text: target.value,
      source: 'input'
    } as MessageFromContent);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTED_TEXT') {
    sendResponse({ text: selectedText });
  }
  return true;
});
