import { useEffect, useRef } from "react";
import type { AutomaComponentProps } from "@/types/automa";

export function LatticeAutoma({ values, width, height, isPaused }: AutomaComponentProps & { isPaused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    if (isPaused) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = () => {
      timeRef.current += 0.01 * values.pulseSpeed;

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = `rgba(255, 255, 255, ${values.intensity})`;
      ctx.lineWidth = values.thickness;

      const cols = Math.ceil(width / values.spacing) + 1;
      const rows = Math.ceil(height / values.spacing) + 1;

      // Draw vertical lines
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        for (let j = 0; j < rows; j++) {
          const x = i * values.spacing;
          const y = j * values.spacing;

          const wave = Math.sin(timeRef.current + i * 0.5 + j * 0.3) * values.deformation;
          const offsetX = x + wave;
          const offsetY = y + Math.cos(timeRef.current + i * 0.3 + j * 0.5) * values.deformation;

          if (j === 0) {
            ctx.moveTo(offsetX, offsetY);
          } else {
            ctx.lineTo(offsetX, offsetY);
          }
        }
        ctx.stroke();
      }

      // Draw horizontal lines
      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        for (let i = 0; i < cols; i++) {
          const x = i * values.spacing;
          const y = j * values.spacing;

          const wave = Math.sin(timeRef.current + i * 0.5 + j * 0.3) * values.deformation;
          const offsetX = x + wave;
          const offsetY = y + Math.cos(timeRef.current + i * 0.3 + j * 0.5) * values.deformation;

          if (i === 0) {
            ctx.moveTo(offsetX, offsetY);
          } else {
            ctx.lineTo(offsetX, offsetY);
          }
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [values, width, height, isPaused]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: "#0a0a0a" }}
    />
  );
}
