/**
 * Product templates turn "something like this" into a structured specification.
 * One template per custom-order vertical. Field definitions drive the spec editor,
 * server-side sanitising, required-field blockers and version diffs, so adding a
 * vertical is a data change, not a code change.
 */
export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'money' | 'date' | 'bool' | 'colors';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  options?: string[];
  placeholder?: string;
  help?: string;
  /** Only the seller can edit (price, advance). */
  sellerOnly?: boolean;
  /** Must be filled before a version can be proposed. */
  required?: boolean;
  max?: number;
  /** Semantic role used by the diff, the dashboard and the work order. */
  role?: 'price' | 'deliveryDate' | 'deliveryTime' | 'fulfilment' | 'address' | 'size' | 'colours' | 'message';
}

export interface Template {
  id: string;
  name: string;
  noun: string;
  /** Lucide icon name rendered by the client. */
  icon: string;
  groups: string[];
  fields: Field[];
}

const fulfilment: Field[] = [
  { key: 'fulfilment', label: 'Pickup or delivery', type: 'select', group: 'Delivery', options: ['Pickup', 'Delivery'], required: true, role: 'fulfilment' },
  { key: 'address', label: 'Delivery address', type: 'textarea', group: 'Delivery', placeholder: 'Only needed for delivery', role: 'address' },
];
const money: Field[] = [
  { key: 'price', label: 'Quoted price (₹)', type: 'money', group: 'Price', sellerOnly: true, required: true, role: 'price' },
  { key: 'advance', label: 'Advance to confirm (₹)', type: 'money', group: 'Price', sellerOnly: true },
  { key: 'notes', label: 'Anything else', type: 'textarea', group: 'Price', placeholder: 'Allergies, packaging, surprises…' },
];

export const TEMPLATES: Record<string, Template> = {
  cake: {
    id: 'cake',
    name: 'Custom cake',
    noun: 'cake',
    icon: 'cake-slice',
    groups: ['The cake', 'Design', 'Delivery', 'Price'],
    fields: [
      { key: 'occasion', label: 'Occasion', type: 'select', group: 'The cake', options: ['Birthday', 'Anniversary', 'Wedding', 'Baby shower', 'Graduation', 'Corporate', 'Other'] },
      { key: 'weight', label: 'Size / weight', type: 'select', group: 'The cake', options: ['0.5 kg', '1 kg', '1.5 kg', '2 kg', '3 kg', '4 kg', '5 kg+'], required: true, role: 'size' },
      { key: 'tiers', label: 'Tiers', type: 'select', group: 'The cake', options: ['1', '2', '3'] },
      { key: 'shape', label: 'Shape', type: 'select', group: 'The cake', options: ['Round', 'Square', 'Heart', 'Rectangle', 'Number / letter', 'Custom'], required: true },
      { key: 'flavour', label: 'Flavour', type: 'select', group: 'The cake', options: ['Chocolate truffle', 'Vanilla', 'Red velvet', 'Butterscotch', 'Black forest', 'Pineapple', 'Blueberry', 'Rasmalai', 'Other'], required: true },
      { key: 'eggless', label: 'Eggless', type: 'bool', group: 'The cake', help: 'Leave off for a cake made with egg.' },
      { key: 'frosting', label: 'Frosting', type: 'select', group: 'Design', options: ['Whipped cream', 'Buttercream', 'Fondant', 'Ganache', 'Semi-naked'] },
      { key: 'colours', label: 'Colour palette', type: 'colors', group: 'Design', role: 'colours' },
      { key: 'theme', label: 'Theme', type: 'text', group: 'Design', placeholder: 'e.g. pastel florals, minimal gold' },
      { key: 'message', label: 'Message on cake', type: 'text', group: 'Design', placeholder: 'Happy 25th, Aditi!', max: 60, role: 'message' },
      { key: 'toppers', label: 'Toppers / decorations', type: 'text', group: 'Design', placeholder: 'Gold leaf, macarons, name topper' },
      { key: 'deliveryDate', label: 'Needed on', type: 'date', group: 'Delivery', required: true, role: 'deliveryDate' },
      { key: 'timeSlot', label: 'Time slot', type: 'select', group: 'Delivery', options: ['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–8)', 'Midnight surprise'], required: true, role: 'deliveryTime' },
      ...fulfilment,
      ...money,
    ],
  },
  merch: {
    id: 'merch',
    name: 'Printed merchandise',
    noun: 'merch order',
    icon: 'shirt',
    groups: ['Product', 'Print', 'Delivery', 'Price'],
    fields: [
      { key: 'product', label: 'Product', type: 'select', group: 'Product', options: ['T-shirt', 'Hoodie', 'Mug', 'Tote bag', 'Cap', 'Other'], required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', group: 'Product', required: true, role: 'size' },
      { key: 'sizes', label: 'Size split', type: 'text', group: 'Product', placeholder: 'S×10, M×20, L×15' },
      { key: 'baseColour', label: 'Product colour', type: 'colors', group: 'Product', role: 'colours' },
      { key: 'placement', label: 'Print placement', type: 'select', group: 'Print', options: ['Front', 'Back', 'Front + back', 'Sleeve', 'Wrap'], required: true },
      { key: 'method', label: 'Print method', type: 'select', group: 'Print', options: ['Screen print', 'DTF', 'Embroidery', 'Sublimation', 'Seller decides'] },
      { key: 'printColours', label: 'Print colours', type: 'colors', group: 'Print' },
      { key: 'printText', label: 'Text to print', type: 'text', group: 'Print', role: 'message' },
      { key: 'deliveryDate', label: 'Needed by', type: 'date', group: 'Delivery', required: true, role: 'deliveryDate' },
      ...fulfilment,
      ...money,
    ],
  },
  furniture: {
    id: 'furniture',
    name: 'Custom furniture',
    noun: 'piece',
    icon: 'armchair',
    groups: ['The piece', 'Finish', 'Delivery', 'Price'],
    fields: [
      { key: 'item', label: 'Item', type: 'select', group: 'The piece', options: ['Bed', 'Wardrobe', 'Dining table', 'Study table', 'Chair', 'Shelf', 'Sofa', 'Other'], required: true },
      { key: 'dimensions', label: 'Dimensions (W × D × H cm)', type: 'text', group: 'The piece', placeholder: '180 × 60 × 75', required: true, role: 'size' },
      { key: 'material', label: 'Material', type: 'select', group: 'Finish', options: ['Sheesham', 'Teak', 'Mango wood', 'Plywood + laminate', 'MDF', 'Metal + wood'], required: true },
      { key: 'finish', label: 'Finish colour', type: 'colors', group: 'Finish', role: 'colours' },
      { key: 'hardware', label: 'Hardware / handles', type: 'text', group: 'Finish' },
      { key: 'deliveryDate', label: 'Needed by', type: 'date', group: 'Delivery', required: true, role: 'deliveryDate' },
      ...fulfilment,
      ...money,
    ],
  },
  jewellery: {
    id: 'jewellery',
    name: 'Custom jewellery',
    noun: 'piece',
    icon: 'gem',
    groups: ['The piece', 'Materials', 'Delivery', 'Price'],
    fields: [
      { key: 'item', label: 'Item', type: 'select', group: 'The piece', options: ['Ring', 'Necklace', 'Pendant', 'Earrings', 'Bracelet', 'Other'], required: true },
      { key: 'size', label: 'Size / length', type: 'text', group: 'The piece', placeholder: 'Ring size 14, 18-inch chain…', required: true, role: 'size' },
      { key: 'metal', label: 'Metal', type: 'select', group: 'Materials', options: ['Gold 22K', 'Gold 18K', 'Silver 925', 'Platinum', 'Rose gold', 'Other'], required: true },
      { key: 'stones', label: 'Stones', type: 'text', group: 'Materials', placeholder: 'Lab diamond 0.5 ct, emerald…' },
      { key: 'engraving', label: 'Engraving', type: 'text', group: 'Materials', max: 40, role: 'message' },
      { key: 'finishColour', label: 'Finish colour', type: 'colors', group: 'Materials', role: 'colours' },
      { key: 'deliveryDate', label: 'Needed by', type: 'date', group: 'Delivery', required: true, role: 'deliveryDate' },
      ...fulfilment,
      ...money,
    ],
  },
};

export const templateFor = (id: string): Template => TEMPLATES[id] ?? TEMPLATES.cake;
export const fieldByRole = (t: Template, role: NonNullable<Field['role']>) => t.fields.find((f) => f.role === role);

export function isFilled(v: unknown): boolean {
  return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
}

export function formatMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatValue(f: Field, v: unknown): string {
  if (!isFilled(v)) return '—';
  if (f.type === 'bool') return v ? 'Yes' : 'No';
  if (f.type === 'money') return formatMoney(Number(v));
  if (f.type === 'colors') return (v as string[]).join(', ');
  if (f.type === 'date') {
    const d = new Date(String(v) + 'T00:00:00');
    return isNaN(+d) ? String(v) : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(v);
}

/** Labels of required fields that are still empty. */
export function missingRequired(templateId: string, spec: Record<string, unknown>): { key: string; label: string; group: string }[] {
  return templateFor(templateId)
    .fields.filter((f) => f.required && !isFilled(spec[f.key]))
    .map((f) => ({ key: f.key, label: f.label, group: f.group }));
}
