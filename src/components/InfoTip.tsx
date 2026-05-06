interface InfoTipProps {
  /** Full explanation shown on hover/focus (native tooltip). */
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  return (
    <button
      type="button"
      className="info-tip"
      aria-label={text}
      title={text}
    >
      <span aria-hidden className="info-tip-mark">i</span>
    </button>
  );
}
