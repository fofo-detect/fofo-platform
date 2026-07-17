// Generative wireframe face mesh (CSS/SVG only, no Three.js) - rows of nodes
// tapered to a rough face silhouette (wide at eye level, narrow at forehead
// and chin), each node linked to its row-neighbors and proportionally to the
// nearest node in the row below, so the mesh reads as a triangulated wireframe
// without hand-authoring every coordinate.

interface Node {
  x: number;
  y: number;
}

interface Row {
  y: number;
  halfWidth: number;
  cols: number;
}

const CENTER_X = 160;

const ROWS: Row[] = [
  { y: 40, halfWidth: 55, cols: 5 },
  { y: 88, halfWidth: 85, cols: 7 },
  { y: 138, halfWidth: 96, cols: 8 },
  { y: 190, halfWidth: 92, cols: 8 },
  { y: 240, halfWidth: 78, cols: 7 },
  { y: 288, halfWidth: 56, cols: 6 },
  { y: 328, halfWidth: 30, cols: 4 },
];

function buildRowNodes(row: Row): Node[] {
  if (row.cols === 1) return [{ x: CENTER_X, y: row.y }];
  return Array.from({ length: row.cols }, (_, i) => {
    const t = (i / (row.cols - 1)) * 2 - 1; // -1..1
    return { x: CENTER_X + t * row.halfWidth, y: row.y };
  });
}

const NODE_ROWS: Node[][] = ROWS.map(buildRowNodes);

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function buildEdges(): Edge[] {
  const edges: Edge[] = [];

  NODE_ROWS.forEach((row) => {
    for (let i = 0; i < row.length - 1; i++) {
      edges.push({ x1: row[i].x, y1: row[i].y, x2: row[i + 1].x, y2: row[i + 1].y });
    }
  });

  for (let r = 0; r < NODE_ROWS.length - 1; r++) {
    const rowA = NODE_ROWS[r];
    const rowB = NODE_ROWS[r + 1];
    rowA.forEach((node, i) => {
      const targetIndex = rowB.length === 1 ? 0 : Math.round((i / (rowA.length - 1)) * (rowB.length - 1));
      const target = rowB[targetIndex];
      edges.push({ x1: node.x, y1: node.y, x2: target.x, y2: target.y });
      const neighborIndex = targetIndex + 1;
      if (neighborIndex < rowB.length) {
        edges.push({ x1: node.x, y1: node.y, x2: rowB[neighborIndex].x, y2: rowB[neighborIndex].y });
      }
    });
  }

  return edges;
}

const EDGES = buildEdges();
const ALL_NODES = NODE_ROWS.flat();

export function FaceMeshVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(0,194,255,0.16),transparent_65%)] blur-2xl" />

      <svg viewBox="0 0 320 380" className="relative h-full w-full overflow-visible">
        <defs>
          <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00c2ff" stopOpacity="0" />
            <stop offset="50%" stopColor="#00c2ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00c2ff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="faceClip">
            <ellipse cx="160" cy="190" rx="150" ry="180" />
          </clipPath>
        </defs>

        <ellipse
          cx="160"
          cy="190"
          rx="145"
          ry="175"
          fill="none"
          stroke="#00c2ff"
          strokeOpacity="0.18"
          strokeWidth="1"
        />

        <g stroke="#00c2ff" strokeOpacity="0.35" strokeWidth="0.75">
          {EDGES.map((edge, i) => (
            <line key={i} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} />
          ))}
        </g>

        <g fill="#00c2ff">
          {ALL_NODES.map((node, i) => (
            <circle
              key={i}
              cx={node.x}
              cy={node.y}
              r="2.4"
              className="animate-mesh-pulse"
              style={{ animationDelay: `${(i % 12) * 0.15}s` }}
            />
          ))}
        </g>

        <g clipPath="url(#faceClip)">
          <rect x="0" y="0" width="320" height="26" fill="url(#scanGradient)" className="animate-scan-sweep" />
        </g>
      </svg>

      <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-[#00c2ff]/40 bg-[#00c2ff]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#7fe0ff]">
        System Active
      </div>
      <div className="absolute bottom-8 left-0 flex items-center gap-1.5 rounded-full border border-[#00c2ff]/40 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#7fe0ff] backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00c2ff]" />
        Scan Running
      </div>
      <div className="absolute bottom-8 right-0 rounded-full border border-[#00c2ff]/40 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#7fe0ff] backdrop-blur">
        Signal Encrypted
      </div>
    </div>
  );
}
