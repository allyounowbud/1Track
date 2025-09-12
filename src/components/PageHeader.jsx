// src/components/PageHeader.jsx

/**
 * Props:
 * - title: string (page title)
 * - showUserAvatar: boolean (default true)
 */
export default function PageHeader({ title = "", showUserAvatar = true }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
    </div>
  );
}
