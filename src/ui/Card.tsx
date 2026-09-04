import { useState, type ReactNode } from 'react';

interface Props {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export function Card({
  title,
  defaultOpen = true,
  children,
  className,
  headerAction,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`panel card ${open ? 'open' : 'closed'} ${className ?? ''}`.trim()}>
      <div
        className="card-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span className="card-title">{title}</span>
        <div className="card-head-right">
          {headerAction && <div onClick={(e) => e.stopPropagation()}>{headerAction}</div>}
          <span className="chev">{open ? '▾' : '▸'}</span>
        </div>
      </div>
      {open && <div className="card-body">{children}</div>}
    </div>
  );
}
