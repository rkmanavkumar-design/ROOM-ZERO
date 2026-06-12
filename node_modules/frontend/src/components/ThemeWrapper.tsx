'use client';

import React, { useEffect, useRef } from 'react';

export type ThemeType = 'space' | 'ocean' | 'arcade' | 'sakura' | 'carnival';

interface ThemeWrapperProps {
  theme: ThemeType;
  children: React.ReactNode;
}

export default function ThemeWrapper({ theme, children }: ThemeWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];
    const maxParticles = 60;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle Factory
    class Particle {
      x: number = 0;
      y: number = 0;
      size: number = 0;
      speedX: number = 0;
      speedY: number = 0;
      color: string = '';
      opacity: number = 0;
      angle: number = 0;
      spin: number = 0;

      constructor() {
        this.reset();
        // Start particles randomly placed on screen initially
        this.y = Math.random() * canvas!.height;
      }

      reset() {
        this.x = Math.random() * canvas!.width;
        this.opacity = Math.random() * 0.5 + 0.2;

        if (theme === 'space') {
          this.y = Math.random() * canvas!.height;
          this.size = Math.random() * 2 + 0.5;
          this.speedX = (Math.random() - 0.5) * 0.1;
          this.speedY = -Math.random() * 0.15 - 0.05;
          this.color = `rgba(255, 255, 255, ${this.opacity})`;
        } else if (theme === 'ocean') {
          this.y = canvas!.height + Math.random() * 100;
          this.size = Math.random() * 6 + 2;
          this.speedX = (Math.random() - 0.5) * 0.3;
          this.speedY = -Math.random() * 1.2 - 0.4;
          this.color = `rgba(6, 182, 212, ${this.opacity * 0.6})`;
        } else if (theme === 'arcade') {
          this.y = -Math.random() * 100;
          this.size = Math.random() * 4 + 2;
          this.speedX = 0;
          this.speedY = Math.random() * 2 + 1;
          // Emerald green or pink retro bits
          const isGreen = Math.random() > 0.5;
          this.color = isGreen ? `rgba(16, 185, 129, ${this.opacity})` : `rgba(236, 72, 153, ${this.opacity})`;
        } else if (theme === 'sakura') {
          this.y = -Math.random() * 100;
          this.size = Math.random() * 8 + 4;
          this.speedX = Math.random() * 1 + 0.5;
          this.speedY = Math.random() * 0.8 + 0.5;
          this.angle = Math.random() * 360;
          this.spin = (Math.random() - 0.5) * 0.02;
          this.color = `rgba(244, 114, 182, ${this.opacity * 0.8})`;
        } else if (theme === 'carnival') {
          this.y = -Math.random() * 100;
          this.size = Math.random() * 6 + 3;
          this.speedX = (Math.random() - 0.5) * 1.5;
          this.speedY = Math.random() * 2 + 1.5;
          this.angle = Math.random() * 360;
          this.spin = (Math.random() - 0.5) * 0.1;
          const colors = ['#f59e0b', '#ec4899', '#f97316', '#3b82f6', '#10b981'];
          this.color = colors[Math.floor(Math.random() * colors.length)];
        }
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (theme === 'sakura' || theme === 'carnival') {
          this.angle += this.spin;
        }

        // Boundary Checks
        if (theme === 'ocean') {
          if (this.y < -20 || this.x < -20 || this.x > canvas!.width + 20) {
            this.reset();
            this.y = canvas!.height + 10;
          }
        } else if (theme === 'space') {
          if (this.y < -20) {
            this.reset();
            this.y = canvas!.height + 10;
          }
        } else {
          // Falling styles (arcade, sakura, carnival)
          if (this.y > canvas!.height + 20 || this.x > canvas!.width + 20 || this.x < -20) {
            this.reset();
          }
        }
      }

      draw() {
        if (!ctx) return;

        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = theme === 'arcade' || theme === 'space' ? 6 : 0;
        ctx.shadowColor = this.color;

        if (theme === 'space') {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme === 'ocean') {
          // Bubble outlines
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.strokeStyle = this.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Highlight inside bubble
          ctx.beginPath();
          ctx.arc(this.x - this.size / 3, this.y - this.size / 3, this.size / 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fill();
        } else if (theme === 'arcade') {
          // Square pixels
          ctx.fillRect(this.x, this.y, this.size, this.size);
        } else if (theme === 'sakura') {
          // Petal shapes (rotated ellipses)
          ctx.translate(this.x, this.y);
          ctx.rotate(this.angle);
          ctx.beginPath();
          // Draw a curved petal shape
          ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme === 'carnival') {
          // Spinning rectangular confetti
          ctx.translate(this.x, this.y);
          ctx.rotate(this.angle);
          ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
        }

        ctx.restore();
      }
    }

    // Init particles
    particles = [];
    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background arcade grid if arcade theme
      if (theme === 'arcade') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme]);

  return (
    <div className={`theme-${theme} min-h-screen relative w-full overflow-hidden transition-all duration-700`}>
      {/* Background Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0 block"
      />
      {theme === 'arcade' && <div className="fixed inset-0 pointer-events-none arcade-grid z-0 opacity-40" />}
      
      {/* Page Content */}
      <div className="relative z-10 w-full min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
