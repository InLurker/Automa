import { useEffect, useRef } from "react";
import type { AutomaComponentProps } from "@/types/automa";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export function DriftAutoma({ values, width, height, isPaused }: AutomaComponentProps & { isPaused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  // Initialize particles when density changes
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < values.density; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        life: Math.random(),
      });
    }
    particlesRef.current = particles;
  }, [values.density, width, height]);

  // Animation loop
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

    const resetParticle = (p: Particle) => {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
      p.vx = 0;
      p.vy = 0;
      p.life = Math.random();
    };

    const animate = () => {
      ctx.fillStyle = "rgba(10, 10, 10, 0.1)";
      ctx.fillRect(0, 0, width, height);

      const dirRad = (values.direction * Math.PI) / 180;
      const noiseAmount = values.noise / 100;

      particlesRef.current.forEach((p) => {
        p.vx = Math.cos(dirRad) * values.speed + (Math.random() - 0.5) * noiseAmount * 2;
        p.vy = Math.sin(dirRad) * values.speed + (Math.random() - 0.5) * noiseAmount * 2;

        p.x += p.vx;
        p.y += p.vy;
        p.life += 0.001;

        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || p.life > 1) {
          resetParticle(p);
        }

        const alpha = values.intensity * (1 - p.life);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, values.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [values, width, height, isPaused]);

  // Pause when hidden
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
