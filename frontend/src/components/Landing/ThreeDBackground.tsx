import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Box, Torus, InstancedMesh } from '@react-three/drei';
import * as THREE from 'three';

// Animated floating spheres representing WiFi signals
const SignalSphere: React.FC<{ position: [number, number, number]; color: string; speed?: number }> = ({ position, color, speed = 1 }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.x = state.clock.elapsedTime * 0.2 * speed;
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.3 * speed;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <Sphere ref={meshRef} args={[0.3, 32, 32]} position={position}>
                <MeshDistortMaterial
                    color={color}
                    attach="material"
                    distort={0.4}
                    speed={2}
                    roughness={0.2}
                    metalness={0.8}
                    transparent
                    opacity={0.6}
                />
            </Sphere>
        </Float>
    );
};

// Rotating router-like box with antenna
const RouterModel: React.FC = () => {
    const groupRef = useRef<THREE.Group>(null);
    
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.3;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Main router body */}
            <Box args={[2, 0.3, 1.2]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#0ea5e9" roughness={0.3} metalness={0.7} />
            </Box>
            
            {/* Antennas */}
            <Box args={[0.1, 0.8, 0.1]} position={[-0.8, 0.5, -0.5]} rotation={[0.3, 0, 0]}>
                <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.6} />
            </Box>
            <Box args={[0.1, 0.8, 0.1]} position={[0.8, 0.5, -0.5]} rotation={[-0.3, 0, 0]}>
                <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.6} />
            </Box>
            
            {/* LED indicators */}
            <Box args={[0.08, 0.08, 0.08]} position={[-0.5, 0.16, 0.5]}>
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} />
            </Box>
            <Box args={[0.08, 0.08, 0.08]} position={[-0.3, 0.16, 0.5]}>
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} />
            </Box>
            <Box args={[0.08, 0.08, 0.08]} position={[-0.1, 0.16, 0.5]}>
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} />
            </Box>
        </group>
    );
};

// WiFi signal rings
const SignalRings: React.FC = () => {
    const groupRef = useRef<THREE.Group>(null);
    
    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.children.forEach((child, i) => {
                const scale = 1 + Math.sin(state.clock.elapsedTime * 2 + i) * 0.1;
                child.scale.setScalar(scale);
                (child as any).material.opacity = 0.3 - (i * 0.05);
            });
        }
    });

    return (
        <group ref={groupRef} position={[0, 0, -1]}>
            {[1, 2, 3].map((i) => (
                <Torus key={i} args={[i * 0.5, 0.02, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
                    <meshStandardMaterial
                        color="#38bdf8"
                        transparent
                        opacity={0.3 - (i * 0.05)}
                        side={THREE.DoubleSide}
                    />
                </Torus>
            ))}
        </group>
    );
};

// Floating particles
const Particles: React.FC<{ count?: number }> = ({ count = 100 }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const positions = useMemo(() => {
        const pos = [];
        for (let i = 0; i < count; i++) {
            pos.push({
                x: (Math.random() - 0.5) * 20,
                y: (Math.random() - 0.5) * 20,
                z: (Math.random() - 0.5) * 10 - 5,
            });
        }
        return pos;
    }, [count]);

    useFrame((state) => {
        if (meshRef.current) {
            positions.forEach((pos, i) => {
                dummy.position.set(
                    pos.x + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.5,
                    pos.y + Math.cos(state.clock.elapsedTime * 0.3 + i) * 0.5,
                    pos.z
                );
                dummy.rotation.set(state.clock.elapsedTime * 0.2, state.clock.elapsedTime * 0.3, 0);
                dummy.updateMatrix();
                meshRef.current!.setMatrixAt(i, dummy.matrix);
            });
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <InstancedMesh ref={meshRef} args={[undefined as any, undefined as any, count]}>
            <BoxGeometry args={[0.05, 0.05, 0.05]} />
            <meshStandardMaterial color="#7dd3fc" transparent opacity={0.4} />
        </InstancedMesh>
    );
};

interface ThreeDBackgroundProps {
    variant?: 'hero' | 'features' | 'dark';
}

export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({ variant = 'hero' }) => {
    return (
        <div className="absolute inset-0 -z-10">
            <Canvas
                camera={{ position: [0, 0, 8], fov: 50 }}
                className="w-full h-full"
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0ea5e9" />
                
                {variant === 'hero' && (
                    <>
                        {/* Central router model */}
                        <RouterModel />
                        
                        {/* Signal rings */}
                        <SignalRings />
                        
                        {/* Floating signal spheres */}
                        <SignalSphere position={[-3, 2, -2]} color="#0ea5e9" speed={1.2} />
                        <SignalSphere position={[3, -1, -3]} color="#8b5cf6" speed={0.8} />
                        <SignalSphere position={[-2, -2, -1]} color="#22d3ee" speed={1.5} />
                        <SignalSphere position={[2, 3, -2]} color="#38bdf8" speed={1} />
                        
                        {/* Particles */}
                        <Particles count={80} />
                    </>
                )}
                
                {variant === 'features' && (
                    <>
                        <SignalSphere position={[-4, 1, -2]} color="#0ea5e9" speed={0.5} />
                        <SignalSphere position={[4, -1, -3]} color="#8b5cf6" speed={0.7} />
                        <SignalSphere position={[0, 3, -2]} color="#22d3ee" speed={0.6} />
                        <Particles count={50} />
                    </>
                )}
                
                {variant === 'dark' && (
                    <>
                        <SignalSphere position={[-3, 0, -2]} color="#1e293b" speed={0.3} />
                        <SignalSphere position={[3, 1, -3]} color="#334155" speed={0.4} />
                        <Particles count={30} />
                    </>
                )}
            </Canvas>
        </div>
    );
};

export default ThreeDBackground;
