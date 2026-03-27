/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { 
  motion, 
  useScroll, 
  useTransform, 
  useSpring, 
  useInView, 
  AnimatePresence, 
  useMotionValue,
  useVelocity,
  useAnimationFrame,
  MotionValue
} from "motion/react";
import { AICreator } from './components/AICreator';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { Toaster, toast } from "sonner";
import { GoogleGenAI } from "@google/genai";
import Lenis from "lenis";

const ScrambleText = ({ text, className = "" }: { text: string; className?: string }) => {
  const [displayText, setDisplayText] = useState(text);
  const chars = "!<>-_\\/[]{}—=+*^?#________";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(prev => 
        text.split("")
          .map((char, index) => {
            if (index < iteration) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );
      
      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 3;
    }, 30);

    return () => clearInterval(interval);
  }, [isInView, text]);

  return <span ref={ref} className={className}>{displayText}</span>;
};

const Reveal = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: 75, opacity: 0 }}
        animate={isInView ? { y: 0, opacity: 1 } : { y: 75, opacity: 0 }}
        transition={{ duration: 0.8, delay, ease: [0.33, 1, 0.68, 1] }}
      >
        {children}
      </motion.div>
      <motion.div
        initial={{ scaleY: 1 }}
        animate={isInView ? { scaleY: 0 } : { scaleY: 1 }}
        transition={{ duration: 0.8, delay, ease: [0.33, 1, 0.68, 1] }}
        style={{ originY: 0 }}
        className="absolute inset-0 bg-primary z-20"
      />
    </div>
  );
};

const ParallaxImage = ({ src, alt, className = "" }: { src: string; alt: string; className?: string }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  // 增强视差效果：更大幅度的位移和缩放
  const y = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1.4, 1.1]);
  const blur = useTransform(scrollYProgress, [0, 0.5, 1], ["blur(15px)", "blur(0px)", "blur(15px)"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.2, 0.6, 0.2]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y, scale, filter: blur, opacity }}
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const HorizontalScroll = ({ children }: { children: React.ReactNode }) => {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-66.6%"]);

  return (
    <section ref={targetRef} className="relative h-[300vh] bg-transparent">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div style={{ x }} className="flex gap-8 px-8">
          {children}
        </motion.div>
      </div>
    </section>
  );
};

const Marquee = ({ text, speed = 20 }: { text: string; speed?: number }) => {
  return (
    <div className="overflow-hidden whitespace-nowrap flex border-y border-white/10 py-4 bg-white/5 backdrop-blur-sm">
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
        className="flex gap-8 px-4"
      >
        {[...Array(10)].map((_, i) => (
          <span key={i} className="text-2xl font-black uppercase tracking-widest text-white/40">
            {text}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

const MagneticText = ({ children, strength = 0.5, className = "" }: { children: React.ReactNode; strength?: number; className?: string }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 20, mass: 0.5 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 20, mass: 0.5 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    x.set((clientX - centerX) * strength);
    y.set((clientY - centerY) * strength);
    rotateX.set((clientY - centerY) * (strength * 0.1));
    rotateY.set((clientX - centerX) * (strength * -0.1));
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: springX, 
        y: springY, 
        rotateX: springRotateX, 
        rotateY: springRotateY,
        transformStyle: 'preserve-3d'
      }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
};


const PerspectiveSection = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [15, 0, -15]);
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [100, 0, -100]);
  const blur = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [20, 0, 0, 20]);

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, opacity, scale, y, filter: useTransform(blur, (b) => `blur(${b}px)`), perspective: 2000 }}
      className={`relative ${className}`}
    >
      {children}
    </motion.div>
  );
};

const FloatingElements = ({ mouseX, mouseY }: { mouseX: any; mouseY: any }) => {
  const x1 = useTransform(mouseX, [-1, 1], [-50, 50]);
  const y1 = useTransform(mouseY, [-1, 1], [-50, 50]);
  const x2 = useTransform(mouseX, [-1, 1], [80, -80]);
  const y2 = useTransform(mouseY, [-1, 1], [80, -80]);

  return (
    <>
      <motion.div
        style={{ x: x1, y: y1 }}
        animate={{
          y: [0, -40, 0],
          rotate: [0, 10, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="floating-element top-20 left-[10%] text-8xl pointer-events-none blur-[1px]"
      >
        🔥
      </motion.div>
      <motion.div
        style={{ x: x2, y: y2 }}
        animate={{
          y: [0, 40, 0],
          rotate: [0, -10, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="floating-element bottom-40 right-[15%] text-9xl pointer-events-none blur-[2px]"
      >
        ✨
      </motion.div>
      <motion.div
        style={{ 
          x: useTransform(mouseX, [-1, 1], [-100, 100]),
          y: useTransform(mouseY, [-1, 1], [-100, 100])
        }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.05, 0.15, 0.05],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="floating-element top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/30 rounded-full blur-[150px] pointer-events-none"
      />
    </>
  );
};

const CustomCursor = ({ mouseX, mouseY, isHovering }: { mouseX: MotionValue<number>, mouseY: MotionValue<number>, isHovering: boolean }) => {
  return (
    <motion.div
      className="custom-cursor"
      style={{
        x: mouseX,
        y: mouseY,
        scale: isHovering ? 2 : 1,
      }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
    />
  );
};
const DynamicBackground = ({ mouseX, mouseY }: any) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div 
        style={{ 
          x: mouseX, 
          y: mouseY,
          translateX: "-50%",
          translateY: "-50%"
        }}
        className="absolute w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]"
      />
      
      {/* 噪点纹理叠加 */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] mix-blend-overlay" />

      {/* Primary Blob */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -50, 100, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-primary/10 rounded-full blur-[120px]"
      />
      
      {/* Secondary Blob */}
      <motion.div
        animate={{
          x: [0, -120, 80, 0],
          y: [0, 100, -60, 0],
          scale: [1, 0.8, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-secondary/10 rounded-full blur-[120px]"
      />

      {/* Accent Blob */}
      <motion.div
        animate={{
          x: [0, 50, -100, 0],
          y: [0, 150, -50, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] bg-blue-500/5 rounded-full blur-[100px]"
      />

      {/* Subtle Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{ 
          backgroundImage: `none`,
          backgroundSize: '40px 40px'
        }} 
      />
    </div>
  );
};

const BackgroundParticles = ({ mouseX, mouseY }: any) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            opacity: 0 
          }}
          animate={{ 
            y: ["-10%", "110%"],
            opacity: [0, 0.3, 0],
            rotate: [0, 360]
          }}
          style={{
            x: useTransform(mouseX, [-1, 1], [Math.random() * -50, Math.random() * 50]),
            y: useTransform(mouseY, [-1, 1], [Math.random() * -50, Math.random() * 50]),
          }}
          transition={{ 
            y: {
              duration: Math.random() * 20 + 20, 
              repeat: Infinity, 
              ease: "linear",
              delay: Math.random() * 10
            },
            opacity: { duration: 2 }
          }}
          className="absolute w-1 h-1 bg-primary/40 rounded-full blur-[1px]"
        />
      ))}
    </div>
  );
};

const SectionDivider = () => (
  <div className="relative h-32 w-full overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-primary/5 blur-3xl opacity-30" />
    <motion.div 
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.5, ease: "circOut" }}
      className="absolute top-1/2 left-0 right-0 h-[1px] bg-primary/5"
    />
  </div>
);

const LogoShowcaseContent = () => {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), { stiffness: 150, damping: 20 });
  const scale = useSpring(1, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseEnter = () => scale.set(1.1);
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    scale.set(1);
  };

  return (
    <motion.div 
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      className="relative w-full flex flex-col items-center justify-center z-10 py-32 cursor-none"
      style={{ perspective: 1500 }}
    >
      {/* 浮动容器 */}
      <motion.div
        animate={{ 
          y: [0, -15, 0],
        }}
        transition={{ 
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="w-full flex flex-col items-center"
      >
        {/* 动态光影层 */}
        <motion.div 
          style={{ 
            rotateX, 
            rotateY, 
            scale,
            opacity: useTransform(scale, [1, 1.1], [0, 0.3])
          }}
          className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full pointer-events-none"
        />
        
        <motion.img 
          style={{ rotateX, rotateY, scale }}
          src="https://i.postimg.cc/XJfLcZd3/shi-liang-zhi-neng-dui-xiang.png" 
          alt="Xylon Logo" 
          className="w-56 md:w-80 h-auto object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.7)] relative z-10"
          referrerPolicy="no-referrer"
        />
      </motion.div>

      {/* 交互提示 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute bottom-10 text-[10px] font-mono tracking-[0.5em] text-white/20 uppercase"
      >
        Interactive 3D Space
      </motion.div>
    </motion.div>
  );
};

const Section = ({ children, className = "", id = "" }: { children: React.ReactNode; className?: string; id?: string }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.9, 1, 1, 0.9]);
  const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [100, 0, 0, -100]);

  return (
    <motion.section 
      ref={ref}
      id={id} 
      className={`section-container ${className}`}
      style={{ opacity, scale, y }}
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { 
            opacity: 1, 
            y: 0,
            transition: {
              duration: 0.8,
              ease: "easeOut",
              staggerChildren: 0.15
            }
          }
        }}
        className="w-full h-full flex flex-col items-center justify-center"
      >
        {children}
      </motion.div>
    </motion.section>
  );
};

const TiltCard = ({ children, className = "", ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [15, -15]), { stiffness: 150, damping: 15 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-15, 15]), { stiffness: 150, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={className}
      {...props}
    >
      <div style={{ transform: "translateZ(50px)", transformStyle: "preserve-3d" }} className="w-full h-full">
        {children}
      </div>
    </motion.div>
  );
};

const Magnetic = ({ children, strength = 0.5 }: { children: React.ReactNode; strength?: number }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 100, damping: 20, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 100, damping: 20, mass: 0.1 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    x.set((clientX - centerX) * strength);
    y.set((clientY - centerY) * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
    >
      {children}
    </motion.div>
  );
};

const MagneticButton = ({ children, className, onClick, type, disabled }: any) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current!.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={`${className} relative overflow-hidden group`}
      onClick={onClick}
      type={type}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05, boxShadow: "0 0 20px rgba(52, 58, 150, 0.4)" } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      {children}
    </motion.button>
  );
};

interface Comment {
  id: string;
  text: string;
  authorName: string;
  authorUid: string;
  authorPhoto?: string;
  createdAt: Timestamp | null;
}

export default function App() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  
  // 顶部进度条平滑动画
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // 首屏视差滚动效果
  const heroY = useTransform(scrollYProgress, [0, 0.3], ["0%", "40%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  // 3D 悬浮交互状态
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Global Mouse Tracker for Custom Cursor
  const globalMouseX = useMotionValue(0);
  const globalMouseY = useMotionValue(0);
  
  // Velocity for dynamic stretching
  const mouseXVelocity = useVelocity(globalMouseX);
  const mouseYVelocity = useVelocity(globalMouseY);
  const mouseVelocity = useTransform(
    [mouseXVelocity, mouseYVelocity],
    ([vx, vy]) => Math.sqrt(Math.pow(Number(vx), 2) + Math.pow(Number(vy), 2))
  );

  // Smooth springs for different layers
  const cursorX = useSpring(globalMouseX, { stiffness: 400, damping: 30, mass: 0.2 });
  const cursorY = useSpring(globalMouseY, { stiffness: 400, damping: 30, mass: 0.2 });
  
  const ringX = useSpring(globalMouseX, { stiffness: 150, damping: 25, mass: 0.8 });
  const ringY = useSpring(globalMouseY, { stiffness: 150, damping: 25, mass: 0.8 });

  const trailX = useSpring(globalMouseX, { stiffness: 50, damping: 20, mass: 1.5 });
  const trailY = useSpring(globalMouseY, { stiffness: 50, damping: 20, mass: 1.5 });

  // Cursor scaling based on velocity
  const cursorScale = useTransform(mouseVelocity, [0, 2000], [1, 1.5]);
  const cursorSkewX = useTransform(mouseXVelocity, [-2000, 2000], [-15, 15]);
  const cursorSkewY = useTransform(mouseYVelocity, [-2000, 2000], [-15, 15]);

  // Hover state for interactive elements
  const [isHovering, setIsHovering] = useState(false);
  const hoverScale = useSpring(isHovering ? 2.5 : 1, { stiffness: 300, damping: 20 });

  // Initialize Lenis Smooth Scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5, // Slightly slower for more "luxurious" feel
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.1,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      globalMouseX.set(e.clientX);
      globalMouseY.set(e.clientY);
    };

    const handleHoverStart = () => setIsHovering(true);
    const handleHoverEnd = () => setIsHovering(false);

    const interactiveElements = document.querySelectorAll('a, button, [role="button"], input, textarea, .interactive');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', handleHoverStart);
      el.addEventListener('mouseleave', handleHoverEnd);
    });

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      interactiveElements.forEach(el => {
        el.removeEventListener('mouseenter', handleHoverStart);
        el.removeEventListener('mouseleave', handleHoverEnd);
      });
    };
  }, [globalMouseX, globalMouseY]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 2; // -1 to 1
    const y = (clientY / innerHeight - 0.5) * 2; // -1 to 1
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const rotateX = useTransform(mouseY, [-1, 1], [10, -10]);
  const rotateY = useTransform(mouseX, [-1, 1], [-10, 10]);
  
  const springRotateX = useSpring(rotateX, { damping: 30, stiffness: 100 });
  const springRotateY = useSpring(rotateY, { damping: 30, stiffness: 100 });

  // Active Tab State for Brand Details
  const [activeTab, setActiveTab] = useState<'elements' | 'colors' | 'interpretation'>('elements');

  // Firebase Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Comments State
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Handle Comments Fetching
  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentsData);
    }, (error) => {
      console.error("Error fetching comments:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "comments"), {
        text: newComment.trim(),
        authorName: user.displayName || "Anonymous",
        authorUid: user.uid,
        authorPhoto: user.photoURL || "",
        createdAt: serverTimestamp()
      });
      setNewComment("");
      toast.success("留言发布成功！");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("发布失败，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "comments", commentId));
      toast.success("留言已删除");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("删除失败");
    }
  };

  const handleCopyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`已复制颜色代码 ${color}`);
  };

  return (
    <div ref={containerRef} className="bg-bg-dark cursor-auto md:cursor-none">
      {/* Custom Cursor Layers */}
      
      {/* 1. Outer Trail (Liquid Lag) */}
      <motion.div
        className="fixed top-0 left-0 w-16 h-16 rounded-full border border-primary/5 pointer-events-none z-[100] hidden md:block"
        style={{
          x: trailX,
          y: trailY,
          translateX: "-50%",
          translateY: "-50%",
          scale: hoverScale,
        }}
      />

      {/* 2. Middle Ring (Responsive Lag) */}
      <motion.div
        className="fixed top-0 left-0 w-10 h-10 rounded-full border border-primary/20 pointer-events-none z-[100] hidden md:block"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          scale: useTransform(hoverScale, (s) => Number(s) * 0.8),
        }}
      />

      {/* 3. Inner Dot (High Precision with Velocity Stretch) */}
      <motion.div
        className="fixed top-0 left-0 w-2 h-2 rounded-full bg-primary pointer-events-none z-[101] mix-blend-screen hidden md:block shadow-[0_0_20px_rgba(91,59,163,1)]"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: "-50%",
          translateY: "-50%",
          scaleX: useTransform(cursorScale, (s) => Number(s) * (isHovering ? 1.5 : 1)),
          scaleY: useTransform(cursorScale, (s) => (1 / Number(s)) * (isHovering ? 1.5 : 1)),
          skewX: cursorSkewX,
          skewY: cursorSkewY,
        }}
      />

      {/* 4. Liquid Trail Dots */}
      {[0.1, 0.2, 0.3].map((delay, i) => (
        <motion.div
          key={i}
          className="fixed top-0 left-0 w-1 h-1 rounded-full bg-primary/30 pointer-events-none z-[100] hidden md:block"
          style={{
            x: useSpring(globalMouseX, { stiffness: 100 - i * 20, damping: 20 + i * 5 }),
            y: useSpring(globalMouseY, { stiffness: 100 - i * 20, damping: 20 + i * 5 }),
            translateX: "-50%",
            translateY: "-50%",
          }}
        />
      ))}

      {/* 4. Hover Glow (Only visible when hovering) */}
      <motion.div
        className="fixed top-0 left-0 w-24 h-24 rounded-full bg-primary/20 blur-2xl pointer-events-none z-[99] hidden md:block"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: isHovering ? 0.6 : 0,
          scale: isHovering ? 1.5 : 0,
        }}
      />

      <Toaster theme="dark" position="bottom-right" />
      <DynamicBackground mouseX={trailX} mouseY={trailY} />
      <CustomCursor mouseX={cursorX} mouseY={cursorY} isHovering={isHovering} />
      
      {/* 顶部滚动进度条 */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
        style={{ scaleX }}
      />
      
      {/* Header / Navigation */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-bg-dark/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="relative group px-4 py-2 cursor-pointer">
            {/* Static Border (visible when not hovering) */}
            <div className="absolute inset-0 rounded-[12px] border border-white/10 group-hover:border-transparent transition-colors duration-500" />
            
            {/* Animated Light Beam (visible on hover) */}
            <div className="absolute inset-0 rounded-[12px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden pointer-events-none">
              <div className="absolute inset-[-150%] bg-primary/10 animate-[spin_4s_linear_infinite]" />
              {/* Inner Mask to create the border effect */}
              <div className="absolute inset-[1px] bg-bg-dark rounded-[7px] z-[1]" />
            </div>

            {/* Text Content */}
            <div className="relative z-10 font-black text-xl tracking-widest text-white">
              XYLON LOGO
            </div>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-bold tracking-widest text-white/70">
            <Magnetic strength={0.3}>
              <a href="#hero" onClick={(e) => { e.preventDefault(); document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-primary transition-colors">首页</a>
            </Magnetic>
            <Magnetic strength={0.3}>
              <a href="#brand-details" onClick={(e) => { e.preventDefault(); document.getElementById('brand-details')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-primary transition-colors">品牌解析</a>
            </Magnetic>
            <Magnetic strength={0.3}>
              <a href="#showcase" onClick={(e) => { e.preventDefault(); document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-primary transition-colors">展示</a>
            </Magnetic>
            <Magnetic strength={0.3}>
              <a href="#ai-creator" onClick={(e) => { e.preventDefault(); document.getElementById('ai-creator')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-primary transition-colors">AI 共创</a>
            </Magnetic>
            <Magnetic strength={0.3}>
              <a href="#comments" onClick={(e) => { e.preventDefault(); document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-primary transition-colors">留言</a>
            </Magnetic>
          </nav>
          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">👤</div>
                  )}
                  <span className="text-sm font-bold hidden sm:block">{user.displayName}</span>
                </div>
                <Magnetic strength={0.2}>
                  <button onClick={handleLogout} className="text-white/70 hover:text-white transition-colors" title="退出登录">
                    🚪
                  </button>
                </Magnetic>
              </div>
            ) : (
              <MagneticButton 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary/80 transition-colors"
              >
                🚪
                <span>登录互动</span>
              </MagneticButton>
            )}
          </div>
        </div>
      </header>

      <Marquee text="BRAND MOOD • DESIGN PHILOSOPHY • CREATIVE DIRECTION • XYLON" speed={60} />

      <BackgroundParticles mouseX={mouseX} mouseY={mouseY} />

      {/* 1. 封面标题 */}
      <section 
        id="hero"
        className="section-container justify-end pb-20 relative overflow-hidden pt-16"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 40, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          transition={{ 
            type: "spring",
            stiffness: 100,
            damping: 12,
            mass: 1.2,
            delay: 0.2
          }}
          className="w-full max-w-7xl mx-auto z-10 px-4 relative"
          style={{ perspective: 1200 }}
        >
          {/* 主标题：使用设计好的图片替换文字，增加 3D 悬浮交互 */}
          <motion.div 
            className="flex justify-center px-4 w-full cursor-pointer relative group"
            style={{
              rotateX: springRotateX,
              rotateY: springRotateY,
              transformStyle: "preserve-3d",
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* 动态光晕层：跟随鼠标反向移动，增强 3D 纵深感 */}
            <motion.div 
              className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center"
              style={{
                x: useTransform(mouseX, [-1, 1], [-80, 80]),
                y: useTransform(mouseY, [-1, 1], [-80, 80]),
                z: -60,
              }}
            >
              <div className="w-[80%] h-[60%] bg-primary/5 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </motion.div>

            {/* 持续悬浮的 Logo 层 */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ z: 50 }}
              className="relative z-10 w-full flex justify-center"
            >
              <img 
                src="https://i.postimg.cc/G2QC4pJc/zu-19-kao-bei.png" 
                alt="LOGO DESIGN" 
                className="w-full max-w-6xl h-auto object-contain drop-shadow-2xl transition-all duration-500 group-hover:drop-shadow-[0_20px_60px_rgba(255,255,255,0.25)]"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        </motion.div>
        <motion.div 
          style={{ y: heroY, opacity: heroOpacity }}
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        >
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-cover opacity-60"
          >
            <source src="https://mp3tourl.com/videos/1774440026534-766d25e9-3705-4eac-ba03-bf5e8d3f395a.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-primary/5" />
          <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
        </motion.div>
      </section>

      {/* 2. 品牌解析 (Tabbed Section) */}
      <PerspectiveSection>
        <Section id="brand-details" className="min-h-screen pt-24">
        <div className="max-w-7xl w-full mx-auto z-10 px-4 flex flex-col h-full">
          {/* Header & Tabs */}
          <div className="relative w-full mb-16 flex flex-col md:block">
            {/* Tabs in Upper Right Corner (Desktop) / Top (Mobile) */}
            <motion.div 
              className="flex flex-row flex-wrap gap-4 z-20 mb-8 md:mb-0 md:absolute md:top-0 md:right-0"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.15,
                  }
                }
              }}
            >
              {[
                { id: 'elements', label: '要素提炼', icon: '✨' },
                { id: 'colors', label: '颜色释义', icon: '🎨' },
                { id: 'interpretation', label: '设计理念', icon: '💡' }
              ].map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  variants={{
                    hidden: { opacity: 0, y: -20, filter: 'blur(10px)' },
                    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 300, damping: 24 } },
                    hover: { scale: 1.05, y: -2 },
                    tap: { scale: 0.95 }
                  }}
                  whileHover="hover"
                  whileTap="tap"
                  className={`relative px-6 py-4 border rounded-[12px] backdrop-blur-md transition-colors duration-300 flex items-center justify-center gap-2 flex-1 md:flex-none md:min-w-[140px] group overflow-hidden ${
                    activeTab === tab.id 
                      ? 'border-primary bg-primary/20 text-white shadow-[0_0_20px_rgba(52,58,150,0.4)]' 
                      : 'border-white/10 bg-black/40 text-white/50 hover:border-white/30 hover:text-white hover:bg-white/5 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                  }`}
                >
                  {/* Hover background effect */}
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <span className="text-sm font-bold tracking-widest relative z-10 flex items-center gap-2">
                    <motion.span 
                      variants={{
                        visible: { 
                          scale: activeTab === tab.id ? 1.2 : 0.9,
                          opacity: activeTab === tab.id ? 1 : 0.7,
                          y: activeTab === tab.id ? [0, -4, 0] : 0,
                          transition: activeTab === tab.id 
                            ? { y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }, scale: { duration: 0.3 } } 
                            : { duration: 0.3 }
                        },
                        hover: { 
                          scale: 1.2,
                          opacity: 1,
                          y: [0, -4, 0],
                          transition: { y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }, scale: { duration: 0.3 } }
                        }
                      }}
                      className="inline-block origin-bottom"
                    >
                      {tab.icon}
                    </motion.span>
                    {tab.label}
                  </span>
                  
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeBoxIndicator"
                      className="absolute inset-0 border-2 border-primary rounded-[12px] pointer-events-none"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </motion.div>

            {/* Header */}
            <div className="md:pt-4">
              <Reveal className="text-4xl md:text-5xl font-black uppercase mb-4">
                <ScrambleText text={activeTab === 'elements' ? '要素提炼' : activeTab === 'colors' ? '颜色释义' : '设计理念'} />
              </Reveal>
              <motion.div 
                initial={{ width: 0 }}
                whileInView={{ width: 48 }}
                viewport={{ once: true }}
                className="h-1 bg-primary" 
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="relative flex-1 w-full min-h-[500px]">
            <AnimatePresence mode="wait">
              {activeTab === 'elements' && (
                <motion.div
                  key="elements"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full"
                >
                  <p className="text-white/60 max-w-md text-sm leading-relaxed mb-12">
                    提取彝族传统文化中的核心符号，通过现代几何重构，赋予品牌深厚的文化底蕴与当代审美。
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                    {[
                      { src: "https://i.postimg.cc/Pqv3KL2t/tu-ceng-17.png", alt: "火把节", title: "火把节", desc: "象征热情与生生不息的品牌生命力，提取火焰跳跃的动态美感。" },
                      { src: "https://i.postimg.cc/903gSyJP/zu-30-kao-bei.png", alt: "彝绣", title: "传统彝绣", desc: "几何化的纹理交织，代表着品牌对细节的极致追求与匠心传承。" },
                      { src: "https://i.postimg.cc/4xM6Bs8W/zu-31-kao-bei-2.png", alt: "羊角图腾", title: "羊角图腾", desc: "坚韧与力量的象征，转化为极简的线条结构，构建稳固的视觉基石。" }
                    ].map((item, i) => (
                      <motion.div 
                        key={i} 
                        whileHover={{ y: -10 }}
                        className="group relative bg-white/5 border border-white/10 rounded-[12px] p-8 hover:bg-white/10 transition-all duration-500 overflow-hidden cursor-pointer flex flex-col items-center text-center"
                        style={{ perspective: 1000 }}
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/40 transition-colors duration-500" />
                        
                        <motion.div 
                          className="relative w-full aspect-square mb-6 flex items-center justify-center rounded-[12px] overflow-hidden"
                          whileHover={{ rotateX: 10, rotateY: -10, scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <img src={item.src} alt={item.alt} className="w-3/4 h-auto object-contain relative z-10 transition-transform duration-700 ease-out group-hover:scale-110 group-hover:-translate-y-2 group-hover:rotate-3 drop-shadow-2xl" referrerPolicy="no-referrer" loading="lazy" />
                          
                          {/* Hover Description Overlay */}
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20 flex items-center justify-center p-6 rounded-[12px]">
                            <p className="text-white text-sm leading-relaxed font-medium transform scale-90 group-hover:scale-100 transition-transform duration-500">
                              {item.desc}
                            </p>
                          </div>
                        </motion.div>
                        
                        <div className="relative z-10">
                          <h3 className="text-2xl font-bold">{item.title}</h3>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'colors' && (
                <motion.div
                  key="colors"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      { name: "热烈红", color: "#C42E2E", cmyk: ["c:28", "m:91", "y:99", "k:0"], img: "https://i.postimg.cc/QCns19fC/2431699721927.png", darkText: false },
                      { name: "深邃蓝", color: "#1A3A6E", cmyk: ["c:92", "m:77", "y:20", "k:0"], img: "https://i.postimg.cc/SsMtDXQL/2411699721926.png", darkText: false },
                      { name: "活力橙", color: "#E69C4A", cmyk: ["c:4", "m:44", "y:69", "k:0"], img: "https://i.postimg.cc/DZkcfxFy/2421699721927.png", darkText: false },
                      { name: "象牙白", color: "#F2E6D4", cmyk: ["c:4", "m:18", "y:27", "k:0"], img: "https://i.postimg.cc/tTqYz6NB/2441699721928.png", darkText: true }
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col group cursor-pointer relative overflow-hidden rounded-[12px] shadow-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:-translate-y-2 hover:scale-[1.03] transition-all duration-500 bg-white/5 border border-white/10" onClick={() => handleCopyColor(item.color)}>
                        <div className="aspect-square overflow-hidden relative">
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                              <span className="text-3xl">📋</span>
                              <span className="text-white font-bold text-sm tracking-wider drop-shadow-md">复制色值</span>
                            </div>
                          </div>
                          <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" loading="lazy" />
                        </div>
                        <div className="p-8 flex flex-col justify-center min-h-[180px] relative" style={{ backgroundColor: item.color }}>
                          <div className={`space-y-1 ${item.darkText ? 'text-black/80' : 'text-white'}`}>
                            <p className="text-xl font-bold mb-2">{item.name}</p>
                            {item.cmyk.map((val, idx) => (
                              <p key={idx} className="text-sm font-mono font-bold tracking-wider leading-none opacity-80">{val}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'interpretation' && (
                <motion.div
                  key="interpretation"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full"
                >
                  <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
                    {/* Left: Visual Display */}
                    <div className="lg:w-1/2 relative rounded-[12px] bg-primary/5 border border-white/10 p-8 flex items-center justify-center overflow-hidden group">
                      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      
                      {/* Decorative corner elements */}
                      <div className="absolute top-8 left-8 w-16 h-16 border-t border-l border-primary/40 rounded-tl-[12px] opacity-0 group-hover:opacity-100 transition-all duration-700 -translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0" />
                      <div className="absolute bottom-8 right-8 w-16 h-16 border-b border-r border-primary/40 rounded-br-[12px] opacity-0 group-hover:opacity-100 transition-all duration-700 translate-x-4 translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0" />

                      {/* Floating badges */}
                      <div className="absolute top-12 right-12 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-mono text-primary opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 translate-y-4 group-hover:translate-y-0 z-20">
                        VISION_01
                      </div>
                      <div className="absolute bottom-12 left-12 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-mono text-primary opacity-0 group-hover:opacity-100 transition-all duration-500 delay-200 -translate-y-4 group-hover:translate-y-0 z-20">
                        SYMBOL_02
                      </div>

                      <img 
                        src="https://i.postimg.cc/vm6pS23w/zu-28-kao-bei.png" 
                        alt="Logo Interpretation" 
                        className="relative z-10 w-4/5 h-auto object-contain transition-all duration-700 group-hover:scale-105 group-hover:drop-shadow-[0_0_40px_rgba(52,58,150,0.6)]" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>

                    {/* Right: Interactive Accordion Cards */}
                    <div className="lg:w-1/2 flex flex-col gap-4">
                      {[
                        {
                          title: "极简几何重构",
                          subtitle: "Modern Geometry",
                          desc: "灵感来源于彝族传统图腾与现代极简美学的碰撞。通过几何化的线条重构，我们将复杂的民族元素提炼为具有高度识别性的超级符号。",
                          icon: "📐"
                        },
                        {
                          title: "向上生长的张力",
                          subtitle: "Upward Tension",
                          desc: "整体形态呈现出向上生长的张力，寓意品牌不断突破与创新的精神。交织的线条不仅代表着文化的融合，也象征着品牌与用户之间紧密的连接。",
                          icon: "🌱"
                        },
                        {
                          title: "文化与现代的交织",
                          subtitle: "Cultural Fusion",
                          desc: "不仅保留了民族底蕴的深厚感，更赋予了其适应现代数字化传播的扁平化特征，让传统文化在当代语境下焕发新生。",
                          icon: "✨"
                        }
                      ].map((item, i) => (
                        <div 
                          key={i}
                          className="group relative flex-1 rounded-[12px] bg-white/5 border border-white/10 p-6 overflow-hidden cursor-pointer transition-all duration-500 hover:bg-white/10 hover:flex-[1.5] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:border-primary/30 flex flex-col justify-center"
                        >
                          {/* Hover Gradient */}
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          
                          <div className="relative z-10">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-[12px] bg-black/30 border border-white/5 flex items-center justify-center text-2xl grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12 group-hover:border-primary/30 group-hover:bg-primary/20">
                                {item.icon}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-white/80 group-hover:text-white transition-colors">{item.title}</h3>
                                <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-in-out">
                                  <p className="text-xs text-primary font-mono uppercase tracking-wider overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                                    {item.subtitle}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-in-out">
                              <div className="overflow-hidden">
                                <p className="text-white/60 text-sm leading-relaxed mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-150 pl-16">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Section>
    </PerspectiveSection>

      <SectionDivider />

      {/* 6. LOGO 展示 */}
      <Section id="showcase" className="relative overflow-hidden">
        <div className="max-w-6xl w-full mx-auto z-10 px-4 flex flex-col items-center">
          <div className="mb-16 text-center w-full">
            <Reveal className="text-4xl md:text-5xl font-black uppercase mb-4">
              <ScrambleText text="LOGO SHOWCASE" />
            </Reveal>
            <motion.div 
              initial={{ width: 0 }}
              whileInView={{ width: 48 }}
              viewport={{ once: true }}
              className="h-1 bg-primary mx-auto" 
            />
          </div>
          
          <LogoShowcaseContent />
        </div>
        
        {/* 多层视差背景 */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* 底层：主背景图 */}
          <ParallaxImage 
            src="https://i.postimg.cc/6qt9LxVR/bei-jing2.png" 
            alt="Logo Showcase Background Layer 1" 
            className="w-full h-full opacity-20 scale-150"
          />
          
          {/* 中层：光影效果 */}
          <div className="absolute inset-0 bg-primary/5 opacity-80" />
          
          {/* 顶层：细节纹理，使用 ParallaxImage 实现反向视差 */}
          <div className="absolute inset-0 opacity-10 mix-blend-overlay overflow-hidden">
            <ParallaxImage 
              src="https://www.transparenttextures.com/patterns/carbon-fibre.png" 
              alt="Texture Layer" 
              className="w-full h-full scale-110"
            />
          </div>
          
          {/* 装饰性光晕 */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[150px] rounded-full"
          />
        </div>
      </Section>

      <SectionDivider />

      {/* 3. 品牌氛围 (Horizontal Scroll) */}
      <section className="bg-bg-dark border-y border-white/5">
        <HorizontalScroll>
          <div className="flex items-center gap-12 px-[10vw]">
            <div className="flex-shrink-0 w-[400px]">
              <Reveal>
                <h2 className="text-6xl font-black text-white mb-6">
                  <ScrambleText text="BRAND" /><br/>
                  <span className="text-primary"><ScrambleText text="MOOD" /></span>
                </h2>
              </Reveal>
              <p className="text-white/60 text-lg leading-relaxed">
                从深邃的民族底蕴中汲取能量，在现代极简的语境下重构视觉张力。
                这是一场关于传承与创新的跨时空对话。
              </p>
            </div>
            
            {[
              { title: "MYSTIC", img: "https://i.postimg.cc/SsMbfGNf/image.png", color: "from-purple-500/20" },
              { title: "ETHNIC", img: "https://i.postimg.cc/HsJsPbZN/image.png", color: "from-orange-500/20" },
              { title: "MODERN", img: "https://i.postimg.cc/MZmF2LNk/13e48e35167ad06cc06b9621fe9691d5.jpg", color: "from-blue-500/20" },
              { title: "FUTURE", img: "https://i.postimg.cc/SRx7pg2t/image.png", color: "from-primary/20" }
            ].map((item, i) => (
              <TiltCard 
                key={i}
                className="flex-shrink-0 w-[450px] aspect-[3/4] relative group rounded-[12px] overflow-hidden bg-white/5 border border-white/10"
              >
                <img 
                  src={item.img} 
                  alt={item.title} 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
                <motion.div 
                  className="absolute inset-0 bg-primary z-10 pointer-events-none"
                  initial={{ clipPath: "circle(0% at 50% 50%)" }}
                  whileHover={{ clipPath: "circle(150% at 50% 50%)" }}
                  transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
                  style={{ mixBlendMode: "overlay", opacity: 0.4 }}
                />
                <div className={`absolute inset-0 bg-primary/20 opacity-60`} />
                <div className="absolute bottom-8 left-8" style={{ transform: "translateZ(30px)" }}>
                  <span className="text-xs font-mono text-primary mb-2 block tracking-[0.3em]">CONCEPT_0{i+1}</span>
                  <h3 className="text-4xl font-black text-white tracking-tighter">{item.title}</h3>
                </div>
                
                {/* Glass Overlay on Hover */}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center" style={{ transform: "translateZ(40px)" }}>
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-500 delay-100">
                    ➡️
                  </div>
                </div>
              </TiltCard>
            ))}
            
            <div className="flex-shrink-0 w-[400px] flex flex-col justify-center">
              <div className="h-px w-full bg-white/10 mb-8" />
              <p className="text-white/40 font-mono text-sm uppercase tracking-widest mb-4">End of Moodboard</p>
              <h3 className="text-3xl font-bold text-white/80">探索无限可能</h3>
            </div>
          </div>
        </HorizontalScroll>
      </section>

      <SectionDivider />

      {/* 5. AI 灵感共创 */}
      <PerspectiveSection>
        <Section id="ai-creator" className="relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] translate-y-1/4 translate-x-1/4" />

        <div className="max-w-6xl w-full mx-auto z-10 px-4">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            {/* Left: Editorial Content */}
            <div className="lg:w-2/5 text-left">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary mb-8"
              >
                ✨
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Co-Creation Studio</span>
              </motion.div>
              
              <Reveal className="mb-6">
                <h2 className="text-5xl md:text-6xl font-black leading-tight">
                  <ScrambleText text="AI" /> <span className="text-primary italic serif"><ScrambleText text="GENESIS" /></span>
                </h2>
              </Reveal>
              
              <Reveal delay={0.2}>
                <p className="text-white/50 text-lg leading-relaxed mb-10">
                  打破现实与想象的边界。基于 Xylon 核心视觉资产，通过 Gemini 3.1 的神经元网络，将您的文字构思转化为具有品牌灵魂的视觉杰作。
                </p>
              </Reveal>

              <div className="space-y-6">
                <div className="flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">01</div>
                  <div>
                    <h4 className="font-bold text-white/80 mb-1">输入创意</h4>
                    <p className="text-xs text-white/40">描述您脑海中的品牌应用场景</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">02</div>
                  <div>
                    <h4 className="font-bold text-white/80 mb-1">算法共鸣</h4>
                    <p className="text-xs text-white/40">AI 实时解析并重构视觉元素</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Interactive Studio */}
            <div className="lg:w-3/5 w-full">
              <div className="relative group">
                {/* Decorative Frame */}
                <div className="absolute -inset-4 border border-white/5 rounded-[12px] pointer-events-none transition-all duration-700 group-hover:border-primary/20" />
                
                <div className="glass-card !p-0 overflow-hidden !rounded-[12px] border-white/10">
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Input Side */}
                    <div className="p-8 border-b md:border-b-0 md:border-r border-white/10 bg-white/[0.02]">
                <AICreator />
                    </div>

                    {/* Preview Side */}
                    <div className="aspect-square md:aspect-auto bg-black/40 flex items-center justify-center relative overflow-hidden">
                      <div className="flex flex-col items-center gap-4 text-white/10">
                        <span className="text-5xl">🖼️</span>
                        <span className="text-[10px] font-mono uppercase tracking-widest">Waiting for input</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </PerspectiveSection>

      <SectionDivider />

      {/* 7. 互动留言区 */}
      <PerspectiveSection>
        <Section id="comments" className="relative">
        <div className="max-w-5xl w-full mx-auto z-10 px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <Reveal className="mb-4">
                <h2 className="text-5xl font-black uppercase tracking-tighter">
                  <ScrambleText text="VOICE OF" /> <span className="text-primary"><ScrambleText text="XYLON" /></span>
                </h2>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="text-white/40 text-lg">
                  每一个观点都是品牌进化的养分。留下您对本次视觉提案的直觉、建议或共鸣。
                </p>
              </Reveal>
            </div>
            
            <div className="flex items-center gap-4">
              {!user && (
                <MagneticButton
                  onClick={handleLogin}
                  className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-primary hover:border-primary transition-all flex items-center gap-2"
                >
                  🚪
                  <span>Sign in to comment</span>
                </MagneticButton>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Input Column */}
            <div className="lg:col-span-4">
              <div className="sticky top-32">
                <div className="glass-card !p-6 border-white/10 bg-white/[0.02]">
                  {user ? (
                    <form onSubmit={handleSubmitComment} className="space-y-6">
                      <div className="flex items-center gap-4 mb-6">
                        <img src={user.photoURL || ""} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/30" referrerPolicy="no-referrer" loading="lazy" />
                        <div>
                          <p className="text-xs font-bold text-white/80">{user.displayName}</p>
                          <p className="text-[10px] text-white/30 font-mono uppercase">Active User</p>
                        </div>
                      </div>
                      
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="撰写您的想法..."
                        className="w-full bg-black/20 border border-white/5 rounded-[12px] p-4 text-sm text-white focus:outline-none focus:border-primary/30 min-h-[120px] transition-all"
                      />
                      
                      <MagneticButton
                        type="submit"
                        disabled={isSubmitting || !newComment.trim()}
                        className="w-full py-3 bg-primary text-white text-xs font-bold rounded-[12px] tracking-widest uppercase shadow-lg shadow-primary/20 disabled:opacity-30"
                      >
                        {isSubmitting ? "Posting..." : "Post Comment"}
                      </MagneticButton>
                    </form>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-white/20">
                        💬
                      </div>
                      <p className="text-sm text-white/30 mb-6">请登录后参与互动</p>
                      <MagneticButton onClick={handleLogin} className="w-full py-3 border border-white/10 rounded-[12px] text-[10px] font-bold uppercase tracking-widest hover:bg-white/5">
                        Login Now
                      </MagneticButton>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8">
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {comments.length > 0 ? (
                    comments.map((comment, i) => (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.1 }}
                        className="group relative"
                      >
                        <div className="flex gap-6 p-6 rounded-[12px] bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500">
                          {comment.authorPhoto ? (
                            <img src={comment.authorPhoto} alt={comment.authorName} className="w-10 h-10 rounded-full grayscale group-hover:grayscale-0 transition-all duration-500" referrerPolicy="no-referrer" loading="lazy" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20">👤</div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-bold text-white/80">{comment.authorName}</h4>
                              <span className="text-[10px] font-mono text-white/20">
                                {comment.createdAt?.toDate().toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-white/50 leading-relaxed group-hover:text-white/70 transition-colors">
                              {comment.text}
                            </p>
                          </div>
                          
                          {user?.uid === comment.authorUid && (
                            <button 
                              onClick={() => handleDeleteComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-500 transition-all"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-[12px]">
                      <p className="text-white/20 font-mono text-xs uppercase tracking-widest">No voices yet. Be the first.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </PerspectiveSection>

      {/* 8. 感谢观看 */}
      <PerspectiveSection>
        <Section>
        <div className="absolute inset-0 z-0 pointer-events-none">
          <ParallaxImage 
            src="https://i.postimg.cc/6qt9LxVR/bei-jing2.png" 
            alt="Thanks Background" 
            className="w-full h-full opacity-60"
          />
          <div className="absolute inset-0 bg-primary/5" />
        </div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center z-10 relative"
        >
          <h2 className="bold-title mb-4">THANKS</h2>
          <p className="text-2xl font-bold tracking-widest">
            <ScrambleText text="THANKS FOR WATCHING" />
          </p>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="mt-12 px-12 py-4 bg-white text-primary font-black rounded-full hover:shadow-xl transition-all"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            BACK TO TOP ☝️
          </motion.button>
        </motion.div>
      </Section>
    </PerspectiveSection>

      {/* Footer */}
      <footer className="py-8 text-center text-xs opacity-30 font-bold uppercase tracking-widest bg-black">
        © 2026 Xylon Logo Proposal • Designed for Excellence
      </footer>
    </div>
  );
}
