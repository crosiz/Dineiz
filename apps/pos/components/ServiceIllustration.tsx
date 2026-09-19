import type { CSSProperties, ReactNode } from 'react';

/** Small, locally rendered service drawings. No remote images or downloads. */
//
// One family: a 160×128 canvas, a three-quarter view, white and cool-grey
// surfaces with thin outlines, warm card for anything cardboard, a soft floor
// shadow, and a single touch of the brand colour. dine-in, takeaway and
// tickets were drawn first (Codex); the rest follow the same rules. Boxes,
// floors and tables use the same isometric projection (isoPoint) so every
// scene shares one angle.

export type IllustrationKind =
  | 'dine-in' | 'takeaway' | 'tickets'
  | 'kitchen' | 'stock' | 'floor' | 'order' | 'shift-done';

const ACCENT = 'var(--illustration-accent)';

// Cool surfaces (tops lightest, the face turned away darkest) and warm card.
const COOL = { top: '#EEF2F5', left: '#DDE3E8', right: '#CFD8E1', stroke: '#B9C5D1' };
const CARD = { top: '#F5EEE5', left: '#F2E6D7', right: '#E6D7C4', stroke: '#D8C9B7' };

type Face = { top: string; left: string; right: string; stroke: string };

/** Screen point for an isometric (x, y, z): x runs down-right, y down-left, z up. */
function isoPoint(ox: number, oy: number, x: number, y: number, z: number): [number, number] {
  return [ox + (x - y) * 0.866, oy + (x + y) * 0.5 - z];
}

function pts(ox: number, oy: number, list: Array<[number, number, number]>): string {
  return list.map(([x, y, z]) => isoPoint(ox, oy, x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');
}

/** A box resting on the floor: the two faces towards the viewer, then the top. */
function IsoBox({ ox, oy, x, y, w, d, h, z = 0, face }: {
  ox: number; oy: number; x: number; y: number; w: number; d: number; h: number; z?: number; face: Face;
}) {
  const t = z + h;
  return (
    <g stroke={face.stroke} strokeLinejoin="round">
      <polygon points={pts(ox, oy, [[x, y + d, t], [x + w, y + d, t], [x + w, y + d, z], [x, y + d, z]])} fill={face.left} />
      <polygon points={pts(ox, oy, [[x + w, y, t], [x + w, y + d, t], [x + w, y + d, z], [x + w, y, z]])} fill={face.right} />
      <polygon points={pts(ox, oy, [[x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]])} fill={face.top} />
    </g>
  );
}

function Check({ cx, cy, r = 10 }: { cx: number; cy: number; r?: number }) {
  const s = r / 10;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={ACCENT} />
      <path
        d={`M${cx - 4.5 * s} ${cy + 0.2 * s} l${3 * s} ${3 * s} l${6 * s} ${-6.5 * s}`}
        stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      />
    </g>
  );
}

function shadow(cx: number, cy: number, rx: number, ry: number): ReactNode {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#0F172A" opacity=".05" />;
}

/** A pot on a stove, steaming. For a kitchen with nothing on it. */
function Kitchen() {
  const ox = 80, oy = 42;
  // Pot stands on the middle of the hob.
  const [px, surfaceY] = isoPoint(ox, oy, 30, 24, 28);
  const py = surfaceY - 16;
  return <>
    {shadow(86, 99, 54, 8)}
    <IsoBox ox={ox} oy={oy} x={0} y={0} w={60} d={48} h={28} face={COOL} />
    {/* oven door, and the lit indicator beside it */}
    <polygon points={pts(ox, oy, [[60, 10, 20], [60, 36, 20], [60, 36, 6], [60, 10, 6]])} fill="#DDE3E8" stroke="#B9C5D1" />
    <polyline points={pts(ox, oy, [[60, 14, 17], [60, 32, 17]])} stroke="#9CA8B6" strokeWidth="2.5" strokeLinecap="round" />
    <polygon points={pts(ox, oy, [[60, 40, 24], [60, 45, 24], [60, 45, 21], [60, 40, 21]])} fill={ACCENT} />
    {/* knobs on the front */}
    {[12, 26, 40].map((x) => {
      const [kx, ky] = isoPoint(ox, oy, x, 48, 20);
      return <ellipse key={x} cx={kx} cy={ky} rx="2.8" ry="2.3" fill="#9CA8B6" />;
    })}
    {/* burner ring round the pot's foot */}
    <ellipse cx={px} cy={py + 17} rx="23" ry="10" stroke="#9CA8B6" strokeWidth="1.5" />
    {/* pot */}
    <path d={`M${px - 18} ${py}v12c0 5 8 9 18 9s18-4 18-9V${py}`} fill="#FFF" stroke="#C7D1DC" />
    <ellipse cx={px} cy={py} rx="18" ry="7.5" fill="#F8FAFC" stroke="#C7D1DC" />
    <ellipse cx={px} cy={py + 0.5} rx="13.5" ry="5" fill={ACCENT} opacity=".18" />
    <path d={`M${px - 23} ${py + 4}h5m36 0h5`} stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
    {/* steam */}
    <path
      d={`M${px - 8} ${py - 8}c-3-3 3-6 0-10M${px} ${py - 10}c-3-3 3-6 0-10M${px + 8} ${py - 8}c-3-3 3-6 0-10`}
      stroke="#C7D1DC" strokeWidth="2.5" strokeLinecap="round"
    />
  </>;
}

/** Stacked cartons with a tick. For stock that's all fine. */
function Stock() {
  const ox = 80, oy = 50;
  const tape = (x: number, y: number, w: number, d: number, top: number) => (
    <polyline points={pts(ox, oy, [[x, y + d / 2, top], [x + w, y + d / 2, top]])} stroke="#D8C9B7" strokeWidth="3.5" opacity=".8" />
  );
  return <>
    {shadow(80, 97, 56, 8)}
    <IsoBox ox={ox} oy={oy} x={0} y={0} w={28} d={28} h={24} face={CARD} />
    {tape(0, 0, 28, 28, 24)}
    <IsoBox ox={ox} oy={oy} x={32} y={0} w={28} d={28} h={24} face={CARD} />
    {tape(32, 0, 28, 28, 24)}
    <IsoBox ox={ox} oy={oy} x={0} y={32} w={28} d={28} h={24} face={CARD} />
    {tape(0, 32, 28, 28, 24)}
    <IsoBox ox={ox} oy={oy} x={4} y={4} w={24} d={24} h={20} z={24} face={CARD} />
    {tape(4, 4, 24, 24, 44)}
    <Check cx={120} cy={30} />
  </>;
}

/** A floor seen from above at an angle, with its tables. For an empty floor plan. */
function Floor() {
  const ox = 80, oy = 34;
  const table = (x: number, y: number, busy = false) => {
    const [fx, fy] = isoPoint(ox, oy, x, y, 4);
    const [tx, ty] = isoPoint(ox, oy, x, y, 14);
    return (
      <g key={`${x}-${y}`}>
        <ellipse cx={fx} cy={fy} rx="10" ry="5" fill="#0F172A" opacity=".06" />
        {[[-12, 0], [12, 0], [0, -8], [0, 8]].map(([dx, dy], i) => (
          <ellipse key={i} cx={fx + dx} cy={fy + dy - 2} rx="3.4" ry="2" fill="#EEF2F5" stroke="#B9C5D1" />
        ))}
        <path d={`M${fx} ${fy}V${ty}`} stroke="#9CA8B6" strokeWidth="2.5" />
        <ellipse cx={tx} cy={ty} rx="10" ry="5" fill={busy ? ACCENT : '#FFF'} fillOpacity={busy ? 0.22 : 1} stroke={busy ? ACCENT : '#B9C5D1'} />
      </g>
    );
  };
  return <>
    {shadow(80, 107, 60, 8)}
    <IsoBox ox={ox} oy={oy} x={0} y={0} w={70} d={70} h={4} face={{ ...COOL, top: '#F8FAFC' }} />
    <polyline points={pts(ox, oy, [[35, 0, 4], [35, 70, 4]])} stroke="#E4E9EE" />
    <polyline points={pts(ox, oy, [[0, 35, 4], [70, 35, 4]])} stroke="#E4E9EE" />
    {table(17, 17)}
    {table(53, 17, true)}
    {table(17, 53)}
    {table(53, 53)}
  </>;
}

/** An empty plate on a tray. For an order with nothing on it yet. */
function Order() {
  const ox = 76, oy = 38, top = 5;
  const [cx, cy] = isoPoint(ox, oy, 38, 26, top);
  const [gx, gy] = isoPoint(ox, oy, 12, 10, top);
  const glassTop = gy - 16;
  return <>
    {shadow(90, 102, 58, 8)}
    <IsoBox ox={ox} oy={oy} x={0} y={0} w={80} d={52} h={top} face={COOL} />
    {/* glass, back left */}
    <path d={`M${gx - 7} ${glassTop}v14c0 2 3.6 3.2 7 3.2s7-1.2 7-3.2V${glassTop}`} fill="#FFF" stroke="#C7D1DC" />
    <path d={`M${gx - 5} ${glassTop + 8}h10`} stroke={ACCENT} strokeOpacity=".35" strokeWidth="6" />
    <ellipse cx={gx} cy={glassTop} rx="7" ry="2.6" fill="#F8FAFC" stroke="#C7D1DC" />
    {/* plate */}
    <ellipse cx={cx} cy={cy + 1.5} rx="24" ry="12" fill="#E4E9EE" />
    <ellipse cx={cx} cy={cy} rx="24" ry="12" fill="#FFF" stroke="#C7D1DC" />
    <ellipse cx={cx} cy={cy} rx="15.5" ry="7.5" stroke="#E4E9EE" />
    {/* napkin and cutlery, front right */}
    <polygon points={pts(ox, oy, [[60, 30, top + 0.5], [74, 30, top + 0.5], [74, 46, top + 0.5], [60, 46, top + 0.5]])} fill={ACCENT} opacity=".85" />
    <polyline points={pts(ox, oy, [[57, 35, top + 1.5], [76, 35, top + 1.5]])} stroke="#8C9AA9" strokeWidth="2.2" strokeLinecap="round" />
    <polyline points={pts(ox, oy, [[57, 41, top + 1.5], [76, 41, top + 1.5]])} stroke="#8C9AA9" strokeWidth="2.2" strokeLinecap="round" />
  </>;
}

/** The cash drawer, shut, with a tick. For a closed, settled shift. */
function ShiftDone() {
  const ox = 76, oy = 44;
  const handle = pts(ox, oy, [[22, 40, 8], [38, 40, 8]]);
  return <>
    {shadow(82, 97, 54, 8)}
    <IsoBox ox={ox} oy={oy} x={0} y={0} w={60} d={40} h={26} face={COOL} />
    {/* drawer seam and handle */}
    <polyline points={pts(ox, oy, [[0, 40, 14], [60, 40, 14]])} stroke="#B9C5D1" />
    <polyline points={handle} stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
    {/* notes on top */}
    <polygon points={pts(ox, oy, [[10, 8, 26.5], [38, 8, 26.5], [38, 24, 26.5], [10, 24, 26.5]])} fill="#FFF" stroke="#C7D1DC" />
    <polygon points={pts(ox, oy, [[14, 12, 28], [42, 12, 28], [42, 28, 28], [14, 28, 28]])} fill={ACCENT} fillOpacity=".16" stroke={ACCENT} strokeOpacity=".5" />
    <Check cx={128} cy={28} r={11} />
  </>;
}

export function ServiceIllustration({ kind, className = '' }: { kind: IllustrationKind; className?: string }) {
  const style = { '--illustration-accent': 'var(--pos-primary)' } as CSSProperties;
  return (
    <svg viewBox="0 0 160 128" fill="none" aria-hidden="true" focusable="false" className={className} style={style}>
      {kind === 'kitchen' ? <Kitchen />
        : kind === 'stock' ? <Stock />
        : kind === 'floor' ? <Floor />
        : kind === 'order' ? <Order />
        : kind === 'shift-done' ? <ShiftDone />
        : kind === 'dine-in' ? <>
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
