import { useRef, useEffect, useState, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface PolygonCanvasProps {
  imageUrl: string;
  polygon: Point[];
  onPolygonChange: (polygon: Point[]) => void;
}

export function PolygonCanvas({ imageUrl, polygon, onPolygonChange }: PolygonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastDrawnRef = useRef({ polygon: [] as Point[], imageUrl: '', width: 0, height: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      setImageSize({ width: img.width, height: img.height });
      imageRef.current = img;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas whenever needed
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded || !imageRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get actual rendered dimensions
    const rect = canvas.getBoundingClientRect();
    const renderWidth = rect.width;
    const renderHeight = rect.height;

    // Only redraw if something changed
    const polygonKey = JSON.stringify(polygon);
    if (
      lastDrawnRef.current.polygon === polygonKey &&
      lastDrawnRef.current.imageUrl === imageUrl &&
      lastDrawnRef.current.width === renderWidth &&
      lastDrawnRef.current.height === renderHeight
    ) {
      return;
    }

    // Set canvas internal resolution to match rendered size
    canvas.width = Math.round(renderWidth);
    canvas.height = Math.round(renderHeight);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image scaled to fill canvas
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    // Scale factor - points are normalized [0,1], image is stretched to canvas
    const scaleX = canvas.width;
    const scaleY = canvas.height;

    // Draw polygon fill
    if (polygon.length >= 3) {
      ctx.beginPath();
      const firstPt = polygon[0];
      ctx.moveTo(firstPt.x * scaleX, firstPt.y * scaleY);
      for (let i = 1; i < polygon.length; i++) {
        const pt = polygon[i];
        ctx.lineTo(pt.x * scaleX, pt.y * scaleY);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw dashed line from last point
    if (polygon.length >= 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const lastPt = polygon[polygon.length - 1];
      ctx.moveTo(lastPt.x * scaleX, lastPt.y * scaleY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw point handles
    polygon.forEach((pt, index) => {
      const x = pt.x * scaleX;
      const y = pt.y * scaleY;
      ctx.beginPath();
      ctx.arc(x, y, hoveredPoint === index ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = hoveredPoint === index ? '#ef4444' : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Track what we just drew
    lastDrawnRef.current = {
      polygon: polygonKey,
      imageUrl,
      width: renderWidth,
      height: renderHeight,
    };
  }, [imageLoaded, imageUrl, polygon, hoveredPoint]);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    // Check if canvas has been sized yet
    if (rect.width === 0 || rect.height === 0) return null;

    // Normalize to [0, 1] based on actual rendered size
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    return { x, y };
  }, []);

  const findPointAtPosition = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): number | null => {
      const point = getCanvasPoint(e);
      if (!point) return null;

      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0) return null;

      // Threshold based on canvas size
      const threshold = 15 / Math.min(canvas.width, canvas.height);

      for (let i = 0; i < polygon.length; i++) {
        const pt = polygon[i];
        const dx = pt.x - point.x;
        const dy = pt.y - point.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          return i;
        }
      }
      return null;
    },
    [getCanvasPoint, polygon]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pointIndex = findPointAtPosition(e);
      if (pointIndex !== null) return;

      const point = getCanvasPoint(e);
      if (point && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1) {
        onPolygonChange([...polygon, point]);
      }
    },
    [findPointAtPosition, getCanvasPoint, onPolygonChange, polygon]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pointIndex = findPointAtPosition(e);
      if (pointIndex !== null && polygon.length > 3) {
        const newPolygon = [...polygon];
        newPolygon.splice(pointIndex, 1);
        onPolygonChange(newPolygon);
      }
    },
    [findPointAtPosition, onPolygonChange, polygon]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pointIndex = findPointAtPosition(e);
      setHoveredPoint(pointIndex);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = pointIndex !== null ? 'pointer' : 'crosshair';
      }
    },
    [findPointAtPosition]
  );

  return (
    <div
      className="relative w-full bg-black rounded-md overflow-hidden"
      style={{ aspectRatio: '16/9' }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        className="absolute inset-0 w-full h-full"
      />
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-muted-foreground">Loading snapshot...</p>
        </div>
      )}
    </div>
  );
}
