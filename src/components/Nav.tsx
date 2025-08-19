'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '@styles/dashboard.module.css';

interface NavLinkProps {
  href: string;
  title: string;
}

const links: NavLinkProps[] = [
  { href: '/dashboard', title: 'CATÁLOGO' },
  { href: '/dashboard/users', title: 'USUARIOS' },
  { href: '/dashboard/report', title: 'REPORTE' },
  { href: '/dashboard/history', title: 'HISTORIAL' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className={styles.aside}>
      {links.map(link => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.link} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {link.title}
          </Link>
        );
      })}
    </aside>
  );
}
