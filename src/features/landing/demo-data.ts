/**
 * Illustrative demo content for the landing page. Clearly an example brief — no fake
 * testimonials, users or metrics. Coordinates are normalised to the reference photo.
 */
import type { AnnotationKind } from '@shared/types';

export const DEMO_IMAGE = '/images/reference-berry-cake.jpg';
export const DEMO_IMAGE_SIZE = { width: 1400, height: 2095 };

export interface DemoAnnotation {
  id: string;
  number: number;
  kind: AnnotationKind;
  shape: 'rect' | 'point';
  x: number;
  y: number;
  w: number;
  h: number;
  note: string;
  color?: string;
  status: 'open' | 'discussion' | 'resolved';
  thread: { who: 'customer' | 'seller'; text: string }[];
}

export const DEMO_ANNOTATIONS: DemoAnnotation[] = [
  {
    id: 'a1',
    number: 1,
    kind: 'colour',
    shape: 'rect',
    x: 0.23,
    y: 0.23,
    w: 0.5,
    h: 0.18,
    note: 'Can we change these to ivory roses?',
    color: '#f4ebd9',
    status: 'resolved',
    thread: [
      { who: 'customer', text: 'Can we change these to ivory roses?' },
      { who: 'seller', text: 'Yes — should I keep the leaves green?' },
      { who: 'customer', text: 'Yes, keep them green.' },
    ],
  },
  {
    id: 'a2',
    number: 2,
    kind: 'question',
    shape: 'point',
    x: 0.43,
    y: 0.445,
    w: 0,
    h: 0,
    note: 'Fresh leaves or sugar leaves?',
    status: 'discussion',
    thread: [
      { who: 'seller', text: 'Fresh leaves or sugar leaves?' },
      { who: 'customer', text: 'Sugar leaves, so they last the evening.' },
    ],
  },
  {
    id: 'a3',
    number: 3,
    kind: 'keep',
    shape: 'rect',
    x: 0.05,
    y: 0.62,
    w: 0.48,
    h: 0.17,
    note: 'Keep this ridged buttercream finish exactly',
    status: 'resolved',
    thread: [{ who: 'customer', text: 'This texture is the reason I picked the photo.' }],
  },
  {
    id: 'a4',
    number: 4,
    kind: 'remove',
    shape: 'rect',
    x: 0.64,
    y: 0.6,
    w: 0.34,
    h: 0.3,
    note: 'No berries on the bottom tier',
    status: 'open',
    thread: [{ who: 'customer', text: 'Bottom tier should be plain white.' }],
  },
];

export const DEMO_DIFF = [
  { label: 'Size', before: '1 kg', after: '1.5 kg' },
  { label: 'Topping (#1)', before: 'Mixed berries', after: 'Ivory roses #f4ebd9' },
  { label: 'Message', before: '—', after: 'Happy 25th, Aditi' },
  { label: 'Quoted price', before: '₹1,850', after: '₹2,400' },
];

/** Example fingerprint for the illustration only (not a real agreement). */
export const DEMO_HASH = '3f9a1c07d24e8b55c0f1e6a9b3d7742e18c5a90f6be2d13474a8e0c95f21b6d3';
