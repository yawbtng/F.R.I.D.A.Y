export function GradientDivider() {
  return (
    <div className="relative mx-auto h-px w-full max-w-4xl">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(59,130,246,0.28) 50%, rgba(255,255,255,0.06) 80%, transparent 100%)',
        }}
      />
    </div>
  );
}
