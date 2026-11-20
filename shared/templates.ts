/**
 * Product templates turn "something like this" into a structured spec.
 * One template per custom-order vertical. Cakes are the hero vertical.
 */
export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'money' | 'date' | 'bool' | 'colors';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  options?: string[];
  placeholder?: string;
  /** Only the seller can edit (price, advance). */
  sellerOnly?: boolean;
  /** Must be filled before the brief can be agreed. */
  required?: boolean;
  max?: number;
}

export interface Template {
  id: string;
  name: string;
  emoji: string;
  noun: string;
  groups: string[];
  fields: Field[];
}

const fulfilment: Field[] = [
  { key: 'fulfilment', label: 'Pickup or delivery', type: 'select', group: 'Delivery', options: ['Pickup', 'Delivery'], required: true },
  { key: 'address', label: 'Delivery address', type: 'textarea', group: 'Delivery', placeholder: 'Only if delivery' },
];
const money: Field[] = [
  { key: 'price', label: 'Quoted price (₹)', type: 'money', group: 'Price', sellerOnly: true, required: true },
  { key: 'advance', label: 'Advance to confirm (₹)', type: 'money', group: 'Price', sellerOnly: true },
  { key: 'notes', label: 'Anything else', type: 'textarea', group: 'Price', placeholder: 'Allergies, packaging, surprises…' },
];

export const TEMPLATES: Record<string, Template> = {
  cake: {
    id: 'cake',
    name: 'Custom cake',
    emoji: '🎂',
    noun: 'cake',
    groups: ['The cake', 'Design', 'Delivery', 'Price'],
    fields: [
      { key: 'occasion', label: 'Occasion', type: 'select', group: 'The cake', options: ['Birthday', 'Anniversary', 'Wedding', 'Baby shower', 'Graduation', 'Corporate', 'Other'] },
      { key: 'weight', label: 'Size', type: 'select', group: 'The cake', options: ['0.5 kg', '1 kg', '1.5 kg', '2 kg', '3 kg', '4 kg', '5 kg+'], required: true },
      { key: 'tiers', label: 'Tiers', type: 'select', group: 'The cake', options: ['1', '2', '3'] },
      { key: 'shape', label: 'Shape', type: 'select', group: 'The cake', options: ['Round', 'Square', 'Heart', 'Rectangle', 'Number / letter', 'Custom'] },
      { key: 'flavour', label: 'Flavour', type: 'select', group: 'The cake', options: ['Chocolate truffle', 'Vanilla', 'Red velvet', 'Butterscotch', 'Black forest', 'Pineapple', 'Blueberry', 'Rasmalai', 'Other'], required: true },
      { key: 'eggless', label: 'Eggless', type: 'bool', group: 'The cake' },
      { key: 'frosting', label: 'Frosting', type: 'select', group: 'Design', options: ['Whipped cream', 'Buttercream', 'Fondant', 'Ganache', 'Semi-naked'] },
      { key: 'colours', label: 'Colour palette', type: 'colors', group: 'Design' },
      { key: 'theme', label: 'Theme', type: 'text', group: 'Design', placeholder: 'e.g. pastel florals, Spider-Man, minimal gold' },
      { key: 'message', label: 'Message on cake', type: 'text', group: 'Design', placeholder: 'Happy 25th, Aditi!', max: 60 },
      { key: 'toppers', label: 'Toppers / decorations', type: 'text', group: 'Design', placeholder: 'Gold leaf, macarons, name topper' },
      { key: 'deliveryDate', label: 'Needed on', type: 'date', group: 'Delivery', required: true },
      { key: 'timeSlot', label: 'Time slot', type: 'select', group: 'Delivery', options: ['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–8)', 'Midnight surprise'] },
      ...fulfilment,
      ...money,
    ],
  },
  merch: {
    id: 'merch',
    name: 'Printed merchandise',
    emoji: '👕',
    noun: 'merch order',
    groups: ['Product', 'Print', 'Delivery', 'Price'],
    fields: [
      { key: 'product', label: 'Product', type: 'select', group: 'Product', options: ['T-shirt', 'Hoodie', 'Mug', 'Tote bag', 'Cap', 'Other'], required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', group: 'Product', required: true },
      { key: 'sizes', label: 'Size split', type: 'text', group: 'Product', placeholder: 'S×10, M×20, L×15' },
      { key: 'baseColour', label: 'Product colour', type: 'colors', group: 'Product' },
      { key: 'placement', label: 'Print placement', type: 'select', group: 'Print', options: ['Front', 'Back', 'Front + back', 'Sleeve', 'Wrap'], required: true },
      { key: 'method', label: 'Print method', type: 'select', group: 'Print', options: ['Screen print', 'DTF', 'Embroidery', 'Sublimation', 'Seller decides'] },
      { key: 'printColours', label: 'Print colours', type: 'colors', group: 'Print' },
      { key: 'printText', label: 'Text to print', type: 'text', group: 'Print' },
      { key: 'deliveryDate', label: 'Needed by', type: 'date', group: 'Delivery', required: true },
      ...fulfilment,
      ...money,
    ],
  },
  furniture: {
    id: 'furniture',
    name: 'Custom furniture',
    emoji: '🪑',
    noun: 'piece',
    groups: ['The piece', 'Finish', 'Delivery', 'Price'],
    fields: [
      { key: 'item', label: 'Item', type: 'select', group: 'The piece', options: ['Bed', 'Wardrobe', 'Dining table', 'Study table', 'Chair', 'Shelf', 'Sofa', 'Other'], required: true },
      { key: 'dimensions', label: 'Dimensions (W × D × H cm)', type: 'text', group: 'The piece', placeholder: '180 × 60 × 75', required: true },
      { key: 'material', label: 'Material', type: 'select', group: 'Finish', options: ['Sheesham', 'Teak', 'Mango wood', 'Plywood + laminate', 'MDF', 'Metal + wood'], required: true },
      { key: 'finish', label: 'Finish colour', type: 'colors', group: 'Finish' },
      { key: 'hardware', label: 'Hardware / handles', type: 'text', group: 'Finish' },
      { key: 'deliveryDate', label: 'Needed by', type: 'date', group: 'Delivery', required: true },
      ...fulfilment,
      ...money,
    ],
  },
};

export const templateFor = (id: string): Template => TEMPLATES[id] ?? TEMPLATES.cake;

export function formatValue(f: Field, v: unknown): string {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return '—';
  if (f.type === 'bool') return v ? 'Yes' : 'No';
  if (f.type === 'money') return `₹${Number(v).toLocaleString('en-IN')}`;
  if (f.type === 'colors') return (v as string[]).join(', ');
  if (f.type === 'date') {
    const d = new Date(String(v) + 'T00:00:00');
    return isNaN(+d) ? String(v) : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(v);
}

export function isFilled(v: unknown): boolean {
  return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
}
