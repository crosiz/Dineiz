import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

export function renderMarkdown(content: string): string {
  if (!content) return '';
  return micromark(content, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
    allowDangerousHtml: true,
  });
}
