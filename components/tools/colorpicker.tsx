import { useState, useRef, useEffect } from 'react';

export default function ImageColorPicker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [clientPosition, setClientPosition] = useState({ x: 0, y: 0 });
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);

  // Handle paste and file drop events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items || [];
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Handle ESC key for exit maximize mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Process image file
  const handleImageFile = (file: Blob) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        drawImageToCanvas(img);
      };
      if (e.target && typeof e.target.result === 'string') {
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Draw image to canvas at responsive size
  const drawImageToCanvas = (img: CanvasImageSource) => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageElement = img as HTMLImageElement;
    
    // Calculate container max width (account for padding/borders)
    const containerWidth = containerRef.current.clientWidth - 2; // 4px padding on each side
    
    // Set canvas dimensions based on image aspect ratio
    let canvasWidth, canvasHeight;
    
    if (imageElement.width <= containerWidth) {
      // Image fits within container width - use original dimensions
      canvasWidth = imageElement.width;
      canvasHeight = imageElement.height;
    } else {
      // Image is wider than container - scale proportionally to fit width
      canvasWidth = containerWidth;
      canvasHeight = (imageElement.height / imageElement.width) * containerWidth;
    }
    
    // Set canvas dimensions
    canvas.width = imageElement.width; // Keep original image dimensions
    canvas.height = imageElement.height;
    
    // Apply CSS styling for responsive display while maintaining aspect ratio
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    canvas.style.maxWidth = '100%';
    
    // Make container height dynamic based on image aspect ratio
    containerRef.current.style.height = 'auto';
    containerRef.current.style.overflowX = 'auto';
    containerRef.current.style.overflowY = 'auto';
    
    if (ctx) {
      ctx.drawImage(img, 0, 0, imageElement.width, imageElement.height);
    }
  };

  // Handle window resize to adjust canvas dimensions
  useEffect(() => {
    const handleResize = () => {
      if (image) {
        drawImageToCanvas(image);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleImageFile(files[0]);
    }
  };

  // Update mouse position and color when hovering over the image
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Store client position for the cursor indicator
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    setClientPosition({ x: clientX, y: clientY });
    
    // Calculate position in canvas coordinates accounting for scaling
    const x = Math.floor(clientX * (canvas.width / rect.width));
    const y = Math.floor(clientY * (canvas.height / rect.height));
    
    // Make sure coordinates are within bounds
    const boundedX = Math.max(0, Math.min(x, canvas.width - 1));
    const boundedY = Math.max(0, Math.min(y, canvas.height - 1));
    
    setPosition({ x: boundedX, y: boundedY });
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixelData = ctx.getImageData(boundedX, boundedY, 1, 1).data;
    // Remove the # from hexColor
    const hexColor = `${pixelData[0].toString(16).padStart(2, '0')}${pixelData[1].toString(16).padStart(2, '0')}${pixelData[2].toString(16).padStart(2, '0')}`;
    setHoveredColor(hexColor);  
    
    updateZoomCanvas(boundedX, boundedY);
  };

  // Update zoom canvas with magnified view and pixel grid
  const updateZoomCanvas = (x: number, y: number) => {
    if (!canvasRef.current || !zoomCanvasRef.current) return;
    
    const sourceCanvas = canvasRef.current;
    const zoomCanvas = zoomCanvasRef.current;
    const sourceCtx = sourceCanvas.getContext('2d');
    const zoomCtx = zoomCanvas.getContext('2d');
    
    // Clear zoom canvas
    if (zoomCtx) {
      zoomCtx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);
    }
    
    // Size of area to magnify - use odd number to have a center pixel
    const size = 9;
    
    // Get image data for the area around the cursor
    const sourceX = Math.max(0, Math.min(x - Math.floor(size/2), sourceCanvas.width - size));
    const sourceY = Math.max(0, Math.min(y - Math.floor(size/2), sourceCanvas.height - size));
    
    if (!sourceCtx) return;
    const imageData = sourceCtx.getImageData(sourceX, sourceY, size, size);
    
    // Calculate pixel size in the zoom canvas
    const pixelSize = Math.floor(zoomCanvas.width / size);
    
    // Draw each pixel with a border to create the grid
    if (zoomCtx) {
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const index = (j * size + i) * 4;
          const r = imageData.data[index];
          const g = imageData.data[index + 1];
          const b = imageData.data[index + 2];
          
          zoomCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          zoomCtx.fillRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
          
          // Draw grid lines
          zoomCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          zoomCtx.lineWidth = 0.5;
          zoomCtx.strokeRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    
    // Draw crosshair
    if (!zoomCtx) return;
    
    // Highlight the center pixel with a brighter border
    const centerPixelX = Math.floor(size / 2) * pixelSize;
    const centerPixelY = Math.floor(size / 2) * pixelSize;
    
    zoomCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    zoomCtx.lineWidth = 2;
    zoomCtx.strokeRect(centerPixelX, centerPixelY, pixelSize, pixelSize);
  };

  // Handle click to select and copy color
  const handleClick = () => {
    if (!canvasRef.current || !hoveredColor) return;
    
    setSelectedColor(hoveredColor);
    
    // Copy to clipboard
    navigator.clipboard.writeText(hoveredColor)
      .then(() => {
        setCopyMessage(`Copied #${hoveredColor} to clipboard!`);
        // setTimeout(() => setCopyMessage(''), 2000);
      })
      .catch(err => {
        setCopyMessage('Failed to copy to clipboard');
        console.error('Failed to copy:', err);
      });
  };

  // Toggle maximize mode
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    // When changing modes, we need to redraw to adjust for new container size
    setTimeout(() => {
      if (image) {
        drawImageToCanvas(image);
      }
    }, 0);
  };

  // Calculate magnifier position safely
  const getMagnifierPosition = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { left: '0px', top: '0px' };
    }

    // Get canvas client rect for proper positioning
    const rect = canvas.getBoundingClientRect();
    
    // Default position values
    let left = '20px';
    let top = '20px';
    
    // Use client position for the magnifier position calculation
    if (rect.width > 0 && rect.height > 0) {
      // Horizontal position
      if (clientPosition.x > rect.width / 2) {
        left = `${clientPosition.x - 130}px`;
      } else {
        left = `${clientPosition.x + 20}px`;
      }
      
      // Vertical position
      if (clientPosition.y > rect.height / 2) {
        top = `${clientPosition.y - 130}px`;
      } else {
        top = `${clientPosition.y + 20}px`;
      }
    }
    
    return { left, top };
  };

  // Determine component display modes
  const hasImage = image !== null;
  const hasSelectedColor = selectedColor !== null;
  
  // Calculate magnifier position
  const magnifierPosition = getMagnifierPosition();

  return (
    <div 
      ref={appContainerRef}
      className={`${isMaximized ? 'fixed inset-0 z-50 bg-white overflow-auto' : 'w-full max-w-3xl mx-auto bg-gray-100 rounded-lg shadow-md'}`}
      style={{ 
        padding: isMaximized ? '1rem' : '1rem',
      }}
    >
      {/* Header with title and maximize button */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">Image Color Picker</h2>
        
        {hasImage && (
          <button 
            onClick={toggleMaximize} 
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            aria-label={isMaximized ? "Exit full view" : "Full view"}
            title={isMaximized ? "Exit full view (ESC)" : "Full view"}
          >
            {isMaximized ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
            )}
          </button>
        )}
      </div>
      
      {/* Instructions */}
      <div className="mb-4 text-center">
        <p className="text-gray-700">
          {!hasImage ? 'Paste an image (Ctrl+V) or upload one below:' : 
            'Hover over the image to magnify. Click to copy the color hex code.'}
        </p>
      </div>
      
      {/* File upload button */}
      {!hasImage && (
        <div className="mb-4 flex justify-center">
          <label className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded cursor-pointer">
            Upload Image
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}
      
      {/* Container for canvas - Responsive height based on content */}
      <div 
        ref={containerRef} 
        className={`relative bg-gray-200 rounded-lg overflow-auto ${isMaximized ? 'flex justify-center' : ''}`}
        style={{ 
          minHeight: hasImage ? 'auto' : '240px',
          maxHeight: isMaximized ? 'calc(100vh - 180px)' : '600px',
          padding: '4px',
        }}
      >
        {!hasImage ? (
          <div className="text-gray-500 text-center p-4 border-2 border-gray-300 rounded-lg h-full flex items-center justify-center">
            <div>
              <p>Paste an image here (Ctrl+V)</p>
              <p className="text-sm mt-2">or use the upload button above</p>
            </div>
          </div>
        ) : (
          <div className="relative" style={{ 
            border: '2px solid #d1d5db', // gray-300 border
            borderRadius: '0.5rem', // rounded-lg
            background: '#f9fafb', // gray-50
            display: 'inline-block', // Important for sizing to content
            minWidth: 'min-content', // Ensures container respects canvas width
          }}>
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              className="cursor-default block"
              style={{
                maxWidth: '100%',
                height: 'auto',
              }}
            />
            
            {/* Custom cursor indicator - position based on client coordinates */}
            {hoveredColor && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  left: clientPosition.x,
                  top: clientPosition.y,
                  width: '15px',
                  height: '15px',
                  border: '1px solid white',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 1px black',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 5
                }}
              />
            )}
            
            {/* Magnifier lens with pixel grid */}
            {hoveredColor && (
              <div 
                className="absolute bg-white border-2 border-gray-400 rounded-lg shadow-lg overflow-hidden"
                style={{
                  left: magnifierPosition.left,
                  top: magnifierPosition.top,
                  width: '120px',
                  height: '140px',
                  zIndex: 10
                }}
              >
                <canvas 
                  ref={zoomCanvasRef} 
                  width={90} 
                  height={90} 
                  className="block mx-auto mt-2"
                />
                <div 
                  className="text-xs text-center py-1 font-mono mt-1"
                  style={{ 
                    backgroundColor: `#${hoveredColor}`, 
                    color: isLightColor(hoveredColor) ? '#000' : '#fff' 
                  }}
                >
                  #{hoveredColor}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Selected color display */}
      {hasSelectedColor && (
        <div className="mt-4 flex items-center border rounded-lg overflow-hidden">
          <div 
            className="w-16 h-16" 
            style={{ backgroundColor: `#${selectedColor}` }}
          ></div>
          <div className="flex-1 px-4 py-2">
            <div className="font-mono font-bold text-black">#{selectedColor}</div>
            {copyMessage && (
              <div className="text-sm text-green-600">{copyMessage}</div>
            )}
          </div>
        </div>
      )}
      
      {/* Maximize note */}
      {isMaximized && (
        <div className="absolute bottom-4 right-4 text-sm text-gray-500">
          Press ESC to exit full view
        </div>
      )}
    </div>
  );
}

// Helper function to determine if a color is light or dark
function isLightColor(hexColor: string) {
  // Remove the # if present
  const hex = hexColor.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate perceived brightness (YIQ equation)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return true if the color is light
  return brightness > 128;
}