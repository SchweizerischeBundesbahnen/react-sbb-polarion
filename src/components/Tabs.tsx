import { type ReactNode, useId } from 'react';

export interface TabItem {
  /** Stable identity of the tab: what `onSelect` reports and what `activeId` is matched against. */
  id: string;
  /** What the tab shows. A plain string in the normal case. */
  label: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  /** Id of the selected tab. No tab is active while it matches none of them. */
  activeId?: string;
  onSelect: (id: string) => void;
  /**
   * Radio-group name. Only matters when a page carries two tab bars: the browser groups radios by
   * name, so sharing one would let each bar clear the other's selection. Defaults to a unique name.
   */
  name?: string;
  /** Accessible name of the bar as a whole, e.g. "Hooks". */
  ariaLabel?: string;
}

/**
 * The shared tab bar - one tab-bar look for every extension, from the generic framework's `tabs.css`.
 *
 * This is the **JS-driven** variant of that stylesheet: the active tab is marked with a class, which
 * is what a dynamic tab count needs (generic's other variant is pure CSS and is capped at four tabs
 * by its `:nth-of-type` rules). The tabs stay real radio inputs, visually hidden rather than removed,
 * so a keyboard user still reaches the bar and switches tabs with the arrow keys - selecting a radio
 * is what fires `onSelect`.
 *
 * Tabs select something; they do not themselves render what was selected. The caller draws the panel.
 */
export default function Tabs({ items, activeId, onSelect, name, ariaLabel }: Readonly<TabsProps>) {
  const generatedName = useId();

  return (
    <ul className="tabs" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id} className={item.id === activeId ? 'tab active' : 'tab'}>
          <label>
            <input
              type="radio"
              name={name ?? generatedName}
              checked={item.id === activeId}
              onChange={() => onSelect(item.id)}
            />
            <span>{item.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
