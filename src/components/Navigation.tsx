'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RecycleIcon } from '@/components/ui/icons';

export default function Navigation() {
  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <RecycleIcon className="h-8 w-8 text-green-600" />
            <span className="text-xl font-bold text-gray-900">WasteChain</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">
              How It Works
            </Link>
            <Link href="#stats" className="text-gray-600 hover:text-gray-900 transition-colors">
              Statistics
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/citizen">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}