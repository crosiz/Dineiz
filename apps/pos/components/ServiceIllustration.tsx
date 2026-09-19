import type { CSSProperties } from 'react';

/** Small, locally rendered service drawings. No remote images or downloads. */
export function ServiceIllustration({ kind, className = '' }: { kind: 'dine-in' | 'takeaway' | 'tickets'; className?: string }) {
  const style = { '--illustration-accent': 'var(--pos-primary)' } as CSSProperties;
  return (
    <svg viewBox="0 0 160 128" fill="none" aria-hidden="true" focusable="false" className={className} style={style}>
      {kind === 'dine-in' ? <>
        <ellipse cx="80" cy="108" rx="55" ry="10" fill="#0F172A" opacity=".05" />
        <path d="M76 71h8v34l-4 3-4-3V71Z" fill="#9CA8B6" />
        <path d="m55 109 25-10 25 10-25 6-25-6Z" fill="#CBD3DC" />
        <path d="M25 53c0-17 25-30 55-30s55 13 55 30v7c0 17-25 30-55 30S25 77 25 60v-7Z" fill="#DDE3E8" />
        <ellipse cx="80" cy="53" rx="55" ry="30" fill="#FFF" stroke="#C7D1DC" />
        <ellipse cx="80" cy="53" rx="43" ry="22" stroke="#E8ECF0" />
        <ellipse cx="64" cy="51" rx="17" ry="9" fill="#F8FAFC" stroke="#CDD6DF" />
        <ellipse cx="64" cy="51" rx="11" ry="5" stroke="#DEE5EC" />
        <ellipse cx="100" cy="57" rx="13" ry="7" fill="var(--illustration-accent)" opacity=".12" />
        <path d="m97 36 7 3-1 14-7-3 1-14Z" fill="var(--illustration-accent)" opacity=".8" />
        <path d="m43 46 10 5m-9-7 10 5m-10-1 9 4m33 10 12 6" stroke="#8C9AA9" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 75v12c0 7 10 12 22 12s22-5 22-12V75" fill="#CFD8E1" />
        <ellipse cx="33" cy="75" rx="22" ry="12" fill="#EEF2F5" stroke="#B9C5D1" />
        <path d="m17 89-2 16m35-16 2 16" stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
        <path d="M111 79v9c0 6 8 11 19 11s19-5 19-11v-9" fill="#CFD8E1" />
        <ellipse cx="130" cy="79" rx="19" ry="11" fill="#EEF2F5" stroke="#B9C5D1" />
        <path d="m116 93-1 12m28-12 2 12" stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
      </> : kind === 'takeaway' ? <>
        <ellipse cx="82" cy="110" rx="49" ry="9" fill="#0F172A" opacity=".05" />
        <path d="m45 36 57-7 17 16-57 9-17-18Z" fill="#F2E6D7" stroke="#D8C9B7" />
        <path d="m45 36-5 66 63 12-1-85-57 7Z" fill="#F5EEE5" stroke="#D8C9B7" />
        <path d="m102 29 17 16 5 59-21 10-1-85Z" fill="#E6D7C4" stroke="#D8C9B7" />
        <path d="M60 39V26c0-15 25-16 25-1v12" stroke="#A99680" strokeWidth="3" strokeLinecap="round" />
        <path d="m61 67 27 3v24l-27-4V67Z" fill="var(--illustration-accent)" />
        <path d="m68 79 5 5 8-9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m30 89 30 5-5 23-24-4-1-24Z" fill="white" stroke="#C7D1DC" />
        <path d="m27 88 36 5-1 6-36-5 1-6Z" fill="#D6DEE6" />
        <path d="m40 87 4-14" stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
      </> : <>
        <ellipse cx="80" cy="111" rx="43" ry="8" fill="#0F172A" opacity=".05" />
        <path d="m49 26 61 7-6 80-7-6-7 5-7-6-7 5-7-6-7 5-7-6-8 4 2-82Z" fill="#E9EEF2" stroke="#CBD5DF" />
        <path d="M45 15h62v91l-8-5-8 5-8-5-8 5-8-5-8 5-7-5-7 5V15Z" fill="white" stroke="#C7D1DC" />
        <rect x="56" y="29" width="25" height="5" rx="2" fill="var(--illustration-accent)" />
        <path d="M56 46h40M56 56h29M56 66h35M56 82h13m13 0h14" stroke="#CCD5DE" strokeWidth="3" strokeLinecap="round" />
        <path d="M55 73h41" stroke="#D9E1E8" strokeDasharray="3 3" />
      </>}
    </svg>
  );
}
