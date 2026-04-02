export function LoadingState() {
  return (
    <div className="crm-space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="crm-animate-pulse crm-rounded-[24px] crm-border crm-border-white/8 crm-bg-white/[0.04] crm-p-4"
        >
          <div className="crm-mb-3 crm-h-4 crm-w-24 crm-rounded-full crm-bg-white/10" />
          <div className="crm-space-y-2">
            <div className="crm-h-3 crm-w-full crm-rounded-full crm-bg-white/10" />
            <div className="crm-h-3 crm-w-4/5 crm-rounded-full crm-bg-white/10" />
            <div className="crm-h-3 crm-w-2/3 crm-rounded-full crm-bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
