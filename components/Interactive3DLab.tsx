
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TechnicalBlueprint } from '../types';

interface Interactive3DLabProps {
  blueprint: TechnicalBlueprint;
}

const Interactive3DLab: React.FC<Interactive3DLabProps> = ({ blueprint }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // Create a persistent clipping plane object
  const clippingPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100));

  const [activeView, setActiveView] = useState<'free' | 'buccal' | 'lingual' | 'occlusal' | 'cross'>('free');
  const [isAnimating, setIsAnimating] = useState(false);

  // Camera Animation Helper
  const animateCamera = useCallback((targetPos: THREE.Vector3, targetLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    setIsAnimating(true);
    const startPos = cameraRef.current.position.clone();
    const duration = 800;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      cameraRef.current!.position.lerpVectors(startPos, targetPos, ease);
      controlsRef.current!.target.lerp(targetLookAt, ease);
      controlsRef.current!.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };
    requestAnimationFrame(animate);
  }, []);

  const setClinicalView = (view: 'buccal' | 'lingual' | 'occlusal' | 'cross') => {
    if (isAnimating) return;
    setActiveView(view);
    
    // Always disable local clipping first
    if (rendererRef.current) rendererRef.current.localClippingEnabled = false;
    clippingPlaneRef.current.constant = 100;

    switch (view) {
      case 'buccal':
        animateCamera(new THREE.Vector3(0, 0, 10));
        break;
      case 'lingual':
        animateCamera(new THREE.Vector3(0, 0, -10));
        break;
      case 'occlusal':
        animateCamera(new THREE.Vector3(0, 10, 0));
        break;
      case 'cross':
        // Enable clipping for cross-section
        clippingPlaneRef.current.constant = 0;
        if (rendererRef.current) rendererRef.current.localClippingEnabled = true;
        animateCamera(new THREE.Vector3(8, 2, 0));
        break;
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x020617);
    
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(8, 8, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = false; // Important
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Enhanced Medical Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const backLight = new THREE.DirectionalLight(0x3b82f6, 0.8);
    backLight.position.set(-5, -5, -5);
    scene.add(backLight);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Dynamic Component Generation
    const safeVisualParams = blueprint.visualParameters || [];
    const safeComponents = blueprint.structuralComponents || [];
    
    const visualMap = new Map(safeVisualParams.map(p => [p.componentId, p]));

    if (safeComponents.length === 0) {
      // Fallback object if no components
      const geometry = new THREE.SphereGeometry(1, 32, 32);
      const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
      mainGroup.add(new THREE.Mesh(geometry, material));
    }

    safeComponents.forEach((component, index) => {
      const visual = visualMap.get(component.partName) || safeVisualParams[index] || safeVisualParams[0];
      let geometry: THREE.BufferGeometry;
      
      const name = (component.partName || "").toLowerCase();
      if (name.includes('root') || name.includes('جذر')) {
        geometry = new THREE.CylinderGeometry(0.6, 0.2, 4, 32);
      } else if (name.includes('crown') || name.includes('تاج')) {
        geometry = new THREE.CapsuleGeometry(1, 1.2, 8, 32);
      } else if (name.includes('pulp') || name.includes('لب')) {
        geometry = new THREE.IcosahedronGeometry(0.5, 2);
      } else {
        geometry = new THREE.SphereGeometry(0.8, 32, 32);
      }

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(visual?.colorHex || '#f8fafc'),
        metalness: 0.1,
        roughness: 0.3,
        clippingPlanes: [clippingPlaneRef.current], // Attach the shared plane
        clipShadows: true,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // Calculate position based on blueprint metadata
      if (visual?.spatialPosition) {
        mesh.position.set(
          (visual.spatialPosition.x / 100) * 8 - 4,
          (visual.spatialPosition.y / 100) * 8 - 4,
          (visual.spatialPosition.z / 100) * 8 - 4
        );
      } else {
        mesh.position.y = index * 1.5 - 2;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mainGroup.add(mesh);
    });

    // Simple Render Loop
    const render = () => {
      frameIdRef.current = requestAnimationFrame(render);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    render();

    // Resize Handler using ResizeObserver for container
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    resizeObserverRef.current = new ResizeObserver(() => {
        handleResize();
    });
    
    if (mountRef.current) {
        resizeObserverRef.current.observe(mountRef.current);
    }
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
      // Dispose geometries and materials
      mainGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [blueprint]);

  return (
    <div className="w-full h-full relative group bg-slate-950 overflow-hidden rounded-[3rem]">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      
      {/* 3D Model Header Info */}
      <div className="absolute top-8 right-8 text-right pointer-events-none z-10">
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 px-6 py-4 rounded-3xl shadow-2xl">
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mb-1">المحاكي السريري 3D</p>
          <h3 className="text-xl font-black text-white">{blueprint?.modelMetadata?.entityName || 'نموذج ثلاثي الأبعاد'}</h3>
          <p className="text-[10px] text-slate-500 font-mono italic mt-1">{blueprint?.modelMetadata?.scientificClassification}</p>
        </div>
      </div>

      {/* Clinical View Presets Panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-2xl p-2 rounded-[2.5rem] border border-white/10 shadow-2xl z-50 overflow-x-auto max-w-[90%] no-scrollbar">
        <button 
          onClick={() => setClinicalView('buccal')}
          className={`whitespace-nowrap px-6 py-3 rounded-full text-[10px] font-black transition-all duration-300 ${activeView === 'buccal' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          منظر خدّي
        </button>

        <button 
          onClick={() => setClinicalView('lingual')}
          className={`whitespace-nowrap px-6 py-3 rounded-full text-[10px] font-black transition-all duration-300 ${activeView === 'lingual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          منظر لساني
        </button>

        <button 
          onClick={() => setClinicalView('occlusal')}
          className={`whitespace-nowrap px-6 py-3 rounded-full text-[10px] font-black transition-all duration-300 ${activeView === 'occlusal' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          منظر إطباقي
        </button>

        <div className="w-px h-6 bg-white/10 mx-1"></div>

        <button 
          onClick={() => setClinicalView('cross')}
          className={`whitespace-nowrap px-6 py-3 rounded-full text-[10px] font-black transition-all duration-300 flex items-center gap-2 ${activeView === 'cross' ? 'bg-rose-600 text-white shadow-lg' : 'text-rose-400 hover:bg-rose-600/10'}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758L5 19m0-14l4.121 4.121" strokeWidth={2.5}/></svg>
          مقطع عرضي
        </button>
      </div>

      {/* Navigation Help */}
      <div className="absolute top-8 left-8 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/5">
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">التحكم الحر متاح</p>
        </div>
      </div>

      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none border-4 border-blue-500/20 rounded-[3rem] animate-pulse z-20"></div>
      )}
    </div>
  );
};

export default Interactive3DLab;
