import { PALETTE, fade } from "@/theme/palette";

/** The ambient scene: gradient orbs + an animated perspective grid floor. */
export default function NeonBackground({ orbs = true }: { orbs?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {orbs && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              `radial-gradient(1400px 900px at 82% -12%,${fade(PALETTE.purple, 7)},transparent 60%),radial-gradient(1200px 800px at 22% -18%,${fade(PALETTE.cyan, 5)},transparent 60%),radial-gradient(900px 600px at 55% 118%,${fade(PALETTE.green, 4.5)},transparent 60%)`,
          }}
        />
      )}
      <div
        className="grid-floor"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 220,
          backgroundImage:
            `linear-gradient(${fade(PALETTE.green, 9)} 1px,transparent 1px),linear-gradient(90deg,${fade(PALETTE.green, 9)} 1px,transparent 1px)`,
          backgroundSize: "56px 56px",
          transform: "perspective(300px) rotateX(55deg)",
          transformOrigin: "top",
          // Dissolve toward the horizon (the tilted top edge) so it fades into
          // the background instead of ending on a hard, bright grid line.
          WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 22%, transparent 72%)",
          maskImage: "linear-gradient(to top, #000 0%, #000 22%, transparent 72%)",
        }}
      />
    </div>
  );
}
