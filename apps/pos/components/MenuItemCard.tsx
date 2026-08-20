const THEMES: Record<string, { gradient: string; emoji: string }> = {
  'kabab':      { gradient: 'linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)', emoji: '🍢' },
  'bbq':        { gradient: 'linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)', emoji: '🍖' },
  'grill':      { gradient: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', emoji: '🥩' },
  'karahi':     { gradient: 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)', emoji: '🥘' },
  'handi':      { gradient: 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)', emoji: '🍲' },
  'curry':      { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🍛' },
  'biryani':    { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🍛' },
  'rice':       { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🍚' },
  'pulao':      { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🥘' },
  'burger':     { gradient: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)', emoji: '🍔' },
  'sandwich':   { gradient: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)', emoji: '🥪' },
  'pizza':      { gradient: 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)', emoji: '🍕' },
  'pasta':      { gradient: 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)', emoji: '🍝' },
  'drink':      { gradient: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', emoji: '🥤' },
  'beverage':   { gradient: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', emoji: '🧃' },
  'lassi':      { gradient: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', emoji: '🥛' },
  'juice':      { gradient: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', emoji: '🧃' },
  'water':      { gradient: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', emoji: '💧' },
  'dessert':    { gradient: 'linear-gradient(135deg, #F3E8FF 0%, #DDD6FE 100%)', emoji: '🍰' },
  'sweet':      { gradient: 'linear-gradient(135deg, #F3E8FF 0%, #DDD6FE 100%)', emoji: '🍮' },
  'bread':      { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🍞' },
  'naan':       { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🫓' },
  'roti':       { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🫓' },
  'paratha':    { gradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', emoji: '🫓' },
  'soup':       { gradient: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', emoji: '🥣' },
  'salad':      { gradient: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', emoji: '🥗' },
  'appetizer':  { gradient: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)', emoji: '🥟' },
  'starter':    { gradient: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)', emoji: '🍤' },
  'side':       { gradient: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)', emoji: '🍟' },
  'platter':    { gradient: 'linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)', emoji: '🍱' },
  'deal':       { gradient: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)', emoji: '🏷️' },
  'default':    { gradient: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)', emoji: '🍽️' },
}

function getTheme(categoryName: string = '') {
  const name = categoryName.toLowerCase()
  for (const [key, theme] of Object.entries(THEMES)) {
    if (key !== 'default' && name.includes(key)) return theme
  }
  return THEMES.default
}

export type ViewMode = 'grid' | 'compact' | 'large' | 'detailed' | 'minimal';

interface MenuItemCardProps {
  item: {
    id: string
    name: string
    basePrice: number
    image?: string | null
    categoryName?: string
    isAvailable?: boolean
    variations?: any[]
    addOns?: any[]
  }
  cartQty: number
  onTap: (item: any) => void
  viewMode?: ViewMode
  /** When provided, renders an 86/restore toggle a cashier can tap without opening the item. */
  onToggleAvailable?: (item: any, nextAvailable: boolean) => void
  isTogglingAvailable?: boolean
}

export function MenuItemCard({ item, cartQty, onTap, viewMode = 'grid', onToggleAvailable, isTogglingAvailable }: MenuItemCardProps) {
  const theme = getTheme(item.categoryName || '');
  const unavailable = item.isAvailable === false;
  const hasOptions = (item.variations && item.variations.length > 0) || (item.addOns && item.addOns.length > 0);

  const isCompact = viewMode === 'compact';
  const isLarge = viewMode === 'large';
  const isDetailed = viewMode === 'detailed';
  const isMinimal = viewMode === 'minimal';

  // Rendered inline (not absolutely positioned) next to each layout's price/options
  // row, so it never collides with the SPICY/POPULAR/cart-qty corner badges.
  // Uses a div with role="button" rather than a real <button> because every
  // layout's outer card is itself a <button> — nesting <button> inside <button>
  // is invalid HTML and breaks hydration.
  const availabilityToggle = onToggleAvailable ? (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={isTogglingAvailable}
      onClick={(e) => { e.stopPropagation(); if (!isTogglingAvailable) onToggleAvailable(item, unavailable); }}
      onKeyDown={(e) => {
        if (isTogglingAvailable) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleAvailable(item, unavailable); }
      }}
      title={unavailable ? 'Mark available' : 'Mark sold out (86)'}
      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${isTogglingAvailable ? 'opacity-50 pointer-events-none' : 'cursor-pointer'} ${unavailable ? 'bg-[#0F172A] border-[#0F172A] text-white hover:brightness-125' : 'bg-white border-[#E2E8F0] text-[#94A3B8] hover:text-[#DC2626] hover:border-[#F5C6C2]'}`}
    >
      <span className="material-symbols-outlined text-[13px]">
        {isTogglingAvailable ? 'hourglass_top' : unavailable ? 'restart_alt' : 'block'}
      </span>
    </div>
  ) : null;

  // --- DETAILED (SHOWCASE) STYLE ---
  if (isDetailed) {
    return (
      <button data-testid="menu-item"
        onClick={() => !unavailable && onTap(item)}
        disabled={unavailable}
        className={`bg-white border rounded-2xl overflow-hidden group transition flex flex-row h-[140px] items-stretch w-full text-left focus:outline-none shadow-sm hover:shadow-lg hover:-translate-y-1 ${cartQty > 0 ? 'border-[var(--pos-primary,#F59E0B)] ring-1 ring-[var(--pos-primary,#F59E0B)] bg-amber-50/50' : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'} ${unavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="w-[140px] shrink-0 relative overflow-hidden bg-[#F8FAFC] border-r border-[#E2E8F0]">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full flex items-center justify-center select-none font-bold" style={{ background: theme.gradient }}>
              <span className="text-[54px] drop-shadow-md">{theme.emoji}</span>
            </div>
          )}
          {unavailable && <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center"><span className="text-white text-[10px] font-bold border border-white/20 px-2 py-0.5 rounded rotate-[-12deg] tracking-widest">SOLD OUT</span></div>}
        </div>

        <div className="flex-1 p-4 flex flex-col justify-between min-w-0 relative">
          <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
            {cartQty > 0 && (
              <div className="w-6 h-6 bg-[var(--pos-primary,#F59E0B)] text-white rounded-full flex items-center justify-center font-bold text-[11px] shadow-md">
                {cartQty}
              </div>
            )}
          </div>

          <div className="pr-10">
            <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest mb-1 truncate flex items-center gap-1.5">
              <span className="opacity-70 text-[12px]">{theme.emoji}</span> {item.categoryName || 'GENERAL'}
            </p>
            <h3 className="text-[#0F172A] font-semibold text-[18px] leading-tight line-clamp-2">
              {item.name}
            </h3>
          </div>

          <div className="flex justify-between items-end mt-auto">
            <p className="text-[#D97706] font-bold text-[16px] tracking-tight">
              PKR {item.basePrice.toLocaleString('en-PK')}
            </p>
            <div className="flex items-center gap-2">
              {hasOptions && !unavailable && (
                <span className="bg-[#F1F5F9] text-[#475569] text-[9px] font-bold px-2 py-1 rounded-md tracking-wider border border-[#CBD5E1]">
                  OPTIONS
                </span>
              )}
              {availabilityToggle}
            </div>
          </div>
        </div>
      </button>
    );
  }

  // --- MINIMAL STYLE ---
  if (isMinimal) {
    return (
      <button data-testid="menu-item"
        onClick={() => !unavailable && onTap(item)}
        disabled={unavailable}
        className={`bg-white border rounded-xl overflow-hidden group transition flex flex-row items-center p-2 gap-3 relative w-full text-left focus:outline-none hover:bg-[#F8FAFC] shadow-sm h-[68px] ${cartQty > 0 ? 'border-[var(--pos-primary,#F59E0B)] bg-amber-50/50 ring-1 ring-[var(--pos-primary,#F59E0B)]/30' : 'border-[#E2E8F0]'} ${unavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="w-11 h-11 rounded-full shrink-0 overflow-hidden relative shadow-inner border border-[#E2E8F0]">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: theme.gradient }}>
              <span className="text-[20px] drop-shadow-md">{theme.emoji}</span>
            </div>
          )}
          {unavailable && <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="text-[#0F172A] font-semibold text-[14px] leading-tight truncate">
              {item.name}
            </h3>
            {hasOptions && !unavailable && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] shrink-0" title="Has Options" />
            )}
          </div>
          <p className="text-[#D97706] font-bold text-[13px] tracking-tight truncate">
            PKR {item.basePrice.toLocaleString('en-PK')}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 pr-1">
          {availabilityToggle}
          {cartQty > 0 && (
            <div className="w-6 h-6 bg-[var(--pos-primary,#F59E0B)] text-white rounded-full flex items-center justify-center font-bold text-[12px] shadow-sm">
              {cartQty}
            </div>
          )}
        </div>
      </button>
    );
  }

  // --- LARGE (HERO) STYLE ---
  if (isLarge) {
    return (
      <button data-testid="menu-item"
        onClick={() => !unavailable && onTap(item)}
        disabled={unavailable}
        className={`border rounded-2xl overflow-hidden group transition flex flex-col h-[220px] sm:h-[260px] relative w-full text-left focus:outline-none shadow-md hover:shadow-xl hover:-translate-y-1 ${cartQty > 0 ? 'border-[var(--pos-primary,#F59E0B)] ring-2 ring-[var(--pos-primary,#F59E0B)]/50' : 'border-[#E2E8F0] bg-white'} ${unavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* Background Image / Gradient */}
        <div className="absolute inset-0 z-0">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center select-none font-bold" style={{ background: theme.gradient }}>
              <span className="text-[64px] drop-shadow-md">{theme.emoji}</span>
            </div>
          )}
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 z-20 flex justify-end items-start">
          {cartQty > 0 && (
            <div className="w-7 h-7 bg-[var(--pos-primary,#F59E0B)] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
              {cartQty}
            </div>
          )}
        </div>

        {/* Content at Bottom */}
        <div className="relative z-20 mt-auto p-4 w-full">
          <p className="text-[11px] text-slate-200 uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5 drop-shadow-sm">
            {theme.emoji} {item.categoryName || 'GENERAL'}
          </p>
          <h3 className="text-white font-semibold text-[18px] leading-tight line-clamp-2 drop-shadow-md mb-2">
            {item.name}
          </h3>
          <div className="flex justify-between items-end">
            <p className="text-amber-300 font-bold text-[16px] drop-shadow-md">
              PKR {item.basePrice.toLocaleString('en-PK')}
            </p>
            <div className="flex items-center gap-2">
              {hasOptions && !unavailable && (
                <span className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold px-2 py-1 rounded-md tracking-wide">
                  OPTIONS
                </span>
              )}
              {availabilityToggle}
            </div>
          </div>
        </div>
        
        {unavailable && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px]">
            <span className="bg-black/80 text-white text-sm font-bold border border-white/20 px-4 py-1.5 rounded rotate-[-12deg] shadow-2xl tracking-widest">SOLD OUT</span>
          </div>
        )}
      </button>
    );
  }

  // --- COMPACT (LIST) STYLE ---
  if (isCompact) {
    return (
      <button data-testid="menu-item"
        onClick={() => !unavailable && onTap(item)}
        disabled={unavailable}
        className={`border rounded-xl overflow-hidden group transition flex flex-row h-[76px] items-center w-full text-left focus:outline-none shadow-sm hover:shadow-md hover:-translate-y-0.5 ${cartQty > 0 ? 'border-[var(--pos-primary,#F59E0B)] bg-amber-50/50' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'} ${unavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="w-[76px] h-full shrink-0 relative p-1.5">
          <div className="w-full h-full rounded-lg overflow-hidden relative shadow-inner">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: theme.gradient }}>
                <span className="text-[28px] drop-shadow-md">{theme.emoji}</span>
              </div>
            )}
            {unavailable && <div className="absolute inset-0 bg-black/50" />}
          </div>
        </div>

        <div className="px-3 py-2 flex-1 min-w-0 flex flex-col justify-center h-full">
          <div className="flex justify-between items-start mb-0.5">
            <h3 className="text-[#0F172A] font-semibold text-[15px] leading-tight line-clamp-1 pr-2">
              {item.name}
            </h3>
            {cartQty > 0 && (
              <div className="w-5 h-5 bg-[var(--pos-primary,#F59E0B)] text-white rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">
                {cartQty}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-[#D97706] font-bold text-[14px]">
              PKR {item.basePrice.toLocaleString('en-PK')}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasOptions && !unavailable && (
                <span className="bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide">
                  OPTIONS
                </span>
              )}
              {availabilityToggle}
            </div>
          </div>
        </div>
      </button>
    );
  }

  // --- GRID STYLE (DEFAULT) ---
  return (
    <button data-testid="menu-item"
      onClick={() => !unavailable && onTap(item)}
      disabled={unavailable}
      className={`bg-white border rounded-xl overflow-hidden group transition flex flex-col h-[220px] sm:h-[240px] relative w-full text-left focus:outline-none hover:shadow-lg hover:-translate-y-1 ${cartQty > 0 ? 'border-[var(--pos-primary,#F59E0B)] ring-1 ring-[var(--pos-primary,#F59E0B)]' : 'border-[#E2E8F0]'} ${unavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Badge Area */}
      {!unavailable && cartQty > 0 && (
        <div className="absolute top-2 right-2 z-10 w-7 h-7 bg-[var(--pos-primary,#F59E0B)] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">
          {cartQty}
        </div>
      )}

      {/* SOLD OUT overlay */}
      {unavailable && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <span className="bg-black/80 text-white text-xs font-bold border border-white/20 px-3 py-1 rounded rotate-[-12deg] tracking-widest">SOLD OUT</span>
        </div>
      )}

      {/* IMAGE AREA (55%) */}
      <div className="h-[55%] shrink-0 w-full relative overflow-hidden bg-[#F8FAFC] border-b border-[#E2E8F0]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className={`w-full h-full object-cover ${!unavailable ? 'group-hover:scale-105' : ''} transition-transform duration-500`}
            onError={e => {
              e.currentTarget.style.display = 'none';
              const fb = e.currentTarget.nextElementSibling as HTMLElement;
              if (fb) fb.style.display = 'flex';
            }}
          />
        ) : null}

        {/* Gradient + Emoji Fallback */}
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-1 select-none font-bold"
          style={{
            display: item.image ? 'none' : 'flex',
            background: theme.gradient,
          }}
        >
          <span style={{ fontSize: '42px', lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }}>{theme.emoji}</span>
        </div>
      </div>

      {/* DETAILS (45%) */}
      <div className="h-[45%] p-3 sm:p-4 flex flex-col w-full bg-white group-hover:bg-[#F8FAFC] transition-colors justify-between">
        <div>
          <p className="text-[9px] sm:text-[10px] text-[#64748B] uppercase font-bold tracking-widest mb-1 truncate flex items-center gap-1">
            <span className="opacity-70">{theme.emoji}</span> {item.categoryName || 'GENERAL'}
          </p>
          <h3 className="text-[#0F172A] font-semibold text-[13px] sm:text-[15px] leading-tight line-clamp-2">
            {item.name}
          </h3>
        </div>
        <div className="flex justify-between items-end mt-auto">
          <div className="bg-[#F8FAFC] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md border border-[#E2E8F0]">
            <p className="text-[#D97706] font-bold text-[12px] sm:text-[13px] tracking-tight">
              PKR {item.basePrice.toLocaleString('en-PK')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {hasOptions && !unavailable && (
              <span className="bg-[#F1F5F9] text-[#475569] text-[9px] font-bold px-1.5 py-1 rounded-md tracking-wider border border-[#CBD5E1]">
                OPTIONS
              </span>
            )}
            {availabilityToggle}
          </div>
        </div>
      </div>
    </button>
  );
}
