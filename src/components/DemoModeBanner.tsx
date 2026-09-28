export default function DemoModeBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;
  return (
    <div
      className="w-full border-b border-signal/30 bg-signal/10 text-signal text-center font-mono text-[11px] sm:text-xs py-1.5 px-4"
      role="status"
    >
      <span className="font-bold tracking-widest">DEMO MODE</span>
      <span className="text-signal/80"> — all payments and activity are simulated. No real money moves.</span>
    </div>
  );
}
