'use client';

/** voice-assistant 원본의 noteHtml(): **bold** 와 줄바꿈만 지원하는 경량 마크다운 렌더러 */
export default function Note({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {renderBold(line)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function renderBold(line: string) {
  const parts = line.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part));
}
