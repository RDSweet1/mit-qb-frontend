'use client';

import { useMemo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

function renderMarkdown(text: string): string {
  // Process line by line
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        // Check if this is a header separator
        if (trimmed.replace(/[\|\-\s:]/g, '') === '') continue;
        result.push('<table class="w-full text-sm border-collapse my-2">');
        const cells = trimmed.split('|').filter(c => c.trim());
        result.push('<thead><tr>' + cells.map(c => `<th class="border border-gray-300 px-2 py-1 bg-gray-50 text-left font-semibold">${c.trim()}</th>`).join('') + '</tr></thead><tbody>');
        continue;
      }
      // Separator row
      if (trimmed.replace(/[\|\-\s:]/g, '') === '') continue;
      const cells = trimmed.split('|').filter(c => c.trim());
      result.push('<tr>' + cells.map(c => `<td class="border border-gray-300 px-2 py-1">${c.trim()}</td>`).join('') + '</tr>');
      continue;
    } else if (inTable) {
      inTable = false;
      result.push('</tbody></table>');
    }

    // List items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        inList = true;
        result.push('<ul class="list-disc pl-5 my-1">');
      }
      result.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
      continue;
    } else if (inList) {
      inList = false;
      result.push('</ul>');
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s(.+)/);
    if (numberedMatch) {
      if (!inList) {
        inList = true;
        result.push('<ol class="list-decimal pl-5 my-1">');
      }
      result.push(`<li>${formatInline(numberedMatch[2])}</li>`);
      continue;
    }

    // Empty line
    if (!trimmed) {
      if (inList) { inList = false; result.push('</ul>'); }
      result.push('<br/>');
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      result.push(`<h4 class="font-semibold text-sm mt-2">${formatInline(trimmed.slice(4))}</h4>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      result.push(`<h3 class="font-semibold mt-2">${formatInline(trimmed.slice(3))}</h3>`);
      continue;
    }

    // Regular paragraph
    result.push(`<p>${formatInline(trimmed)}</p>`);
  }

  if (inTable) result.push('</tbody></table>');
  if (inList) result.push('</ul>');

  return result.join('');
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
    .replace(/\$([0-9,.]+)/g, '<span class="font-mono">$$$1</span>');
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const html = useMemo(() => role === 'assistant' ? renderMarkdown(content) : content, [role, content]);

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-[85%] text-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-3">
      <div
        className="bg-gray-100 text-gray-800 px-4 py-2 rounded-2xl rounded-bl-md max-w-[85%] text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
