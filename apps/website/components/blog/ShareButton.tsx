'use client';

import React from 'react';
import { Share2 } from 'lucide-react';

interface ShareButtonProps {
  url: string;
  title: string;
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const handleShare = () => {
    const text = encodeURIComponent(`Check out this article on Dineiz: ${title}`);
    const shareUrl = `https://api.whatsapp.com/send?text=${text}%20${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank');
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors text-sm"
    >
      <Share2 size={16} />
      Share on WhatsApp
    </button>
  );
}
