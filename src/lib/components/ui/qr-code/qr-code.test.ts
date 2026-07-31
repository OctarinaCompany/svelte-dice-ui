import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as QRCode from './index.js';
import {
	buildGenerationKey,
	buildQRCodeOptions,
	getQRCodeLabel,
	resolveDownload,
	type QRCodeGenerationInput
} from './index.js';
import Harness, { type QRCodeHarnessProps } from './qr-code.test.svelte';

const encoder = vi.hoisted(() => ({
	toDataURL: vi.fn(),
	toCanvas: vi.fn(),
	toString: vi.fn()
}));

vi.mock('qrcode', () => ({ default: encoder }));

const VALUE = 'https://diceui.com';
const DATA_URL = 'data:image/png;base64,AAAA';
const SVG_STRING = '<svg data-testid="qr-svg" viewBox="0 0 25 25"></svg>';

/** Every `<a download>` that was clicked, captured instead of letting jsdom navigate. */
let anchorClicks: { href: string; download: string }[] = [];

beforeEach(() => {
	encoder.toDataURL.mockReset().mockResolvedValue(DATA_URL);
	encoder.toCanvas.mockReset().mockResolvedValue(undefined);
	encoder.toString.mockReset().mockResolvedValue(SVG_STRING);

	anchorClicks = [];
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
		this: HTMLAnchorElement
	) {
		anchorClicks.push({
			href: this.getAttribute('href') ?? '',
			download: this.getAttribute('download') ?? ''
		});
	});

	URL.createObjectURL = vi.fn(() => 'blob:qr-code');
	URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function querySlot(container: HTMLElement, slot: string): HTMLElement | null {
	return container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

async function waitForState(container: HTMLElement, state: string): Promise<void> {
	await waitFor(() => expect(bySlot(container, 'qr-code')).toHaveAttribute('data-state', state));
}

const BASE_INPUT: QRCodeGenerationInput = {
	value: VALUE,
	size: 200,
	level: 'M',
	margin: 1,
	quality: 0.92,
	foregroundColor: '#000000',
	backgroundColor: '#ffffff'
};

describe('pure helpers', () => {
	describe('buildQRCodeOptions', () => {
		it('maps every customization prop onto the encoder options', () => {
			expect(
				buildQRCodeOptions({
					size: 120,
					level: 'H',
					margin: 4,
					quality: 0.5,
					foregroundColor: '#3b82f6',
					backgroundColor: '#f1f5f9'
				})
			).toEqual({
				errorCorrectionLevel: 'H',
				type: 'image/png',
				quality: 0.5,
				margin: 4,
				color: { dark: '#3b82f6', light: '#f1f5f9' },
				width: 120
			});
		});
	});

	describe('buildGenerationKey', () => {
		it('returns an empty key for an empty value', () => {
			expect(buildGenerationKey({ ...BASE_INPUT, value: '' })).toBe('');
		});

		it('returns the same key for the same seven inputs', () => {
			expect(buildGenerationKey(BASE_INPUT)).toBe(buildGenerationKey({ ...BASE_INPUT }));
		});

		it('changes when any one of the seven inputs changes', () => {
			const base = buildGenerationKey(BASE_INPUT);
			const variants: QRCodeGenerationInput[] = [
				{ ...BASE_INPUT, value: 'https://svelte.dev' },
				{ ...BASE_INPUT, size: 120 },
				{ ...BASE_INPUT, level: 'H' },
				{ ...BASE_INPUT, margin: 4 },
				{ ...BASE_INPUT, quality: 0.5 },
				{ ...BASE_INPUT, foregroundColor: '#dc2626' },
				{ ...BASE_INPUT, backgroundColor: '#f1f5f9' }
			];

			for (const variant of variants) {
				expect(buildGenerationKey(variant)).not.toBe(base);
			}
		});
	});

	describe('getQRCodeLabel', () => {
		it('describes the encoded value', () => {
			expect(getQRCodeLabel(VALUE)).toBe(`QR code for ${VALUE}`);
		});
	});

	describe('resolveDownload', () => {
		it('resolves a png download from the data URL', () => {
			expect(resolveDownload({ dataUrl: DATA_URL, svgString: null }, 'qr', 'png')).toEqual({
				href: DATA_URL,
				download: 'qr.png',
				revoke: false
			});
		});

		it('resolves an svg download from a revocable blob URL', () => {
			expect(resolveDownload({ dataUrl: null, svgString: SVG_STRING }, 'qr', 'svg')).toEqual({
				href: 'blob:qr-code',
				download: 'qr.svg',
				revoke: true
			});
		});

		it('resolves to null when the requested format has no output', () => {
			expect(resolveDownload({ dataUrl: null, svgString: SVG_STRING }, 'qr', 'png')).toBeNull();
			expect(resolveDownload({ dataUrl: DATA_URL, svgString: null }, 'qr', 'svg')).toBeNull();
			expect(resolveDownload({ dataUrl: null, svgString: null }, 'qr', 'png')).toBeNull();
		});
	});
});

describe('rendering, roles and accessible names', () => {
	it('renders the root with data-slot="qr-code" and publishes --qr-code-size', () => {
		const { container } = render(Harness, { props: { size: 160 } });
		const root = bySlot(container, 'qr-code');

		expect(root.tagName).toBe('DIV');
		expect(root.getAttribute('style')).toContain('--qr-code-size: 160px');
	});

	it('appends the caller style after the size custom property', () => {
		const { container } = render(Harness, { props: { size: 160, style: 'outline: 1px solid;' } });

		expect(bySlot(container, 'qr-code').getAttribute('style')).toBe(
			'--qr-code-size: 160px; outline: 1px solid;'
		);
	});

	it('renders every part on its documented element with its data-slot', async () => {
		const { container } = render(Harness, { props: {} });

		expect(bySlot(container, 'qr-code-skeleton').tagName).toBe('DIV');
		expect(bySlot(container, 'qr-code-canvas').tagName).toBe('CANVAS');
		expect(bySlot(container, 'qr-code-overlay').tagName).toBe('DIV');
		expect(bySlot(container, 'qr-code-download').tagName).toBe('BUTTON');

		await waitForState(container, 'ready');

		expect(bySlot(container, 'qr-code-svg').tagName).toBe('DIV');
		expect(bySlot(container, 'qr-code-image').tagName).toBe('IMG');
	});

	it('gives the canvas role="img" and a name describing the encoded value', () => {
		const { container } = render(Harness, { props: { svg: false, image: false } });
		const canvas = bySlot(container, 'qr-code-canvas');

		expect(canvas).toHaveAttribute('role', 'img');
		expect(canvas).toHaveAccessibleName(`QR code for ${VALUE}`);
	});

	it('gives the svg wrapper role="img" and a name describing the encoded value', async () => {
		const { container } = render(Harness, { props: { canvas: false, image: false } });
		await waitForState(container, 'ready');
		const svg = bySlot(container, 'qr-code-svg');

		expect(svg).toHaveAttribute('role', 'img');
		expect(svg).toHaveAccessibleName(`QR code for ${VALUE}`);
		// The generated markup is parsed and adopted in an effect, one flush after the wrapper mounts.
		await waitFor(() => expect(svg.firstElementChild?.localName).toBe('svg'));
	});

	it('lets a caller aria-label override the default name on canvas and svg', async () => {
		const { container } = render(Harness, {
			props: { canvasLabel: 'Ticket code', svgLabel: 'Ticket code (svg)' }
		});
		await waitForState(container, 'ready');

		expect(bySlot(container, 'qr-code-canvas')).toHaveAccessibleName('Ticket code');
		expect(bySlot(container, 'qr-code-svg')).toHaveAccessibleName('Ticket code (svg)');
	});

	it('gives the image alt="QR Code" by default and honours a custom alt', async () => {
		const first = render(Harness, { props: { canvas: false, svg: false } });
		await waitForState(first.container, 'ready');
		expect(bySlot(first.container, 'qr-code-image')).toHaveAttribute('alt', 'QR Code');

		const second = render(Harness, { props: { canvas: false, svg: false, alt: 'DiceUI QR Code' } });
		await waitForState(second.container, 'ready');
		expect(bySlot(second.container, 'qr-code-image')).toHaveAttribute('alt', 'DiceUI QR Code');
	});

	it('names the download button after its format and honours explicit children', () => {
		const png = render(Harness, { props: {} });
		expect(bySlot(png.container, 'qr-code-download')).toHaveAccessibleName('Download PNG');

		const svg = render(Harness, { props: { format: 'svg' } });
		expect(bySlot(svg.container, 'qr-code-download')).toHaveAccessibleName('Download SVG');

		const custom = render(Harness, { props: { downloadLabel: 'Save the code' } });
		expect(bySlot(custom.container, 'qr-code-download')).toHaveAccessibleName('Save the code');
	});

	it('merges a caller class last on all seven parts', async () => {
		const { container } = render(Harness, {
			props: {
				class: 'root-class',
				canvasClass: 'canvas-class',
				svgClass: 'svg-class',
				imageClass: 'image-class',
				overlayClass: 'overlay-class',
				skeletonClass: 'skeleton-class',
				downloadClass: 'download-class'
			}
		});

		expect(bySlot(container, 'qr-code')).toHaveClass('root-class', 'relative', 'flex-col');
		expect(bySlot(container, 'qr-code-skeleton')).toHaveClass('skeleton-class', 'animate-pulse');

		await waitForState(container, 'ready');

		expect(bySlot(container, 'qr-code-canvas')).toHaveClass('canvas-class', 'relative');
		expect(bySlot(container, 'qr-code-svg')).toHaveClass('svg-class', 'relative');
		expect(bySlot(container, 'qr-code-image')).toHaveClass('image-class', 'relative');
		expect(bySlot(container, 'qr-code-overlay')).toHaveClass('overlay-class', 'absolute');
		expect(bySlot(container, 'qr-code-download')).toHaveClass(
			'download-class',
			'max-w-(--qr-code-size)'
		);
	});

	it('binds ref on all seven parts', async () => {
		const refs: Record<string, Element | null> = {
			rootRef: null,
			canvasRef: null,
			svgRef: null,
			imageRef: null,
			overlayRef: null,
			skeletonRef: null,
			downloadRef: null
		};
		const accessors = Object.fromEntries(
			Object.keys(refs).map((key) => [
				key,
				{
					get: () => refs[key],
					set: (next: Element | null) => {
						refs[key] = next;
					},
					enumerable: true,
					configurable: true
				}
			])
		);
		const props = Object.defineProperties({}, accessors) as QRCodeHarnessProps;

		const { container } = render(Harness, { props });

		expect(refs.skeletonRef).toBeInstanceOf(HTMLDivElement);

		await waitForState(container, 'ready');

		expect(refs.rootRef).toBeInstanceOf(HTMLDivElement);
		expect(refs.canvasRef).toBeInstanceOf(HTMLCanvasElement);
		expect(refs.svgRef).toBeInstanceOf(HTMLDivElement);
		expect(refs.imageRef).toBeInstanceOf(HTMLImageElement);
		expect(refs.overlayRef).toBeInstanceOf(HTMLDivElement);
		expect(refs.downloadRef).toBeInstanceOf(HTMLButtonElement);
	});

	it('renders the child snippet in place of the default element on all seven parts', async () => {
		const rootOnly = render(Harness, { props: { useRootChild: true } });
		const rootChild = screen.getByTestId('root-child');
		expect(rootChild.tagName).toBe('SECTION');
		expect(rootChild).toHaveAttribute('data-slot', 'qr-code');
		expect(rootChild.getAttribute('style')).toContain('--qr-code-size: 200px');
		expect(querySlot(rootOnly.container, 'qr-code')).toBe(rootChild);
		await waitForState(rootOnly.container, 'ready');

		const { container } = render(Harness, {
			props: {
				useCanvasChild: true,
				useSvgChild: true,
				useImageChild: true,
				useOverlayChild: true,
				useSkeletonChild: true,
				useDownloadChild: true,
				size: 120
			}
		});

		const skeletonChild = screen.getByTestId('skeleton-child');
		expect(skeletonChild).toHaveAttribute('data-slot', 'qr-code-skeleton');
		expect(skeletonChild.getAttribute('style')).toContain('width: 120px');

		const canvasChild = screen.getByTestId('canvas-child');
		expect(canvasChild.tagName).toBe('SPAN');
		expect(canvasChild).toHaveAttribute('data-slot', 'qr-code-canvas');
		expect(canvasChild).toHaveAttribute('role', 'img');
		expect(canvasChild).toHaveAttribute('aria-label', `QR code for ${VALUE}`);
		expect(canvasChild).toHaveAttribute('width', '120');

		const downloadChild = screen.getByTestId('download-child');
		expect(downloadChild).toHaveAttribute('data-slot', 'qr-code-download');
		expect(downloadChild).toHaveAttribute('type', 'button');

		await waitForState(container, 'ready');

		const svgChild = screen.getByTestId('svg-child');
		expect(svgChild).toHaveAttribute('data-slot', 'qr-code-svg');
		expect(svgChild).toHaveAttribute('role', 'img');

		const imageChild = screen.getByTestId('image-child');
		expect(imageChild).toHaveAttribute('data-slot', 'qr-code-image');
		expect(imageChild).toHaveAttribute('src', DATA_URL);

		const overlayChild = screen.getByTestId('overlay-child');
		expect(overlayChild).toHaveAttribute('data-slot', 'qr-code-overlay');

		// The `child` element replaces the default one — `ref` stays null, so the download handler is
		// still the component's, proving the payload carries the handlers too.
		await userEvent.click(downloadChild);
		expect(anchorClicks).toHaveLength(1);
	});

	it('keeps drawing into the canvas when it is rendered through the child snippet', async () => {
		const { container } = render(Harness, {
			props: { useCanvasChild: true, canvasChildTag: 'canvas', svg: false, image: false, size: 120 }
		});
		await waitForState(container, 'ready');

		const canvasChild = screen.getByTestId('canvas-child');
		expect(canvasChild.tagName).toBe('CANVAS');
		expect(encoder.toCanvas).toHaveBeenCalledWith(
			canvasChild,
			VALUE,
			buildQRCodeOptions({
				size: 120,
				level: 'M',
				margin: 1,
				quality: 0.92,
				foregroundColor: '#000000',
				backgroundColor: '#ffffff'
			})
		);
	});

	it('adopts the generated markup into the element the svg child snippet renders', async () => {
		const { container } = render(Harness, {
			props: { useSvgChild: true, canvas: false, image: false }
		});
		await waitForState(container, 'ready');

		const svgChild = screen.getByTestId('svg-child');
		await waitFor(() => expect(svgChild.firstElementChild?.localName).toBe('svg'));
		expect(svgChild.querySelector('[data-testid="qr-svg"]')).not.toBeNull();
	});

	it('renders canvas, svg and image side by side inside one root', async () => {
		const { container } = render(Harness, { props: {} });
		await waitForState(container, 'ready');

		expect(bySlot(container, 'qr-code-canvas')).toBeInTheDocument();
		expect(bySlot(container, 'qr-code-svg')).toBeInTheDocument();
		expect(bySlot(container, 'qr-code-image')).toBeInTheDocument();
		expect(encoder.toString).toHaveBeenCalledTimes(1);
	});

	it('moves data-state from idle to ready across a successful generation', async () => {
		const { container } = render(Harness, { props: {} });

		expect(bySlot(container, 'qr-code')).toHaveAttribute('data-state', 'idle');

		await waitForState(container, 'ready');
	});

	it('reports data-state="generating" while an encode is still in flight', async () => {
		let release: ((markup: string) => void) | undefined;
		encoder.toString.mockImplementationOnce(
			() =>
				new Promise<string>((resolve) => {
					release = resolve;
				})
		);

		const { container } = render(Harness, { props: {} });

		await waitForState(container, 'generating');

		await waitFor(() => expect(release).toBeDefined());
		release?.(SVG_STRING);

		await waitForState(container, 'ready');
	});

	it('moves data-state to error after a failed generation', async () => {
		encoder.toString.mockRejectedValue(new Error('nope'));
		const { container } = render(Harness, { props: {} });

		await waitForState(container, 'error');
	});
});

describe('keyboard interaction', () => {
	it('reaches the download button with Tab and shows a visible focus indicator', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { svg: false, image: false } });
		await waitForState(container, 'ready');

		await user.tab();

		const button = bySlot(container, 'qr-code-download');
		expect(button).toHaveFocus();
		expect(button.className).toContain('focus-visible:ring-[3px]');
	});

	it('downloads the png with Enter', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { filename: 'ticket' } });
		await waitForState(container, 'ready');

		bySlot(container, 'qr-code-download').focus();
		await user.keyboard('{Enter}');

		expect(anchorClicks).toEqual([{ href: DATA_URL, download: 'ticket.png' }]);
	});

	it('downloads the svg with Space', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { filename: 'ticket', format: 'svg' } });
		await waitForState(container, 'ready');

		bySlot(container, 'qr-code-download').focus();
		await user.keyboard('[Space]');

		expect(anchorClicks).toEqual([{ href: 'blob:qr-code', download: 'ticket.svg' }]);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:qr-code');
	});

	it('runs a caller onclick first and lets preventDefault suppress the download', async () => {
		const user = userEvent.setup();
		const onDownloadClick = vi.fn((event: MouseEvent) => {
			expect(anchorClicks).toHaveLength(0);
			event.preventDefault();
		});
		const { container } = render(Harness, { props: { onDownloadClick } });
		await waitForState(container, 'ready');

		await user.click(bySlot(container, 'qr-code-download'));

		expect(onDownloadClick).toHaveBeenCalledTimes(1);
		expect(anchorClicks).toHaveLength(0);
	});

	it('runs the built-in download when the caller onclick does not prevent it', async () => {
		const user = userEvent.setup();
		const onDownloadClick = vi.fn();
		const { container } = render(Harness, { props: { onDownloadClick } });
		await waitForState(container, 'ready');

		await user.click(bySlot(container, 'qr-code-download'));

		expect(onDownloadClick).toHaveBeenCalledTimes(1);
		expect(anchorClicks).toHaveLength(1);
	});
});

describe('reactivity and idempotence', () => {
	it('regenerates and re-invokes onGenerated when value changes', async () => {
		const onGenerated = vi.fn();
		const { container, rerender } = render(Harness, {
			props: { value: VALUE, onGenerated }
		});
		await waitForState(container, 'ready');
		expect(onGenerated).toHaveBeenCalledTimes(1);

		await rerender({ value: 'https://svelte.dev', onGenerated });
		await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(2));

		expect(encoder.toString.mock.calls.map((call) => call[0])).toEqual([
			VALUE,
			'https://svelte.dev'
		]);
	});

	it.each([
		['size', { size: 120 }],
		['level', { level: 'H' as const }],
		['margin', { margin: 4 }],
		['quality', { quality: 0.5 }],
		['foregroundColor', { foregroundColor: '#dc2626' }],
		['backgroundColor', { backgroundColor: '#f1f5f9' }]
	])('regenerates when %s changes', async (_name, change) => {
		const onGenerated = vi.fn();
		const { container, rerender } = render(Harness, { props: { onGenerated } });
		await waitForState(container, 'ready');
		expect(onGenerated).toHaveBeenCalledTimes(1);

		await rerender({ onGenerated, ...change });
		await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(2));
	});

	it('hands the encoder every customization prop', async () => {
		const { container } = render(Harness, {
			props: {
				size: 120,
				level: 'H',
				margin: 4,
				quality: 0.5,
				foregroundColor: '#3b82f6',
				backgroundColor: '#f1f5f9'
			}
		});
		await waitForState(container, 'ready');

		const expected = buildQRCodeOptions({
			size: 120,
			level: 'H',
			margin: 4,
			quality: 0.5,
			foregroundColor: '#3b82f6',
			backgroundColor: '#f1f5f9'
		});

		expect(encoder.toDataURL).toHaveBeenCalledWith(VALUE, expected);
		expect(encoder.toCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), VALUE, expected);
		expect(encoder.toString).toHaveBeenCalledWith(VALUE, {
			errorCorrectionLevel: 'H',
			margin: 4,
			color: { dark: '#3b82f6', light: '#f1f5f9' },
			width: 120,
			type: 'svg'
		});
	});

	it('does not call the encoder again for an identical set of inputs', async () => {
		const { container, rerender } = render(Harness, { props: { value: VALUE, size: 200 } });
		await waitForState(container, 'ready');
		expect(encoder.toString).toHaveBeenCalledTimes(1);

		await rerender({ value: VALUE, size: 200 });
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

		expect(encoder.toString).toHaveBeenCalledTimes(1);
	});

	it('shows the skeleton until any output exists, then removes it', async () => {
		const { container } = render(Harness, { props: {} });

		expect(querySlot(container, 'qr-code-skeleton')).toBeInTheDocument();

		await waitForState(container, 'ready');

		expect(querySlot(container, 'qr-code-skeleton')).toBeNull();
	});

	it('renders nothing for svg and image before their own output exists', () => {
		const { container } = render(Harness, { props: {} });

		expect(querySlot(container, 'qr-code-svg')).toBeNull();
		expect(querySlot(container, 'qr-code-image')).toBeNull();
	});

	it('keeps the canvas invisible until the first generation completes', async () => {
		const { container } = render(Harness, { props: {} });

		expect(bySlot(container, 'qr-code-canvas')).toHaveClass('invisible');

		await waitForState(container, 'ready');

		expect(bySlot(container, 'qr-code-canvas')).not.toHaveClass('invisible');
	});

	it('ends on the newest value when it changes while a generation is still in flight', async () => {
		let releaseFirst: ((markup: string) => void) | undefined;
		encoder.toString.mockImplementationOnce(
			() =>
				new Promise<string>((resolve) => {
					releaseFirst = resolve;
				})
		);
		encoder.toString.mockResolvedValue('<svg data-testid="second"></svg>');

		const { container, rerender } = render(Harness, { props: { value: VALUE } });
		await waitFor(() => expect(encoder.toString).toHaveBeenCalledTimes(1));

		await rerender({ value: 'https://svelte.dev' });
		await waitFor(() => expect(releaseFirst).toBeDefined());
		releaseFirst?.('<svg data-testid="first"></svg>');

		await waitFor(() => expect(encoder.toString).toHaveBeenCalledTimes(2));
		await waitForState(container, 'ready');

		expect(encoder.toString.mock.calls.map((call) => call[0])).toEqual([
			VALUE,
			'https://svelte.dev'
		]);
		await waitFor(() =>
			expect(bySlot(container, 'qr-code-svg').innerHTML).toContain('data-testid="second"')
		);
	});
});

describe('RTL', () => {
	it('keeps the root and overlay centred and the download usable inside dir="rtl"', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { rtl: true, filename: 'rtl', size: 160 } });

		// The loading placeholder is direction-agnostic too (FR-013) — and it is gone by the time the
		// generation is `ready`, so it has to be checked first.
		const skeleton = bySlot(container, 'qr-code-skeleton');
		expect(skeleton).toHaveClass(
			'absolute',
			'max-h-(--qr-code-size)',
			'max-w-(--qr-code-size)',
			'animate-pulse'
		);
		expect(skeleton.getAttribute('style')).toBe('width: 160px; height: 160px;');

		await waitForState(container, 'ready');

		expect(bySlot(container, 'qr-code')).toHaveClass('flex-col', 'items-center');
		expect(bySlot(container, 'qr-code-overlay')).toHaveClass(
			'top-1/2',
			'left-1/2',
			'-translate-x-1/2',
			'-translate-y-1/2'
		);

		await user.tab();
		const button = bySlot(container, 'qr-code-download');
		expect(button).toHaveFocus();

		await user.keyboard('{Enter}');
		expect(anchorClicks).toEqual([{ href: DATA_URL, download: 'rtl.png' }]);
	});
});

describe('guard rails and edge cases', () => {
	it('never touches the encoder for an empty value', async () => {
		const { container } = render(Harness, { props: { value: '' } });
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

		expect(encoder.toDataURL).not.toHaveBeenCalled();
		expect(encoder.toCanvas).not.toHaveBeenCalled();
		expect(encoder.toString).not.toHaveBeenCalled();
		expect(bySlot(container, 'qr-code')).toHaveAttribute('data-state', 'idle');
	});

	it('reports a thrown Error through onError', async () => {
		const failure = new Error('encoder exploded');
		encoder.toString.mockRejectedValue(failure);
		const onError = vi.fn();

		const { container } = render(Harness, { props: { onError } });
		await waitForState(container, 'error');

		expect(onError).toHaveBeenCalledWith(failure);
	});

	it('normalises a non-Error throw to "Failed to generate QR code"', async () => {
		encoder.toString.mockRejectedValue('boom');
		const onError = vi.fn();

		const { container } = render(Harness, { props: { onError } });
		await waitForState(container, 'error');

		expect(onError).toHaveBeenCalledWith(expect.any(Error));
		expect(onError.mock.calls[0][0]).toHaveProperty('message', 'Failed to generate QR code');
	});

	it('clears a previously generated code when a regeneration fails', async () => {
		const { container, rerender } = render(Harness, { props: { value: VALUE } });
		await waitForState(container, 'ready');
		expect(querySlot(container, 'qr-code-image')).toBeInTheDocument();
		expect(querySlot(container, 'qr-code-svg')).toBeInTheDocument();

		encoder.toString.mockRejectedValue(new Error('nope'));
		await rerender({ value: 'https://svelte.dev' });
		await waitForState(container, 'error');

		expect(querySlot(container, 'qr-code-image')).toBeNull();
		expect(querySlot(container, 'qr-code-svg')).toBeNull();
	});

	it('erases the registered canvas when a generation fails', async () => {
		const clearRect = vi.fn();
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			clearRect
		} as unknown as CanvasRenderingContext2D);
		encoder.toString.mockRejectedValue(new Error('nope'));

		const { container } = render(Harness, { props: { size: 120 } });
		await waitForState(container, 'error');

		expect(clearRect).toHaveBeenCalledWith(0, 0, 120, 120);
	});

	it('treats a toDataURL failure as non-fatal, suppressing only the image', async () => {
		encoder.toDataURL.mockRejectedValue(new Error('no data url'));
		const onGenerated = vi.fn();
		const onError = vi.fn();

		const { container } = render(Harness, { props: { onGenerated, onError } });
		await waitForState(container, 'ready');

		expect(onGenerated).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
		expect(querySlot(container, 'qr-code-image')).toBeNull();
		expect(querySlot(container, 'qr-code-svg')).toBeInTheDocument();
	});

	it('is a no-op when the download button is clicked with no output yet', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { value: '' } });

		await user.click(bySlot(container, 'qr-code-download'));

		expect(anchorClicks).toHaveLength(0);
		expect(URL.createObjectURL).not.toHaveBeenCalled();
	});

	it('is a no-op when the requested format has no output', async () => {
		const user = userEvent.setup();
		encoder.toString.mockResolvedValue('');
		const { container } = render(Harness, { props: { format: 'svg' } });
		await waitFor(() => expect(encoder.toString).toHaveBeenCalledTimes(1));

		await user.click(bySlot(container, 'qr-code-download'));

		expect(anchorClicks).toHaveLength(0);
	});

	// Each part is wrapped in its own thunk so that the table stays a list of `() => void`s rather
	// than a union of differently-typed components, which `render`'s generic cannot resolve.
	it.each([
		['QRCode.Canvas', () => render(QRCode.Canvas)],
		['QRCode.Svg', () => render(QRCode.Svg)],
		['QRCode.Image', () => render(QRCode.Image)],
		['QRCode.Overlay', () => render(QRCode.Overlay)],
		['QRCode.Skeleton', () => render(QRCode.Skeleton)],
		['QRCode.Download', () => render(QRCode.Download)]
	] as [string, () => unknown][])(
		'throws when %s is used outside QRCode.Root',
		(_name, mountPart) => {
			expect(mountPart).toThrow(/must be used within `<QRCode\.Root>`\./);
		}
	);

	it('throws for a part rendered as a sibling of the root rather than inside it', () => {
		expect(() => render(Harness, { props: { siblingCanvas: true } })).toThrow(
			/`<QRCode\.Canvas>` must be used within `<QRCode\.Root>`\./
		);
	});
});
