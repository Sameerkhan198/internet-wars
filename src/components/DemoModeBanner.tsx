export default function DemoModeBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;
  return (
    <div className="w-full bg-amber-400 text-black text-center text-xs sm:text-sm font-semibold py-1.5 px-4">
      DEMO MODE — all payments and activity are simulated. No real money moves.
    </div>
  );
}
