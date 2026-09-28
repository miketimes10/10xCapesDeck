/**
 * Lazy-loaded video component with progressive loading
 * RULE-020: Standardized lazy-load component structure
 * RULE-018: Progressive asset loading with Intersection Observer
 * RULE-014: Video lazy loading with preload="none"
 * RULE-008: Respect prefers-reduced-motion
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { lazyLoadManager } from '../lib/intersection-observer';
import { bunnyImage, bunnyVideoFile, bunnyVideoPoster, bunnyVideoUrl } from '../lib/bunny-cdn';

export interface LazyVideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
	src?: string;
	videoId?: string;
	poster?: string;
	priority?: boolean;
	pullZone?: string;
	className?: string;
	showUnmuteButton?: boolean;
	unmuteButtonText?: string;
}

export function LazyVideo({
	src,
	videoId,
	poster: customPoster,
	priority = false,
	pullZone = 'storage',
	className = '',
	showUnmuteButton = false,
	unmuteButtonText = 'unmute',
	...props
}: LazyVideoProps): React.JSX.Element {
	// If priority is true, start with shouldLoad=true and isIntersecting=true
	// This ensures videos load immediately on mobile when using client:load
	const [shouldLoad, setShouldLoad] = useState(priority);
	const [isIntersecting, setIsIntersecting] = useState(priority); // Start as intersecting if priority
	const [reducedMotion, setReducedMotion] = useState(false);
	const [isMuted, setIsMuted] = useState(true);
	const containerRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const savedTimeRef = useRef<number>(0);

	// Files in public/videos are served locally, not from the CDN
	const isLocal = (path: string) => path.startsWith('/videos/');

	// Determine final URLs
	const videoUrl = videoId
		? bunnyVideoUrl(videoId)
		: (src
			? (src.startsWith('http://') || src.startsWith('https://') || isLocal(src)
				? src
				: bunnyVideoFile(src, pullZone))
			: '');

	// RULE-015: Use Bunny Optimizer for dynamic resizing/format conversion
	const posterUrl = videoId
		? bunnyVideoPoster(videoId)
		: (customPoster ? (customPoster.startsWith('http') || isLocal(customPoster) ? customPoster : bunnyImage(customPoster, { quality: 85 })) : undefined);

	useEffect(() => {
		// RULE-008: Respect prefers-reduced-motion
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		setReducedMotion(mediaQuery.matches);

		const handleChange = (e: MediaQueryListEvent): void => {
			setReducedMotion(e.matches);
			if (e.matches) {
				setShouldLoad(true);
			}
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) {
			return;
		}

		// Always load priority videos immediately and mark as intersecting
		if (priority || reducedMotion) {
			setShouldLoad(true);
			setIsIntersecting(true);
		}

		// Check if element is already in viewport (fixes mobile gray box issue)
		// Use multiple checks with delays to ensure layout is complete on mobile
		const checkInitialIntersection = (): void => {
			const rect = element.getBoundingClientRect();
			// More lenient check: element is in viewport or very close to it
			// On mobile, check if element is visible (has dimensions and is in viewport)
			const hasDimensions = rect.width > 0 && rect.height > 0;
			// More aggressive check for mobile: if element has dimensions, it's likely visible
			// Also check if it's within 2 viewport heights (for scroll-snap sections)
			const isInViewport = rect.top < window.innerHeight * 2 && rect.bottom > -window.innerHeight * 0.5;
			
			// On mobile, if element has dimensions and is near viewport, load it
			// This handles cases where scroll-snap sections are just off-screen
			if (hasDimensions && (isInViewport || priority)) {
				setIsIntersecting(true);
				// If already in viewport, load immediately (especially important for mobile)
				setShouldLoad(true);
			}
		};

		// For mobile: Use requestAnimationFrame to ensure layout is complete
		// Then check multiple times with delays
		let timeoutId1: ReturnType<typeof setTimeout> | null = null;
		let timeoutId2: ReturnType<typeof setTimeout> | null = null;
		let timeoutId3: ReturnType<typeof setTimeout> | null = null;
		let timeoutId4: ReturnType<typeof setTimeout> | null = null;

		const rafId = requestAnimationFrame(() => {
			checkInitialIntersection();
			
			// Check immediately and after delays (for mobile layout completion)
			timeoutId1 = setTimeout(checkInitialIntersection, 100);
			timeoutId2 = setTimeout(checkInitialIntersection, 300);
			timeoutId3 = setTimeout(checkInitialIntersection, 500);
			timeoutId4 = setTimeout(checkInitialIntersection, 1000); // Extra check for slow mobile
		});

		// Always observe for intersection to handle pause/resume, even for priority videos
		lazyLoadManager.observe(element, (entry) => {
			if (entry.isIntersecting) {
				// Video scrolled into view
				setIsIntersecting(true);
				setShouldLoad(true);
			} else {
				// Video scrolled out of view - pause and save time
				setIsIntersecting(false);
				
				// Save current time and pause before unloading
				if (videoRef.current) {
					savedTimeRef.current = videoRef.current.currentTime;
					videoRef.current.pause();
				}

				// RULE-018: Unload videos from sections >2 viewports away
				// Only unload if not priority (keep priority videos loaded)
				if (!priority && !reducedMotion) {
					setShouldLoad(false);
				}
			}
		});

		return () => {
			cancelAnimationFrame(rafId);
			if (timeoutId1) clearTimeout(timeoutId1);
			if (timeoutId2) clearTimeout(timeoutId2);
			if (timeoutId3) clearTimeout(timeoutId3);
			if (timeoutId4) clearTimeout(timeoutId4);
			lazyLoadManager.unobserve(element);
		};
	}, [priority, reducedMotion]);

	// Additional safeguard: If shouldLoad becomes true but isIntersecting is false,
	// set isIntersecting to true to ensure video is visible (fixes mobile loading issues)
	// This handles cases where intersection detection hasn't fired yet
	useEffect(() => {
		if (shouldLoad && !isIntersecting && !priority) {
			// Use a small delay to allow intersection check to run first
			const safeguardTimeout = setTimeout(() => {
				// If still loaded but not intersecting, mark as intersecting to show video
				// This ensures videos load on mobile even if intersection detection is delayed
				setIsIntersecting(true);
			}, 200);
			
			return () => clearTimeout(safeguardTimeout);
		}
	}, [shouldLoad, isIntersecting, priority]);

	// Ensure video is muted immediately when element is created, and set volume to 55% when unmuted
	useEffect(() => {
		const video = videoRef.current;
		if (video && shouldLoad) {
			if (props.muted !== false) {
				video.muted = true;
				video.volume = 0;
				// Set attributes to ensure mobile compatibility
				video.setAttribute('muted', '');
				video.setAttribute('playsinline', '');
			} else {
				// Set volume to 55% when not muted
				video.volume = 0.55;
			}
		}
	}, [shouldLoad, props.muted]);

	// Listen for unmute events and set volume to 55%
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !shouldLoad) return;

		const handleVolumeChange = (): void => {
			// Update muted state for button visibility
			setIsMuted(video.muted);
			
			// When video is unmuted, set volume to 55%
			if (!video.muted && video.volume > 0 && video.volume < 0.1) {
				video.volume = 0.55;
			}
		};

		// Set initial muted state
		setIsMuted(video.muted);

		video.addEventListener('volumechange', handleVolumeChange);
		
		return () => {
			video.removeEventListener('volumechange', handleVolumeChange);
		};
	}, [shouldLoad]);

	// Handle unmute button click
	const handleUnmute = (): void => {
		const video = videoRef.current;
		if (video) {
			video.muted = false;
			video.volume = 0.55;
		}
	};

	// Handle play/pause and resume for native video
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !shouldLoad || reducedMotion) {
			return;
		}

		// Pause video when not intersecting
		if (!isIntersecting) {
			savedTimeRef.current = video.currentTime;
			video.pause();
			return;
		}

		// Function to restore time and play
		const restoreAndPlay = (): void => {
			// Ensure video is properly muted before attempting play (critical for mobile)
			if (props.muted !== false) {
				video.muted = true;
				video.volume = 0;
			}

			// Restore saved time if resuming
			if (savedTimeRef.current > 0 && video.readyState >= 2) {
				video.currentTime = savedTimeRef.current;
			}

			// Only autoplay if props.autoPlay is not false
			if (props.autoPlay !== false) {
				// Use a promise to handle play() to avoid "play() request was interrupted" errors
				const playPromise = video.play();
				if (playPromise !== undefined) {
					playPromise.catch((error) => {
						console.log('Video autoplay failed, will retry:', error.message);
						// On mobile, sometimes play fails even with muted. Retry with a slight delay
						setTimeout(() => {
							if (video.muted && video.readyState >= 2) {
								video.play().catch((retryError) => {
									console.log('Video autoplay retry failed:', retryError.message);
									// Final fallback: ensure video can be played on user interaction
									// Silently fail - user can tap to play if needed
								});
							}
						}, 200);
					});
				}
			}
		};

		// Wait for video to have enough data loaded
		if (video.readyState >= 3) { // HAVE_FUTURE_DATA - enough data to play
			restoreAndPlay();
		} else {
			// Wait for video to load enough data
			const handleCanPlayThrough = (): void => {
				restoreAndPlay();
				video.removeEventListener('canplaythrough', handleCanPlayThrough);
			};
			video.addEventListener('canplaythrough', handleCanPlayThrough);
			
			return () => {
				video.removeEventListener('canplaythrough', handleCanPlayThrough);
			};
		}
	}, [isIntersecting, shouldLoad, reducedMotion, props.autoPlay, props.muted]);

	// Extract video-specific className if provided, otherwise use default
	const videoClassName = className.includes('object-contain') || className.includes('h-auto') 
		? className 
		: 'w-full h-full object-cover';
	
	return (
		<div 
			ref={containerRef} 
			className={`relative overflow-hidden ${className.includes('object-contain') || className.includes('h-auto') ? 'bg-transparent' : 'bg-black/5'}`}
			style={{ 
				aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : undefined,
				height: props.width && props.height ? undefined : (className.includes('h-auto') ? 'auto' : '100%'),
				width: '100%'
			}}
		>
			{/* RULE-020: Show poster → video stream transition */}
			{posterUrl && (
				<img
					src={posterUrl}
					alt=""
					aria-hidden="true"
					crossOrigin="anonymous" // Required for mobile browsers CORS (iOS Safari)
					className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
						// Hide poster when video is loaded and visible
						// On mobile, if shouldLoad is true, video should be visible, so hide poster
						shouldLoad && (isIntersecting || priority || reducedMotion) ? 'opacity-0 pointer-events-none' : 'opacity-100'
					}`}
					loading={priority ? 'eager' : 'lazy'}
				/>
			)}

			{shouldLoad && (
				<video
					ref={videoRef}
					src={videoUrl}
					poster={posterUrl}
					preload={priority ? 'auto' : 'metadata'} // RULE-014: Use metadata for non-priority
					crossOrigin="anonymous" // Required for mobile browsers CORS (iOS Safari)
					className={`${videoClassName} transition-opacity duration-700 ${
						// Show video when intersecting OR when priority/reducedMotion
						// If shouldLoad is true, video element is rendered, and we show it if intersecting
						// The safeguard useEffect will ensure isIntersecting is set when shouldLoad is true
						isIntersecting || priority || reducedMotion ? 'opacity-100' : 'opacity-0'
					}`}
					muted // Always muted for autoplay compatibility
					controls={!isMuted} // Show controls when unmuted
					playsInline // Required for iOS autoplay
					autoPlay={props.autoPlay !== false}
					loop={props.loop}
					onError={(e) => {
						// Log video loading errors for debugging (especially on mobile)
						const video = e.currentTarget;
						console.error('[LazyVideo] Video loading error:', {
							src: videoUrl,
							error: video.error?.message || 'Unknown error',
							code: video.error?.code,
							pullZone,
							priority
						});
						// Don't prevent default - let browser handle error display
					}}
					{...props}
				/>
			)}

			{/* Unmute button for full page reel elements */}
			{showUnmuteButton && isMuted && shouldLoad && (
				<button
					type="button"
					onClick={handleUnmute}
					className="absolute bottom-0 left-1/2 -translate-x-1/2 text-white text-[20px] lowercase italic font-bold pb-4 z-10 hover:opacity-80 transition-opacity"
					aria-label="Unmute audio"
				>
					{unmuteButtonText}
				</button>
			)}
		</div>
	);
}

