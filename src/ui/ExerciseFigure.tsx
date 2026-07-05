import type { ReactNode } from "react";

/**
 * Simple local stick-figure illustrations (no hotlinked media).
 * All scenes share a 120x90 viewBox.
 */

const INK = "var(--text-secondary)";
const HI = "var(--accent)";
const WARM = "var(--serious)";

function Scene(props: { children: ReactNode; title: string; size?: number }) {
  const size = props.size ?? 96;
  return (
    <svg
      viewBox="0 0 120 90"
      width={size}
      height={(size * 90) / 120}
      role="img"
      aria-label={props.title}
      className="exercise-figure"
    >
      <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        {props.children}
      </g>
    </svg>
  );
}

const Floor = () => <line x1={6} y1={74} x2={114} y2={74} stroke="var(--grid)" strokeWidth={3} />;
const Head = ({ cx, cy }: { cx: number; cy: number }) => <circle cx={cx} cy={cy} r={6} />;

/** Supine base: head left, knees bent. */
function Lying({ children }: { children?: ReactNode }) {
  return (
    <>
      <Floor />
      <Head cx={16} cy={64} />
      <path d="M23 66 L74 66" />
      <path d="M74 66 L86 48 L100 70" />
      <path d="M30 66 L44 58" /* arm resting */ />
      {children}
    </>
  );
}

function AllFours({ children }: { children?: ReactNode }) {
  return (
    <>
      <Floor />
      <Head cx={28} cy={40} />
      <path d="M35 44 L74 48" /* back */ />
      <path d="M38 46 L36 72" /* arm */ />
      <path d="M74 48 L80 72" /* thigh+shin */ />
      {children}
    </>
  );
}

function Standing({ children, x = 60 }: { children?: ReactNode; x?: number }) {
  return (
    <>
      <Floor />
      <Head cx={x} cy={16} />
      <path d={`M${x} 22 L${x} 50`} />
      <path d={`M${x} 50 L${x - 9} 72`} />
      <path d={`M${x} 50 L${x + 9} 72`} />
      <path d={`M${x} 30 L${x - 12} 42`} />
      <path d={`M${x} 30 L${x + 12} 42`} />
      {children}
    </>
  );
}

function Chair({ x = 62 }: { x?: number }) {
  return (
    <g stroke="var(--baseline)" strokeWidth={3.5}>
      <path d={`M${x} 46 L${x + 26} 46 L${x + 26} 72`} />
      <path d={`M${x + 2} 46 L${x + 2} 72`} />
      <path d={`M${x + 26} 46 L${x + 26} 22`} />
    </g>
  );
}

function Seated({ children }: { children?: ReactNode }) {
  return (
    <>
      <Floor />
      <Chair x={52} />
      <Head cx={62} cy={18} />
      <path d="M62 24 L62 44 L78 46" /* torso to hips on seat */ />
      <path d="M78 46 L78 60 L88 72" />
      <path d="M62 30 L74 36" />
      {children}
    </>
  );
}

function Arrow({ d }: { d: string }) {
  return <path d={d} stroke={HI} strokeWidth={3} markerEnd="url(#arr)" />;
}

function Defs() {
  return (
    <defs>
      <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0 L6,3.5 L0,7 Z" fill={HI} stroke="none" />
      </marker>
    </defs>
  );
}

const SCENES: Record<string, { title: string; body: ReactNode }> = {
  "heat-reset": {
    title: "Lying with heat on the low back",
    body: (
      <Lying>
        <g stroke={WARM} strokeWidth={2.5}>
          <path d="M58 52 q3 -6 0 -12" />
          <path d="M66 52 q3 -6 0 -12" />
          <path d="M74 50 q3 -6 0 -12" />
        </g>
      </Lying>
    ),
  },
  "ice-option": {
    title: "Lying with wrapped ice pack",
    body: (
      <Lying>
        <g stroke={HI} strokeWidth={2.5}>
          <path d="M66 46 l0 -12 M60 40 l12 0 M61 35 l10 10 M71 35 l-10 10" />
        </g>
      </Lying>
    ),
  },
  breathing: {
    title: "Diaphragmatic breathing",
    body: (
      <Lying>
        <circle cx={56} cy={60} r={4} stroke={HI} />
        <Arrow d="M56 50 L56 40" />
      </Lying>
    ),
  },
  "ninety-ninety-rest": {
    title: "90/90 rest with calves on a chair",
    body: (
      <>
        <Floor />
        <Chair x={66} />
        <Head cx={18} cy={68} />
        <path d="M25 70 L62 70" />
        <path d="M62 70 L66 48 L90 44" /* thighs up, calves on seat */ />
      </>
    ),
  },
  "short-walk": { title: "Easy walk", body: <WalkScene /> },
  "walk-progression": { title: "Progressive walk", body: <WalkScene brisk /> },
  "walk-room": { title: "Walk around the room", body: <WalkScene loop /> },
  "pelvic-tilts": {
    title: "Pelvic tilts lying down",
    body: (
      <Lying>
        <Arrow d="M70 56 q8 -4 12 2" />
      </Lying>
    ),
  },
  "cat-cow": {
    title: "Small cat-cow on all fours",
    body: (
      <AllFours>
        <Arrow d="M50 38 q6 -6 14 -2" />
        <Arrow d="M64 58 q-6 6 -14 2" />
      </AllFours>
    ),
  },
  "rock-back": {
    title: "Kneeling rock-back",
    body: (
      <AllFours>
        <Arrow d="M62 40 L82 44" />
      </AllFours>
    ),
  },
  "hip-flexor-opener": {
    title: "Standing hip flexor opener",
    body: (
      <>
        <Floor />
        <Head cx={56} cy={16} />
        <path d="M56 22 L58 48" />
        <path d="M58 48 L44 60 L40 72" /* back leg */ />
        <path d="M58 48 L70 58 L70 72" /* front leg */ />
        <path d="M56 28 L46 40 M56 28 L68 38" />
        <Arrow d="M52 54 L62 50" />
      </>
    ),
  },
  "seated-posture-reset": {
    title: "Seated posture reset",
    body: (
      <Seated>
        <Arrow d="M52 40 q-4 -12 4 -22" />
      </Seated>
    ),
  },
  "direction-check": {
    title: "Direction preference check",
    body: (
      <Standing>
        <Arrow d="M74 34 q10 -6 6 -16" />
        <Arrow d="M42 40 q-8 8 -2 16" />
      </Standing>
    ),
  },
  "abdominal-brace": {
    title: "Abdominal bracing",
    body: (
      <Lying>
        <ellipse cx={58} cy={62} rx={9} ry={5} stroke={HI} />
      </Lying>
    ),
  },
  "glute-squeeze": {
    title: "Glute squeeze",
    body: (
      <Standing>
        <circle cx={60} cy={50} r={6} stroke={HI} />
      </Standing>
    ),
  },
  "desk-glute-squeeze": {
    title: "Glute squeezes at the desk",
    body: (
      <Seated>
        <circle cx={76} cy={46} r={5} stroke={HI} />
      </Seated>
    ),
  },
  clamshell: {
    title: "Clamshell",
    body: (
      <>
        <Floor />
        <Head cx={16} cy={58} />
        <path d="M23 60 L60 64" />
        <path d="M60 64 L74 56 L88 66" /* bottom leg */ />
        <path d="M60 64 L74 42 L88 50" stroke={HI} /* top leg opened */ />
        <Arrow d="M70 52 q4 -8 10 -8" />
      </>
    ),
  },
  "heel-slides": {
    title: "Heel slide",
    body: (
      <Lying>
        <path d="M74 66 L104 70" stroke={HI} />
        <Arrow d="M92 62 L104 62" />
      </Lying>
    ),
  },
  "marching-brace": {
    title: "Marching brace",
    body: (
      <Lying>
        <path d="M74 66 L80 44 L94 50" stroke={HI} />
        <Arrow d="M84 40 L84 30" />
      </Lying>
    ),
  },
  bridge: {
    title: "Hip bridge",
    body: (
      <>
        <Floor />
        <Head cx={18} cy={66} />
        <path d="M25 68 L58 46" /* torso raised */ />
        <path d="M58 46 L74 58 L78 72" />
        <circle cx={58} cy={46} r={5} stroke={HI} />
      </>
    ),
  },
  "bridge-shift": {
    title: "Bridge with weight shift",
    body: (
      <>
        <Floor />
        <Head cx={18} cy={66} />
        <path d="M25 68 L58 46" />
        <path d="M58 46 L74 58 L78 72" />
        <Arrow d="M50 38 L66 38" />
        <Arrow d="M66 32 L50 32" />
      </>
    ),
  },
  "bird-dog-arms": {
    title: "Bird dog, arm reach",
    body: (
      <AllFours>
        <path d="M40 44 L14 36" stroke={HI} />
      </AllFours>
    ),
  },
  "bird-dog-legs": {
    title: "Bird dog, leg reach",
    body: (
      <AllFours>
        <path d="M74 48 L106 40" stroke={HI} />
      </AllFours>
    ),
  },
  "bird-dog-full": {
    title: "Full bird dog",
    body: (
      <AllFours>
        <path d="M40 44 L14 36" stroke={HI} />
        <path d="M74 48 L106 40" stroke={HI} />
      </AllFours>
    ),
  },
  "standing-bird-dog": {
    title: "Standing counter bird dog",
    body: (
      <>
        <Floor />
        <g stroke="var(--baseline)" strokeWidth={3.5}>
          <path d="M20 44 L44 44 L44 72" />
        </g>
        <Head cx={52} cy={22} />
        <path d="M52 28 L56 50" />
        <path d="M52 32 L40 42" /* hands to counter */ />
        <path d="M56 50 L56 72" />
        <path d="M56 50 L86 44" stroke={HI} /* leg reaching back */ />
      </>
    ),
  },
  "dead-bug-arms": {
    title: "Dead bug, arms only",
    body: (
      <Lying>
        <path d="M36 64 L34 40" stroke={HI} />
        <Arrow d="M28 46 q-4 -8 2 -12" />
      </Lying>
    ),
  },
  "dead-bug-heel-taps": {
    title: "Dead bug heel taps",
    body: (
      <Lying>
        <path d="M74 66 L82 46 L96 52" stroke={HI} />
        <Arrow d="M96 56 L100 68" />
      </Lying>
    ),
  },
  "side-plank-mod": {
    title: "Modified side plank on knees",
    body: (
      <>
        <Floor />
        <Head cx={26} cy={36} />
        <path d="M32 42 L66 56 L88 70" /* torso to knees */ />
        <path d="M36 46 L34 72" /* forearm */ />
        <circle cx={58} cy={52} r={5} stroke={HI} />
      </>
    ),
  },
  "sit-to-stand": {
    title: "Sit to stand",
    body: (
      <>
        <Floor />
        <Chair x={58} />
        <Head cx={50} cy={26} />
        <path d="M50 32 L56 48 L66 48" />
        <path d="M66 48 L66 60 L74 72" />
        <Arrow d="M42 42 L38 24" />
      </>
    ),
  },
  "hip-hinge": {
    title: "Hip hinge with flat back",
    body: (
      <>
        <Floor />
        <Head cx={36} cy={34} />
        <path d="M42 38 L66 48" /* flat back */ />
        <path d="M66 48 L62 72" />
        <path d="M66 48 L74 72" />
        <path d="M46 40 L46 56" /* arm hanging */ />
        <Arrow d="M76 40 q6 6 0 14" />
      </>
    ),
  },
  "counter-hinge": {
    title: "Counter-supported hinge",
    body: (
      <>
        <Floor />
        <g stroke="var(--baseline)" strokeWidth={3.5}>
          <path d="M12 42 L36 42 L36 72" />
        </g>
        <Head cx={48} cy={32} />
        <path d="M54 36 L74 46" />
        <path d="M50 36 L38 42" /* hands on counter */ />
        <path d="M74 46 L70 72 M74 46 L82 72" />
        <Arrow d="M84 38 q6 6 0 14" />
      </>
    ),
  },
  "suitcase-carry": {
    title: "Suitcase carry",
    body: (
      <Standing x={56}>
        <path d="M68 42 L68 54" />
        <rect x={62} y={54} width={13} height={10} rx={2} stroke={HI} />
      </Standing>
    ),
  },
  "farmer-carry": {
    title: "Farmer carry",
    body: (
      <Standing x={60}>
        <path d="M48 42 L48 54 M72 42 L72 54" />
        <rect x={42} y={54} width={12} height={10} rx={2} stroke={HI} />
        <rect x={66} y={54} width={12} height={10} rx={2} stroke={HI} />
      </Standing>
    ),
  },
  "standing-pelvic-tilts": {
    title: "Standing pelvic tilts",
    body: (
      <Standing>
        <Arrow d="M70 48 q8 4 2 12" />
      </Standing>
    ),
  },
  "monitor-recenter": {
    title: "Monitor centered in front of chair",
    body: (
      <>
        <Floor />
        <g stroke="var(--baseline)" strokeWidth={3.5}>
          <path d="M20 58 L100 58" /* desk */ />
        </g>
        <rect x={44} y={30} width={32} height={22} rx={2} stroke={HI} />
        <path d="M60 52 L60 58" />
        <Arrow d="M60 70 L60 62" />
      </>
    ),
  },
  "chair-swivel": {
    title: "Swivel the chair, not the spine",
    body: (
      <Seated>
        <Arrow d="M60 82 q16 6 30 -2" />
      </Seated>
    ),
  },
};

function WalkScene({ brisk, loop }: { brisk?: boolean; loop?: boolean }) {
  return (
    <>
      <Floor />
      <Head cx={58} cy={16} />
      <path d="M58 22 L60 48" />
      <path d="M60 48 L48 62 L46 72" />
      <path d="M60 48 L72 60 L78 72" />
      <path d="M58 28 L48 40 M58 28 L70 36" />
      {brisk && (
        <g stroke={HI} strokeWidth={2.5}>
          <path d="M28 30 L38 30 M24 40 L36 40 M28 50 L38 50" />
        </g>
      )}
      {loop && <Arrow d="M88 30 q14 12 -2 24" />}
    </>
  );
}

export function ExerciseFigure(props: { exerciseId: string; alt: string; size?: number }) {
  const scene = SCENES[props.exerciseId];
  return (
    <Scene title={scene?.title ?? props.alt} size={props.size}>
      <Defs />
      {scene ? (
        scene.body
      ) : (
        <Standing>
          <circle cx={60} cy={50} r={4} stroke={HI} />
        </Standing>
      )}
    </Scene>
  );
}
