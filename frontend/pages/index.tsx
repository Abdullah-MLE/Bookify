import Link from 'next/link';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Twin from '../components/Twin';

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-white text-black font-sans selection:bg-black selection:text-white overflow-hidden relative">
      {/* Background Robot Face */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'url("/robot.png")',
          backgroundSize: 'cover',
          backgroundPosition: '-20% center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Nav */}
      <nav className="flex-shrink-0 flex justify-between items-center px-10 py-6 border-b border-black z-10 bg-white">
        <h1 className="text-sm font-black tracking-[0.3em] uppercase">AI Summary Maker</h1>
        <SignedIn>
          <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8 border-2 border-black' } }} />
        </SignedIn>
      </nav>

      {/* Body — left hero / right chat */}
      <div className="flex-1 flex min-h-0 z-10">

        {/* Left — Hero (70%) */}
        <div className="w-[70%] flex flex-col justify-center px-20 py-12 relative overflow-hidden">
          <div className="space-y-10 relative z-10">
            <p className="text-xs font-black tracking-[0.4em] uppercase text-black">
              Intelligence in focus
            </p>

            <h2 className="text-7xl font-black tracking-tighter leading-none uppercase">
              Simple summaries.<br />
              Powered by AI.
            </h2>

            <p className="text-black text-lg max-w-md leading-tight font-medium">
              Transform YouTube content into structured insights. Brutalist efficiency meets deep intelligence.
            </p>

            <div className="pt-6">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-12 py-5 bg-black text-white text-xs font-black uppercase tracking-[0.3em] hover:bg-neutral-900 transition-all border-2 border-black">
                    Get Started
                  </button>
                </SignInButton>
              </SignedOut>

              <SignedIn>
                <Link href="/app">
                  <button className="px-12 py-5 bg-black text-white text-xs font-black uppercase tracking-[0.3em] hover:bg-neutral-900 transition-all border-2 border-black flex items-center gap-4">
                    Open Dashboard
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </Link>
              </SignedIn>
            </div>
          </div>

          <footer className="mt-auto pt-12">
            <p className="text-xs font-black tracking-[0.3em] uppercase">© 2026 / CORE SYSTEM</p>
          </footer>
        </div>

        {/* Right — Chat (30%) */}
        <div className="w-[30%] flex flex-col min-h-0 bg-white border-l-2 border-black">
          <Twin />
        </div>
      </div>
    </div>
  );
}
