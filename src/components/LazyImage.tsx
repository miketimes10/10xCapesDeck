/**
 * Lazy-loaded image component with progressive loading
 * RULE-020: Standardized lazy-load component structure
 * RULE-018: Progressive asset loading with Intersection Observer
 * RULE-008: Respect prefers-reduced-motion
 */

import { useEffect, useRef, useState } from 'react';
import { lazyLoadManager } from '../lib/intersection-observer';
import { bunnyImage, bunnyThumbnail, type BunnyImageOptions } from '../lib/bunny-cdn';

export interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
	src: string;
	alt: string;
	priority?: boolean;
	width?: number;
	height?: number;
	quality?: number;
	aspectRatio?: string;
	blurPlaceholder?: boolean;
	pullZone?: string; // Optional: specify a named pull zone (e.g., "images", "assets")
}

export function LazyImage({
	src,
	alt,
	priority = false,
	width,
	height,
	quality,
	aspectRatio,
	blurPlaceholder = true,
	pullZone,
	className = '',
	...props
}: LazyImageProps): JSX.Element {
	// For priority images without blur placeholder, show immediately
	const [isLoaded, setIsLoaded] = useState(priority && !blurPlaceholder);
	const [shouldLoad, setShouldLoad] = useState(priority);
	const [reducedMotion, setReducedMotion] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// RULE-008: Respect prefers-reduced-motion
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		setReducedMotion(mediaQuery.matches);

		const handleChange = (e: MediaQueryListEvent): void => {
			setReducedMotion(e.matches);
			if (e.matches && !shouldLoad) {
				setShouldLoad(true);
			}
		};

		mediaQuery.addEventListener('change', handleChange);

		return () => {
			mediaQuery.removeEventListener('change', handleChange);
		};
	}, [shouldLoad]);

	useEffect(() => {
		if (priority || reducedMotion || shouldLoad) {
			return;
		}

		const element = containerRef.current;
		if (!element) return;

		// RULE-018: Use singleton lazyLoadManager
		lazyLoadManager.observe(element, (entry) => {
			if (entry.isIntersecting) {
				setShouldLoad(true);
				lazyLoadManager.unobserve(element);
			}
		});

		return () => {
			if (element) {
				lazyLoadManager.unobserve(element);
			}
		};
	}, [priority, reducedMotion, shouldLoad]);

	const imageOptions: BunnyImageOptions = {
		width,
		height,
		quality,
		aspectRatio,
		pullZone,
	};

	// Files in public/images are served locally, not from the CDN
	const isLocal = src.startsWith('/images/');
	const fullImageUrl = isLocal ? src : bunnyImage(src, imageOptions);
	const thumbnailUrl = blurPlaceholder && !isLocal ? bunnyThumbnail(src, width ? Math.min(width, 50) : 50, pullZone) : fullImageUrl;

	return (
		<div ref={containerRef} className={`relative overflow-hidden ${className}`}>
			{blurPlaceholder && !isLoaded && (
				<img
					src={thumbnailUrl}
					alt=""
					aria-hidden="true"
					crossOrigin="anonymous" // Required for mobile browsers CORS (iOS Safari)
					className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
					style={{ filter: 'blur(10px)' }}
				/>
			)}
			{shouldLoad && (
				<img
					ref={imgRef}
					src={fullImageUrl}
					alt={alt}
					loading={priority ? 'eager' : 'lazy'}
					crossOrigin="anonymous" // Required for mobile browsers CORS (iOS Safari)
					onLoad={() => setIsLoaded(true)}
					onError={() => {
						// If image fails to load, show it anyway (might be CDN config issue)
						setIsLoaded(true);
						console.warn(`[LazyImage] Failed to load image: ${fullImageUrl}`);
					}}
					className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
					{...props}
				/>
			)}
		</div>
	);
}

