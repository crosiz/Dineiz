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
  | 'kitchen' | 'stock' | 'floor' | 'order' | 'shift-done'
  | 'payment' | 'open-shift' | 'break' | 'lost' | 'error'
  | 'cashier' | 'waiter' | 'rider' | 'manager' | 'on-hold';

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

/** A receipt with notes and coins beside it, ticked. For a payment taken. */
function Payment() {
  const ox = 104, oy = 64;
  const note = (z: number, dx: number, accent = false) => (
    <g key={z}>
      <IsoBox ox={ox + dx} oy={oy} x={0} y={0} w={34} d={18} h={1.6} z={z}
        face={{ top: '#FFF', left: '#E4E9EE', right: '#DDE3E8', stroke: '#C7D1DC' }} />
      {accent && <>
        <polyline points={pts(ox + dx, oy, [[4, 9, z + 1.7], [30, 9, z + 1.7]])} stroke={ACCENT} strokeOpacity=".55" strokeWidth="4" />
        <ellipse cx={isoPoint(ox + dx, oy, 17, 9, z + 1.7)[0]} cy={isoPoint(ox + dx, oy, 17, 9, z + 1.7)[1]} rx="4.5" ry="2.4" fill="#FFF" stroke={ACCENT} strokeOpacity=".6" />
      </>}
    </g>
  );
  const coin = (cy: number) => (
    <g key={cy}>
      <path d={`M129 ${cy}v3c0 2.2 4 4 9 4s9-1.8 9-4v-3`} fill="#E6D7C4" stroke="#D8C9B7" />
      <ellipse cx="138" cy={cy} rx="9" ry="4" fill="#F2E6D7" stroke="#D8C9B7" />
    </g>
  );
  return <>
    {shadow(84, 106, 60, 8)}
    {/* receipt */}
    <path d="m44 24 40 4-3 66-5-3-5 3-5-3-5 3-5-3-5 3-5-3-5 3 1-67Z" fill="#E9EEF2" stroke="#CBD5DF" />
    <path d="M40 18h40v70l-5-3-5 3-5-3-5 3-5-3-5 3-5-3-5 3V18Z" fill="#FFF" stroke="#C7D1DC" />
    <rect x="47" y="28" width="20" height="4.5" rx="2" fill={ACCENT} />
    <path d="M47 41h26M47 49h18M47 57h22M47 74h10m8 0h8" stroke="#CCD5DE" strokeWidth="3" strokeLinecap="round" />
    <path d="M47 66h26" stroke="#D9E1E8" strokeDasharray="3 3" />
    {/* notes and coins */}
    {note(0, 0)}
    {note(2.2, 2)}
    {note(4.4, -1, true)}
    {coin(96)}
    {coin(91)}
    {coin(86)}
    <Check cx={84} cy={22} />
  </>;
}

/** The cash drawer pulled open, notes and coins inside. For opening a shift. */
function OpenShift() {
  const ox = 88, oy = 36;
  const floor = 15.2;
  return <>
    {shadow(84, 101, 56, 8)}
    <IsoBox ox={ox} oy={oy} x={0} y={0} w={60} d={40} h={28} face={COOL} />
    {/* the drawer, out towards the viewer; its top is the open tray */}
    <IsoBox ox={ox} oy={oy} x={4} y={40} w={52} d={26} h={12} z={3} face={{ ...COOL, top: '#DDE3E8' }} />
    {[17, 30, 43].map((x) => (
      <polyline key={x} points={pts(ox, oy, [[x, 40, floor], [x, 66, floor]])} stroke="#B9C5D1" strokeWidth="1.5" />
    ))}
    {/* notes in the first two slots, coins in the last */}
    <polygon points={pts(ox, oy, [[5.5, 42, floor + 0.3], [15.5, 42, floor + 0.3], [15.5, 64, floor + 0.3], [5.5, 64, floor + 0.3]])} fill="#FFF" stroke="#C7D1DC" />
    <polygon points={pts(ox, oy, [[18.5, 42, floor + 0.3], [28.5, 42, floor + 0.3], [28.5, 64, floor + 0.3], [18.5, 64, floor + 0.3]])} fill={ACCENT} fillOpacity=".22" stroke={ACCENT} strokeOpacity=".5" />
    {[[49, 48], [50, 56], [36, 52]].map(([x, y]) => {
      const [cx, cy] = isoPoint(ox, oy, x, y, floor + 1.5);
      return <ellipse key={`${x}-${y}`} cx={cx} cy={cy} rx="4.2" ry="2.3" fill="#F2E6D7" stroke="#D8C9B7" />;
    })}
    <polyline points={pts(ox, oy, [[22, 66, 9], [38, 66, 9]])} stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
  </>;
}

/** Tea on a saucer, steaming. For a terminal on break. */
function Break() {
  return <>
    {shadow(80, 104, 46, 8)}
    <ellipse cx="80" cy="94" rx="42" ry="12" fill="#DDE3E8" />
    <ellipse cx="80" cy="91" rx="42" ry="12" fill="#EEF2F5" stroke="#B9C5D1" />
    <ellipse cx="80" cy="91" rx="27" ry="7" stroke="#DDE3E8" />
    <path d="M103 62c13-3 16 16 1 18" stroke="#CFD8E1" strokeWidth="5" strokeLinecap="round" />
    <path d="M56 58v18c0 9 11 14 24 14s24-5 24-14V58" fill="#FFF" stroke="#C7D1DC" />
    <path d="M56 66v7c0 6 11 10 24 10s24-4 24-10v-7c0 6-11 10-24 10s-24-4-24-10Z" fill={ACCENT} opacity=".85" />
    <ellipse cx="80" cy="58" rx="24" ry="8" fill="#F8FAFC" stroke="#C7D1DC" />
    <ellipse cx="80" cy="59" rx="19.5" ry="5.5" fill="#A99680" />
    <ellipse cx="75" cy="58" rx="7" ry="1.8" fill="#D8C9B7" opacity=".8" />
    <path d="M70 44c-3-3 3-6 0-10M80 41c-3-3 3-6 0-10M90 44c-3-3 3-6 0-10" stroke="#C7D1DC" strokeWidth="2.5" strokeLinecap="round" />
  </>;
}

/** A serving dome lifted off an empty plate. For a page that isn't there. */
function Lost() {
  return <>
    {shadow(80, 106, 54, 8)}
    <ellipse cx="80" cy="96" rx="46" ry="13" fill="#DDE3E8" />
    <ellipse cx="80" cy="93" rx="46" ry="13" fill="#EEF2F5" stroke="#B9C5D1" />
    <ellipse cx="80" cy="93" rx="31" ry="8" fill="#FFF" stroke="#DDE3E8" />
    <g transform="rotate(-14 80 48)">
      <ellipse cx="80" cy="62" rx="37" ry="7.5" fill="#E4E9EE" stroke="#C7D1DC" />
      <path d="M43 62c0-21 16-35 37-35s37 14 37 35c-6 4-20 7.5-37 7.5S49 66 43 62Z" fill="#FFF" stroke="#C7D1DC" />
      <path d="M57 45c4-6 10-10 17-11" stroke="#E8ECF0" strokeWidth="3" strokeLinecap="round" />
      <rect x="78" y="22" width="4" height="6" rx="1.5" fill="#9CA8B6" />
      <ellipse cx="80" cy="21" rx="7" ry="3.2" fill={ACCENT} />
    </g>
  </>;
}

/** A glass knocked over, a small spill. For a screen that failed. */
function Spill() {
  return <>
    {shadow(84, 104, 58, 8)}
    <path d="M58 94c-12 0-18-5-9-9s25-2 36-6 24 2 32 6-3 11-19 11-29-2-40-2Z" fill={ACCENT} fillOpacity=".16" stroke={ACCENT} strokeOpacity=".35" />
    <ellipse cx="120" cy="99" rx="3" ry="1.6" fill={ACCENT} opacity=".4" />
    <ellipse cx="128" cy="96" rx="2" ry="1.2" fill={ACCENT} opacity=".35" />
    {/* the glass, lying on its side, mouth towards the spill */}
    <path d="M44 60 98 66V94L44 83Z" fill="#FFF" stroke="#C7D1DC" strokeLinejoin="round" />
    <ellipse cx="44" cy="71.5" rx="5.5" ry="11.5" fill="#EEF2F5" stroke="#C7D1DC" />
    <ellipse cx="98" cy="80" rx="7.5" ry="14" fill="#F8FAFC" stroke="#C7D1DC" />
    <ellipse cx="98" cy="86" rx="5" ry="7" fill={ACCENT} opacity=".3" />
    <path d="M52 66l38 4" stroke="#E8ECF0" strokeWidth="3" strokeLinecap="round" />
  </>;
}

/** A till: screen, keypad, receipt. For the cashier role. */
function Cashier() {
  const ox = 82, oy = 46, top = 22;
  return <>
    {shadow(86, 97, 56, 8)}
    <IsoBox ox={ox} oy={oy} x={0} y={0} w={56} d={40} h={top} face={COOL} />
    <polyline points={pts(ox, oy, [[0, 40, 9], [56, 40, 9]])} stroke="#B9C5D1" />
    <polyline points={pts(ox, oy, [[20, 40, 5], [36, 40, 5]])} stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
    {/* screen, standing at the back, turned to the cashier */}
    <polyline points={pts(ox, oy, [[8, 18, top], [8, 18, top + 6]])} stroke="#9CA8B6" strokeWidth="3" />
    <polygon points={pts(ox, oy, [[6, 4, top + 26], [6, 32, top + 26], [6, 32, top + 6], [6, 4, top + 6]])} fill="#F8FAFC" stroke="#B9C5D1" strokeLinejoin="round" />
    <polygon points={pts(ox, oy, [[6, 8, top + 22], [6, 28, top + 22], [6, 28, top + 11], [6, 8, top + 11]])} fill={ACCENT} fillOpacity=".14" stroke={ACCENT} strokeOpacity=".45" />
    <polyline points={pts(ox, oy, [[6, 12, top + 17], [6, 22, top + 17]])} stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
    {/* keypad */}
    {[22, 30, 38].flatMap((x) => [8, 16, 24].map((y) => (
      <polygon key={`${x}-${y}`} points={pts(ox, oy, [[x, y, top + 0.5], [x + 6, y, top + 0.5], [x + 6, y + 6, top + 0.5], [x, y + 6, top + 0.5]])}
        fill={x === 38 && y === 24 ? ACCENT : '#FFF'} stroke={x === 38 && y === 24 ? ACCENT : '#C7D1DC'} />
    )))}
    {/* receipt coming out of the printer slot */}
    <polygon points={pts(ox, oy, [[44, 3, top], [53, 3, top], [53, 3, top + 20], [44, 3, top + 20]])} fill="#FFF" stroke="#C7D1DC" />
    <polyline points={pts(ox, oy, [[46, 3, top + 15], [51, 3, top + 15]])} stroke="#CCD5DE" strokeWidth="2" strokeLinecap="round" />
    <polyline points={pts(ox, oy, [[46, 3, top + 10], [51, 3, top + 10]])} stroke="#CCD5DE" strokeWidth="2" strokeLinecap="round" />
  </>;
}

/** A round tray: two glasses and a folded napkin. For the waiter role. */
function Waiter() {
  const glass = (cx: number, topY: number, h: number) => (
    <g>
      <path d={`M${cx - 7} ${topY}v${h}c0 2 3.2 3.2 7 3.2s7-1.2 7-3.2V${topY}`} fill="#FFF" stroke="#C7D1DC" />
      <path d={`M${cx - 5.5} ${topY + h * 0.55}h11`} stroke={ACCENT} strokeOpacity=".35" strokeWidth={h * 0.5} />
      <ellipse cx={cx} cy={topY} rx="7" ry="2.6" fill="#F8FAFC" stroke="#C7D1DC" />
    </g>
  );
  return <>
    {shadow(80, 106, 50, 8)}
    <ellipse cx="80" cy="84" rx="52" ry="17" fill="#CFD8E1" />
    <ellipse cx="80" cy="80" rx="52" ry="17" fill="#EEF2F5" stroke="#B9C5D1" />
    <ellipse cx="80" cy="80" rx="43" ry="12.5" stroke="#DDE3E8" />
    {glass(60, 52, 24)}
    {glass(80, 58, 20)}
    {/* folded napkin */}
    <path d="m94 80 16-7 9 6-16 8-9-7Z" fill={ACCENT} opacity=".85" />
    <path d="m101 83 13-6" stroke="#FFF" strokeOpacity=".7" strokeWidth="1.5" />
  </>;
}

/** A scooter with a delivery box on the back. For the rider role. */
function Rider() {
  const box = { ox: 52, oy: 42 };
  const wheel = (cx: number) => (
    <g>
      <circle cx={cx} cy="94" r="12" fill="#FFF" stroke="#9CA8B6" strokeWidth="4" />
      <circle cx={cx} cy="94" r="3.5" fill="#9CA8B6" />
    </g>
  );
  return <>
    {shadow(84, 108, 58, 6)}
    {/* rear body and seat */}
    <path d="M34 90c0-13 9-20 23-20h24c6 0 9 4 9 10v10H34Z" fill="#EEF2F5" stroke="#B9C5D1" strokeLinejoin="round" />
    <path d="M48 64h26c3 0 4 2 3 5H46c-1-3 0-5 2-5Z" fill="#9CA8B6" />
    {/* deck, front shield, steering column */}
    <rect x="62" y="86" width="44" height="6" rx="3" fill="#CFD8E1" />
    <path d="M102 90 112 58h9l-6 32Z" fill="#DDE3E8" stroke="#B9C5D1" strokeLinejoin="round" />
    <path d="M117 58 121 44" stroke="#9CA8B6" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M113 44h16" stroke="#9CA8B6" strokeWidth="4" strokeLinecap="round" />
    <circle cx="116.5" cy="64" r="2.8" fill={ACCENT} />
    {/* delivery box */}
    <IsoBox ox={box.ox} oy={box.oy} x={0} y={0} w={24} d={24} h={22} face={CARD} />
    <polygon points={pts(box.ox, box.oy, [[24, 6, 15], [24, 18, 15], [24, 18, 7], [24, 6, 7]])} fill={ACCENT} />
    {wheel(48)}
    {wheel(118)}
  </>;
}

/** A clipboard of ticked approvals, and the keys. For the manager role. */
function Manager() {
  const row = (y: number, done: boolean, len: number) => (
    <g key={y}>
      <rect x="58" y={y} width="9" height="9" rx="2" fill={done ? ACCENT : '#FFF'} stroke={done ? ACCENT : '#B9C5D1'} />
      {done && <path d={`M60 ${y + 4.6}l2 2 3.5-4`} stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      <path d={`M73 ${y + 4.5}h${len}`} stroke="#CCD5DE" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  return <>
    {shadow(82, 108, 48, 7)}
    <g transform="rotate(-6 80 62)">
      <path d="M48 22h58a4 4 0 0 1 4 4v74a4 4 0 0 1-4 4H48a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4Z" fill="#E6D7C4" stroke="#D8C9B7" />
      <rect x="51" y="31" width="52" height="68" rx="2" fill="#FFF" stroke="#C7D1DC" />
      <rect x="64" y="16" width="26" height="12" rx="3" fill="#9CA8B6" />
      <rect x="72" y="19" width="10" height="4" rx="2" fill="#EEF2F5" />
      {row(40, true, 24)}
      {row(55, true, 18)}
      {row(70, false, 22)}
    </g>
    {/* keys */}
    <circle cx="122" cy="80" r="9" stroke="#9CA8B6" strokeWidth="4" />
    <path d="M115.5 86.5 101 101m3 1 4 4m0-8 3 3" stroke="#9CA8B6" strokeWidth="4" strokeLinecap="round" />
    <rect x="126" y="62" width="10" height="14" rx="3" transform="rotate(24 131 69)" fill={ACCENT} />
  </>;
}

/** Order slips waiting on the kitchen rail, one paused. For held orders. */
function OnHold() {
  return <>
    {shadow(80, 110, 46, 7)}
    {/* the rail, with its two end brackets */}
    <path d="M30 24v10M130 24v10" stroke="#9CA8B6" strokeWidth="3" strokeLinecap="round" />
    <rect x="26" y="26" width="108" height="7" rx="3.5" fill="#CFD8E1" stroke="#B9C5D1" />
    {/* a slip behind */}
    <path d="M94 33h26v48l-4.3-3-4.3 3-4.4-3-4.3 3-4.4-3-4.3 3V33Z" fill="#E9EEF2" stroke="#CBD5DF" strokeLinejoin="round" />
    <path d="M100 44h14M100 51h10" stroke="#D5DDE5" strokeWidth="2.5" strokeLinecap="round" />
    {/* the held slip in front */}
    <path d="M46 33h42v68l-5.25-3-5.25 3-5.25-3-5.25 3-5.25-3-5.25 3-5.25-3-5.25 3V33Z" fill="#FFF" stroke="#C7D1DC" strokeLinejoin="round" />
    <rect x="53" y="44" width="20" height="4.5" rx="2" fill={ACCENT} />
    <path d="M53 57h28M53 65h20M53 73h24" stroke="#CCD5DE" strokeWidth="3" strokeLinecap="round" />
    <rect x="61" y="23" width="12" height="13" rx="2.5" fill="#9CA8B6" />
    {/* pause badge */}
    <circle cx="90" cy="88" r="12.5" fill={ACCENT} />
    <rect x="84.5" y="81.5" width="3.8" height="13" rx="1.2" fill="#FFF" />
    <rect x="91.7" y="81.5" width="3.8" height="13" rx="1.2" fill="#FFF" />
  </>;
}

export function ServiceIllustration({ kind, className = '' }: { kind: IllustrationKind; className?: string }) {
  const style = { '--illustration-accent': 'var(--pos-primary)' } as CSSProperties;
  return (
    <svg viewBox="0 0 160 128" fill="none" aria-hidden="true" focusable="false" className={className} style={style}>
      {kind === 'kitchen' ? <Kitchen />
        : kind === 'on-hold' ? <OnHold />
        : kind === 'cashier' ? <Cashier />
        : kind === 'waiter' ? <Waiter />
        : kind === 'rider' ? <Rider />
        : kind === 'manager' ? <Manager />
        : kind === 'payment' ? <Payment />
        : kind === 'open-shift' ? <OpenShift />
        : kind === 'break' ? <Break />
        : kind === 'lost' ? <Lost />
        : kind === 'error' ? <Spill />
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
