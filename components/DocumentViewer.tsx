
import React, { useState, useRef, useEffect } from 'react';
import { LessonDocument } from '../types';

interface Props {
  documents: LessonDocument[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  zoomLevel: number;
  onZoomChange: (level: number) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isReadOnly?: boolean;
}

const DocumentViewer: React.FC<Props> = ({ 
  documents, 
  currentIndex, 
  onIndexChange, 
  zoomLevel, 
  onZoomChange,
  isReadOnly
}) => {
  const currentDoc = documents[currentIndex];
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom 1 olduğunda veya belge değiştiğinde konumu sıfırla
  useEffect(() => {
    if (zoomLevel === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoomLevel, currentIndex]);

  // Handle Mouse Wheel Zoom (with Ctrl key)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        onZoomChange(Math.max(0.5, Math.min(4, zoomLevel + delta)));
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener('wheel', handleWheel);
    };
  }, [zoomLevel, onZoomChange]);

  const nextDoc = () => {
    if (currentIndex < documents.length - 1) onIndexChange(currentIndex + 1);
  };

  const prevDoc = () => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(dist);
      return;
    }

    if (zoomLevel <= 1 && !('touches' in e)) return;
    
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    // Handle Pinch to Zoom
    if ('touches' in e && e.touches.length === 2 && lastTouchDistance !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastTouchDistance;
      const scaleDelta = delta * 0.01;
      onZoomChange(Math.max(0.5, Math.min(4, zoomLevel + scaleDelta)));
      setLastTouchDistance(dist);
      return;
    }

    if (!isDragging || (zoomLevel <= 1 && !('touches' in e))) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setLastTouchDistance(null);
  };

  const handleDoubleClick = () => {
    onZoomChange(1);
    setPosition({ x: 0, y: 0 });
  };

  // Resim kaynağını belirle (URL veya Base64)
  const imageSrc = currentDoc 
    ? (currentDoc.imageUrl || (currentDoc.data ? `data:${currentDoc.type};base64,${currentDoc.data}` : '')) 
    : '';

  return (
    <div 
      ref={containerRef}
      className={`h-full w-full bg-[#f0f2f5] flex items-center justify-center overflow-hidden relative select-none touch-none ${zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'} ${isDragging ? 'cursor-grabbing' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Kalıcı Navigasyon Okları (Birden fazla belge varsa her zaman görünür) */}
      {documents.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); prevDoc(); }}
            disabled={currentIndex === 0}
            className={`absolute left-4 z-40 p-4 bg-white/95 rounded-2xl shadow-2xl transition-all ${currentIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-80 hover:opacity-100 hover:scale-105 active:scale-95 text-slate-800'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); nextDoc(); }}
            disabled={currentIndex === documents.length - 1}
            className={`absolute right-4 z-40 p-4 bg-white/95 rounded-2xl shadow-2xl transition-all ${currentIndex === documents.length - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-80 hover:opacity-100 hover:scale-105 active:scale-95 text-slate-800'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      {!currentDoc ? (
        <div className="text-center animate-fade-in px-10">
          <div className="w-24 h-24 bg-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-12 h-12 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c0 .621 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          {isReadOnly ? (
             <>
               <p className="text-slate-500 font-semibold text-lg tracking-tight">Keine Lektion verfügbar</p>
               <p className="text-slate-400 text-sm mt-2">Bitte warte, bis Mari eine Lektion für dich bereitstellt.</p>
             </>
          ) : (
             <>
               <p className="text-slate-500 font-semibold text-lg tracking-tight">Deine Lektion hochladen</p>
               <p className="text-slate-400 text-sm mt-2">Klicke oben auf "+" um eine Datei hinzuzufügen.</p>
             </>
          )}
        </div>
      ) : (
        <div 
          className={`relative transition-transform duration-150 ${isDragging ? 'ease-linear' : 'ease-out'}`}
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
          }}
        >
          <div className="bg-white shadow-2xl p-1 rounded-sm">
            {imageSrc ? (
              <img 
                src={imageSrc}
                alt={currentDoc.name} 
                className="max-w-[85vw] max-h-[70vh] object-contain pointer-events-none"
                loading="lazy"
              />
            ) : (
              <div className="p-10 text-slate-400">Bild wird geladen...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
