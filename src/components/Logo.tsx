
export default function Logo() {
  return (
    <div className="flex flex-col items-center justify-center mb-8 space-y-4">
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-indigo-500/20">
          <img 
            src="/images/Gemini_Generated_Image_8zv1rl8zv1rl8zv1.png" 
            alt="AI Interview Coach Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-pulse"></div>
      </div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
        AI Interview Coach
      </h1>
    </div>
  );
}