import { useRef, type KeyboardEvent } from 'react';
import { tableFeatures, useTable, type ColumnDef } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

export const features = tableFeatures({});
export type MediaColumn<T extends object> = ColumnDef<typeof features, T>;

export function VirtualTable<T extends { uri: string }>({
  items,
  columns,
  rowHeight,
  className = '',
  label,
  currentIndex = -1,
  grid,
}: {
  items: T[];
  columns: MediaColumn<T>[];
  rowHeight: number;
  className?: string;
  label: string;
  currentIndex?: number;
  grid: string;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const table = useTable({
    features,
    data: items,
    columns,
    getRowId: (item, index) => `${item.uri}:${index}`,
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index].id,
    overscan: 5,
  });
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(
        event.key,
      ) ||
      !rows.length
    )
      return;
    const element =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-row-index]')
        : null;
    const from = element
      ? Number(element.dataset.rowIndex)
      : (virtualizer.range?.startIndex ?? 0);
    const page = Math.max(
      1,
      Math.floor((scroll.current?.clientHeight ?? 200) / rowHeight),
    );
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : from +
            (event.key === 'ArrowDown'
              ? 1
              : event.key === 'ArrowUp'
                ? -1
                : event.key === 'PageDown'
                  ? page
                  : -page);
    const index = Math.max(0, Math.min(rows.length - 1, target));
    event.preventDefault();
    virtualizer.scrollToIndex(index, { align: 'auto' });
    requestAnimationFrame(() =>
      scroll.current
        ?.querySelector<HTMLElement>(
          `[data-row-index="${index}"] button, [data-row-index="${index}"]`,
        )
        ?.focus({ preventScroll: true }),
    );
  }
  if (!rows.length) return null;
  return (
    <div ref={scroll} className={`virtual-table ${className}`}>
      <table
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- This table implements arrow-key grid navigation.
        role="grid"
        aria-label={label}
        aria-rowcount={rows.length}
        tabIndex={0}
        onKeyDown={navigate}
        style={{ display: 'block', width: '100%', borderSpacing: 0 }}
      >
        <tbody
          style={{
            display: 'block',
            height: virtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            return (
              <tr
                aria-rowindex={item.index + 1}
                aria-selected={row.index === currentIndex}
                data-row-index={item.index}
                data-index={item.index}
                tabIndex={-1}
                key={row.id}
                className={`virtual-row ${row.index === currentIndex ? 'selected' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: rowHeight,
                  transform: `translateY(${item.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: grid,
                }}
              >
                {row.getAllCells().map((cell) => (
                  // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- Cell content and its buttons supply the accessible names.
                  <td
                    className={`media-cell cell-${cell.column.id}`}
                    key={cell.id}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
