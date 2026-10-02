/** Converts the model's Markdown to WhatsApp's formatting (*bold*, • bullets). */
export function toWhatsAppText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/^[-*]\s+/gm, "• ");
}
